import { describe, expect, it } from "vitest";

import { championship } from "../src/lib/championship-data";
import {
  DerivedPlayerStats,
  GameDetails,
  GameId,
  ScheduledGame,
  Team,
} from "../src/lib/schema";
import {
  buildStatisticsScope,
  normalizeStatisticsThrough,
  statisticsScopeIncludesTeamGame,
  statisticsThroughOptions,
} from "../src/lib/statistics-scope";
import { buildCurrentTeamSummary } from "../src/lib/team-summary";
import { tournament } from "../src/lib/tournament-data";
import {
  buildPlayerRows,
  playerDataCoverageComplete,
} from "../src/routes/statistics";

const scheduledGame = (
  id: string,
  homeName: string,
  awayName: string,
): ScheduledGame =>
  ScheduledGame.make({
    id: GameId.make(id),
    url: `https://example.com/games/${id}`,
    date: `Day ${id}`,
    time: "12:00",
    phase: "TEST",
    venue: "Test Field",
    status: "OFFICIAL",
    home: Team.make({
      id: homeName,
      code: homeName,
      name: homeName,
      flagUrl: null,
      score: 10,
    }),
    away: Team.make({
      id: awayName,
      code: awayName,
      name: awayName,
      flagUrl: null,
      score: 5,
    }),
  });

const playerStats = (team: string, goals: number): DerivedPlayerStats =>
  DerivedPlayerStats.make({
    id: null,
    name: `${team} scorer`,
    team,
    goals,
    assists: 0,
    unassistedGoals: goals,
    shots: goals,
    shotsOnGoal: goals,
    shotsOffTarget: 0,
    freePositionGoals: 0,
    freePositionAttempts: 0,
    groundBalls: 0,
    drawControls: 0,
    turnovers: 0,
    causedTurnovers: 0,
    yellowCards: 0,
    greenCards: 0,
    redCards: 0,
    startedGame: true,
    goalkeeperStarts: 0,
  });

const gameDetails = (
  game: ScheduledGame,
  homeGoals: number,
  awayGoals: number,
): GameDetails =>
  GameDetails.make({
    id: game.id,
    url: game.url,
    competition: "Test tournament",
    phase: game.phase,
    date: game.date,
    time: game.time,
    venue: game.venue,
    status: game.status,
    home: game.home,
    away: game.away,
    periodScores: [],
    teamStats: [],
    plays: [],
    derivedPlayerStats: [
      playerStats(game.home.name, homeGoals),
      playerStats(game.away.name, awayGoals),
    ],
    rosters: [],
    officials: [],
  });

const game1 = scheduledGame("1", "A", "C");
const game2 = scheduledGame("2", "A", "C");
const game3 = scheduledGame("3", "A", "B");
const game4 = scheduledGame("4", "B", "C");
const game5 = scheduledGame("5", "A", "B");
const schedule = [game1, game2, game3, game4, game5];
const inProgressGame = ScheduledGame.make({
  id: GameId.make("6"),
  url: "https://example.com/games/6",
  date: "Day 6",
  time: game5.time,
  phase: game5.phase,
  venue: game5.venue,
  status: "LIVE",
  home: game5.home,
  away: game5.away,
});

const details = [
  gameDetails(game1, 1, 1),
  gameDetails(game2, 2, 2),
  gameDetails(game3, 30, 3),
  gameDetails(game4, 4, 40),
  gameDetails(game5, 50, 50),
];
const inProgressDetails = gameDetails(inProgressGame, 60, 6);

const source = (games: readonly GameDetails[]) => ({
  schedule,
  games,
  conflictedDetailGameIds: [],
});

describe("equal-games statistics scope", () => {
  it("selects the first N games independently for each team", () => {
    const scope = buildStatisticsScope(source(details), ["A", "B", "C"], 2);

    expect(statisticsScopeIncludesTeamGame(scope, "A", "3")).toBe(false);
    expect(statisticsScopeIncludesTeamGame(scope, "B", "3")).toBe(true);
    expect(statisticsScopeIncludesTeamGame(scope, "B", "4")).toBe(true);
    expect(statisticsScopeIncludesTeamGame(scope, "C", "4")).toBe(false);
    expect(
      scope.selectedScheduleByTeam.get("A")?.map((game) => game.id),
    ).toEqual(["1", "2"]);
    expect(
      scope.selectedScheduleByTeam.get("B")?.map((game) => game.id),
    ).toEqual(["3", "4"]);
  });

  it("aggregates only the selected side of an asymmetrical matchup", () => {
    const scope = buildStatisticsScope(source(details), ["A", "B", "C"], 2);
    const rows = buildPlayerRows(details, scope);

    expect(rows.find((player) => player.team === "A")?.goals).toBe(3);
    expect(rows.find((player) => player.team === "B")?.goals).toBe(7);
    expect(rows.find((player) => player.team === "C")?.goals).toBe(3);
  });

  it("excludes teams that have not reached the selected game number", () => {
    const scope = buildStatisticsScope(
      source(details),
      ["A", "B", "C", "D"],
      2,
    );

    expect(scope.eligibleTeams).toEqual(new Set(["A", "B", "C"]));
    expect(scope.selectedScheduleByTeam.get("D")).toEqual([]);
  });

  it("scopes team totals to the same first N games", () => {
    const team = tournament.teamDetails.find(
      (candidate) => candidate.name === "Philippines",
    );
    expect(team).toBeDefined();
    if (team === undefined) return;
    const scope = buildStatisticsScope(
      {
        schedule: tournament.schedule,
        games: championship.games,
        conflictedDetailGameIds: [],
      },
      tournament.teamDetails.map((candidate) => candidate.name),
      2,
    );
    const selectedSchedule = scope.selectedScheduleByTeam.get(team.name) ?? [];
    const selectedIds = new Set(selectedSchedule.map((game) => game.id));
    const summary = buildCurrentTeamSummary(team, {
      schedule: [...selectedSchedule],
      games: championship.games.filter((game) => selectedIds.has(game.id)),
      updatedAt: tournament.scrapedAt,
    });

    expect(summary.record["Matches Played"]).toBe("2");
    expect(summary.completedGames).toBe(2);
    expect(summary.detailedGames).toBe(2);
  });

  it("scopes and reconciles goalkeeper saves", () => {
    const scope = buildStatisticsScope(
      {
        schedule: tournament.schedule,
        games: championship.games,
        conflictedDetailGameIds: [],
      },
      tournament.teamDetails.map((team) => team.name),
      1,
    );
    const selectedGame = scope.selectedScheduleByTeam.get("Philippines")?.[0];
    const detailsForGame = championship.games.find(
      (game) => game.id === selectedGame?.id,
    );
    const goalkeeper = detailsForGame?.rosters
      .find((roster) => roster.team === "Philippines")
      ?.players.find((player) => player.id === "1349");
    const expectedSaves = Number(goalkeeper?.stats.Saves);
    expect(selectedGame).toBeDefined();
    expect(Number.isSafeInteger(expectedSaves)).toBe(true);

    const row = buildPlayerRows(championship.games, scope).find(
      (player) => player.id === "1349",
    );
    expect(row?.saves).toBe(expectedSaves);
  });

  it("checks detail coverage only for games inside the snapshot", () => {
    const withoutUnselectedGame = buildStatisticsScope(
      source(details.slice(0, 4)),
      ["A", "B", "C"],
      2,
    );
    const withoutSelectedGame = buildStatisticsScope(
      source(details.slice(0, 3)),
      ["A", "B", "C"],
      2,
    );

    expect(withoutUnselectedGame.coverage).toMatchObject({
      completedGames: 4,
      detailedGames: 4,
      missingDetailGameIds: [],
    });
    expect(withoutSelectedGame.coverage).toMatchObject({
      completedGames: 4,
      detailedGames: 3,
      missingDetailGameIds: ["4"],
    });
  });

  it("fails closed when selected details are conflicted", () => {
    const scope = buildStatisticsScope(
      {
        ...source(details),
        conflictedDetailGameIds: [GameId.make("4")],
      },
      ["A", "B", "C"],
      2,
    );

    expect(scope.coverage.conflictedDetailGameIds).toEqual(["4"]);
    expect(playerDataCoverageComplete(scope.coverage)).toBe(false);
  });

  it("preserves the existing current totals in the latest view", () => {
    const scope = buildStatisticsScope(
      {
        schedule: tournament.schedule,
        games: championship.games,
        conflictedDetailGameIds: [],
      },
      tournament.teamDetails.map((team) => team.name),
      "latest",
    );

    expect(buildPlayerRows(championship.games, scope)).toEqual(
      buildPlayerRows(championship.games),
    );
  });

  it("keeps the current completed-game cutoff distinct while a game is live", () => {
    const liveSource = {
      schedule: [...schedule, inProgressGame],
      games: [...details, inProgressDetails],
      conflictedDetailGameIds: [],
    };
    const latest = buildStatisticsScope(liveSource, ["A", "B", "C"], "latest");
    const completedCutoff = buildStatisticsScope(
      liveSource,
      ["A", "B", "C"],
      4,
    );

    expect(latest.latestIncludesInProgressGames).toBe(true);
    expect(completedCutoff.through).toBe(4);
    expect(
      buildPlayerRows(liveSource.games, latest).find(
        (player) => player.team === "A",
      )?.goals,
    ).toBe(143);
    expect(
      buildPlayerRows(liveSource.games, completedCutoff).find(
        (player) => player.team === "A",
      )?.goals,
    ).toBe(83);
  });

  it("offers only non-redundant cutoffs below the latest team-game count", () => {
    expect(statisticsThroughOptions(0)).toEqual([]);
    expect(statisticsThroughOptions(1)).toEqual([]);
    expect(statisticsThroughOptions(3)).toEqual([1, 2]);
    expect(statisticsThroughOptions(5)).toEqual([1, 2, 3, 4]);
    expect(statisticsThroughOptions(5, true)).toEqual([1, 2, 3, 4, 5]);
  });

  it("normalizes invalid, current, and out-of-range URL cutoffs", () => {
    expect(normalizeStatisticsThrough("latest", 5)).toBe("latest");
    expect(normalizeStatisticsThrough(0, 5)).toBe("latest");
    expect(normalizeStatisticsThrough(9, 5)).toBe("latest");
    expect(normalizeStatisticsThrough(5, 5)).toBe("latest");
    expect(normalizeStatisticsThrough(5, 5, true)).toBe(5);
    expect(normalizeStatisticsThrough(3, 5)).toBe(3);
    expect(normalizeStatisticsThrough(3, 0)).toBe("latest");
  });
});
