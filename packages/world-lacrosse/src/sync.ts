import { access, mkdir, readFile, rename } from "node:fs/promises";
import { dirname, join } from "node:path";

import { Clock, Context, Effect, Layer, Schema } from "effect";

import { buildAnalysisData } from "./analysis-data";
import { ScrapeError, SyncStorageError } from "./error";
import { enrichPlayers } from "./player-enrichment";
import {
  Championship,
  type GameDetails,
  type PlayerDetails,
  type ScheduledGame,
  SyncCounts,
  SyncManifest,
  TournamentData,
} from "./schema";
import {
  DEFAULT_SCHEDULE_URL,
  TOURNAMENT_BASE_URL,
  WorldLacrosseScraper,
} from "./scraper";

export const DEFAULT_SYNC_DIRECTORY = new URL("./generated", import.meta.url)
  .pathname;
export const OFFICIAL_GAME_RECHECK_MS = 12 * 60 * 60 * 1000;
export const TOURNAMENT_RECHECK_MS = 2 * 60 * 60 * 1000;

const PreviousDataset = Schema.Struct({
  championship: Championship,
  tournament: TournamentData,
  manifest: SyncManifest,
});
type PreviousDataset = typeof PreviousDataset.Type;

const storageError = (path: string, operation: string, cause: unknown) =>
  SyncStorageError.make({
    path,
    operation,
    message: `Could not ${operation} ${path}`,
    cause,
  });

export class SyncStore extends Context.Service<SyncStore>()(
  "@laxdb/world-lacrosse/SyncStore",
  {
    make: Effect.succeed({
      readJson: Effect.fn("SyncStore.readJson")((path: string) =>
        Effect.tryPromise({
          try: async (): Promise<string | null> => {
            try {
              await access(path);
            } catch {
              return null;
            }
            return readFile(path, "utf8");
          },
          catch: (cause) => storageError(path, "read", cause),
        }),
      ),
      writeJson: Effect.fn("SyncStore.writeJson")(
        (path: string, value: unknown) =>
          Effect.tryPromise({
            try: async () => {
              await mkdir(dirname(path), { recursive: true });
              const temporary = `${path}.${process.pid}.tmp`;
              await Bun.write(temporary, `${JSON.stringify(value, null, 2)}\n`);
              await rename(temporary, path);
            },
            catch: (cause) => storageError(path, "write", cause),
          }),
      ),
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}

export interface SyncOptions {
  readonly outputDirectory?: string;
  readonly force?: boolean;
  readonly skipPlayerRefresh?: boolean;
}

const decodePreviousDataset = (
  value: string | null,
  path: string,
): Effect.Effect<PreviousDataset | null, SyncStorageError> =>
  value === null
    ? Effect.succeed(null)
    : Schema.decodeUnknownEffect(Schema.fromJsonString(PreviousDataset))(
        value,
      ).pipe(Effect.mapError((cause) => storageError(path, "decode", cause)));

const isActiveStatus = (status: string): boolean =>
  !["OFFICIAL", "UPCOMING", "SCHEDULED"].includes(status.toUpperCase());

const refreshExpired = (
  refreshedAt: string | undefined,
  now: number,
  interval: number,
): boolean => {
  const refreshed = Date.parse(refreshedAt ?? "");
  return !Number.isFinite(refreshed) || now - refreshed >= interval;
};

export const scheduleFingerprint = (game: ScheduledGame): string =>
  JSON.stringify({
    date: game.date,
    time: game.time,
    phase: game.phase,
    venue: game.venue,
    status: game.status,
    homeId: game.home.id,
    homeScore: game.home.score,
    awayId: game.away.id,
    awayScore: game.away.score,
  });

export const shouldRefreshGame = (
  scheduled: ScheduledGame,
  current: GameDetails | undefined,
  refreshedAt: string | undefined,
  previousScheduleFingerprint: string | undefined,
  now: number,
): boolean => {
  if (!current) return true;
  const status = scheduled.status.toUpperCase();
  if (["UPCOMING", "SCHEDULED"].includes(status)) {
    return previousScheduleFingerprint !== scheduleFingerprint(scheduled);
  }
  if (isActiveStatus(status)) return true;
  const lastRefresh = Date.parse(refreshedAt ?? "");
  return (
    current.status.toUpperCase() !== "OFFICIAL" ||
    scheduled.home.score !== current.home.score ||
    scheduled.away.score !== current.away.score ||
    !Number.isFinite(lastRefresh) ||
    now - lastRefresh >= OFFICIAL_GAME_RECHECK_MS
  );
};

export const shouldRefreshGameForSync = (
  force: boolean | undefined,
  scheduled: ScheduledGame,
  current: GameDetails | undefined,
  refreshedAt: string | undefined,
  previousScheduleFingerprint: string | undefined,
  now: number,
): boolean =>
  force === true ||
  shouldRefreshGame(
    scheduled,
    current,
    refreshedAt,
    previousScheduleFingerprint,
    now,
  );

export const shouldRefreshPlayerForSync = (
  force: boolean | undefined,
  playerExists: boolean,
  gameBecameOfficial: boolean,
): boolean => force === true || !playerExists || gameBecameOfficial;

export const shouldSkipPlayerRefresh = (
  requested: boolean | undefined,
  force: boolean | undefined,
  hasPreviousDataset: boolean,
): boolean => requested === true && force !== true && hasPreviousDataset;

const makeTournamentSync = Effect.gen(function* () {
  const scraper = yield* WorldLacrosseScraper;
  const store = yield* SyncStore;

  const syncOnce = Effect.fn("TournamentSync.syncOnce")(function* (
    options: SyncOptions = {},
  ) {
    const startedAt = yield* Clock.currentTimeMillis;
    const outputDirectory = options.outputDirectory ?? DEFAULT_SYNC_DIRECTORY;
    const datasetPath = join(outputDirectory, "dataset.json");
    const previous = options.force
      ? null
      : yield* store
          .readJson(datasetPath)
          .pipe(
            Effect.flatMap((value) =>
              decodePreviousDataset(value, datasetPath),
            ),
          );

    yield* Effect.log("Checking World Lacrosse schedule");
    const schedule = yield* scraper.scrapeSchedule(DEFAULT_SCHEDULE_URL);
    const scheduleIds = new Set(schedule.map((game) => game.id));
    const previousScheduleIds = new Set(
      previous?.tournament.schedule.map((game) => game.id) ?? [],
    );
    const scheduleInvalid =
      scheduleIds.size !== schedule.length ||
      [...previousScheduleIds].some((id) => !scheduleIds.has(id));
    if (scheduleInvalid) {
      return yield* ScrapeError.make({
        url: DEFAULT_SCHEDULE_URL,
        message: `Schedule dropped or duplicated known game IDs (${schedule.length} rows, ${scheduleIds.size} unique); refusing to replace the current dataset`,
      });
    }
    const currentGames = new Map(
      (previous?.championship.games ?? []).map((game) => [game.id, game]),
    );
    const gamesToRefresh = schedule.filter((game) =>
      shouldRefreshGameForSync(
        options.force,
        game,
        currentGames.get(game.id),
        previous?.manifest.gameRefreshedAt[game.id],
        previous?.manifest.scheduleFingerprints[game.id],
        startedAt,
      ),
    );
    yield* Effect.log(
      `Refreshing ${gamesToRefresh.length}/${schedule.length} game pages`,
    );
    const refreshedGames = yield* Effect.forEach(
      gamesToRefresh,
      (game, index) =>
        scraper
          .scrapeGame(game)
          .pipe(
            Effect.tap(() =>
              Effect.log(
                `Scraped game ${index + 1}/${gamesToRefresh.length}: ${game.id}`,
              ),
            ),
          ),
      { concurrency: 6 },
    );
    const officialTransitionGameIds = new Set(
      refreshedGames
        .filter(
          (game) =>
            game.status.toUpperCase() === "OFFICIAL" &&
            currentGames.get(game.id)?.status.toUpperCase() !== "OFFICIAL",
        )
        .map((game) => game.id),
    );
    for (const game of refreshedGames) currentGames.set(game.id, game);
    const games = schedule.flatMap((game) => {
      const details = currentGames.get(game.id);
      return details ? [details] : [];
    });

    const scheduleHasActiveGame = schedule.some((game) =>
      isActiveStatus(game.status),
    );
    const refreshTournament =
      options.force === true ||
      previous === null ||
      officialTransitionGameIds.size > 0 ||
      (!scheduleHasActiveGame &&
        refreshExpired(
          previous.manifest.tournamentRefreshedAt,
          startedAt,
          TOURNAMENT_RECHECK_MS,
        ));
    const tournamentPages =
      refreshTournament || previous === null
        ? yield* Effect.all(
            {
              teams: scraper.scrapeTeams(),
              standings: scraper.scrapeStandings(),
              leaderboards: scraper.scrapeLeaderboards(),
              format: scraper.scrapeFormat(),
            },
            { concurrency: 4 },
          )
        : {
            teams: previous.tournament.teams,
            standings: previous.tournament.standings,
            leaderboards: previous.tournament.leaderboards,
            format: previous.tournament.format,
          };
    const teamDetails =
      refreshTournament || previous === null
        ? yield* Effect.forEach(
            tournamentPages.teams,
            (team, index) =>
              scraper
                .scrapeTeam(team)
                .pipe(
                  Effect.tap(() =>
                    Effect.log(
                      `Scraped team ${index + 1}/${tournamentPages.teams.length}: ${team.name}`,
                    ),
                  ),
                ),
            { concurrency: 6 },
          )
        : previous.tournament.teamDetails;
    yield* Effect.log(
      refreshTournament
        ? "Refreshed tournament tables and team pages"
        : "Reused tournament tables and team pages",
    );

    const playerUrls = new Map<string, string>();
    const officialTransitionPlayerIds = new Set<string>();
    for (const game of games) {
      const becameOfficial = officialTransitionGameIds.has(game.id);
      for (const roster of game.rosters) {
        for (const player of roster.players) {
          if (!player.id) continue;
          const url = new URL("player-details/", TOURNAMENT_BASE_URL);
          url.searchParams.set("player_id", player.id);
          playerUrls.set(player.id, url.toString());
          if (becameOfficial) officialTransitionPlayerIds.add(player.id);
        }
      }
    }
    const currentPlayers = new Map<string, PlayerDetails>(
      (previous?.championship.players ?? []).map((player) => [
        player.id,
        player,
      ]),
    );
    const skipPlayerRefresh = shouldSkipPlayerRefresh(
      options.skipPlayerRefresh,
      options.force,
      previous !== null,
    );
    if (options.skipPlayerRefresh && !skipPlayerRefresh)
      yield* Effect.logWarning(
        "Ignoring --skip-players because force/full initialization requires a complete player dataset",
      );
    const playersToRefresh = skipPlayerRefresh
      ? []
      : [...playerUrls].filter(([id]) =>
          shouldRefreshPlayerForSync(
            options.force,
            currentPlayers.has(id),
            officialTransitionPlayerIds.has(id),
          ),
        );
    yield* Effect.log(
      `Refreshing ${playersToRefresh.length}/${playerUrls.size} player pages`,
    );
    const refreshedPlayers: readonly PlayerDetails[] = yield* Effect.forEach(
      playersToRefresh,
      ([id, url], index) =>
        scraper
          .scrapePlayer(url)
          .pipe(
            Effect.tap(() =>
              Effect.log(
                `Scraped player ${index + 1}/${playersToRefresh.length}: ${id}`,
              ),
            ),
          ),
      { concurrency: 8 },
    );
    for (const player of refreshedPlayers)
      currentPlayers.set(player.id, player);
    const currentRosterPlayers = [...playerUrls.keys()].flatMap((id) => {
      const player = currentPlayers.get(id);
      return player ? [player] : [];
    });
    const players = enrichPlayers(games, currentRosterPlayers);
    const syncedAt = new Date(yield* Clock.currentTimeMillis).toISOString();
    const championship = Championship.make({
      sourceUrl: DEFAULT_SCHEDULE_URL,
      scrapedAt: syncedAt,
      games,
      players,
    });
    const tournament = TournamentData.make({
      sourceUrl: TOURNAMENT_BASE_URL,
      scrapedAt: refreshTournament
        ? syncedAt
        : (previous?.tournament.scrapedAt ?? syncedAt),
      schedule,
      ...tournamentPages,
      teamDetails,
    });
    const analysis = buildAnalysisData(games);
    const finishedAt = yield* Clock.currentTimeMillis;
    const gameRefreshedAt = {
      ...previous?.manifest.gameRefreshedAt,
    };
    for (const game of refreshedGames) gameRefreshedAt[game.id] = syncedAt;
    const playerRefreshedAt = {
      ...previous?.manifest.playerRefreshedAt,
    };
    for (const player of refreshedPlayers)
      playerRefreshedAt[player.id] = syncedAt;
    const activeGames = games.filter((game) =>
      isActiveStatus(game.status),
    ).length;
    const manifest = SyncManifest.make({
      version: 1,
      generation: crypto.randomUUID(),
      syncedAt,
      lastFullSyncAt:
        options.force || !previous
          ? syncedAt
          : previous.manifest.lastFullSyncAt,
      durationMs: finishedAt - startedAt,
      counts: SyncCounts.make({
        games: games.length,
        refreshedGames: refreshedGames.length,
        players: players.length,
        refreshedPlayers: refreshedPlayers.length,
        teams: teamDetails.length,
        completedGames: analysis.games.length,
        activeGames,
      }),
      gameRefreshedAt,
      playerRefreshedAt,
      scheduleFingerprints: Object.fromEntries(
        schedule.map((game) => [game.id, scheduleFingerprint(game)]),
      ),
      tournamentRefreshedAt: refreshTournament
        ? syncedAt
        : (previous?.manifest.tournamentRefreshedAt ?? syncedAt),
    });

    yield* store.writeJson(datasetPath, {
      championship,
      tournament,
      analysis,
      manifest,
    });
    yield* Effect.log(
      `Sync complete: ${games.length} games, ${players.length} players, ${teamDetails.length} teams`,
    );
    return manifest;
  });

  return { syncOnce };
});

export class TournamentSync extends Context.Service<
  TournamentSync,
  Effect.Success<typeof makeTournamentSync>
>()("@laxdb/world-lacrosse/TournamentSync") {
  static readonly layer = Layer.effect(this, makeTournamentSync).pipe(
    Layer.provide(WorldLacrosseScraper.layer),
    Layer.provide(SyncStore.layer),
  );
}
