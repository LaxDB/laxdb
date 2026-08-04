import { isActiveGameStatus, isUpcomingGameStatus } from "./game-status";
import { scheduleDateLabel } from "./schedule-date";
import type { ScheduledGame } from "./schema";

export interface MatchdaySelection {
  readonly date: string | null;
  readonly games: readonly ScheduledGame[];
}

export const selectMatchday = (
  schedule: readonly ScheduledGame[],
  now: Date,
): MatchdaySelection => {
  const localDate = scheduleDateLabel(now);
  const date =
    schedule.find((game) => game.date === localDate)?.date ??
    schedule.find((game) => isActiveGameStatus(game.status))?.date ??
    schedule.find((game) => isUpcomingGameStatus(game.status))?.date ??
    schedule.at(-1)?.date ??
    null;
  return {
    date,
    games: date === null ? [] : schedule.filter((game) => game.date === date),
  };
};
