import { Schema } from "effect";

import { isFinalGameStatus } from "./game-status";
import type { GameDetails } from "./schema";
import type { StaticPlayerProfile } from "./static-tournament-data";

const NonNegativeInteger = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
);

const PlayerGameResult = Schema.Union([
  Schema.Literal("W"),
  Schema.Literal("L"),
]);

export class CurrentPlayerGameLog extends Schema.Class<CurrentPlayerGameLog>(
  "WorldLacrosseCurrentPlayerGameLog",
)({
  gameId: Schema.String,
  date: Schema.String,
  phase: Schema.String,
  opponent: Schema.String,
  opponentFlagUrl: Schema.NullOr(Schema.String),
  goalsFor: Schema.NullOr(NonNegativeInteger),
  goalsAgainst: Schema.NullOr(NonNegativeInteger),
  result: Schema.NullOr(PlayerGameResult),
  provisional: Schema.Boolean,
  goalkeeperStarted: Schema.Boolean,
  goalkeeperPeriodStarts: NonNegativeInteger,
  recordedShots: NonNegativeInteger,
  recordedGoals: NonNegativeInteger,
  stats: Schema.Record(Schema.String, Schema.String),
}) {}

export class CurrentPlayerSummary extends Schema.Class<CurrentPlayerSummary>(
  "WorldLacrosseCurrentPlayerSummary",
)({
  teamGames: NonNegativeInteger,
  gamesWithRecordedActivity: NonNegativeInteger,
  gamesStarted: NonNegativeInteger,
  goalkeeperPeriodStarts: NonNegativeInteger,
  stats: Schema.Record(Schema.String, Schema.String),
  gameLog: Schema.Array(CurrentPlayerGameLog),
}) {}

const strictInteger = (value: string | undefined): number | null => {
  if (value === undefined || !/^\d+$/u.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const percentage = (made: number, attempts: number): string =>
  attempts === 0 ? "—" : `${((made / attempts) * 100).toFixed(1)}%`;

export const buildCurrentPlayerSummary = (
  player: Readonly<StaticPlayerProfile>,
  games: readonly GameDetails[],
): CurrentPlayerSummary => {
  const currentGames = games.filter(
    (game) =>
      isFinalGameStatus(game.status) &&
      (game.home.name === player.team || game.away.name === player.team),
  );
  const logs: CurrentPlayerGameLog[] = [];
  let gamesWithRecordedActivity = 0;
  let gamesStarted = 0;
  let goalkeeperPeriodStarts = 0;
  let goals = 0;
  let recordedAssists = 0;
  let saves = 0;
  let shots = 0;
  let shotsOnGoal = 0;
  let groundBalls = 0;
  let turnovers = 0;
  let causedTurnovers = 0;
  let drawControls = 0;
  let greenCards = 0;
  let yellowCards = 0;
  let redCards = 0;

  for (const game of currentGames) {
    const roster = game.rosters.find((entry) => entry.team === player.team);
    const sourcePlayer = roster?.players.find(
      (entry) => entry.id === player.id,
    );
    const derived = game.derivedPlayerStats.find(
      (entry) => entry.id === player.id,
    );
    if (!sourcePlayer && !derived) continue;
    const gameGoals =
      strictInteger(sourcePlayer?.stats.Goals) ?? derived?.goals ?? 0;
    const gameAssists =
      strictInteger(sourcePlayer?.stats.Assists) ?? derived?.assists ?? 0;
    const gameSaves = strictInteger(sourcePlayer?.stats.Saves) ?? 0;
    const gameShots = derived?.shots ?? 0;
    const gameShotsOnGoal = derived?.shotsOnGoal ?? 0;
    const gameGroundBalls = derived?.groundBalls ?? 0;
    const gameTurnovers = derived?.turnovers ?? 0;
    const gameCausedTurnovers = derived?.causedTurnovers ?? 0;
    const gameDrawControls = derived?.drawControls ?? 0;
    const gameGreenCards = derived?.greenCards ?? 0;
    const gameYellowCards = derived?.yellowCards ?? 0;
    const gameRedCards = derived?.redCards ?? 0;
    const periodStarts = derived?.goalkeeperStarts ?? 0;
    const started = derived?.startedGame ?? false;
    const hasRecordedActivity =
      started ||
      gameGoals +
        gameAssists +
        gameSaves +
        gameShots +
        gameGroundBalls +
        gameTurnovers +
        gameCausedTurnovers +
        gameDrawControls +
        gameGreenCards +
        gameYellowCards +
        gameRedCards >
        0;
    if (hasRecordedActivity) gamesWithRecordedActivity += 1;
    if (started) gamesStarted += 1;
    goalkeeperPeriodStarts += periodStarts;
    goals += gameGoals;
    recordedAssists += gameAssists;
    saves += gameSaves;
    shots += gameShots;
    shotsOnGoal += gameShotsOnGoal;
    groundBalls += gameGroundBalls;
    turnovers += gameTurnovers;
    causedTurnovers += gameCausedTurnovers;
    drawControls += gameDrawControls;
    greenCards += gameGreenCards;
    yellowCards += gameYellowCards;
    redCards += gameRedCards;
    const isHome = game.home.name === player.team;
    const opponent = isHome ? game.away : game.home;
    const goalsFor = isHome ? game.home.score : game.away.score;
    const goalsAgainst = isHome ? game.away.score : game.home.score;
    const result =
      goalsFor === null || goalsAgainst === null || goalsFor === goalsAgainst
        ? null
        : goalsFor > goalsAgainst
          ? "W"
          : "L";
    logs.push(
      CurrentPlayerGameLog.make({
        gameId: game.id,
        date: game.date,
        phase: game.phase,
        opponent: opponent.name,
        opponentFlagUrl: opponent.flagUrl,
        goalsFor,
        goalsAgainst,
        result,
        provisional: game.status.toUpperCase() === "UNOFFICIAL",
        goalkeeperStarted: started,
        goalkeeperPeriodStarts: periodStarts,
        recordedShots: gameShots,
        recordedGoals: gameGoals,
        stats: {
          Goals: String(gameGoals),
          "Shots on Goal": String(gameShotsOnGoal),
          Shots: String(gameShots),
          "Shooting Percentage": percentage(gameGoals, gameShots),
          "Recorded Assists": String(gameAssists),
          Points: String(gameGoals + gameAssists),
          Saves: String(gameSaves),
          "Ground Balls": String(gameGroundBalls),
          Turnovers: String(gameTurnovers),
          "Caused Turnovers": String(gameCausedTurnovers),
          "Draw Controls": String(gameDrawControls),
          "Green Cards": String(gameGreenCards),
          "Yellow Cards": String(gameYellowCards),
          "Red Cards": String(gameRedCards),
        },
      }),
    );
  }

  return CurrentPlayerSummary.make({
    teamGames: currentGames.length,
    gamesWithRecordedActivity,
    gamesStarted,
    goalkeeperPeriodStarts,
    stats: {
      Goals: String(goals),
      "Shots on Goal": String(shotsOnGoal),
      Shots: String(shots),
      "Shooting Percentage": percentage(goals, shots),
      "Recorded Assists": String(recordedAssists),
      Points: String(goals + recordedAssists),
      Saves: String(saves),
      "Ground Balls": String(groundBalls),
      Turnovers: String(turnovers),
      "Caused Turnovers": String(causedTurnovers),
      "Draw Controls": String(drawControls),
      "Green Cards": String(greenCards),
      "Yellow Cards": String(yellowCards),
      "Red Cards": String(redCards),
    },
    gameLog: logs.toSorted(
      (left, right) => Date.parse(right.date) - Date.parse(left.date),
    ),
  });
};
