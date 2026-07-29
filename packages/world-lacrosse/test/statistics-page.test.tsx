import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { championship } from "../src/championship-data";
import { DataTable } from "../src/components/data-table";
import {
  buildPlayerColumns,
  buildPlayerRows,
  penaltyMinutesStat,
  playerDataCoverageComplete,
  teamSavePercentage,
} from "../src/pages/statistics-page";
import { GameDetails } from "../src/schema";
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

  it("keeps positive totals for players ranked outside the top ten", () => {
    const goals = context.playerLeaderboards.find(
      (leaderboard) => leaderboard.metric === "goals",
    );
    const outsideTopTen = goals?.entries.find(
      (entry) => entry.rank.rank > 10 && entry.id !== null,
    );
    expect(outsideTopTen).toBeDefined();
    if (!outsideTopTen?.id) return;

    const row = buildPlayerRows().find(
      (candidate) => candidate.id === outsideTopTen.id,
    );
    expect(row?.goals).toBe(outsideTopTen.value);
    expect(row?.goals).toBeGreaterThan(0);
  });

  it("aggregates current shooting, possession, and discipline data", () => {
    const player = buildPlayerRows().find(
      (candidate) => candidate.id === "1315",
    );

    expect(player).toMatchObject({
      name: "LIPKIN Jordyn",
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

  it("publishes every recorded field-player counting category", () => {
    const markup = renderToStaticMarkup(
      <DataTable
        columns={buildPlayerColumns("field")}
        data={[]}
        searchPlaceholder="Search players…"
      />,
    );

    for (const heading of [
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
    expect(markup).toContain(">#<");
    expect(markup).not.toContain(">RA<");
    expect(markup).not.toContain(">SH%<");
    expect(markup).not.toContain(">GC<");
    expect(markup).not.toContain("title=");
    expect(markup).toContain("statistics-stat-abbreviation");
  });

  it("shows saves and the full stat line for goalkeepers", () => {
    const markup = renderToStaticMarkup(
      <DataTable
        columns={buildPlayerColumns("goalkeepers")}
        data={[]}
        searchPlaceholder="Search goalkeepers…"
      />,
    );

    for (const heading of ["GS", "PS", "SV", "PTS", "G", "A", "GB", "TO", "CT"])
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
    const players = buildPlayerRows();
    const philippinesGoalkeeper = players.find(
      (player) => player.id === "1349",
    );
    const japanGoalkeeper = players.find((player) => player.id === "1323");

    expect(philippinesGoalkeeper?.saves).toBe(22);
    expect(japanGoalkeeper?.position).toBe("Goal Keeper");
    expect(japanGoalkeeper?.saves).toBeNull();
  });
});
