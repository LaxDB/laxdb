import { Schema } from "effect";

import {
  MatchInsightScore,
  MatchInsightSide,
  MatchInsightTeam,
} from "./match-insights-schema";
import { GameId } from "./schema";

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

export const TournamentContextRank = Schema.Struct({
  rank: PositiveInteger,
  total: PositiveInteger,
  percentile: Percentage,
  tied: Schema.Boolean,
}).check(
  Schema.makeFilter((value) => {
    const expectedPercentile =
      value.total <= 1
        ? 100
        : ((value.total - value.rank) / (value.total - 1)) * 100;
    const issues: Schema.FilterIssue[] = [];
    if (value.rank > value.total)
      issues.push({ path: ["rank"], issue: "rank must not exceed total" });
    if (Math.abs(value.percentile - expectedPercentile) > 0.000_001)
      issues.push({
        path: ["percentile"],
        issue: "percentile must match the rank and total",
      });
    return issues;
  }),
);
export type TournamentContextRank = typeof TournamentContextRank.Type;

export class TournamentContextSample extends Schema.Class<TournamentContextSample>(
  "WorldLacrosseTournamentContextSample",
)({
  eligibleGames: NonNegativeInteger,
  excludedGames: NonNegativeInteger,
  eligibleTeamGames: NonNegativeInteger,
  completedThrough: Schema.NullOr(Schema.String),
  sourceUpdatedAt: Schema.NullOr(Schema.String),
  criteria: Schema.String,
}) {}

export class TournamentContextGame extends Schema.Class<TournamentContextGame>(
  "WorldLacrosseTournamentContextGame",
)({
  gameId: GameId,
  date: Schema.String,
  phase: Schema.String,
  home: MatchInsightTeam,
  away: MatchInsightTeam,
  score: MatchInsightScore,
}) {}

export class TournamentCloseGameRecord extends Schema.Class<TournamentCloseGameRecord>(
  "WorldLacrosseTournamentCloseGameRecord",
)({
  game: TournamentContextGame,
  closeGameSeconds: NonNegativeInteger,
  observedSeconds: PositiveInteger,
  closeGameShare: Percentage,
  rank: TournamentContextRank,
}) {}

export class TournamentBurstRecord extends Schema.Class<TournamentBurstRecord>(
  "WorldLacrosseTournamentBurstRecord",
)({
  game: TournamentContextGame,
  side: MatchInsightSide,
  team: Schema.String,
  goals: PositiveInteger,
  durationSeconds: NonNegativeInteger,
  startPeriod: Schema.String,
  startClock: Schema.String,
  endPeriod: Schema.String,
  endClock: Schema.String,
  rank: TournamentContextRank,
}) {}

export class TournamentComebackRecord extends Schema.Class<TournamentComebackRecord>(
  "WorldLacrosseTournamentComebackRecord",
)({
  game: TournamentContextGame,
  winner: Schema.String,
  deficitGoals: PositiveInteger,
  rank: TournamentContextRank,
}) {}

export class TournamentCloseShootingRecord extends Schema.Class<TournamentCloseShootingRecord>(
  "WorldLacrosseTournamentCloseShootingRecord",
)({
  game: TournamentContextGame,
  side: MatchInsightSide,
  team: Schema.String,
  goals: NonNegativeInteger,
  shots: PositiveInteger,
  percentage: Percentage,
  rank: TournamentContextRank,
}) {}

export const TournamentContextMetric = Schema.Union([
  Schema.Literal("close-game-share"),
  Schema.Literal("recovered-deficit"),
  Schema.Literal("fastest-2-goal-burst"),
  Schema.Literal("fastest-3-goal-burst"),
  Schema.Literal("fastest-4-goal-burst"),
  Schema.Literal("close-game-shooting"),
]);
export type TournamentContextMetric = typeof TournamentContextMetric.Type;

export const TournamentCloseGamePlacement = Schema.Struct({
  metric: Schema.Literal("close-game-share"),
  side: Schema.Null,
  team: Schema.Null,
  value: Percentage,
  numerator: NonNegativeInteger,
  denominator: PositiveInteger,
  rank: TournamentContextRank,
}).check(
  Schema.makeFilter((placement) =>
    Math.abs(
      placement.value - (placement.numerator / placement.denominator) * 100,
    ) <= 0.000_001
      ? undefined
      : "close-game share must match numerator and denominator",
  ),
);
export type TournamentCloseGamePlacement =
  typeof TournamentCloseGamePlacement.Type;

export class TournamentComebackPlacement extends Schema.Class<TournamentComebackPlacement>(
  "WorldLacrosseTournamentComebackPlacement",
)({
  metric: Schema.Literal("recovered-deficit"),
  side: Schema.Null,
  team: Schema.String,
  value: PositiveInteger,
  rank: TournamentContextRank,
}) {}

export class TournamentBurstPlacement extends Schema.Class<TournamentBurstPlacement>(
  "WorldLacrosseTournamentBurstPlacement",
)({
  metric: Schema.Union([
    Schema.Literal("fastest-2-goal-burst"),
    Schema.Literal("fastest-3-goal-burst"),
    Schema.Literal("fastest-4-goal-burst"),
  ]),
  side: MatchInsightSide,
  team: Schema.String,
  value: NonNegativeInteger,
  rank: TournamentContextRank,
}) {}

export const TournamentCloseShootingPlacement = Schema.Struct({
  metric: Schema.Literal("close-game-shooting"),
  side: MatchInsightSide,
  team: Schema.String,
  value: Percentage,
  numerator: NonNegativeInteger,
  denominator: PositiveInteger,
  rank: TournamentContextRank,
}).check(
  Schema.makeFilter((placement) => {
    const issues: Schema.FilterIssue[] = [];
    if (placement.numerator > placement.denominator)
      issues.push({
        path: ["numerator"],
        issue: "goals must not exceed shots",
      });
    if (
      Math.abs(
        placement.value - (placement.numerator / placement.denominator) * 100,
      ) > 0.000_001
    )
      issues.push({
        path: ["value"],
        issue: "shooting percentage must match goals and shots",
      });
    return issues;
  }),
);
export type TournamentCloseShootingPlacement =
  typeof TournamentCloseShootingPlacement.Type;

export const TournamentGamePlacement = Schema.Union([
  TournamentCloseGamePlacement,
  TournamentComebackPlacement,
  TournamentBurstPlacement,
  TournamentCloseShootingPlacement,
]);
export type TournamentGamePlacement = typeof TournamentGamePlacement.Type;

export class TournamentGameContext extends Schema.Class<TournamentGameContext>(
  "WorldLacrosseTournamentGameContext",
)({
  gameId: GameId,
  eligible: Schema.Boolean,
  placements: Schema.Array(TournamentGamePlacement),
}) {}

export class TournamentRecentResult extends Schema.Class<TournamentRecentResult>(
  "WorldLacrosseTournamentRecentResult",
)({
  gameId: GameId,
  date: Schema.String,
  opponent: Schema.String,
  result: Schema.Union([
    Schema.Literal("W"),
    Schema.Literal("L"),
    Schema.Literal("T"),
  ]),
  goalsFor: NonNegativeInteger,
  goalsAgainst: NonNegativeInteger,
}) {}

export class TournamentTeamContext extends Schema.Class<TournamentTeamContext>(
  "WorldLacrosseTournamentTeamContext",
)({
  team: Schema.String,
  pool: Schema.NullOr(Schema.String),
  games: NonNegativeInteger,
  wins: NonNegativeInteger,
  losses: NonNegativeInteger,
  ties: NonNegativeInteger,
  averageGoalsFor: NonNegativeNumber,
  averageGoalsAgainst: NonNegativeNumber,
  averageGoalDifference: Schema.Number,
  averageCloseGameSeconds: Schema.NullOr(NonNegativeNumber),
  closeGameSampleGames: NonNegativeInteger,
  recent: Schema.Array(TournamentRecentResult),
  opponentAdjustedMargin: Schema.NullOr(Schema.Number),
  opponentAdjustmentGames: NonNegativeInteger,
  opponentAdjustedRank: Schema.NullOr(TournamentContextRank),
}) {}

export const TournamentPlayerMetric = Schema.Union([
  Schema.Literal("points"),
  Schema.Literal("goals"),
  Schema.Literal("recorded-assists"),
  Schema.Literal("draw-controls"),
  Schema.Literal("ground-balls"),
  Schema.Literal("caused-turnovers"),
]);
export type TournamentPlayerMetric = typeof TournamentPlayerMetric.Type;

export class TournamentPlayerRank extends Schema.Class<TournamentPlayerRank>(
  "WorldLacrosseTournamentPlayerRank",
)({
  id: Schema.NullOr(Schema.String),
  name: Schema.String,
  team: Schema.String,
  value: NonNegativeInteger,
  rank: TournamentContextRank,
}) {}

export class TournamentPlayerLeaderboard extends Schema.Class<TournamentPlayerLeaderboard>(
  "WorldLacrosseTournamentPlayerLeaderboard",
)({
  metric: TournamentPlayerMetric,
  sampleGames: NonNegativeInteger,
  entries: Schema.Array(TournamentPlayerRank),
}) {}

export class TournamentGoalkeeperRank extends Schema.Class<TournamentGoalkeeperRank>(
  "WorldLacrosseTournamentGoalkeeperRank",
)({
  id: Schema.NullOr(Schema.String),
  name: Schema.String,
  team: Schema.String,
  games: PositiveInteger,
  estimatedMinutes: NonNegativeNumber,
  saves: NonNegativeInteger,
  goalsAllowed: NonNegativeInteger,
  savePercentage: Percentage,
  rank: TournamentContextRank,
}) {}

export class TournamentContext extends Schema.Class<TournamentContext>(
  "WorldLacrosseTournamentContext",
)({
  generatedFrom: Schema.String,
  sample: TournamentContextSample,
  games: Schema.Array(TournamentGameContext),
  closestGames: Schema.Array(TournamentCloseGameRecord),
  fastestBursts: Schema.Array(TournamentBurstRecord),
  largestComebacks: Schema.Array(TournamentComebackRecord),
  bestCloseGameShooting: Schema.Array(TournamentCloseShootingRecord),
  teams: Schema.Array(TournamentTeamContext),
  playerLeaderboards: Schema.Array(TournamentPlayerLeaderboard),
  goalkeeperTeamGameSample: NonNegativeInteger,
  goalkeeperExpectedTeamGames: NonNegativeInteger,
  goalkeeperRankings: Schema.Array(TournamentGoalkeeperRank),
}) {}
