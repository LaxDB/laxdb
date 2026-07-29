import { Schema } from "effect";

import { gameDetailMatchesSchedule } from "./game-evidence";
import { isActiveGameStatus, isFinalGameStatus } from "./game-status";
import { parseCurrentPeriod, parseGameDetails, parseSchedule } from "./parser";
import { LiveSchedule, ScheduledGame } from "./schema";
import type { GameDetails } from "./schema";
import { DEFAULT_SCHEDULE_URL, MIN_REQUEST_INTERVAL_MS } from "./scraper";

interface Env {
  readonly SCORES: KVNamespace;
}

const scheduleKey = "world-lacrosse:live-schedule:v1";
const liveRefreshMs = 55_000;
const idleRefreshMs = 115_000;
const expectedTournamentGames = 44;
const decodeLiveSchedule = Schema.decodeUnknownSync(LiveSchedule);
const wait = (duration: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, duration);
  });

interface EnrichedSchedule {
  readonly schedule: readonly ScheduledGame[];
  readonly games: readonly GameDetails[];
  readonly detailCursor: number;
  readonly gameUpdatedAt: Readonly<Record<string, string>>;
}

const gameChanged = (scheduled: ScheduledGame, details: GameDetails): boolean =>
  scheduled.status !== details.status ||
  scheduled.home.score !== details.home.score ||
  scheduled.away.score !== details.away.score;

export const detailReconciles = gameDetailMatchesSchedule;

export const candidateScheduleIsSafe = (
  candidate: readonly ScheduledGame[],
  existing: readonly ScheduledGame[],
): boolean => {
  const candidateIds = new Set(candidate.map((game) => game.id));
  return (
    candidateIds.size === candidate.length &&
    existing.every((game) => candidateIds.has(game.id))
  );
};

const enrichLiveGames = async (
  schedule: readonly ScheduledGame[],
  existingGames: readonly GameDetails[],
  existingGameUpdatedAt: Readonly<Record<string, string>>,
  detailCursor: number,
  lastRequestStartedAt: number,
): Promise<EnrichedSchedule> => {
  const enrichedSchedule: ScheduledGame[] = [];
  const enrichedGames: GameDetails[] = [];
  const gameUpdatedAt: Record<string, string> = { ...existingGameUpdatedAt };
  const hasActiveGame = schedule.some((game) =>
    isActiveGameStatus(game.status),
  );
  const completedGames = schedule.filter((game) =>
    isFinalGameStatus(game.status),
  );
  const missingFinal = completedGames.find(
    (game) => !existingGames.some((details) => details.id === game.id),
  );
  const correctionCandidate =
    !hasActiveGame && missingFinal === undefined && completedGames.length > 0
      ? completedGames[detailCursor % completedGames.length]
      : undefined;
  const maintenanceGameId = missingFinal?.id ?? correctionCandidate?.id;
  const nextDetailCursor =
    correctionCandidate === undefined
      ? detailCursor
      : (detailCursor + 1) % completedGames.length;
  let previousRequestStartedAt = lastRequestStartedAt;

  for (const game of schedule) {
    const existingGame = existingGames.find((item) => item.id === game.id);
    const shouldRefresh =
      game.id === maintenanceGameId ||
      isActiveGameStatus(game.status) ||
      (existingGame !== undefined && gameChanged(game, existingGame));

    if (!shouldRefresh) {
      enrichedSchedule.push(game);
      if (existingGame !== undefined && detailReconciles(game, existingGame))
        enrichedGames.push(existingGame);
      continue;
    }

    const delay =
      MIN_REQUEST_INTERVAL_MS - (Date.now() - previousRequestStartedAt);
    if (delay > 0) await wait(delay);
    previousRequestStartedAt = Date.now();

    try {
      const response = await fetch(game.url, {
        signal: AbortSignal.timeout(20_000),
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent":
            "laxdb-world-lacrosse-live/1.0 (+https://world.laxdb.io)",
        },
      });
      if (!response.ok) {
        throw new Error(`Game ${game.id} returned HTTP ${response.status}`);
      }
      const html = await response.text();
      const scheduled = ScheduledGame.make({
        id: game.id,
        url: game.url,
        date: game.date,
        time: game.time,
        phase: game.phase,
        venue: game.venue,
        status: game.status,
        period: parseCurrentPeriod(html),
        home: game.home,
        away: game.away,
      });
      const details = parseGameDetails(html, scheduled);
      enrichedSchedule.push(scheduled);
      if (!detailReconciles(scheduled, details))
        throw new Error(
          `Game ${game.id} schedule and detail evidence do not reconcile`,
        );
      enrichedGames.push(details);
      gameUpdatedAt[game.id] = new Date().toISOString();
    } catch (cause) {
      console.error(`Could not enrich live game ${game.id}`, cause);
      if (!enrichedSchedule.some((item) => item.id === game.id))
        enrichedSchedule.push(game);
      if (existingGame !== undefined && detailReconciles(game, existingGame))
        enrichedGames.push(existingGame);
    }
  }

  return {
    schedule: enrichedSchedule,
    games: enrichedGames,
    detailCursor: nextDetailCursor,
    gameUpdatedAt,
  };
};

const readSchedule = async (env: Env): Promise<LiveSchedule | null> => {
  const stored: unknown = await env.SCORES.get(scheduleKey, "json");
  if (stored === null) return null;
  try {
    return decodeLiveSchedule(stored);
  } catch (cause) {
    console.error("Stored live schedule failed schema validation", cause);
    return null;
  }
};

const refreshSchedule = async (env: Env): Promise<LiveSchedule> => {
  const existing = await readSchedule(env);
  const now = Date.now();
  if (existing !== null && Date.parse(existing.nextRefreshAt) > now) {
    return existing;
  }

  const scheduleRequestStartedAt = Date.now();
  const response = await fetch(DEFAULT_SCHEDULE_URL, {
    signal: AbortSignal.timeout(20_000),
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "laxdb-world-lacrosse-live/1.0 (+https://world.laxdb.io)",
    },
  });
  if (!response.ok) {
    throw new Error(`World Lacrosse returned HTTP ${response.status}`);
  }

  const scrapedSchedule = parseSchedule(
    await response.text(),
    DEFAULT_SCHEDULE_URL,
  );
  if (scrapedSchedule.length < expectedTournamentGames)
    throw new Error(
      `Candidate live schedule returned ${scrapedSchedule.length}/${expectedTournamentGames} expected games`,
    );
  if (
    existing !== null &&
    !candidateScheduleIsSafe(scrapedSchedule, existing.schedule)
  )
    throw new Error(
      "Candidate live schedule dropped or duplicated known game IDs",
    );
  const enriched = await enrichLiveGames(
    scrapedSchedule,
    existing?.games ?? [],
    existing?.gameUpdatedAt ?? {},
    existing?.detailCursor ?? 0,
    scheduleRequestStartedAt,
  );
  const hasLiveGame = enriched.schedule.some((game) =>
    isActiveGameStatus(game.status),
  );
  const payload = LiveSchedule.make({
    updatedAt: new Date(now).toISOString(),
    nextRefreshAt: new Date(
      now + (hasLiveGame ? liveRefreshMs : idleRefreshMs),
    ).toISOString(),
    schedule: enriched.schedule,
    games: enriched.games,
    detailCursor: enriched.detailCursor,
    gameUpdatedAt: enriched.gameUpdatedAt,
  });
  const latest = await readSchedule(env);
  if (latest !== null && Date.parse(latest.updatedAt) > now) return latest;
  await env.SCORES.put(scheduleKey, JSON.stringify(payload));
  return payload;
};

const jsonResponse = (body: LiveSchedule, status = 200): Response =>
  Response.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=15, stale-while-revalidate=45",
    },
  });

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/schedule") {
      return new Response("Not found", { status: 404 });
    }

    const stored = await readSchedule(env);
    if (stored !== null) return jsonResponse(stored);

    return Response.json(
      { error: "Live scores are initializing" },
      {
        status: 503,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      },
    );
  },

  scheduled(_controller, env, context): void {
    context.waitUntil(
      refreshSchedule(env).catch((cause: unknown) => {
        console.error("World Lacrosse live score refresh failed", cause);
      }),
    );
  },
} satisfies ExportedHandler<Env>;
