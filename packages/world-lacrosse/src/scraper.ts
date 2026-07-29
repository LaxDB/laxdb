import {
  Clock,
  Context,
  Duration,
  Effect,
  Layer,
  Schedule,
  Semaphore,
} from "effect";

import { FetchError, ScrapeError } from "./error";
import {
  parseFormat,
  parseGameDetails,
  parseLeaderboards,
  parsePlayerDetails,
  parseSchedule,
  parseStandings,
  parseTeamDetails,
  parseTournamentTeams,
} from "./parser";
import { enrichPlayers } from "./player-enrichment";
import {
  Championship,
  type PlayerDetails,
  type ScheduledGame,
  type TournamentTeam,
} from "./schema";

export const TOURNAMENT_BASE_URL =
  "https://worldlacrosse.sport/events/2026-world-lacrosse-womens-championship/";
export const DEFAULT_SCHEDULE_URL = `${TOURNAMENT_BASE_URL}schedule/`;
export const TEAMS_URL = `${TOURNAMENT_BASE_URL}teams/`;
export const STANDINGS_URL = `${TOURNAMENT_BASE_URL}standings/`;
export const STATISTICS_URL = `${TOURNAMENT_BASE_URL}tournament-stats/`;
export const FORMAT_URL = `${TOURNAMENT_BASE_URL}format-and-progression/`;

// World Lacrosse publishes `Crawl-delay: 10` in robots.txt.
export const MIN_REQUEST_INTERVAL_MS = 10_000;

export class HtmlClient extends Context.Service<HtmlClient>()(
  "@laxdb/world-lacrosse/HtmlClient",
  {
    make: Effect.gen(function* () {
      const semaphore = yield* Semaphore.make(1);
      let nextRequestAt = 0;

      const fetchHtml = Effect.fn("HtmlClient.fetchHtml")((url: string) =>
        Effect.tryPromise({
          try: async () => {
            const response = await fetch(url, {
              signal: AbortSignal.timeout(20_000),
              headers: {
                Accept: "text/html,application/xhtml+xml",
                "User-Agent":
                  "laxdb-world-lacrosse-sync/1.0 (+https://world.laxdb.io)",
              },
            });
            if (!response.ok) {
              throw FetchError.make({
                url,
                status: response.status,
                message: `World Lacrosse returned HTTP ${response.status}`,
              });
            }
            return response.text();
          },
          catch: (cause) =>
            cause instanceof FetchError
              ? cause
              : FetchError.make({
                  url,
                  message: `Could not fetch ${url}`,
                  cause,
                }),
        }).pipe(
          Effect.retry({
            schedule: Schedule.exponential("10 seconds"),
            times: 2,
            while: (error) =>
              error.status === undefined ||
              error.status === 429 ||
              error.status >= 500,
          }),
        ),
      );

      const get = Effect.fn("HtmlClient.get")((url: string) =>
        semaphore.withPermit(
          Effect.gen(function* () {
            const now = yield* Clock.currentTimeMillis;
            if (now < nextRequestAt) {
              yield* Effect.sleep(Duration.millis(nextRequestAt - now));
            }
            const startedAt = yield* Clock.currentTimeMillis;
            nextRequestAt = startedAt + MIN_REQUEST_INTERVAL_MS;
            return yield* fetchHtml(url);
          }),
        ),
      );

      return { get };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}

const parseScheduleEffect = (html: string, url: string) =>
  Effect.try({
    try: () => parseSchedule(html, url),
    catch: (cause) =>
      cause instanceof ScrapeError
        ? cause
        : ScrapeError.make({ url, message: String(cause) }),
  });

const parsePlayerEffect = (html: string, url: string) =>
  Effect.try({
    try: () => parsePlayerDetails(html, url),
    catch: (cause) =>
      cause instanceof ScrapeError
        ? cause
        : ScrapeError.make({ url, message: String(cause) }),
  });

const parseDetailsEffect = (html: string, game: ScheduledGame) =>
  Effect.try({
    try: () => parseGameDetails(html, game),
    catch: (cause) =>
      cause instanceof ScrapeError
        ? cause
        : ScrapeError.make({ url: game.url, message: String(cause) }),
  });

const makeWorldLacrosseScraper = Effect.gen(function* () {
  const htmlClient = yield* HtmlClient;

  const scrapeSchedule = Effect.fn("WorldLacrosseScraper.scrapeSchedule")(
    function* (url: string = DEFAULT_SCHEDULE_URL) {
      const html = yield* htmlClient.get(url);
      return yield* parseScheduleEffect(html, url);
    },
  );

  const scrapeGame = Effect.fn("WorldLacrosseScraper.scrapeGame")(function* (
    game: ScheduledGame,
  ) {
    const html = yield* htmlClient.get(game.url);
    return yield* parseDetailsEffect(html, game);
  });

  const scrapeTeams = Effect.fn("WorldLacrosseScraper.scrapeTeams")(function* (
    url: string = TEAMS_URL,
  ) {
    const html = yield* htmlClient.get(url);
    return yield* Effect.try({
      try: () => parseTournamentTeams(html, url),
      catch: (cause) =>
        cause instanceof ScrapeError
          ? cause
          : ScrapeError.make({ url, message: String(cause) }),
    });
  });

  const scrapeStandings = Effect.fn("WorldLacrosseScraper.scrapeStandings")(
    function* (url: string = STANDINGS_URL) {
      const html = yield* htmlClient.get(url);
      return yield* Effect.try({
        try: () => parseStandings(html, url),
        catch: (cause) =>
          cause instanceof ScrapeError
            ? cause
            : ScrapeError.make({ url, message: String(cause) }),
      });
    },
  );

  const scrapeLeaderboards = Effect.fn(
    "WorldLacrosseScraper.scrapeLeaderboards",
  )(function* (url: string = STATISTICS_URL) {
    const html = yield* htmlClient.get(url);
    return yield* Effect.try({
      try: () => parseLeaderboards(html, url),
      catch: (cause) =>
        cause instanceof ScrapeError
          ? cause
          : ScrapeError.make({ url, message: String(cause) }),
    });
  });

  const scrapeTeam = Effect.fn("WorldLacrosseScraper.scrapeTeam")(function* (
    team: TournamentTeam,
  ) {
    const html = yield* htmlClient.get(team.sourceUrl);
    return yield* Effect.try({
      try: () => parseTeamDetails(html, team),
      catch: (cause) =>
        cause instanceof ScrapeError
          ? cause
          : ScrapeError.make({ url: team.sourceUrl, message: String(cause) }),
    });
  });

  const scrapeFormat = Effect.fn("WorldLacrosseScraper.scrapeFormat")(
    function* (url: string = FORMAT_URL) {
      const html = yield* htmlClient.get(url);
      return yield* Effect.try({
        try: () => parseFormat(html, url),
        catch: (cause) =>
          cause instanceof ScrapeError
            ? cause
            : ScrapeError.make({ url, message: String(cause) }),
      });
    },
  );

  const scrapePlayer = Effect.fn("WorldLacrosseScraper.scrapePlayer")(
    function* (url: string) {
      const html = yield* htmlClient.get(url);
      return yield* parsePlayerEffect(html, url);
    },
  );

  const scrape = Effect.fn("WorldLacrosseScraper.scrape")(function* (
    scheduleUrl: string = DEFAULT_SCHEDULE_URL,
  ) {
    const scheduledGames = yield* scrapeSchedule(scheduleUrl);
    yield* Effect.log(`Found ${scheduledGames.length} games`);

    const games = yield* Effect.forEach(
      scheduledGames,
      (scheduled, index) =>
        Effect.gen(function* () {
          yield* Effect.log(
            `Scraping game ${index + 1}/${scheduledGames.length}: ${scheduled.id}`,
          );
          return yield* scrapeGame(scheduled);
        }),
      { concurrency: 4 },
    );

    const playerUrls = new Map<string, string>();
    for (const game of games) {
      for (const roster of game.rosters) {
        for (const player of roster.players) {
          if (!player.id || playerUrls.has(player.id)) continue;
          const url = new URL("../player-details/", game.url);
          url.searchParams.set("player_id", player.id);
          playerUrls.set(player.id, url.toString());
        }
      }
    }
    yield* Effect.log(`Found ${playerUrls.size} unique players`);
    const scrapedPlayers: readonly PlayerDetails[] = yield* Effect.forEach(
      [...playerUrls.values()],
      (url, index) =>
        scrapePlayer(url).pipe(
          Effect.tap(() =>
            Effect.log(`Scraped player ${index + 1}/${playerUrls.size}`),
          ),
        ),
      { concurrency: 4 },
    );

    const players = enrichPlayers(games, scrapedPlayers);

    return Championship.make({
      sourceUrl: scheduleUrl,
      scrapedAt: new Date().toISOString(),
      games,
      players,
    });
  });

  return {
    scrape,
    scrapeFormat,
    scrapeGame,
    scrapeLeaderboards,
    scrapePlayer,
    scrapeSchedule,
    scrapeStandings,
    scrapeTeam,
    scrapeTeams,
  };
});

export class WorldLacrosseScraper extends Context.Service<
  WorldLacrosseScraper,
  Effect.Success<typeof makeWorldLacrosseScraper>
>()("@laxdb/world-lacrosse/WorldLacrosseScraper") {
  static readonly layer = Layer.effect(this, makeWorldLacrosseScraper).pipe(
    Layer.provide(HtmlClient.layer),
  );
}
