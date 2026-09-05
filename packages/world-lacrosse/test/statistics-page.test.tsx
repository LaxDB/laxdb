import { describe, expect, it } from "vitest";

import { championship } from "../src/lib/championship-data";
import { DerivedPlayerStats, GameDetails } from "../src/lib/schema";
import { buildTournamentContext } from "../src/lib/tournament-context";
import { tournament } from "../src/lib/tournament-data";
import {
  buildPlayerRows,
  penaltyMinutesStat,
  playerDataCoverageComplete,
  teamSavePercentage,
} from "../src/routes/statistics";

const context = buildTournamentContext(championship.games, {
  sourceUpdatedAt: championship.scrapedAt,
  playerRankLimit: null,
  teamPools: tournament.teams.map((team) => ({
    name: team.name,
    pool: team.pool,
  })),
  players: championship.players,
});

const withGameStatus = (
  game: Readonly<GameDetails>,
  status: string,
  derivedPlayerStats = game.derivedPlayerStats,
): GameDetails =>
  GameDetails.make({
    id: game.id,
    url: game.url,
    competition: game.competition,
    phase: game.phase,
    date: game.date,
    time: game.time,
    venue: game.venue,
    status,
    home: game.home,
    away: game.away,
    periodScores: game.periodScores,
    teamStats: game.teamStats,
    plays: game.plays,
    derivedPlayerStats,
    rosters: game.rosters,
    officials: game.officials,
  });

const withPlayerIdentity = (
  player: Readonly<DerivedPlayerStats>,
  id: string | null,
  name: string,
  team: string,
): DerivedPlayerStats =>
  DerivedPlayerStats.make({
    id,
    name,
    team,
    goals: player.goals,
    assists: player.assists,
    unassistedGoals: player.unassistedGoals,
    shots: player.shots,
    shotsOnGoal: player.shotsOnGoal,
    shotsOffTarget: player.shotsOffTarget,
    freePositionGoals: player.freePositionGoals,
    freePositionAttempts: player.freePositionAttempts,
    groundBalls: player.groundBalls,
    drawControls: player.drawControls,
    turnovers: player.turnovers,
    causedTurnovers: player.causedTurnovers,
    yellowCards: player.yellowCards,
    greenCards: player.greenCards,
    redCards: player.redCards,
    startedGame: player.startedGame,
    goalkeeperStarts: player.goalkeeperStarts,
  });

describe("statistics page player rows", () => {
  it("fails closed when a completed game has no accepted details", () => {
    expect(
      playerDataCoverageComplete({
        completedGames: 3,
        detailedGames: 2,
        missingDetailGameIds: ["84"],
        conflictedDetailGameIds: [],
      }),
    ).toBe(false);
    expect(
      playerDataCoverageComplete({
        completedGames: 3,
        detailedGames: 3,
        missingDetailGameIds: [],
        conflictedDetailGameIds: [],
      }),
    ).toBe(true);
  });

  it("aggregates current stats beyond the top-ten leaderboard", () => {
    const rows = buildPlayerRows(championship.games);
    const player = rows.find((candidate) => candidate.id === "1315");

    expect(player).toMatchObject({
      name: "LIPKIN Jordyn",
      gamesPlayed: 6,
      isLive: false,
      goals: 19,
      assists: 6,
      points: 25,
      shots: 32,
      shotsOnGoal: 27,
      shotsOffTarget: 4,
      goalsWithoutRecordedAssist: 16,
      freePositionGoals: 11,
      freePositionAttempts: 12,
      groundBalls: 4,
      turnovers: 12,
      causedTurnovers: 1,
    });

    const goals = context.playerLeaderboards.find(
      (leaderboard) => leaderboard.metric === "goals",
    );
    const outsideTopTen = goals?.entries.find(
      (entry) => entry.rank.rank > 10 && entry.id !== null,
    );
    expect(outsideTopTen).toBeDefined();
    if (!outsideTopTen?.id) return;

    const row = rows.find((candidate) => candidate.id === outsideTopTen.id);
    expect(row?.goals).toBe(outsideTopTen.value);
    expect(row?.goals).toBeGreaterThan(0);
  });

  it("handles live, pregame, and nullable-ID player evidence", () => {
    const game = championship.games.find((candidate) => candidate.id === "107");
    expect(game).toBeDefined();
    if (game === undefined) return;

    const liveGame = withGameStatus(game, "LIVE");
    const livePlayer = buildPlayerRows([liveGame]).find(
      (candidate) => candidate.id === "1315",
    );
    expect(livePlayer).toMatchObject({
      gamesPlayed: 1,
      isLive: true,
      points: 5,
    });

    const pregamePlayer = buildPlayerRows([
      withGameStatus(game, "GETTING READY"),
    ]).find((candidate) => candidate.id === "1315");
    expect(pregamePlayer).toMatchObject({
      gamesPlayed: 0,
      isLive: false,
      points: 0,
    });

    const nullableEventGame = withGameStatus(
      liveGame,
      "LIVE",
      liveGame.derivedPlayerStats.map((player) =>
        player.id === "1315"
          ? DerivedPlayerStats.make({
              id: null,
              name: player.name,
              team: player.team,
              goals: player.goals,
              assists: player.assists,
              unassistedGoals: player.unassistedGoals,
              shots: player.shots,
              shotsOnGoal: player.shotsOnGoal,
              shotsOffTarget: player.shotsOffTarget,
              freePositionGoals: player.freePositionGoals,
              freePositionAttempts: player.freePositionAttempts,
              groundBalls: player.groundBalls,
              drawControls: player.drawControls,
              turnovers: player.turnovers,
              causedTurnovers: player.causedTurnovers,
              yellowCards: player.yellowCards,
              greenCards: player.greenCards,
              redCards: player.redCards,
              startedGame: player.startedGame,
              goalkeeperStarts: player.goalkeeperStarts,
            })
          : player,
      ),
    );
    const rows = buildPlayerRows([nullableEventGame]).filter(
      (player) => player.team === "Israel" && player.name === "LIPKIN Jordyn",
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "1315",
      gamesPlayed: 1,
      isLive: true,
      points: 5,
    });
  });

  it("retains a later canonical ID for a newly discovered athlete", () => {
    const firstGame = championship.games[0];
    const secondGame = championship.games[1];
    const seed = firstGame?.derivedPlayerStats[0];
    expect(firstGame).toBeDefined();
    expect(secondGame).toBeDefined();
    expect(seed).toBeDefined();
    if (
      firstGame === undefined ||
      secondGame === undefined ||
      seed === undefined
    )
      return;

    const discoveredPlayer = (id: string | null): DerivedPlayerStats =>
      withPlayerIdentity(seed, id, "DISCOVERED Athlete", "Discovery Team");
    const rows = buildPlayerRows([
      withGameStatus(firstGame, "LIVE", [discoveredPlayer(null)]),
      withGameStatus(secondGame, "LIVE", [
        discoveredPlayer("canonical-live-player"),
      ]),
    ]).filter(
      (player) =>
        player.team === "Discovery Team" &&
        player.name === "DISCOVERED Athlete",
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "canonical-live-player",
      gamesPlayed: 2,
      isLive: true,
    });
  });

  it("parses zero and non-zero penalty minutes", () => {
    expect(penaltyMinutesStat("(0 min)")).toBe(0);
    expect(penaltyMinutesStat("(15 min)")).toBe(15);
    expect(penaltyMinutesStat("(1:30 min)")).toBe(1.5);
  });

  it("derives saves only from complete, unique game evidence", () => {
    const game = championship.games.find((candidate) => candidate.id === "107");
    const philippinesStats = game?.teamStats.find(
      (candidate) => candidate.team === "Philippines",
    );
    const roster = game?.rosters.find(
      (candidate) => candidate.team === "Philippines",
    );
    expect(game).toBeDefined();
    expect(philippinesStats).toBeDefined();
    expect(roster).toBeDefined();
    if (!game || !philippinesStats || !roster) return;

    expect(teamSavePercentage([game], "Philippines", 1)).toBe(40);
    expect(teamSavePercentage([game], "Philippines", 2)).toBeNull();

    const duplicateEvidence = GameDetails.make({
      id: game.id,
      url: game.url,
      competition: game.competition,
      phase: game.phase,
      date: game.date,
      time: game.time,
      venue: game.venue,
      status: game.status,
      home: game.home,
      away: game.away,
      periodScores: game.periodScores,
      teamStats: [...game.teamStats, philippinesStats],
      plays: game.plays,
      derivedPlayerStats: game.derivedPlayerStats,
      rosters: game.rosters,
      officials: game.officials,
    });
    expect(
      teamSavePercentage([duplicateEvidence], "Philippines", 1),
    ).toBeNull();

    const duplicate = GameDetails.make({
      id: game.id,
      url: game.url,
      competition: game.competition,
      phase: game.phase,
      date: game.date,
      time: game.time,
      venue: game.venue,
      status: game.status,
      home: game.home,
      away: game.away,
      periodScores: game.periodScores,
      teamStats: game.teamStats,
      plays: game.plays,
      derivedPlayerStats: game.derivedPlayerStats,
      rosters: [...game.rosters, roster],
      officials: game.officials,
    });
    const goalkeeper = buildPlayerRows([duplicate]).find(
      (player) => player.id === "1349",
    );

    expect(goalkeeper?.saves).toBeNull();
  });

  it("shows reconciled saves and withholds a conflicting team total", () => {
    const players = buildPlayerRows(championship.games);
    const philippinesGoalkeeper = players.find(
      (player) => player.id === "1349",
    );
    const japanGoalkeeper = players.find((player) => player.id === "1323");

    expect(philippinesGoalkeeper?.saves).toBe(30);
    expect(japanGoalkeeper?.position).toBe("Goal Keeper");
    expect(japanGoalkeeper?.saves).toBeNull();
  });
});
