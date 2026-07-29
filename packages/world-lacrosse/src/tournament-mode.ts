import { Schema } from "effect";

export const TournamentMode = Schema.Union([
  Schema.Literal("live"),
  Schema.Literal("archived"),
]);
export type TournamentMode = typeof TournamentMode.Type;

/**
 * Change this only after the final tournament dataset has been synced,
 * validated, committed, and is ready to replace the live worker.
 */
export const tournamentMode: TournamentMode = "live";

export const expectedTournamentGames = 44;

export const isExpectedTournamentGameCount = (count: number): boolean =>
  count === expectedTournamentGames;

export const tournamentRefreshCrons = (
  stage: string,
  productionStage: string,
  mode: TournamentMode = tournamentMode,
): string[] =>
  stage === productionStage && mode === "live" ? ["* * * * *"] : [];
