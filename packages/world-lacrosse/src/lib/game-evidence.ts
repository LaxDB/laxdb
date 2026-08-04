import {
  isActiveGameStatus,
  isFinalGameStatus,
  isUpcomingGameStatus,
} from "./game-status";
import type { GameDetails, ScheduledGame } from "./schema";

const sameStatusClass = (
  schedule: Readonly<ScheduledGame>,
  details: Readonly<GameDetails>,
): boolean =>
  (isFinalGameStatus(schedule.status) &&
    isFinalGameStatus(details.status) &&
    (schedule.status.toUpperCase() === "UNOFFICIAL") ===
      (details.status.toUpperCase() === "UNOFFICIAL")) ||
  (isActiveGameStatus(schedule.status) && isActiveGameStatus(details.status)) ||
  (isUpcomingGameStatus(schedule.status) &&
    isUpcomingGameStatus(details.status));

export const gameDetailMatchesSchedule = (
  schedule: Readonly<ScheduledGame>,
  details: Readonly<GameDetails>,
): boolean =>
  schedule.id === details.id &&
  schedule.home.name === details.home.name &&
  schedule.away.name === details.away.name &&
  schedule.home.score === details.home.score &&
  schedule.away.score === details.away.score &&
  sameStatusClass(schedule, details);
