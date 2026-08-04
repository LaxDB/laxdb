import { activeGameStatusLabel, isInProgressGameStatus } from "./game-status";
import {
  formatMatchClock,
  matchPeriodDuration,
  parseMatchClock,
} from "./match-clock";
import type { GameDetails } from "./schema";

export interface LiveGameClock {
  readonly period: string;
  readonly clock: string;
}

const periodLabel = (period: string): string | null => {
  const quarter = period.match(/^Quarter\s+([1-4])$/iu);
  if (quarter) return `Q${quarter[1]}`;
  const overtime = period.match(/^(?:OT|Overtime\s*)(\d+)$/iu);
  if (overtime) return `OT${overtime[1]}`;
  const compact = period.match(/^(Q[1-4]|OT\d+)$/iu);
  return compact ? (compact[1]?.toUpperCase() ?? null) : null;
};

export const latestLiveGameClock = (
  game: Readonly<Pick<GameDetails, "status" | "plays">>,
): LiveGameClock | null => {
  if (!isInProgressGameStatus(game.status)) return null;
  const latestPlay = game.plays.at(-1);
  if (!latestPlay) return null;
  const period = periodLabel(latestPlay.period);
  const duration = matchPeriodDuration(latestPlay.period);
  const remaining = parseMatchClock(latestPlay.time);
  if (
    period === null ||
    duration === null ||
    remaining === null ||
    remaining > duration
  )
    return null;
  return { period, clock: formatMatchClock(remaining) };
};

export const activeGameStatusWithClock = (
  status: string,
  scheduledPeriod: string | null | undefined,
  game: Readonly<Pick<GameDetails, "status" | "plays">> | undefined,
): string => {
  const fallback = activeGameStatusLabel(status, scheduledPeriod);
  if (!isInProgressGameStatus(status) || game === undefined) return fallback;
  const clock = latestLiveGameClock(game);
  if (clock === null) return fallback;
  const expectedPeriod = scheduledPeriod ? periodLabel(scheduledPeriod) : null;
  if (expectedPeriod === null || expectedPeriod !== clock.period)
    return fallback;
  const state = status.toUpperCase() === "BREAK" ? "Break" : "Live";
  return `${clock.period} · ${clock.clock} · ${state}`;
};
