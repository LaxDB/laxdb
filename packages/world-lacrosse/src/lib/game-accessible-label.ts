import {
  finalGameStatusLabel,
  isActiveGameStatus,
  isFinalGameStatus,
} from "./game-status";
import { activeGameStatusWithClock } from "./live-game-clock";
import type { GameDetails, ScheduledGame } from "./schema";

export const gameAccessibleLabel = (
  game: Readonly<ScheduledGame>,
  details?: Readonly<GameDetails>,
): string => {
  const status = isActiveGameStatus(game.status)
    ? activeGameStatusWithClock(game.status, game.period, details)
    : isFinalGameStatus(game.status)
      ? finalGameStatusLabel(game.status)
      : game.status;
  return `${game.home.name} ${game.home.score ?? ""} vs ${game.away.name} ${game.away.score ?? ""}, ${status}, ${game.date} at ${game.time}, ${game.phase}, ${game.venue}`;
};
