import { Schema } from "effect";

import { GameId } from "./schema";

export const MatchInsightSide = Schema.Union([
  Schema.Literal("home"),
  Schema.Literal("away"),
]);
export type MatchInsightSide = typeof MatchInsightSide.Type;

export const MatchInsightCompleteness = Schema.Union([
  Schema.Literal("upcoming"),
  Schema.Literal("live"),
  Schema.Literal("provisional-final"),
  Schema.Literal("final-reconciled"),
  Schema.Literal("final-unreconciled"),
  Schema.Literal("unavailable"),
]);
export type MatchInsightCompleteness = typeof MatchInsightCompleteness.Type;

export const MatchInsightScoreConsistency = Schema.Union([
  Schema.Literal("consistent"),
  Schema.Literal("inconsistent"),
  Schema.Literal("not-checkable"),
]);
export type MatchInsightScoreConsistency =
  typeof MatchInsightScoreConsistency.Type;

export const MatchInsightAnomalyCode = Schema.Union([
  Schema.Literal("actorless-goal"),
  Schema.Literal("final-score-mismatch"),
  Schema.Literal("goal-side-mismatch"),
  Schema.Literal("invalid-score-transition"),
  Schema.Literal("malformed-clock"),
  Schema.Literal("malformed-score"),
  Schema.Literal("missing-end-game"),
  Schema.Literal("missing-start-game"),
  Schema.Literal("non-monotonic-clock"),
  Schema.Literal("non-terminal-end-game"),
  Schema.Literal("period-score-mismatch"),
  Schema.Literal("period-start-clock-mismatch"),
  Schema.Literal("period-clock-out-of-range"),
  Schema.Literal("period-end-clock-mismatch"),
  Schema.Literal("terminal-clock-mismatch"),
  Schema.Literal("unattributed-shot-event"),
  Schema.Literal("unattributed-overtime-event"),
  Schema.Literal("period-sequence-invalid"),
]);
export type MatchInsightAnomalyCode = typeof MatchInsightAnomalyCode.Type;

export class MatchInsightTeam extends Schema.Class<MatchInsightTeam>(
  "WorldLacrosseMatchInsightTeam",
)({
  id: Schema.NullOr(Schema.String),
  code: Schema.NullOr(Schema.String),
  name: Schema.String,
}) {}

export class MatchInsightScore extends Schema.Class<MatchInsightScore>(
  "WorldLacrosseMatchInsightScore",
)({
  home: Schema.Number,
  away: Schema.Number,
}) {}

export class MatchInsightParticipant extends Schema.Class<MatchInsightParticipant>(
  "WorldLacrosseMatchInsightParticipant",
)({
  id: Schema.NullOr(Schema.String),
  number: Schema.NullOr(Schema.String),
  name: Schema.String,
  team: Schema.String,
}) {}

export class MatchInsightAnomaly extends Schema.Class<MatchInsightAnomaly>(
  "WorldLacrosseMatchInsightAnomaly",
)({
  code: MatchInsightAnomalyCode,
  sourceIndex: Schema.NullOr(Schema.Number),
  period: Schema.NullOr(Schema.String),
  clock: Schema.NullOr(Schema.String),
  detail: Schema.String,
}) {}

export class MatchInsightGoal extends Schema.Class<MatchInsightGoal>(
  "WorldLacrosseMatchInsightGoal",
)({
  sequence: Schema.Number,
  sourceIndex: Schema.Number,
  period: Schema.String,
  clock: Schema.String,
  side: MatchInsightSide,
  team: Schema.String,
  scoreBefore: MatchInsightScore,
  score: MatchInsightScore,
  scorer: Schema.NullOr(MatchInsightParticipant),
  recordedAssist: Schema.NullOr(MatchInsightParticipant),
  freePosition: Schema.Boolean,
  equalizer: Schema.Boolean,
  goAhead: Schema.Boolean,
  leadChange: Schema.Boolean,
  gameWinner: Schema.Boolean,
}) {}

export class MatchInsightPeriod extends Schema.Class<MatchInsightPeriod>(
  "WorldLacrosseMatchInsightPeriod",
)({
  period: Schema.String,
  homeGoals: Schema.Number,
  awayGoals: Schema.Number,
  winner: Schema.NullOr(MatchInsightSide),
  scoreBefore: MatchInsightScore,
  score: MatchInsightScore,
}) {}

export class MatchInsightScoringRun extends Schema.Class<MatchInsightScoringRun>(
  "WorldLacrosseMatchInsightScoringRun",
)({
  side: MatchInsightSide,
  team: Schema.String,
  goals: Schema.Number,
  startSequence: Schema.Number,
  endSequence: Schema.Number,
  startPeriod: Schema.String,
  startClock: Schema.String,
  endPeriod: Schema.String,
  endClock: Schema.String,
  durationSeconds: Schema.NullOr(Schema.Number),
  scoreBefore: MatchInsightScore,
  score: MatchInsightScore,
}) {}

export class MatchInsightLargestLead extends Schema.Class<MatchInsightLargestLead>(
  "WorldLacrosseMatchInsightLargestLead",
)({
  side: MatchInsightSide,
  team: Schema.String,
  goals: Schema.Number,
  goalSequence: Schema.NullOr(Schema.Number),
  period: Schema.NullOr(Schema.String),
  clock: Schema.NullOr(Schema.String),
  score: MatchInsightScore,
}) {}

export class MatchInsightLargestDeficit extends Schema.Class<MatchInsightLargestDeficit>(
  "WorldLacrosseMatchInsightLargestDeficit",
)({
  side: MatchInsightSide,
  team: Schema.String,
  goals: Schema.Number,
  goalSequence: Schema.NullOr(Schema.Number),
  period: Schema.NullOr(Schema.String),
  clock: Schema.NullOr(Schema.String),
  score: MatchInsightScore,
}) {}

export class MatchInsightScoringContributor extends Schema.Class<MatchInsightScoringContributor>(
  "WorldLacrosseMatchInsightScoringContributor",
)({
  id: Schema.NullOr(Schema.String),
  number: Schema.NullOr(Schema.String),
  name: Schema.String,
  team: Schema.String,
  side: MatchInsightSide,
  goals: Schema.Number,
  recordedAssists: Schema.Number,
  points: Schema.Number,
  freePositionGoals: Schema.Number,
  goalsWithoutRecordedAssist: Schema.Number,
  goalInvolvements: Schema.Number,
  goalInvolvementShare: Schema.Number,
  equalizingGoals: Schema.Number,
  goAheadGoals: Schema.Number,
  responseGoals: Schema.Number,
  fourthQuarterGoals: Schema.Number,
}) {}

export class MatchInsightGameStateTime extends Schema.Class<MatchInsightGameStateTime>(
  "WorldLacrosseMatchInsightGameStateTime",
)({
  complete: Schema.Boolean,
  observedSeconds: Schema.Number,
  homeLeadingSeconds: Schema.Number,
  tiedSeconds: Schema.Number,
  awayLeadingSeconds: Schema.Number,
  oneGoalMarginSeconds: Schema.Number,
  twoGoalMarginSeconds: Schema.Number,
  threePlusMarginSeconds: Schema.Number,
  endpointPeriod: Schema.String,
  endpointClock: Schema.String,
}) {}

export class MatchInsightTeamShape extends Schema.Class<MatchInsightTeamShape>(
  "WorldLacrosseMatchInsightTeamShape",
)({
  side: MatchInsightSide,
  team: Schema.String,
  longestRunGoals: Schema.Number,
  longestDroughtSeconds: Schema.NullOr(Schema.Number),
  longestDroughtGoalsConceded: Schema.NullOr(Schema.Number),
  responseGoals: Schema.Number,
  responseOpportunities: Schema.Number,
  fastestResponseSeconds: Schema.NullOr(Schema.Number),
  averageResponseSeconds: Schema.NullOr(Schema.Number),
}) {}

export const MatchInsightSegmentName = Schema.Union([
  Schema.Literal("first-half"),
  Schema.Literal("second-half"),
  Schema.Literal("overtime"),
]);
export type MatchInsightSegmentName = typeof MatchInsightSegmentName.Type;

export class MatchInsightScoringSegment extends Schema.Class<MatchInsightScoringSegment>(
  "WorldLacrosseMatchInsightScoringSegment",
)({
  segment: MatchInsightSegmentName,
  homeGoals: Schema.Number,
  awayGoals: Schema.Number,
  winner: Schema.NullOr(MatchInsightSide),
}) {}

export class MatchInsightScoringBurst extends Schema.Class<MatchInsightScoringBurst>(
  "WorldLacrosseMatchInsightScoringBurst",
)({
  side: MatchInsightSide,
  team: Schema.String,
  goals: Schema.Number,
  durationSeconds: Schema.Number,
  startSequence: Schema.Number,
  endSequence: Schema.Number,
  startPeriod: Schema.String,
  startClock: Schema.String,
  endPeriod: Schema.String,
  endClock: Schema.String,
}) {}

export class MatchInsightTeamClosing extends Schema.Class<MatchInsightTeamClosing>(
  "WorldLacrosseMatchInsightTeamClosing",
)({
  side: MatchInsightSide,
  team: Schema.String,
  fourthQuarterGoals: Schema.Number,
  finalFiveMinuteGoals: Schema.NullOr(Schema.Number),
  overtimeGoals: Schema.Number,
  goalsWhileTied: Schema.Number,
  goalsWhileTrailing: Schema.Number,
  equalizingGoals: Schema.Number,
  goAheadGoals: Schema.Number,
}) {}

export class MatchInsightTeamShotSplit extends Schema.Class<MatchInsightTeamShotSplit>(
  "WorldLacrosseMatchInsightTeamShotSplit",
)({
  side: MatchInsightSide,
  team: Schema.String,
  segment: MatchInsightSegmentName,
  attributionComplete: Schema.Boolean,
  shots: Schema.Number,
  shotsOnGoal: Schema.Number,
  goals: Schema.Number,
  shotAccuracy: Schema.NullOr(Schema.Number),
  saves: Schema.Number,
  saveOpportunities: Schema.Number,
  savePercentage: Schema.NullOr(Schema.Number),
}) {}

export class MatchInsightTeamEventProfile extends Schema.Class<MatchInsightTeamEventProfile>(
  "WorldLacrosseMatchInsightTeamEventProfile",
)({
  side: MatchInsightSide,
  team: Schema.String,
  closeGameShots: Schema.Number,
  closeGameShotsOnGoal: Schema.Number,
  closeGameGoals: Schema.Number,
  longestSaveRun: Schema.Number,
  overtimeTurnovers: Schema.Number,
  overtimeDrawControls: Schema.Number,
  overtimeGroundBalls: Schema.Number,
  overtimeAttributionComplete: Schema.Boolean,
}) {}

export class MatchInsightScoringCombination extends Schema.Class<MatchInsightScoringCombination>(
  "WorldLacrosseMatchInsightScoringCombination",
)({
  side: MatchInsightSide,
  team: Schema.String,
  scorer: MatchInsightParticipant,
  recordedAssist: MatchInsightParticipant,
  goals: Schema.Number,
}) {}

export class MatchInsightTeamScoringProfile extends Schema.Class<MatchInsightTeamScoringProfile>(
  "WorldLacrosseMatchInsightTeamScoringProfile",
)({
  side: MatchInsightSide,
  team: Schema.String,
  goals: Schema.Number,
  knownScorerGoals: Schema.Number,
  uniqueRecordedScorers: Schema.Number,
  topScorers: Schema.Array(MatchInsightParticipant),
  topScorerGoals: Schema.Number,
  topScorerShare: Schema.NullOr(Schema.Number),
  recordedAssistedGoals: Schema.Number,
  recordedAssistRate: Schema.NullOr(Schema.Number),
  freePositionGoals: Schema.Number,
  freePositionAttempts: Schema.Number,
  freePositionConversion: Schema.NullOr(Schema.Number),
}) {}

export class MatchInsightTeamPerformance extends Schema.Class<MatchInsightTeamPerformance>(
  "WorldLacrosseMatchInsightTeamPerformance",
)({
  side: MatchInsightSide,
  team: Schema.String,
  shots: Schema.NullOr(Schema.Number),
  shotsOnGoal: Schema.NullOr(Schema.Number),
  shotAccuracy: Schema.NullOr(Schema.Number),
  shootingPercentage: Schema.NullOr(Schema.Number),
  saves: Schema.NullOr(Schema.Number),
  savePercentage: Schema.NullOr(Schema.Number),
  drawControls: Schema.NullOr(Schema.Number),
  groundBalls: Schema.NullOr(Schema.Number),
  causedTurnovers: Schema.NullOr(Schema.Number),
  turnovers: Schema.NullOr(Schema.Number),
}) {}

export class MatchInsightTeamDiscipline extends Schema.Class<MatchInsightTeamDiscipline>(
  "WorldLacrosseMatchInsightTeamDiscipline",
)({
  side: MatchInsightSide,
  team: Schema.String,
  cardEvents: Schema.Number,
  yellowCards: Schema.Number,
  yellowRedCards: Schema.Number,
  redCards: Schema.Number,
  recordedPenaltyMinutes: Schema.Number,
}) {}

export class MatchInsightQuality extends Schema.Class<MatchInsightQuality>(
  "WorldLacrosseMatchInsightQuality",
)({
  completeness: MatchInsightCompleteness,
  scoreConsistency: MatchInsightScoreConsistency,
  periodScoreConsistency: MatchInsightScoreConsistency,
  scoreFlowValid: Schema.Boolean,
  periodStartsValid: Schema.Boolean,
  periodEndsValid: Schema.Boolean,
  terminalClockValid: Schema.Boolean,
  goalClockFlowValid: Schema.Boolean,
  sourcePlayCount: Schema.Number,
  parsedGoalCount: Schema.Number,
  ignoredGoalCount: Schema.Number,
  unattributedFreePositionAttempts: Schema.Number,
  unattributedShotEvents: Schema.Number,
  unattributedOvertimeEvents: Schema.Number,
  unattributedCardEvents: Schema.Number,
  anomalies: Schema.Array(MatchInsightAnomaly),
}) {}

export class MatchInsights extends Schema.Class<MatchInsights>(
  "WorldLacrosseMatchInsights",
)({
  gameId: GameId,
  status: Schema.String,
  home: MatchInsightTeam,
  away: MatchInsightTeam,
  score: MatchInsightScore,
  leader: Schema.NullOr(MatchInsightSide),
  winner: Schema.NullOr(MatchInsightSide),
  leadChanges: Schema.Number,
  timesTied: Schema.Number,
  winnerLargestDeficit: Schema.NullOr(Schema.Number),
  wentToOvertime: Schema.Boolean,
  gameWinningGoalSequence: Schema.NullOr(Schema.Number),
  largestLeads: Schema.Array(MatchInsightLargestLead),
  largestDeficits: Schema.Array(MatchInsightLargestDeficit),
  periods: Schema.Array(MatchInsightPeriod),
  goals: Schema.Array(MatchInsightGoal),
  scoringRuns: Schema.Array(MatchInsightScoringRun),
  scoringContributors: Schema.Array(MatchInsightScoringContributor),
  gameStateTime: Schema.NullOr(MatchInsightGameStateTime),
  teamShapes: Schema.Array(MatchInsightTeamShape),
  scoringSegments: Schema.Array(MatchInsightScoringSegment),
  biggestPeriodSwings: Schema.Array(MatchInsightPeriod),
  fastestScoringBursts: Schema.Array(MatchInsightScoringBurst),
  closing: Schema.Array(MatchInsightTeamClosing),
  scoringProfiles: Schema.Array(MatchInsightTeamScoringProfile),
  scoringCombinations: Schema.Array(MatchInsightScoringCombination),
  shotSplits: Schema.Array(MatchInsightTeamShotSplit),
  eventProfiles: Schema.Array(MatchInsightTeamEventProfile),
  teamPerformance: Schema.Array(MatchInsightTeamPerformance),
  discipline: Schema.Array(MatchInsightTeamDiscipline),
  quality: MatchInsightQuality,
}) {}

export class MatchInsightsDataset extends Schema.Class<MatchInsightsDataset>(
  "WorldLacrosseMatchInsightsDataset",
)({
  generatedFrom: Schema.String,
  games: Schema.Array(MatchInsights),
}) {}
