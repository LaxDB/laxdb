import { championship } from "./championship-data";
import type { GameDetails, PlayerDetails, ScheduledGame } from "./schema";
import { tournament } from "./tournament-data";

export interface ArchivedTournamentData {
  readonly updatedAt: string;
  readonly schedule: readonly ScheduledGame[];
  readonly games: readonly GameDetails[];
  readonly players: readonly PlayerDetails[];
  readonly expectedPlayerIds: readonly string[];
}

/**
 * Complete generated event data. Browser code may consume this only when the
 * tournament is explicitly configured as archived.
 */
export const archivedTournamentData: ArchivedTournamentData = {
  updatedAt: championship.scrapedAt,
  schedule: tournament.schedule,
  games: championship.games,
  players: championship.players,
  expectedPlayerIds: tournament.teamDetails.flatMap((team) =>
    team.players.flatMap((player) => (player.Id ? [player.Id] : [])),
  ),
};
