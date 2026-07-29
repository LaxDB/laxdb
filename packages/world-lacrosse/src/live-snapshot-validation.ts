import type { LiveSchedule } from "./schema";
import {
  expectedTournamentGames,
  isExpectedTournamentGameCount,
} from "./tournament-mode";

export type LiveScheduleValidationCode =
  | "invalid-updated-at"
  | "invalid-next-refresh-at"
  | "reversed-refresh-window"
  | "future-generation"
  | "regressed-generation"
  | "unexpected-game-count"
  | "duplicate-game-ids";

export class LiveScheduleValidationError extends Error {
  readonly code: LiveScheduleValidationCode;

  constructor(code: LiveScheduleValidationCode, message: string) {
    super(message);
    this.name = "LiveScheduleValidationError";
    this.code = code;
  }
}

const maximumClockSkewMs = 5 * 60_000;

const timestamp = (
  value: string,
  code: "invalid-updated-at" | "invalid-next-refresh-at",
): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new LiveScheduleValidationError(
      code,
      `Live schedule contains an invalid timestamp: ${value}`,
    );
  }
  return parsed;
};

export const validateLiveScheduleCandidate = (
  candidate: Readonly<LiveSchedule>,
  previous?: Readonly<LiveSchedule>,
  now: number = Date.now(),
): LiveSchedule => {
  const updatedAt = timestamp(candidate.updatedAt, "invalid-updated-at");
  const nextRefreshAt = timestamp(
    candidate.nextRefreshAt,
    "invalid-next-refresh-at",
  );
  if (nextRefreshAt < updatedAt) {
    throw new LiveScheduleValidationError(
      "reversed-refresh-window",
      "Live schedule nextRefreshAt precedes updatedAt",
    );
  }
  if (updatedAt > now + maximumClockSkewMs) {
    throw new LiveScheduleValidationError(
      "future-generation",
      "Live schedule is implausibly far in the future",
    );
  }
  if (
    previous !== undefined &&
    updatedAt < timestamp(previous.updatedAt, "invalid-updated-at")
  ) {
    throw new LiveScheduleValidationError(
      "regressed-generation",
      "Live schedule is older than the last accepted generation",
    );
  }
  if (!isExpectedTournamentGameCount(candidate.schedule.length)) {
    throw new LiveScheduleValidationError(
      "unexpected-game-count",
      `Live schedule contains ${candidate.schedule.length}/${expectedTournamentGames} expected games`,
    );
  }
  const gameIds = new Set(candidate.schedule.map((game) => game.id));
  if (gameIds.size !== candidate.schedule.length) {
    throw new LiveScheduleValidationError(
      "duplicate-game-ids",
      "Live schedule contains duplicate game IDs",
    );
  }
  return candidate;
};
