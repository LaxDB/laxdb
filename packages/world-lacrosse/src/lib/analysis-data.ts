import type { GameDetails } from "./schema";

const integer = (value: string | undefined): number | null => {
  if (value === undefined || !/^\d+$/u.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const percentage = (value: string | undefined): number | null => {
  const match =
    value?.trim().match(/^(?:\d+\s*\/\s*\d+\s*)?\(([-\d.]+)%\)$/u) ??
    value?.trim().match(/^([-\d.]+)%$/u);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
    ? parsed
    : null;
};

const leadingInteger = (value: string | undefined): number | null => {
  const match = value?.trim().match(/^(\d+)\s*\//u);
  return match ? integer(match[1]) : null;
};

const metricTeam = (game: GameDetails, side: "home" | "away") => {
  const team = game[side];
  const stats = game.teamStats.find((entry) => entry.team === team.name)?.stats;
  if (!stats || team.score === null) return null;
  const shots = integer(stats["Total Shots"]);
  const shootingPercentage = percentage(stats["Shooting Percentage"]);
  const shotsOnGoal = integer(stats["Shots on Goal"]);
  const drawControls = leadingInteger(stats["Draw Controls"]);
  const drawPercentage = percentage(stats["Draw Controls"]);
  const groundBalls = integer(stats["Ground Balls"]);
  const causedTurnovers = integer(stats["Caused Turnovers"]);
  const turnovers = integer(stats.Turnovers);
  const assists = integer(stats.Assists);
  const saves = leadingInteger(stats.Saves);
  const savePercentage = percentage(stats.Saves);
  if (
    shots === null ||
    shootingPercentage === null ||
    shotsOnGoal === null ||
    drawControls === null ||
    drawPercentage === null ||
    groundBalls === null ||
    causedTurnovers === null ||
    turnovers === null ||
    assists === null ||
    saves === null ||
    savePercentage === null
  )
    return null;
  return {
    team: team.name,
    score: team.score,
    goals: team.score,
    shots,
    shootingPercentage,
    shotsOnGoal,
    drawControls,
    drawPercentage,
    groundBalls,
    causedTurnovers,
    turnovers,
    assists,
    saves,
    savePercentage,
  };
};

export const buildAnalysisData = (games: readonly GameDetails[]) => ({
  generatedFrom: "World Lacrosse completed game detail pages",
  games: games.flatMap((game) => {
    if (
      game.status.toUpperCase() !== "OFFICIAL" ||
      game.home.score === null ||
      game.away.score === null ||
      game.home.score === game.away.score
    )
      return [];
    const home = metricTeam(game, "home");
    const away = metricTeam(game, "away");
    return home === null || away === null
      ? []
      : [
          {
            id: game.id,
            date: game.date,
            home,
            away,
          },
        ];
  }),
});
