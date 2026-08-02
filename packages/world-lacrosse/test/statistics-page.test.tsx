import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { championship } from "../src/championship-data";
import {
  DataTable,
  dataValueMatchesFilter,
} from "../src/components/data-table";
import {
  buildPlayerColumns,
  buildPlayerRows,
  fieldPlayerFilters,
  goalkeeperFilters,
  penaltyMinutesStat,
  playerDataCoverageComplete,
  teamFilters,
  teamSavePercentage,
} from "../src/pages/statistics-page";
import { parseStatisticsSearch } from "../src/routes/statistics";
import { DerivedPlayerStats, GameDetails } from "../src/schema";
import { buildTournamentContext } from "../src/tournament-context";
import { tournament } from "../src/tournament-data";

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
  it("parses shareable equal-game snapshot URLs", () => {
    expect(parseStatisticsSearch({ through: 3 })).toEqual({ through: 3 });
    expect(parseStatisticsSearch({ through: "3" })).toEqual({ through: 3 });
    expect(parseStatisticsSearch({ through: 0 })).toEqual({});
    expect(parseStatisticsSearch({ through: "3.5" })).toEqual({});
    expect(parseStatisticsSearch({ through: "latest" })).toEqual({});
  });

  it("supports structured text, select, multi-select, and numeric filters", () => {
    expect(
      dataValueMatchesFilter("Pool D", {
        kind: "text",
        operator: "contains",
        value: "pool",
      }),
    ).toBe(true);
    expect(
      dataValueMatchesFilter("Attack", {
        kind: "select",
        operator: "eq",
        value: "Attack",
      }),
    ).toBe(true);
    expect(
      dataValueMatchesFilter("Attack", {
        kind: "select",
        operator: "neq",
        value: "Attack",
      }),
    ).toBe(false);
    expect(
      dataValueMatchesFilter("Japan", {
        kind: "multi-select",
        values: ["Japan", "Wales"],
      }),
    ).toBe(true);
    expect(
      dataValueMatchesFilter("Canada", {
        kind: "multi-select",
        values: ["Japan", "Wales"],
      }),
    ).toBe(false);
    expect(
      dataValueMatchesFilter(54.2, {
        kind: "number",
        operator: "gt",
        value: 50,
      }),
    ).toBe(true);
    expect(
      dataValueMatchesFilter(20, {
        kind: "number",
        operator: "gte",
        value: 20,
      }),
    ).toBe(true);
    expect(
      dataValueMatchesFilter(20, {
        kind: "number",
        operator: "lt",
        value: 20,
      }),
    ).toBe(false);
    expect(
      dataValueMatchesFilter(20, {
        kind: "number",
        operator: "contains",
        value: 2,
      }),
    ).toBe(false);
    expect(
      dataValueMatchesFilter("Japan", {
        kind: "multi-select",
        values: [],
      }),
    ).toBe(false);
    expect(dataValueMatchesFilter("Japan", null)).toBe(true);
  });

  it("declares only useful filters with structured categorical controls", () => {
    const fieldFiltersById = new Map(
      fieldPlayerFilters.map((filter) => [filter.id, filter]),
    );
    const goalkeeperFiltersById = new Map(
      goalkeeperFilters.map((filter) => [filter.id, filter]),
    );
    const teamFiltersById = new Map(
      teamFilters.map((filter) => [filter.id, filter]),
    );

    expect(fieldFiltersById.has("name")).toBe(false);
    expect(fieldFiltersById.has("number")).toBe(false);
    expect(fieldFiltersById.get("team")).toMatchObject({
      kind: "multi-select",
    });
    expect(fieldFiltersById.get("position")).toMatchObject({
      kind: "select",
      options: ["Attack", "Midfield", "Defense"],
    });
    expect(fieldFiltersById.get("gamesPlayed")).toMatchObject({
      kind: "number",
    });
    expect(fieldFiltersById.get("points")).toMatchObject({ kind: "number" });
    expect(goalkeeperFiltersById.has("position")).toBe(false);
    expect(goalkeeperFiltersById.get("saves")).toMatchObject({
      kind: "number",
    });
    expect(teamFiltersById.get("team")).toMatchObject({
      kind: "multi-select",
    });
    expect(teamFiltersById.get("pool")).toMatchObject({
      kind: "multi-select",
      options: ["A", "B", "C", "D"],
    });
  });

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

  it("keeps positive totals for players ranked outside the top ten", () => {
    const goals = context.playerLeaderboards.find(
      (leaderboard) => leaderboard.metric === "goals",
    );
    const outsideTopTen = goals?.entries.find(
      (entry) => entry.rank.rank > 10 && entry.id !== null,
    );
    expect(outsideTopTen).toBeDefined();
    if (!outsideTopTen?.id) return;

    const row = buildPlayerRows(championship.games).find(
      (candidate) => candidate.id === outsideTopTen.id,
    );
    expect(row?.goals).toBe(outsideTopTen.value);
    expect(row?.goals).toBeGreaterThan(0);
  });

  it("aggregates current shooting, possession, and discipline data", () => {
    const player = buildPlayerRows(championship.games).find(
      (candidate) => candidate.id === "1315",
    );

    expect(player).toMatchObject({
      name: "LIPKIN Jordyn",
      gamesPlayed: 3,
      isLive: false,
      goals: 12,
      assists: 5,
      points: 17,
      shots: 17,
      shotsOnGoal: 15,
      shotsOffTarget: 1,
      goalsWithoutRecordedAssist: 12,
      freePositionGoals: 7,
      freePositionAttempts: 8,
      groundBalls: 1,
      turnovers: 4,
      causedTurnovers: 1,
    });
  });

  it("includes accepted live-game totals and marks active players", () => {
    const game = championship.games.find((candidate) => candidate.id === "107");
    expect(game).toBeDefined();
    if (game === undefined) return;

    const liveGame = withGameStatus(game, "LIVE");
    const player = buildPlayerRows([liveGame]).find(
      (candidate) => candidate.id === "1315",
    );
    expect(player).toMatchObject({
      gamesPlayed: 1,
      isLive: true,
      points: 5,
    });
    if (player === undefined) return;

    const markup = renderToStaticMarkup(
      <DataTable
        columns={buildPlayerColumns("field")}
        data={[{ ...player, id: null }]}
        searchPlaceholder="Search players…"
      />,
    );
    expect(markup).toContain('data-live="true"');
    expect(markup).toContain('class="statistics-player-live">Live</span>');
  });

  it("does not count or mark players before the game starts", () => {
    const game = championship.games.find((candidate) => candidate.id === "107");
    expect(game).toBeDefined();
    if (game === undefined) return;

    const player = buildPlayerRows([
      withGameStatus(game, "GETTING READY"),
    ]).find((candidate) => candidate.id === "1315");
    expect(player).toMatchObject({
      gamesPlayed: 0,
      isLive: false,
      points: 0,
    });
  });

  it("reconciles nullable live event IDs with the known player", () => {
    const game = championship.games.find((candidate) => candidate.id === "107");
    expect(game).toBeDefined();
    if (game === undefined) return;

    const liveGame = withGameStatus(game, "LIVE");
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

  it("publishes every recorded field-player counting category", () => {
    const markup = renderToStaticMarkup(
      <DataTable
        columns={buildPlayerColumns("field")}
        data={[]}
        searchPlaceholder="Search players…"
      />,
    );

    for (const heading of [
      "GP",
      "PTS",
      "G",
      "A",
      "SH",
      "SOG",
      "OFF",
      "G–A",
      "FPG",
      "FPA",
      "GB",
      "DC",
      "TO",
      "CT",
      "YC",
      "RC",
    ])
      expect(markup).toContain(`>${heading}<`);
    expect(markup.indexOf(">GP<")).toBeLessThan(markup.indexOf(">PTS<"));
    expect(markup).toContain(">#<");
    expect(markup).not.toContain(">RA<");
    expect(markup).not.toContain(">SH%<");
    expect(markup).not.toContain(">GC<");
    expect(markup).not.toContain("title=");
    expect(markup).toContain("statistics-stat-abbreviation");
    expect(markup).toContain(">Filter<");
    expect(markup).not.toContain("data-table-column-filter");
  });

  it("shows saves and the full stat line for goalkeepers", () => {
    const markup = renderToStaticMarkup(
      <DataTable
        columns={buildPlayerColumns("goalkeepers")}
        data={[]}
        searchPlaceholder="Search goalkeepers…"
      />,
    );

    for (const heading of [
      "GS",
      "PS",
      "SV",
      "GP",
      "PTS",
      "G",
      "A",
      "GB",
      "TO",
      "CT",
    ])
      expect(markup).toContain(`>${heading}<`);
  });

  it("parses zero and non-zero penalty minutes", () => {
    expect(penaltyMinutesStat("(0 min)")).toBe(0);
    expect(penaltyMinutesStat("(15 min)")).toBe(15);
    expect(penaltyMinutesStat("(1:30 min)")).toBe(1.5);
  });

  it("derives save percentage only from complete, reconciled game evidence", () => {
    const game = championship.games.find((candidate) => candidate.id === "107");
    const philippinesStats = game?.teamStats.find(
      (candidate) => candidate.team === "Philippines",
    );
    expect(game).toBeDefined();
    expect(philippinesStats).toBeDefined();
    if (!game || !philippinesStats) return;

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
  });

  it("withholds saves when a game contains duplicate roster evidence", () => {
    const game = championship.games.find((candidate) => candidate.id === "107");
    const roster = game?.rosters.find(
      (candidate) => candidate.team === "Philippines",
    );
    expect(game).toBeDefined();
    expect(roster).toBeDefined();
    if (!game || !roster) return;

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

    expect(philippinesGoalkeeper?.saves).toBe(22);
    expect(japanGoalkeeper?.position).toBe("Goal Keeper");
    expect(japanGoalkeeper?.saves).toBeNull();
  });
});
