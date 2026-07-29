import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { championship } from "../src/championship-data";
import {
  GameDetails,
  Play,
  TeamStat,
  type TournamentTeam,
} from "../src/schema";
import { buildTeamComparison } from "../src/team-comparison";
import {
  TeamComparison,
  teamComparisonMetricDefinitions,
  type TeamComparisonMetricKey,
} from "../src/team-comparison-schema";
import { tournament } from "../src/tournament-data";

const source = {
  updatedAt: championship.scrapedAt,
  schedule: tournament.schedule,
  games: championship.games,
};

const metric = (
  comparison: TeamComparison,
  side: "left" | "right",
  key: TeamComparisonMetricKey,
) => comparison[side].metrics.find((entry) => entry.key === key);

const comparisonFor = (left: string, right: string): TeamComparison => {
  const comparison = buildTeamComparison(left, right, source, tournament.teams);
  expect(comparison).not.toBeNull();
  if (comparison === null) throw new Error("expected a valid comparison");
  return comparison;
};

const copyGameWithStats = (
  game: Readonly<GameDetails>,
  teamStats: readonly TeamStat[],
): GameDetails =>
  GameDetails.make({
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
    teamStats,
    plays: game.plays,
    derivedPlayerStats: game.derivedPlayerStats,
    rosters: game.rosters,
    officials: game.officials,
  });

const withUnattributedShot = (game: Readonly<GameDetails>): GameDetails => {
  let replaced = false;
  const plays = game.plays.map((play) => {
    if (
      replaced ||
      !["Shot missed", "Shot saved", "Free Position Shot saved"].includes(
        play.action,
      )
    )
      return play;
    replaced = true;
    return Play.make({
      period: play.period,
      home: "",
      time: play.time,
      result: play.result,
      action: play.action,
      away: "",
      participants: [],
    });
  });
  return GameDetails.make({
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
    plays,
    derivedPlayerStats: game.derivedPlayerStats,
    rosters: game.rosters,
    officials: game.officials,
  });
};

const malformedShots = (
  game: Readonly<GameDetails>,
  team: string,
): GameDetails =>
  copyGameWithStats(
    game,
    game.teamStats.map((row) =>
      row.team === team
        ? TeamStat.make({
            team: row.team,
            stats: { ...row.stats, "Total Shots": "not recorded" },
          })
        : row,
    ),
  );

const replaceShootingStats = (
  game: Readonly<GameDetails>,
  team: string,
  changes: Readonly<Record<string, string>>,
): GameDetails =>
  copyGameWithStats(
    game,
    game.teamStats.map((row) =>
      row.team === team
        ? TeamStat.make({
            team: row.team,
            stats: { ...row.stats, ...changes },
          })
        : row,
    ),
  );

const duplicateTeamStats = (
  game: Readonly<GameDetails>,
  team: string,
): GameDetails => {
  const row = game.teamStats.find((candidate) => candidate.team === team);
  return row
    ? copyGameWithStats(game, [...game.teamStats, row])
    : copyGameWithStats(game, game.teamStats);
};

const distinctPairs = (
  teams: readonly TournamentTeam[],
): readonly (readonly [TournamentTeam, TournamentTeam])[] =>
  teams.flatMap((left, leftIndex) =>
    teams.slice(leftIndex + 1).map((right) => [left, right]),
  );

describe("team comparison", () => {
  it("builds a schema-validated Australia and USA comparison", () => {
    const comparison = comparisonFor("25", "24");
    const encoded = Schema.encodeSync(TeamComparison)(comparison);

    expect(Schema.decodeUnknownSync(TeamComparison)(encoded)).toEqual(
      comparison,
    );
    expect(comparison.left).toMatchObject({
      name: "Australia",
      completedGames: 3,
      eligibleGames: 3,
      wins: 2,
      losses: 1,
    });
    expect(comparison.right).toMatchObject({
      name: "United States of America",
      eligibleGames: 2,
      wins: 2,
      losses: 0,
    });
    expect(comparison.left.metrics).toHaveLength(
      teamComparisonMetricDefinitions.length,
    );
    expect(metric(comparison, "left", "shooting-conversion")).toMatchObject({
      numerator: 45,
      denominator: 84,
      sampleGames: 3,
      value: 53.571_428_571_428_57,
    });
  });

  it("pins representative evidence across every section and aggregation mode", () => {
    const comparison = comparisonFor("25", "24");
    const golden = [
      ["goals-total", "total", 45, 45, 3, 3],
      ["goals-per-game", "per-game", 15, 45, 3, 3],
      ["q1-goals", "total", 11, 11, 3, 3],
      ["save-rate", "percentage", 28.571_428_571_428_57, 10, 35, 3],
      ["draw-share", "percentage", 62.5, 50, 80, 3],
      [
        "average-close-game-time",
        "average",
        1558.666_666_666_666_7,
        4676,
        3,
        3,
      ],
      ["longest-drought", "maximum", 829, 829, 3, 3],
      ["fastest-response-time", "minimum", 58, 58, 3, 3],
      ["drought-goals-conceded", "paired-maximum", 3, 3, 3, 3],
      ["fourth-quarter-goals", "total", 11, 11, 3, 3],
      ["recorded-scorers", "unique", 14, 14, 3, 3],
      ["yellow-cards", "total", 4, 4, 3, 3],
    ] as const;

    for (const [
      key,
      aggregation,
      value,
      numerator,
      denominator,
      sampleGames,
    ] of golden) {
      expect(
        teamComparisonMetricDefinitions.find(
          (definition) => definition.key === key,
        )?.aggregation,
      ).toBe(aggregation);
      expect(metric(comparison, "left", key)).toMatchObject({
        value,
        numerator,
        denominator,
        sampleGames,
      });
    }

    expect(metric(comparison, "left", "one-goal-margin-share")).toMatchObject({
      numerator: 2753,
      denominator: 10_800,
      sampleGames: 3,
    });
    expect(
      metric(comparison, "left", "close-game-shooting-conversion"),
    ).toMatchObject({ numerator: 13, denominator: 30, sampleGames: 3 });
    expect(metric(comparison, "left", "longest-save-run")).toMatchObject({
      value: 3,
      sampleGames: 3,
    });
    expect(
      metric(comparison, "left", "recorded-leading-scorer-share"),
    ).toMatchObject({ numerator: 9, denominator: 45, sampleGames: 3 });

    const overtime = comparisonFor("28", "27");
    expect(
      metric(overtime, "left", "overtime-shooting-conversion"),
    ).toMatchObject({
      value: 50,
      numerator: 1,
      denominator: 2,
      sampleGames: 1,
    });
    const zeroDenominator = comparisonFor("23", "22");
    expect(
      metric(zeroDenominator, "left", "fastest-four-goal-burst"),
    ).toMatchObject({
      value: null,
      numerator: 0,
      denominator: 0,
      sampleGames: 2,
    });
  });

  it("rejects reordered or internally inconsistent metric evidence", () => {
    const comparison = comparisonFor("25", "24");
    const encoded = Schema.encodeSync(TeamComparison)(comparison);
    expect(() =>
      Schema.decodeUnknownSync(TeamComparison)({
        ...encoded,
        left: {
          ...encoded.left,
          metrics: encoded.left.metrics.toReversed(),
        },
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(TeamComparison)({
        ...encoded,
        left: {
          ...encoded.left,
          metrics: encoded.left.metrics.map((entry) =>
            entry.key === "goals-per-game"
              ? { ...entry, denominator: entry.denominator + 1 }
              : entry,
          ),
        },
      }),
    ).toThrow();
  });

  it("rejects mismatched longest-drought evidence pairs", () => {
    const encoded = Schema.encodeSync(TeamComparison)(
      comparisonFor("25", "24"),
    );
    const mutations: readonly {
      readonly key: "longest-drought" | "drought-goals-conceded";
      readonly denominator: number;
      readonly sampleGames?: number;
    }[] = [
      { key: "drought-goals-conceded", denominator: 2 },
      { key: "longest-drought", denominator: 2, sampleGames: 2 },
    ];

    for (const mutation of mutations)
      expect(() =>
        Schema.decodeUnknownSync(TeamComparison)({
          ...encoded,
          left: {
            ...encoded.left,
            metrics: encoded.left.metrics.map((entry) =>
              entry.key === mutation.key
                ? {
                    ...entry,
                    denominator: mutation.denominator,
                    sampleGames: mutation.sampleGames ?? entry.sampleGames,
                  }
                : entry,
            ),
          },
        }),
      ).toThrow();
  });

  it("rejects non-finite, negative, fractional, and zero-denominator evidence", () => {
    const encoded = Schema.encodeSync(TeamComparison)(
      comparisonFor("25", "24"),
    );
    const mutations: readonly {
      readonly key: TeamComparisonMetricKey;
      readonly changes: Readonly<Record<string, number | null>>;
    }[] = [
      { key: "goals-total", changes: { numerator: Number.NaN } },
      { key: "goals-total", changes: { value: Number.POSITIVE_INFINITY } },
      { key: "goals-total", changes: { numerator: -1, value: -1 } },
      { key: "longest-drought", changes: { numerator: -1, value: -1 } },
      { key: "goals-total", changes: { numerator: 1.5, value: 1.5 } },
      {
        key: "free-position-conversion",
        changes: { numerator: 1, denominator: 0, value: null },
      },
    ];

    for (const mutation of mutations)
      expect(() =>
        Schema.decodeUnknownSync(TeamComparison)({
          ...encoded,
          left: {
            ...encoded.left,
            metrics: encoded.left.metrics.map((entry) =>
              entry.key === mutation.key
                ? { ...entry, ...mutation.changes }
                : entry,
            ),
          },
        }),
      ).toThrow();
  });

  it("reconciles quarter totals with regulation halves", () => {
    const sides: readonly ("left" | "right")[] = ["left", "right"];
    for (const side of sides) {
      const comparison = comparisonFor("25", "24");
      const q1 = metric(comparison, side, "q1-goals")?.numerator ?? 0;
      const q2 = metric(comparison, side, "q2-goals")?.numerator ?? 0;
      const q3 = metric(comparison, side, "q3-goals")?.numerator ?? 0;
      const q4 = metric(comparison, side, "q4-goals")?.numerator ?? 0;
      expect(metric(comparison, side, "first-half-goals")?.numerator).toBe(
        q1 + q2,
      );
      expect(metric(comparison, side, "second-half-goals")?.numerator).toBe(
        q3 + q4,
      );
    }
  });

  it("keeps partial shooting evidence isolated from other samples", () => {
    const australiaGame = championship.games.find(
      (game) =>
        game.home.name === "Australia" || game.away.name === "Australia",
    );
    expect(australiaGame).toBeDefined();
    if (!australiaGame) return;
    const partialSource = {
      ...source,
      games: championship.games.map((game) =>
        game.id === australiaGame.id ? malformedShots(game, "Australia") : game,
      ),
    };
    const comparison = buildTeamComparison(
      "25",
      "24",
      partialSource,
      tournament.teams,
    );
    expect(comparison).not.toBeNull();
    if (!comparison) return;

    expect(metric(comparison, "left", "shooting-conversion")?.sampleGames).toBe(
      2,
    );
    expect(metric(comparison, "left", "q1-goals")?.sampleGames).toBe(3);
    expect(metric(comparison, "left", "time-ahead-share")?.sampleGames).toBe(3);
  });

  it("fails closed on numeric shooting contradictions without widening other samples", () => {
    const australiaGame = championship.games.find(
      (game) =>
        game.home.name === "Australia" || game.away.name === "Australia",
    );
    expect(australiaGame).toBeDefined();
    if (!australiaGame) return;
    const comparisonWith = (
      changes: Readonly<Record<string, string>>,
    ): TeamComparison => {
      const comparison = buildTeamComparison(
        "25",
        "24",
        {
          ...source,
          games: championship.games.map((game) =>
            game.id === australiaGame.id
              ? replaceShootingStats(game, "Australia", changes)
              : game,
          ),
        },
        tournament.teams,
      );
      expect(comparison).not.toBeNull();
      if (!comparison) throw new Error("expected comparison");
      return comparison;
    };

    const belowGoals = comparisonWith({
      "Total Shots": "1",
      "Shots on Goal": "1",
    });
    for (const key of [
      "shots",
      "shots-on-goal",
      "shooting-conversion",
      "shot-accuracy",
    ] as const)
      expect(metric(belowGoals, "left", key)?.sampleGames).toBe(2);

    const shotsOnGoalBelowGoals = comparisonWith({ "Shots on Goal": "1" });
    expect(metric(shotsOnGoalBelowGoals, "left", "shots")?.sampleGames).toBe(3);
    expect(
      metric(shotsOnGoalBelowGoals, "left", "shooting-conversion")?.sampleGames,
    ).toBe(3);
    expect(
      metric(shotsOnGoalBelowGoals, "left", "shots-on-goal")?.sampleGames,
    ).toBe(2);
    expect(
      metric(shotsOnGoalBelowGoals, "left", "shot-accuracy")?.sampleGames,
    ).toBe(2);

    const shotsOnGoalAboveShots = comparisonWith({
      "Total Shots": "99",
      "Shots on Goal": "100",
    });
    expect(metric(shotsOnGoalAboveShots, "left", "shots")?.sampleGames).toBe(3);
    expect(
      metric(shotsOnGoalAboveShots, "left", "shots-on-goal")?.sampleGames,
    ).toBe(2);
    expect(metric(shotsOnGoalAboveShots, "left", "q1-goals")?.sampleGames).toBe(
      3,
    );
  });

  it("withholds duplicated team-stat evidence without dropping event metrics", () => {
    const australiaGame = championship.games.find(
      (game) =>
        game.home.name === "Australia" || game.away.name === "Australia",
    );
    expect(australiaGame).toBeDefined();
    if (!australiaGame) return;
    const duplicateSource = {
      ...source,
      games: championship.games.map((game) =>
        game.id === australiaGame.id
          ? duplicateTeamStats(game, "Australia")
          : game,
      ),
    };
    const comparison = buildTeamComparison(
      "25",
      "24",
      duplicateSource,
      tournament.teams,
    );
    expect(comparison).not.toBeNull();
    if (!comparison) return;

    expect(metric(comparison, "left", "shots")?.sampleGames).toBe(2);
    expect(metric(comparison, "left", "draw-controls")?.sampleGames).toBe(2);
    expect(
      metric(comparison, "left", "first-half-shot-accuracy")?.sampleGames,
    ).toBe(3);
    expect(metric(comparison, "left", "goals-total")?.sampleGames).toBe(3);
  });

  it("isolates unattributed shot events to close-game shooting and save runs", () => {
    const australiaGame = championship.games.find(
      (game) =>
        game.home.name === "Australia" || game.away.name === "Australia",
    );
    expect(australiaGame).toBeDefined();
    if (!australiaGame) return;
    const comparison = buildTeamComparison(
      "25",
      "24",
      {
        ...source,
        games: championship.games.map((game) =>
          game.id === australiaGame.id ? withUnattributedShot(game) : game,
        ),
      },
      tournament.teams,
    );
    expect(comparison).not.toBeNull();
    if (!comparison) return;

    expect(
      metric(comparison, "left", "close-game-shooting-conversion")?.sampleGames,
    ).toBe(2);
    expect(metric(comparison, "left", "longest-save-run")?.sampleGames).toBe(2);
    expect(metric(comparison, "left", "shooting-conversion")?.sampleGames).toBe(
      3,
    );
    expect(metric(comparison, "left", "goals-total")?.sampleGames).toBe(3);
  });

  it("returns every unordered distinct current-team pair with closed metrics", () => {
    for (const [left, right] of distinctPairs(tournament.teams)) {
      const comparison = buildTeamComparison(
        left.id,
        right.id,
        source,
        tournament.teams,
      );
      expect(comparison).not.toBeNull();
      if (!comparison) continue;
      expect(comparison.left.id).toBe(left.id);
      expect(comparison.right.id).toBe(right.id);
      for (const team of [comparison.left, comparison.right]) {
        expect(team.metrics.map((entry) => entry.key)).toEqual(
          teamComparisonMetricDefinitions.map((definition) => definition.key),
        );
        expect(
          team.metrics.every(
            (entry) => entry.sampleGames <= team.eligibleGames,
          ),
        ).toBe(true);
      }
    }
  }, 120_000);

  it("preserves route orientation and rejects unknown or identical teams", () => {
    const forward = comparisonFor("25", "24");
    const reverse = comparisonFor("24", "25");
    expect(reverse.left.name).toBe(forward.right.name);
    expect(reverse.right.name).toBe(forward.left.name);
    expect(
      buildTeamComparison("25", "25", source, tournament.teams),
    ).toBeNull();
    expect(
      buildTeamComparison("unknown", "24", source, tournament.teams),
    ).toBeNull();
  });

  it("includes direct meetings only for eligible meetings", () => {
    const australiaWales = comparisonFor("25", "28");
    const australiaUsa = comparisonFor("25", "24");

    expect(australiaWales.directMeetings).toHaveLength(1);
    expect(australiaWales.directMeetings[0]).toMatchObject({
      leftGoals: 9,
      rightGoals: 7,
      winner: "left",
    });
    expect(australiaUsa.directMeetings).toEqual([]);
  });

  it("retains overtime evidence with its own sample", () => {
    const walesGermany = comparisonFor("28", "27");
    expect(
      metric(walesGermany, "left", "overtime-appearances")?.numerator,
    ).toBe(1);
    expect(metric(walesGermany, "left", "overtime-wins")?.sampleGames).toBe(1);
    expect(metric(walesGermany, "left", "overtime-goals")?.numerator).toBe(1);
  });
});
