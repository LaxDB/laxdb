import { Schema } from "effect";

import { GamePreview, GamePreviewTeam } from "./game-preview-schema";
import { isUpcomingGameStatus } from "./game-status";
import type { GameDetails, ScheduledGame, Team } from "./schema";
import { buildTeamAnalysis } from "./team-analysis";
import type { TeamAnalysis } from "./team-analysis-schema";

interface TeamPool {
  readonly name: string;
  readonly pool: string;
}

interface GamePreviewSource {
  readonly updatedAt: string;
  readonly schedule: readonly ScheduledGame[];
  readonly games: readonly GameDetails[];
}

const previewTeam = (
  team: Readonly<Team>,
  analysis: Readonly<TeamAnalysis>,
): GamePreviewTeam =>
  GamePreviewTeam.make({
    id: team.id,
    code: team.code ?? team.name,
    name: team.name,
    flagUrl: team.flagUrl,
    eligibleGames: analysis.eligibleGames,
    wins: analysis.context?.wins ?? 0,
    losses: analysis.context?.losses ?? 0,
    benchmarks: analysis.benchmarks,
    recent: analysis.context?.recent ?? [],
  });

export const buildGamePreview = (
  gameId: string,
  source: Readonly<GamePreviewSource>,
  teamPools: readonly TeamPool[],
): GamePreview | null => {
  const targetIndex = source.schedule.findIndex((game) => game.id === gameId);
  const target = source.schedule[targetIndex];
  const knownTeams = new Set(teamPools.map((team) => team.name));
  if (
    targetIndex < 0 ||
    target === undefined ||
    !isUpcomingGameStatus(target.status) ||
    !knownTeams.has(target.home.name) ||
    !knownTeams.has(target.away.name) ||
    target.home.name === target.away.name
  )
    return null;

  const priorSchedule = source.schedule.slice(0, targetIndex);
  const priorIds = new Set(priorSchedule.map((game) => game.id));
  const priorSource: GamePreviewSource = {
    updatedAt: source.updatedAt,
    schedule: priorSchedule,
    games: source.games.filter((game) => priorIds.has(game.id)),
  };
  const homeAnalysis = buildTeamAnalysis(
    target.home.name,
    priorSource,
    teamPools,
  );
  const awayAnalysis = buildTeamAnalysis(
    target.away.name,
    priorSource,
    teamPools,
  );
  if (homeAnalysis.eligibleGames === 0 || awayAnalysis.eligibleGames === 0)
    return null;

  const eligibleIds = new Set([
    ...homeAnalysis.games
      .filter((game) => game.eligible)
      .map((game) => game.gameId),
    ...awayAnalysis.games
      .filter((game) => game.eligible)
      .map((game) => game.gameId),
  ]);
  const latestEligibleDate =
    priorSchedule.toReversed().find((game) => eligibleIds.has(game.id))?.date ??
    null;

  return Schema.decodeUnknownSync(GamePreview)({
    gameId: target.id,
    generatedFrom: source.updatedAt,
    scheduledDate: target.date,
    priorScheduleGames: priorSchedule.length,
    latestEligibleDate,
    home: previewTeam(target.home, homeAnalysis),
    away: previewTeam(target.away, awayAnalysis),
  });
};
