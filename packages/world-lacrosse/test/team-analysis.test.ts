import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { championship } from "../src/championship-data";
import {
  GameDetails,
  PeriodScore,
  ScheduledGame,
  Team,
  TeamStat,
} from "../src/schema";
import { buildTeamAnalysis } from "../src/team-analysis";
import { TeamAnalysis } from "../src/team-analysis-schema";
import { tournament } from "../src/tournament-data";

const source = {
  updatedAt: championship.scrapedAt,
  schedule: tournament.schedule,
  games: championship.games,
};
const teamPools = tournament.teams.map((team) => ({
  name: team.name,
  pool: team.pool,
}));
const australia = buildTeamAnalysis("Australia", source, teamPools);

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

const copyScheduledScore = (
  game: Readonly<ScheduledGame>,
  homeScore: number | null,
  awayScore: number | null,
): ScheduledGame =>
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
      score: homeScore,
    }),
    away: Team.make({
      id: game.away.id,
      code: game.away.code,
      name: game.away.name,
      flagUrl: game.away.flagUrl,
      score: awayScore,
    }),
  });

const replaceTeamStats = (
  game: Readonly<GameDetails>,
  team: string,
  changes: Readonly<Record<string, string>>,
): GameDetails =>
  copyGameWithStats(
    game,
    game.teamStats.map((row) =>
      row.team === team
        ? TeamStat.make({ team: row.team, stats: { ...row.stats, ...changes } })
        : row,
    ),
  );

describe("team analysis", () => {
  it("round-trips through its runtime schema", () => {
    const encoded = Schema.encodeSync(TeamAnalysis)(australia);
    expect(Schema.decodeUnknownSync(TeamAnalysis)(encoded)).toEqual(australia);
  });

  it("builds Australia's verified performance dossier from eligible games", () => {
    expect(australia.completedGames).toBe(3);
    expect(australia.eligibleGames).toBe(3);
    expect(australia.excludedCompletedGames).toBe(0);
    expect(australia.context).toMatchObject({
      team: "Australia",
      games: 3,
      wins: 2,
      losses: 1,
      averageGoalsFor: 15,
    });
    expect(
      australia.benchmarks.find(
        (benchmark) => benchmark.metric === "shooting-percentage",
      ),
    ).toMatchObject({
      rate: { numerator: 45, denominator: 84 },
      sampleGames: 3,
    });
    expect(
      australia.benchmarks.find(
        (benchmark) => benchmark.metric === "draw-control-percentage",
      ),
    ).toMatchObject({
      rate: { numerator: 50, denominator: 80 },
      sampleGames: 3,
    });
    expect(australia.scoring.goals).toBe(45);
    expect(
      Object.values(australia.scoring.periodGoals).reduce(
        (total, goals) => total + goals,
        0,
      ),
    ).toBe(45);
    expect(
      Object.values(australia.scoring.periodGoalsAgainst).reduce(
        (total, goals) => total + goals,
        0,
      ),
    ).toBe(25);
    expect(
      australia.scoring.aheadSeconds +
        australia.scoring.tiedSeconds +
        australia.scoring.behindSeconds,
    ).toBe(australia.scoring.observedSeconds);
    const points = australia.playerLeaderboards.find(
      (leaderboard) => leaderboard.metric === "points",
    );
    expect(points?.sampleGames).toBe(3);
    expect(points?.entries[0]).toMatchObject({
      name: "LATCH Georgia",
      value: 12,
    });
    expect(australia.games[0]).toMatchObject({
      opponent: "Wales",
      shooting: { value: 37.5, numerator: 9, denominator: 24 },
      drawControl: {
        value: 57.894_736_842_105_27,
        numerator: 11,
        denominator: 19,
      },
    });
    expect(australia.games.at(-1)).toMatchObject({
      opponent: "Israel",
      status: "UPCOMING",
      eligible: false,
    });
  });

  it("keeps every team result, rate, and player sample internally consistent", () => {
    for (const team of tournament.teams) {
      const analysis = buildTeamAnalysis(team.name, source, teamPools);
      expect(analysis.generatedFrom).toBe(source.updatedAt);
      expect(analysis.excludedCompletedGames).toBe(
        analysis.completedGames - analysis.eligibleGames,
      );
      for (const benchmark of analysis.benchmarks) {
        expect(benchmark.rate.denominator).toBeGreaterThan(0);
        expect(benchmark.sampleGames).toBeGreaterThan(0);
        const expected =
          (benchmark.rate.numerator / benchmark.rate.denominator) *
          (benchmark.rate.scale === "percentage" ? 100 : 1);
        expect(benchmark.rate.value).toBeCloseTo(expected);
      }
      if (analysis.scoring.observedSeconds > 0)
        expect(
          analysis.scoring.aheadSeconds +
            analysis.scoring.tiedSeconds +
            analysis.scoring.behindSeconds,
        ).toBe(analysis.scoring.observedSeconds);
      expect(
        analysis.games.filter((game) => game.result !== null),
      ).toHaveLength(analysis.completedGames);
      Schema.decodeUnknownSync(TeamAnalysis)(
        Schema.encodeSync(TeamAnalysis)(analysis),
      );
    }
  }, 15_000);

  it("withholds a malformed player metric game instead of parsing a numeric prefix", () => {
    const game = championship.games.find((candidate) => candidate.id === "84");
    expect(game).toBeDefined();
    if (!game) return;
    const teamStats = game.teamStats.map((row) =>
      row.team === "Australia"
        ? TeamStat.make({
            team: row.team,
            stats: {
              ...row.stats,
              Assists: `${row.stats.Assists ?? "0"} source`,
            },
          })
        : row,
    );
    const games = championship.games.map((candidate) =>
      candidate.id === game.id
        ? copyGameWithStats(candidate, teamStats)
        : candidate,
    );
    const analysis = buildTeamAnalysis(
      "Australia",
      { ...source, games },
      teamPools,
    );

    expect(
      analysis.playerLeaderboards.find(
        (leaderboard) => leaderboard.metric === "goals",
      )?.sampleGames,
    ).toBe(3);
    expect(
      analysis.playerLeaderboards.find(
        (leaderboard) => leaderboard.metric === "recorded-assists",
      )?.sampleGames,
    ).toBe(2);
    expect(
      analysis.playerLeaderboards.find(
        (leaderboard) => leaderboard.metric === "points",
      )?.sampleGames,
    ).toBe(2);
  });

  it("shows missing detail coverage without using a stale completed-game analysis", () => {
    const analysis = buildTeamAnalysis(
      "Australia",
      {
        ...source,
        games: championship.games.filter((game) => game.id !== "84"),
      },
      teamPools,
    );

    expect(analysis.completedGames).toBe(3);
    expect(analysis.eligibleGames).toBe(2);
    expect(analysis.excludedCompletedGames).toBe(1);
    expect(analysis.games.find((game) => game.gameId === "84")).toMatchObject({
      eligible: false,
      result: "W",
      shooting: null,
      drawControl: null,
      closeGame: null,
      largestLead: null,
      longestRunGoals: null,
    });
    expect(analysis.benchmarks).toHaveLength(6);
    expect(
      analysis.benchmarks.every((benchmark) => benchmark.sampleGames === 2),
    ).toBe(true);
  });

  it("uses the verified score for shooting when the source Goals summary is wrong", () => {
    const game = championship.games.find((candidate) => candidate.id === "84");
    expect(game).toBeDefined();
    if (!game) return;
    for (const sourceGoals of ["1", "41"]) {
      const changed = replaceTeamStats(game, "Australia", {
        Goals: sourceGoals,
      });
      const analysis = buildTeamAnalysis(
        "Australia",
        {
          ...source,
          games: championship.games.map((candidate) =>
            candidate.id === game.id ? changed : candidate,
          ),
        },
        teamPools,
      );
      expect(
        analysis.games.find((candidate) => candidate.gameId === game.id)
          ?.shooting,
      ).toMatchObject({ value: 62.5, numerator: 25, denominator: 40 });
      expect(
        analysis.benchmarks.find(
          (benchmark) => benchmark.metric === "shooting-percentage",
        )?.rate,
      ).toMatchObject({ numerator: 45, denominator: 84 });
    }
  });

  it("withholds the team save rate on malformed or conflicting source ratios", () => {
    const game = championship.games.find((candidate) => candidate.id === "84");
    expect(game).toBeDefined();
    if (!game) return;
    for (const saves of ["1 / 6 (16.7%) source", "1 / 999 (0.1%)"]) {
      const changed = replaceTeamStats(game, "Australia", { Saves: saves });
      const analysis = buildTeamAnalysis(
        "Australia",
        {
          ...source,
          games: championship.games.map((candidate) =>
            candidate.id === game.id ? changed : candidate,
          ),
        },
        teamPools,
      );
      expect(
        analysis.benchmarks.some(
          (benchmark) => benchmark.metric === "save-percentage",
        ),
      ).toBe(false);
    }
  });

  it("revalidates schedule and detail evidence inside the public builder", () => {
    const scheduled = tournament.schedule.find(
      (candidate) => candidate.id === "84",
    );
    expect(scheduled).toBeDefined();
    if (!scheduled) return;
    const changedSchedule = tournament.schedule.map((game) =>
      game.id === scheduled.id ? copyScheduledScore(game, 24, 5) : game,
    );
    const analysis = buildTeamAnalysis(
      "Australia",
      { ...source, schedule: changedSchedule },
      teamPools,
    );

    expect(analysis.completedGames).toBe(3);
    expect(analysis.eligibleGames).toBe(2);
    expect(analysis.scoring.goals).toBe(20);
    expect(
      analysis.games.find((game) => game.gameId === scheduled.id),
    ).toMatchObject({
      goalsFor: 24,
      goalsAgainst: 5,
      eligible: false,
      shooting: null,
      drawControl: null,
      closeGame: null,
    });

    const duplicate = championship.games.find(
      (game) => game.id === scheduled.id,
    );
    expect(duplicate).toBeDefined();
    if (!duplicate) return;
    const duplicateAnalysis = buildTeamAnalysis(
      "Australia",
      { ...source, games: [...championship.games, duplicate] },
      teamPools,
    );
    expect(duplicateAnalysis.eligibleGames).toBe(2);
    expect(
      duplicateAnalysis.games.find((game) => game.gameId === scheduled.id),
    ).toMatchObject({ eligible: false, shooting: null });
  });

  it("rejects duplicate stat evidence for metric-specific rates", () => {
    const game = championship.games.find((candidate) => candidate.id === "84");
    expect(game).toBeDefined();
    if (!game) return;
    const australiaStats = game.teamStats.find(
      (row) => row.team === "Australia",
    );
    expect(australiaStats).toBeDefined();
    if (!australiaStats) return;
    const duplicate = copyGameWithStats(game, [
      ...game.teamStats,
      TeamStat.make({
        team: australiaStats.team,
        stats: australiaStats.stats,
      }),
    ]);
    const analysis = buildTeamAnalysis(
      "Australia",
      {
        ...source,
        games: championship.games.map((candidate) =>
          candidate.id === game.id ? duplicate : candidate,
        ),
      },
      teamPools,
    );

    expect(
      analysis.games.find((candidate) => candidate.gameId === game.id),
    ).toMatchObject({ shooting: null, drawControl: null });
    expect(
      analysis.benchmarks.some(
        (benchmark) => benchmark.metric === "shooting-percentage",
      ),
    ).toBe(false);
  });

  it("does not count final-status rows without a decisive score", () => {
    const scheduled = tournament.schedule.find(
      (candidate) => candidate.id === "84",
    );
    expect(scheduled).toBeDefined();
    if (!scheduled) return;
    for (const scores of [
      { home: null, away: null },
      { home: 5, away: 5 },
    ]) {
      const schedule = tournament.schedule.map((game) =>
        game.id === scheduled.id
          ? copyScheduledScore(game, scores.home, scores.away)
          : game,
      );
      const analysis = buildTeamAnalysis(
        "Australia",
        { ...source, schedule },
        teamPools,
      );
      expect(analysis.completedGames).toBe(2);
      expect(analysis.eligibleGames).toBe(2);
      expect(
        analysis.games.find((game) => game.gameId === scheduled.id),
      ).toMatchObject({
        result: null,
        eligible: false,
        shooting: null,
        drawControl: null,
        closeGame: null,
      });
    }
  });

  it("withholds a matching tied final without throwing", () => {
    const scheduled = tournament.schedule.find(
      (candidate) => candidate.id === "84",
    );
    const detail = championship.games.find(
      (candidate) => candidate.id === "84",
    );
    expect(scheduled).toBeDefined();
    expect(detail).toBeDefined();
    if (!scheduled || !detail) return;
    const tiedSchedule = copyScheduledScore(scheduled, 0, 0);
    const tiedDetail = GameDetails.make({
      id: detail.id,
      url: detail.url,
      competition: detail.competition,
      phase: detail.phase,
      date: detail.date,
      time: detail.time,
      venue: detail.venue,
      status: detail.status,
      home: Team.make({
        id: detail.home.id,
        code: detail.home.code,
        name: detail.home.name,
        flagUrl: detail.home.flagUrl,
        score: 0,
      }),
      away: Team.make({
        id: detail.away.id,
        code: detail.away.code,
        name: detail.away.name,
        flagUrl: detail.away.flagUrl,
        score: 0,
      }),
      periodScores: detail.periodScores.map((period) =>
        PeriodScore.make({
          team: period.team,
          scores: Object.fromEntries(
            Object.keys(period.scores).map((key) => [key, "0"]),
          ),
        }),
      ),
      teamStats: detail.teamStats,
      plays: detail.plays.filter((play) => play.action !== "Goal"),
      derivedPlayerStats: detail.derivedPlayerStats,
      rosters: detail.rosters,
      officials: detail.officials,
    });
    const analysis = buildTeamAnalysis(
      "Australia",
      {
        ...source,
        schedule: tournament.schedule.map((game) =>
          game.id === tiedSchedule.id ? tiedSchedule : game,
        ),
        games: championship.games.map((game) =>
          game.id === tiedDetail.id ? tiedDetail : game,
        ),
      },
      teamPools,
    );

    expect(analysis.completedGames).toBe(2);
    expect(analysis.eligibleGames).toBe(2);
    expect(
      analysis.games.find((game) => game.gameId === tiedSchedule.id),
    ).toMatchObject({ result: null, eligible: false });
  });

  it("rejects invalid formulas, sample counts, and ineligible analytical fields", () => {
    const encoded = Schema.encodeSync(TeamAnalysis)(australia);
    const firstBenchmark = encoded.benchmarks[0];
    const upcoming = encoded.games.find((game) => !game.eligible);
    expect(firstBenchmark).toBeDefined();
    expect(upcoming).toBeDefined();
    if (!firstBenchmark || !upcoming) return;

    expect(() =>
      Schema.decodeUnknownSync(TeamAnalysis)({
        ...encoded,
        eligibleGames: encoded.eligibleGames + 1,
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(TeamAnalysis)({
        ...encoded,
        benchmarks: [
          {
            ...firstBenchmark,
            rate: {
              ...firstBenchmark.rate,
              value: firstBenchmark.rate.value + 1,
            },
          },
          ...encoded.benchmarks.slice(1),
        ],
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(TeamAnalysis)({
        ...encoded,
        scoring: {
          ...encoded.scoring,
          aheadSeconds: encoded.scoring.aheadSeconds + 1,
        },
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(TeamAnalysis)({
        ...encoded,
        games: encoded.games.map((game) =>
          game.gameId === upcoming.gameId
            ? {
                ...game,
                shooting: { value: 50, numerator: 1, denominator: 2 },
              }
            : game,
        ),
      }),
    ).toThrow();
    const fractionalNumerator = firstBenchmark.rate.numerator + 0.5;
    expect(() =>
      Schema.decodeUnknownSync(TeamAnalysis)({
        ...encoded,
        benchmarks: [
          {
            ...firstBenchmark,
            rate: {
              ...firstBenchmark.rate,
              numerator: fractionalNumerator,
              value:
                (fractionalNumerator / firstBenchmark.rate.denominator) *
                (firstBenchmark.rate.scale === "percentage" ? 100 : 1),
            },
          },
          ...encoded.benchmarks.slice(1),
        ],
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(TeamAnalysis)({
        ...encoded,
        completedGames: encoded.completedGames + 1,
        eligibleGames: encoded.eligibleGames + 1,
        scoring: {
          ...encoded.scoring,
          sampleGames: encoded.scoring.sampleGames + 1,
        },
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(TeamAnalysis)({
        ...encoded,
        benchmarks: [...encoded.benchmarks, firstBenchmark],
      }),
    ).toThrow();
    const firstLeaderboard = encoded.playerLeaderboards[0];
    const firstEntry = firstLeaderboard?.entries[0];
    expect(firstLeaderboard).toBeDefined();
    expect(firstEntry).toBeDefined();
    if (!firstLeaderboard || !firstEntry) return;
    expect(() =>
      Schema.decodeUnknownSync(TeamAnalysis)({
        ...encoded,
        playerLeaderboards: [
          {
            ...firstLeaderboard,
            entries: [{ ...firstEntry, team: "Another team" }],
          },
          ...encoded.playerLeaderboards.slice(1),
        ],
      }),
    ).toThrow();
  });
});
