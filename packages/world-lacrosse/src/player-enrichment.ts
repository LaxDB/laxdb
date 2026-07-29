import { PlayerDetails, PlayerGameLog, type GameDetails } from "./schema";

export const enrichPlayers = (
  games: readonly GameDetails[],
  scrapedPlayers: readonly PlayerDetails[],
): readonly PlayerDetails[] => {
  const goalkeeperStats = new Map<
    string,
    { gamesStarted: number; periodStarts: number }
  >();
  const playerEventTotals = new Map<string, { goals: number; shots: number }>();
  const playerGameEvents = new Map<
    string,
    { goals: number; shots: number; started: boolean; periodStarts: number }
  >();
  const teamFlags = new Map<string, string>();

  for (const game of games) {
    if (game.home.flagUrl) teamFlags.set(game.home.name, game.home.flagUrl);
    if (game.away.flagUrl) teamFlags.set(game.away.name, game.away.flagUrl);
    for (const stats of game.derivedPlayerStats) {
      if (!stats.id) continue;
      const eventTotals = playerEventTotals.get(stats.id) ?? {
        goals: 0,
        shots: 0,
      };
      eventTotals.goals += stats.goals;
      eventTotals.shots += stats.shots;
      playerEventTotals.set(stats.id, eventTotals);
      const opponent =
        stats.team === game.home.name ? game.away.name : game.home.name;
      playerGameEvents.set(`${stats.id}:${opponent}:${Date.parse(game.date)}`, {
        goals: stats.goals,
        shots: stats.shots,
        started: stats.startedGame,
        periodStarts: stats.goalkeeperStarts,
      });

      if (stats.goalkeeperStarts === 0) continue;
      const current = goalkeeperStats.get(stats.id) ?? {
        gamesStarted: 0,
        periodStarts: 0,
      };
      if (stats.startedGame) current.gamesStarted += 1;
      current.periodStarts += stats.goalkeeperStarts;
      goalkeeperStats.set(stats.id, current);
    }
  }

  return scrapedPlayers.map((player) => {
    const goalkeeper = goalkeeperStats.get(player.id);
    const eventTotals = playerEventTotals.get(player.id);
    const periodStarts = goalkeeper?.periodStarts ?? 0;
    return PlayerDetails.make({
      id: player.id,
      url: player.url,
      name: player.name,
      teamId: player.teamId,
      team: player.team,
      teamUrl: player.teamUrl,
      flagUrl: teamFlags.get(player.team) ?? player.flagUrl,
      number: player.number,
      playerType: player.playerType,
      position: player.position,
      height: player.height,
      hometown: player.hometown,
      university: player.university,
      gamesStarted: goalkeeper?.gamesStarted ?? 0,
      goalkeeperPeriodStarts: periodStarts,
      estimatedMinutesPlayed: periodStarts * 15,
      estimatedShots: eventTotals?.shots ?? 0,
      estimatedGoals: eventTotals?.goals ?? 0,
      stats: player.stats,
      gameLog: player.gameLog.map((game) => {
        const recorded = playerGameEvents.get(
          `${player.id}:${game.opponent}:${Date.parse(game.date)}`,
        );
        const gamePeriodStarts = recorded?.periodStarts ?? 0;
        return PlayerGameLog.make({
          date: game.date,
          opponent: game.opponent,
          goalkeeperStarted: recorded?.started ?? false,
          goalkeeperPeriodStarts: gamePeriodStarts,
          estimatedMinutesPlayed: gamePeriodStarts * 15,
          estimatedShots: recorded?.shots ?? 0,
          estimatedGoals: recorded?.goals ?? 0,
          stats: game.stats,
        });
      }),
    });
  });
};
