import { isCompletedGame } from "./game-status";
import type { GameDetails, GameId, ScheduledGame } from "./schema";

export type StatisticsThrough = "latest" | number;

interface StatisticsScopeSource {
  readonly schedule: readonly ScheduledGame[];
  readonly games: readonly GameDetails[];
  readonly conflictedDetailGameIds: readonly GameId[];
}

export interface StatisticsScopeCoverage {
  readonly completedGames: number;
  readonly detailedGames: number;
  readonly missingDetailGameIds: readonly GameId[];
  readonly conflictedDetailGameIds: readonly GameId[];
}

export interface StatisticsScope {
  readonly through: StatisticsThrough;
  readonly maximumCompletedTeamGames: number;
  readonly eligibleTeams: ReadonlySet<string>;
  readonly selectedScheduleByTeam: ReadonlyMap<
    string,
    readonly ScheduledGame[]
  >;
  readonly includedTeamGames: ReadonlySet<string>;
  readonly coverage: StatisticsScopeCoverage;
}

const teamGameKey = (team: string, gameId: string): string =>
  `${team}\u0000${gameId}`;

export const statisticsScopeIncludesTeamGame = (
  scope: Readonly<StatisticsScope>,
  team: string,
  gameId: string,
): boolean => scope.includedTeamGames.has(teamGameKey(team, gameId));

export const statisticsThroughOptions = (
  maximumCompletedTeamGames: number,
): readonly number[] =>
  Array.from(
    { length: Math.max(0, maximumCompletedTeamGames - 1) },
    (_, index) => index + 1,
  );

export const normalizeStatisticsThrough = (
  through: StatisticsThrough,
  maximumCompletedTeamGames: number,
): StatisticsThrough => {
  if (
    through === "latest" ||
    maximumCompletedTeamGames === 0 ||
    !Number.isSafeInteger(through) ||
    through < 1 ||
    through >= maximumCompletedTeamGames
  )
    return "latest";
  return through;
};

export const buildStatisticsScope = (
  source: Readonly<StatisticsScopeSource>,
  teamNames: readonly string[],
  requestedThrough: StatisticsThrough,
): StatisticsScope => {
  const teams = [...new Set(teamNames)];
  const completedByTeam = new Map<string, ScheduledGame[]>();
  for (const team of teams) completedByTeam.set(team, []);

  for (const game of source.schedule) {
    if (!isCompletedGame(game)) continue;
    completedByTeam.get(game.home.name)?.push(game);
    completedByTeam.get(game.away.name)?.push(game);
  }

  let maximumCompletedTeamGames = 0;
  for (const team of teams) {
    const count = completedByTeam.get(team)?.length ?? 0;
    maximumCompletedTeamGames = Math.max(maximumCompletedTeamGames, count);
  }

  const through = normalizeStatisticsThrough(
    requestedThrough,
    maximumCompletedTeamGames,
  );
  const eligibleTeams = new Set<string>();
  const selectedScheduleByTeam = new Map<string, readonly ScheduledGame[]>();
  const includedTeamGames = new Set<string>();
  const selectedGameIds = new Set<GameId>();

  for (const team of teams) {
    const completed = completedByTeam.get(team) ?? [];
    const eligible = through === "latest" || completed.length >= through;
    const selected =
      eligible && through !== "latest"
        ? completed.slice(0, through)
        : completed;
    selectedScheduleByTeam.set(team, eligible ? selected : []);
    if (!eligible) continue;
    eligibleTeams.add(team);
    for (const game of selected) {
      includedTeamGames.add(teamGameKey(team, game.id));
      selectedGameIds.add(game.id);
    }
  }

  const acceptedDetailIds = new Set(source.games.map((game) => game.id));
  const missingDetailGameIds = [...selectedGameIds].filter(
    (gameId) => !acceptedDetailIds.has(gameId),
  );
  const conflictedDetailGameIds = source.conflictedDetailGameIds.filter(
    (gameId) => selectedGameIds.has(gameId),
  );
  return {
    through,
    maximumCompletedTeamGames,
    eligibleTeams,
    selectedScheduleByTeam,
    includedTeamGames,
    coverage: {
      completedGames: selectedGameIds.size,
      detailedGames: [...selectedGameIds].filter((gameId) =>
        acceptedDetailIds.has(gameId),
      ).length,
      missingDetailGameIds,
      conflictedDetailGameIds,
    },
  };
};
