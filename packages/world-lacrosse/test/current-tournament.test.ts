import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { buildAnalysisData } from "../src/analysis-data";
import { championship } from "../src/championship-data";
import {
  buildCurrentTournamentSnapshot,
  CurrentTournamentSnapshot,
} from "../src/current-tournament";
import { gameDetailMatchesSchedule } from "../src/game-evidence";
import {
  candidateScheduleIsSafe,
  detailReconciles,
} from "../src/live-scores-worker";
import { LiveSchedule, ScheduledGame, Team } from "../src/schema";
import { buildCurrentStandings } from "../src/standings";
import { buildCurrentTeamSummary } from "../src/team-summary";
import { buildTournamentContext } from "../src/tournament-context";
import { tournament } from "../src/tournament-data";

const live = (schedule = tournament.schedule, games = championship.games) =>
  LiveSchedule.make({
    updatedAt: "2026-07-28T09:00:00.000Z",
    nextRefreshAt: "2026-07-28T09:02:00.000Z",
    schedule,
    games,
  });

const changedScore = (game: ScheduledGame) =>
  ScheduledGame.make({
    id: game.id,
    url: game.url,
    date: game.date,
    time: game.time,
    phase: game.phase,
    venue: game.venue,
    status: game.status,
    period: game.period,
    home: Team.make({
      id: game.home.id,
      code: game.home.code,
      name: game.home.name,
      flagUrl: game.home.flagUrl,
      score: (game.home.score ?? 0) + 1,
    }),
    away: game.away,
  });

describe("current tournament snapshot", () => {
  it("accepts only details that reconcile with the same schedule generation", () => {
    const schedule = tournament.schedule.map((game) =>
      game.id === "69" ? changedScore(game) : game,
    );
    const snapshot = buildCurrentTournamentSnapshot(
      live(schedule, championship.games),
      true,
    );

    expect(snapshot.source).toBe("live");
    expect(snapshot.freshness).toBe("degraded");
    expect(snapshot.conflictedDetailGameIds).toContain("69");
    expect(snapshot.games.some((game) => game.id === "69")).toBe(false);
    expect(snapshot.issues).toContain("schedule-detail-conflict");
  });

  it("drives every game-derived view from the same accepted detail set", () => {
    const schedule = tournament.schedule.map((game) =>
      game.id === "69" ? changedScore(game) : game,
    );
    const snapshot = buildCurrentTournamentSnapshot(
      live(schedule, championship.games),
      true,
    );
    const canada = tournament.teamDetails.find(
      (team) => team.name === "Canada",
    );
    expect(canada).toBeDefined();
    if (!canada) return;

    const standings = buildCurrentStandings(
      snapshot.schedule,
      tournament.teams,
    );
    const teamSummary = buildCurrentTeamSummary(canada, snapshot);
    const context = buildTournamentContext(snapshot.games, {
      sourceUpdatedAt: snapshot.updatedAt,
      teamPools: tournament.teams.map((team) => ({
        name: team.name,
        pool: team.pool,
      })),
    });
    const analysis = buildAnalysisData(snapshot.games);

    expect(standings.find((row) => row.team === "Canada")?.goalsFor).toBe(
      tournament.schedule
        .filter(
          (game) =>
            game.phase === "POOL B" &&
            (game.home.name === "Canada" || game.away.name === "Canada") &&
            game.status === "OFFICIAL",
        )
        .reduce(
          (total, game) =>
            total +
            (game.home.name === "Canada"
              ? (game.home.score ?? 0)
              : (game.away.score ?? 0)),
          0,
        ) + 1,
    );
    expect(teamSummary.stats.Assists).toBeUndefined();
    expect(context.games.some((game) => game.gameId === "69")).toBe(false);
    expect(analysis.games.some((game) => game.id === "69")).toBe(false);
    expect(snapshot.conflictedDetailGameIds).toContain("69");
  });

  it("falls back rather than accepting a schedule that drops known games", () => {
    const snapshot = buildCurrentTournamentSnapshot(
      live(tournament.schedule.slice(1), championship.games),
      true,
    );

    expect(snapshot).toMatchObject({
      source: "bundled",
      freshness: "fallback",
    });
    expect(snapshot.issues).toContain("live-schedule-missing-known-games");
    expect(snapshot.schedule).toHaveLength(tournament.schedule.length);
  });

  it("rejects duplicate detail rows", () => {
    const first = championship.games[0];
    expect(first).toBeDefined();
    if (!first) return;
    const snapshot = buildCurrentTournamentSnapshot(
      live(tournament.schedule, [...championship.games, first]),
      true,
    );

    expect(snapshot.freshness).toBe("degraded");
    expect(snapshot.issues).toContain("duplicate-detail-game-ids");
    expect(snapshot.games.some((game) => game.id === first.id)).toBe(false);
  });

  it("uses a visibly marked bundled fallback before the live feed is ready", () => {
    const snapshot = buildCurrentTournamentSnapshot(live(), false);

    expect(snapshot).toMatchObject({
      source: "bundled",
      freshness: "fallback",
      updatedAt: championship.scrapedAt,
    });
    expect(snapshot.issues).toContain("live-feed-not-ready");
  });

  it("round-trips through the runtime schema", () => {
    const snapshot = buildCurrentTournamentSnapshot(live(), true);
    const encoded = Schema.encodeSync(CurrentTournamentSnapshot)(snapshot);
    expect(
      Schema.decodeUnknownSync(CurrentTournamentSnapshot)(encoded),
    ).toEqual(snapshot);
  });

  it("refuses worker schedule candidates that drop or duplicate known games", () => {
    expect(
      candidateScheduleIsSafe(tournament.schedule, tournament.schedule),
    ).toBe(true);
    expect(
      candidateScheduleIsSafe(
        tournament.schedule.slice(1),
        tournament.schedule,
      ),
    ).toBe(false);
    const first = tournament.schedule[0];
    expect(first).toBeDefined();
    if (!first) return;
    expect(
      candidateScheduleIsSafe(
        [...tournament.schedule, first],
        tournament.schedule,
      ),
    ).toBe(false);
  });

  it("requires identity, status class, and scores to match", () => {
    const details = championship.games.find((game) => game.id === "69");
    const scheduled = tournament.schedule.find((game) => game.id === "69");
    expect(details).toBeDefined();
    expect(scheduled).toBeDefined();
    if (!details || !scheduled) return;

    expect(gameDetailMatchesSchedule(scheduled, details)).toBe(true);
    expect(detailReconciles(scheduled, details)).toBe(true);
    expect(gameDetailMatchesSchedule(changedScore(scheduled), details)).toBe(
      false,
    );
    expect(detailReconciles(changedScore(scheduled), details)).toBe(false);
    const provisional = ScheduledGame.make({
      id: scheduled.id,
      url: scheduled.url,
      date: scheduled.date,
      time: scheduled.time,
      phase: scheduled.phase,
      venue: scheduled.venue,
      status: "UNOFFICIAL",
      period: scheduled.period,
      home: scheduled.home,
      away: scheduled.away,
    });
    expect(gameDetailMatchesSchedule(provisional, details)).toBe(false);
    expect(detailReconciles(provisional, details)).toBe(false);
  });
});
