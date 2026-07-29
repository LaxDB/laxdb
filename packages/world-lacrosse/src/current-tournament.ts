import { Schema } from "effect";
import { useMemo } from "react";

import { championship } from "./championship-data";
import { gameDetailMatchesSchedule } from "./game-evidence";
import { isCompletedGame, isUpcomingGameStatus } from "./game-status";
import { useLiveSchedule } from "./live-schedule";
import { GameDetails, GameId, ScheduledGame } from "./schema";
import type { LiveSchedule } from "./schema";
import { tournament } from "./tournament-data";

const SnapshotSource = Schema.Union([
  Schema.Literal("live"),
  Schema.Literal("bundled"),
]);
const SnapshotFreshness = Schema.Union([
  Schema.Literal("fresh"),
  Schema.Literal("degraded"),
  Schema.Literal("fallback"),
]);

export class CurrentTournamentSnapshot extends Schema.Class<CurrentTournamentSnapshot>(
  "WorldLacrosseCurrentTournamentSnapshot",
)({
  source: SnapshotSource,
  freshness: SnapshotFreshness,
  updatedAt: Schema.String,
  schedule: Schema.Array(ScheduledGame),
  games: Schema.Array(GameDetails),
  completedGames: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0),
  ),
  detailedGames: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0),
  ),
  missingDetailGameIds: Schema.Array(GameId),
  conflictedDetailGameIds: Schema.Array(GameId),
  provisional: Schema.Boolean,
  issues: Schema.Array(Schema.String),
}) {}

const duplicateIds = <T extends { readonly id: string }>(
  entries: readonly T[],
): ReadonlySet<string> => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) duplicates.add(entry.id);
    else seen.add(entry.id);
  }
  return duplicates;
};

const createSnapshot = ({
  source,
  freshness,
  updatedAt,
  schedule,
  candidateGames,
  initialIssues,
}: {
  readonly source: "live" | "bundled";
  readonly freshness: "fresh" | "degraded" | "fallback";
  readonly updatedAt: string;
  readonly schedule: readonly ScheduledGame[];
  readonly candidateGames: readonly GameDetails[];
  readonly initialIssues: readonly string[];
}): CurrentTournamentSnapshot => {
  const scheduleById = new Map(schedule.map((game) => [game.id, game]));
  const duplicateDetailIds = duplicateIds(candidateGames);
  const conflicts = new Set<GameId>();
  const games = candidateGames.filter((details) => {
    const scheduled = scheduleById.get(details.id);
    if (scheduled !== undefined && isUpcomingGameStatus(scheduled.status))
      return false;
    if (
      scheduled === undefined ||
      duplicateDetailIds.has(details.id) ||
      !gameDetailMatchesSchedule(scheduled, details)
    ) {
      conflicts.add(details.id);
      return false;
    }
    return true;
  });
  const completed = schedule.filter(isCompletedGame);
  const detailIds = new Set(games.map((game) => game.id));
  const missingDetailGameIds = completed
    .filter((game) => !detailIds.has(game.id))
    .map((game) => game.id);
  const issues = [...initialIssues];
  if (duplicateDetailIds.size > 0) issues.push("duplicate-detail-game-ids");
  if (conflicts.size > 0) issues.push("schedule-detail-conflict");
  if (missingDetailGameIds.length > 0)
    issues.push("completed-game-details-missing");
  return CurrentTournamentSnapshot.make({
    source,
    freshness:
      issues.length === 0
        ? freshness
        : source === "bundled"
          ? "fallback"
          : "degraded",
    updatedAt,
    schedule,
    games,
    completedGames: completed.length,
    detailedGames: completed.filter((game) => detailIds.has(game.id)).length,
    missingDetailGameIds,
    conflictedDetailGameIds: [...conflicts],
    provisional: completed.some(
      (game) => game.status.toUpperCase() === "UNOFFICIAL",
    ),
    issues,
  });
};

export const buildCurrentTournamentSnapshot = (
  liveSchedule: Readonly<LiveSchedule>,
  liveReady: boolean,
): CurrentTournamentSnapshot => {
  if (!liveReady)
    return createSnapshot({
      source: "bundled",
      freshness: "fallback",
      updatedAt: championship.scrapedAt,
      schedule: tournament.schedule,
      candidateGames: championship.games,
      initialIssues: ["live-feed-not-ready"],
    });

  const scheduleDuplicates = duplicateIds(liveSchedule.schedule);
  const bundledIds = new Set(tournament.schedule.map((game) => game.id));
  const liveIds = new Set(liveSchedule.schedule.map((game) => game.id));
  const missingBundledIds = [...bundledIds].filter((id) => !liveIds.has(id));
  if (scheduleDuplicates.size > 0 || missingBundledIds.length > 0)
    return createSnapshot({
      source: "bundled",
      freshness: "fallback",
      updatedAt: championship.scrapedAt,
      schedule: tournament.schedule,
      candidateGames: championship.games,
      initialIssues: [
        scheduleDuplicates.size > 0
          ? "live-schedule-duplicate-game-ids"
          : "live-schedule-missing-known-games",
      ],
    });

  return createSnapshot({
    source: "live",
    freshness: "fresh",
    updatedAt: liveSchedule.updatedAt,
    schedule: liveSchedule.schedule,
    candidateGames: liveSchedule.games,
    initialIssues: [],
  });
};

export const useCurrentTournamentSnapshot = (): CurrentTournamentSnapshot => {
  const query = useLiveSchedule();
  const liveReady = query.dataUpdatedAt > 0;
  return useMemo(
    () => buildCurrentTournamentSnapshot(query.data, liveReady),
    [liveReady, query.data],
  );
};
