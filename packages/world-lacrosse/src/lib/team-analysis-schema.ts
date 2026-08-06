import { Schema } from "effect";

import {
  TournamentPlayerMetric,
  TournamentPlayerRank,
  TournamentTeamContext,
} from "./tournament-context-schema";

const NonNegativeInteger = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
);
const PositiveInteger = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThan(0),
);
const NonNegativeNumber = Schema.Number.check(Schema.isGreaterThanOrEqualTo(0));
const Percentage = Schema.Number.check(
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(100),
);

export const TeamBenchmarkMetric = Schema.Union([
  Schema.Literal("goals-per-game"),
  Schema.Literal("goals-against-per-game"),
  Schema.Literal("goal-difference-per-game"),
  Schema.Literal("shooting-percentage"),
  Schema.Literal("draw-control-percentage"),
  Schema.Literal("save-percentage"),
]);
export type TeamBenchmarkMetric = typeof TeamBenchmarkMetric.Type;

export const TeamRateScale = Schema.Union([
  Schema.Literal("per-unit"),
  Schema.Literal("percentage"),
]);
export type TeamRateScale = typeof TeamRateScale.Type;

export const TeamRate = Schema.Struct({
  value: Schema.Number,
  numerator: Schema.Number.check(Schema.isInt()),
  denominator: PositiveInteger,
  scale: TeamRateScale,
}).check(
  Schema.makeFilter((rate) => {
    const expected =
      (rate.numerator / rate.denominator) *
      (rate.scale === "percentage" ? 100 : 1);
    if (Math.abs(rate.value - expected) > 0.000_001)
      return "rate value must match its numerator, denominator, and scale";
    if (
      rate.scale === "percentage" &&
      (rate.numerator < 0 ||
        rate.numerator > rate.denominator ||
        rate.value < 0 ||
        rate.value > 100)
    )
      return "percentage rate must remain between zero and 100";
  }),
);
export type TeamRate = typeof TeamRate.Type;

export const TeamBenchmark = Schema.Struct({
  metric: TeamBenchmarkMetric,
  rate: TeamRate,
  sampleGames: PositiveInteger,
}).check(
  Schema.makeFilter((benchmark) => {
    const percentageMetric = benchmark.metric.endsWith("percentage");
    if (
      percentageMetric !== (benchmark.rate.scale === "percentage") ||
      (!percentageMetric &&
        benchmark.rate.denominator !== benchmark.sampleGames)
    )
      return "benchmark scale and sample must match its metric";
  }),
);
export type TeamBenchmark = typeof TeamBenchmark.Type;

export class TeamRunSummary extends Schema.Class<TeamRunSummary>(
  "WorldLacrosseTeamRunSummary",
)({
  gameId: Schema.String,
  opponent: Schema.String,
  goals: PositiveInteger,
  durationSeconds: Schema.NullOr(NonNegativeInteger),
}) {}

export const TeamScoringProfile = Schema.Struct({
  sampleGames: NonNegativeInteger,
  periodGoals: Schema.Record(Schema.String, NonNegativeInteger),
  periodGoalsAgainst: Schema.Record(Schema.String, NonNegativeInteger),
  goals: NonNegativeInteger,
  recordedAssistedGoals: NonNegativeInteger,
  knownScorerGoals: NonNegativeInteger,
  recordedScorers: NonNegativeInteger,
  goalsWhileTied: NonNegativeInteger,
  goalsWhileTrailing: NonNegativeInteger,
  responseGoals: NonNegativeInteger,
  responseOpportunities: NonNegativeInteger,
  largestLead: NonNegativeInteger,
  longestRun: Schema.NullOr(TeamRunSummary),
  aheadSeconds: NonNegativeInteger,
  tiedSeconds: NonNegativeInteger,
  behindSeconds: NonNegativeInteger,
  observedSeconds: NonNegativeInteger,
  timeSampleGames: NonNegativeInteger,
  averageCloseGameSeconds: Schema.NullOr(NonNegativeNumber),
  closeGameSampleGames: NonNegativeInteger,
}).check(
  Schema.makeFilter((profile) => {
    const issues: Schema.FilterIssue[] = [];
    const periodGoals = Object.values(profile.periodGoals).reduce(
      (total, goals) => total + goals,
      0,
    );
    if (periodGoals !== profile.goals)
      issues.push({
        path: ["periodGoals"],
        issue: "period goals must sum to verified goals",
      });
    if (
      profile.recordedAssistedGoals > profile.goals ||
      profile.knownScorerGoals > profile.goals
    )
      issues.push({
        path: ["goals"],
        issue: "attributed goals must not exceed verified goals",
      });
    if (profile.responseGoals > profile.responseOpportunities)
      issues.push({
        path: ["responseGoals"],
        issue: "responses must not exceed opportunities",
      });
    if (
      profile.aheadSeconds + profile.tiedSeconds + profile.behindSeconds !==
      profile.observedSeconds
    )
      issues.push({
        path: ["observedSeconds"],
        issue: "clock states must sum to observed seconds",
      });
    if (
      profile.timeSampleGames > profile.sampleGames ||
      profile.closeGameSampleGames > profile.sampleGames
    )
      issues.push({
        path: ["sampleGames"],
        issue: "metric samples must not exceed the scoring sample",
      });
    return issues;
  }),
);
export type TeamScoringProfile = typeof TeamScoringProfile.Type;

export class TeamPlayerLeaderboard extends Schema.Class<TeamPlayerLeaderboard>(
  "WorldLacrosseTeamPlayerLeaderboard",
)({
  metric: TournamentPlayerMetric,
  sampleGames: NonNegativeInteger,
  entries: Schema.Array(TournamentPlayerRank),
}) {}

export const TeamGameResult = Schema.Union([
  Schema.Literal("W"),
  Schema.Literal("L"),
]);
export type TeamGameResult = typeof TeamGameResult.Type;

export const TeamGameRate = Schema.Struct({
  value: Percentage,
  numerator: NonNegativeInteger,
  denominator: PositiveInteger,
}).check(
  Schema.makeFilter((rate) =>
    Math.abs(rate.value - (rate.numerator / rate.denominator) * 100) <=
    0.000_001
      ? undefined
      : "game rate must match its numerator and denominator",
  ),
);
export type TeamGameRate = typeof TeamGameRate.Type;

export const TeamGameAnalysis = Schema.Struct({
  gameId: Schema.String,
  date: Schema.String,
  time: Schema.String,
  phase: Schema.String,
  venue: Schema.String,
  status: Schema.String,
  period: Schema.NullOr(Schema.String),
  opponentId: Schema.NullOr(Schema.String),
  opponentCode: Schema.String,
  opponent: Schema.String,
  opponentFlagUrl: Schema.NullOr(Schema.String),
  isHome: Schema.Boolean,
  goalsFor: Schema.NullOr(NonNegativeInteger),
  goalsAgainst: Schema.NullOr(NonNegativeInteger),
  result: Schema.NullOr(TeamGameResult),
  provisional: Schema.Boolean,
  eligible: Schema.Boolean,
  shooting: Schema.NullOr(TeamGameRate),
  drawControl: Schema.NullOr(TeamGameRate),
  closeGame: Schema.NullOr(TeamGameRate),
  largestLead: Schema.NullOr(NonNegativeInteger),
  longestRunGoals: Schema.NullOr(NonNegativeInteger),
}).check(
  Schema.makeFilter((game) => {
    const analyticalValues = [
      game.shooting,
      game.drawControl,
      game.closeGame,
      game.largestLead,
      game.longestRunGoals,
    ];
    if (!game.eligible && analyticalValues.some((value) => value !== null))
      return "ineligible games must not expose analytical values";
    if (game.eligible && game.result === null)
      return "eligible games must have a completed result";
    if (
      game.result !== null &&
      (game.goalsFor === null ||
        game.goalsAgainst === null ||
        game.goalsFor === game.goalsAgainst ||
        (game.result === "W" && game.goalsFor < game.goalsAgainst) ||
        (game.result === "L" && game.goalsFor > game.goalsAgainst))
    )
      return "game result must match its verified score";
  }),
);
export type TeamGameAnalysis = typeof TeamGameAnalysis.Type;

export const TeamAnalysis = Schema.Struct({
  generatedFrom: Schema.String,
  team: Schema.String,
  completedGames: NonNegativeInteger,
  eligibleGames: NonNegativeInteger,
  excludedCompletedGames: NonNegativeInteger,
  context: Schema.NullOr(TournamentTeamContext),
  benchmarks: Schema.Array(TeamBenchmark),
  scoring: TeamScoringProfile,
  playerLeaderboards: Schema.Array(TeamPlayerLeaderboard),
  games: Schema.Array(TeamGameAnalysis),
}).check(
  Schema.makeFilter((analysis) => {
    const issues: Schema.FilterIssue[] = [];
    if (
      analysis.eligibleGames + analysis.excludedCompletedGames !==
      analysis.completedGames
    )
      issues.push({
        path: ["excludedCompletedGames"],
        issue: "completed sample must split into eligible and excluded games",
      });
    if (analysis.scoring.sampleGames !== analysis.eligibleGames)
      issues.push({
        path: ["scoring", "sampleGames"],
        issue: "scoring sample must match eligible games",
      });
    if (
      analysis.benchmarks.some(
        (benchmark) => benchmark.sampleGames > analysis.eligibleGames,
      ) ||
      analysis.playerLeaderboards.some(
        (leaderboard) => leaderboard.sampleGames > analysis.eligibleGames,
      )
    )
      issues.push({
        path: ["eligibleGames"],
        issue: "metric samples must not exceed eligible games",
      });
    const completedRows = analysis.games.filter(
      (game) => game.result !== null,
    ).length;
    const eligibleRows = analysis.games.filter((game) => game.eligible).length;
    if (completedRows !== analysis.completedGames)
      issues.push({
        path: ["completedGames"],
        issue: "completed count must match decisive result rows",
      });
    if (eligibleRows !== analysis.eligibleGames)
      issues.push({
        path: ["eligibleGames"],
        issue: "eligible count must match eligible game rows",
      });
    const gameIds = analysis.games.map((game) => game.gameId);
    if (new Set(gameIds).size !== gameIds.length)
      issues.push({
        path: ["games"],
        issue: "game IDs must be unique",
      });
    const benchmarkMetrics = analysis.benchmarks.map(
      (benchmark) => benchmark.metric,
    );
    if (new Set(benchmarkMetrics).size !== benchmarkMetrics.length)
      issues.push({
        path: ["benchmarks"],
        issue: "benchmark metrics must be unique",
      });
    const playerMetrics = analysis.playerLeaderboards.map(
      (leaderboard) => leaderboard.metric,
    );
    if (new Set(playerMetrics).size !== playerMetrics.length)
      issues.push({
        path: ["playerLeaderboards"],
        issue: "player leaderboard metrics must be unique",
      });
    if (
      analysis.playerLeaderboards.some((leaderboard) =>
        leaderboard.entries.some((entry) => entry.team !== analysis.team),
      )
    )
      issues.push({
        path: ["playerLeaderboards"],
        issue: "player leaderboard entries must belong to the selected team",
      });
    if (
      analysis.context !== null &&
      (analysis.context.team !== analysis.team ||
        analysis.context.games !== analysis.eligibleGames)
    )
      issues.push({
        path: ["context"],
        issue: "team context must match the selected team and eligible sample",
      });
    return issues;
  }),
);
export type TeamAnalysis = typeof TeamAnalysis.Type;
