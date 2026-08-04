import { Schema } from "effect";

import {
  TeamComparisonMetricEvidence,
  teamComparisonMetricEvidenceIssues,
} from "./team-comparison-schema";

const NonNegativeInteger = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
);
const FiniteNumber = Schema.Number.check(Schema.isFinite());

export const OpponentRecordGroup = Schema.Literals([
  "above-500",
  "at-500",
  "below-500",
  "unclassified",
]);
export type OpponentRecordGroup = typeof OpponentRecordGroup.Type;

export const TeamEvaluationPlayerMetricKey = Schema.Literals([
  "points",
  "goals",
  "recorded-assists",
  "goals-without-recorded-assist",
  "shots",
  "shots-on-goal",
  "shooting-conversion",
  "shot-accuracy",
  "free-position-goals",
  "free-position-attempts",
  "free-position-conversion",
  "ground-balls",
  "draw-controls",
  "turnovers",
  "caused-turnovers",
  "saves",
  "yellow-cards",
  "red-cards",
  "goalkeeper-period-starts",
]);
export type TeamEvaluationPlayerMetricKey =
  typeof TeamEvaluationPlayerMetricKey.Type;

export const TeamEvaluationSegment = Schema.Literals([
  "full-game",
  "quarter-1",
  "quarter-2",
  "quarter-3",
  "quarter-4",
  "first-half",
  "second-half",
  "overtime",
]);
export type TeamEvaluationSegment = typeof TeamEvaluationSegment.Type;

export const teamEvaluationSegmentOrder: readonly TeamEvaluationSegment[] = [
  "full-game",
  "quarter-1",
  "quarter-2",
  "quarter-3",
  "quarter-4",
  "first-half",
  "second-half",
  "overtime",
];

export const TeamEvaluationSegmentMetric = Schema.Literals([
  "points",
  "goals",
  "recorded-assists",
  "free-position-goals",
]);
export type TeamEvaluationSegmentMetric =
  typeof TeamEvaluationSegmentMetric.Type;

export interface TeamEvaluationPlayerMetricDefinition {
  readonly key: TeamEvaluationPlayerMetricKey;
  readonly label: string;
  readonly format: "integer" | "percentage";
  readonly playerType: "field" | "goalkeeper" | "both";
}

export const teamEvaluationPlayerMetricDefinitions: readonly TeamEvaluationPlayerMetricDefinition[] =
  [
    { key: "points", label: "Points", format: "integer", playerType: "field" },
    { key: "goals", label: "Goals", format: "integer", playerType: "field" },
    {
      key: "recorded-assists",
      label: "Recorded assists",
      format: "integer",
      playerType: "field",
    },
    {
      key: "goals-without-recorded-assist",
      label: "Goals without a recorded assist",
      format: "integer",
      playerType: "field",
    },
    { key: "shots", label: "Shots", format: "integer", playerType: "field" },
    {
      key: "shots-on-goal",
      label: "Shots on goal",
      format: "integer",
      playerType: "field",
    },
    {
      key: "shooting-conversion",
      label: "Shooting conversion",
      format: "percentage",
      playerType: "field",
    },
    {
      key: "shot-accuracy",
      label: "Shot accuracy",
      format: "percentage",
      playerType: "field",
    },
    {
      key: "free-position-goals",
      label: "Free-position goals",
      format: "integer",
      playerType: "field",
    },
    {
      key: "free-position-attempts",
      label: "Free-position attempts",
      format: "integer",
      playerType: "field",
    },
    {
      key: "free-position-conversion",
      label: "Free-position conversion",
      format: "percentage",
      playerType: "field",
    },
    {
      key: "ground-balls",
      label: "Ground balls",
      format: "integer",
      playerType: "both",
    },
    {
      key: "draw-controls",
      label: "Draw controls",
      format: "integer",
      playerType: "field",
    },
    {
      key: "turnovers",
      label: "Turnovers",
      format: "integer",
      playerType: "both",
    },
    {
      key: "caused-turnovers",
      label: "Caused turnovers",
      format: "integer",
      playerType: "both",
    },
    {
      key: "saves",
      label: "Saves",
      format: "integer",
      playerType: "goalkeeper",
    },
    {
      key: "yellow-cards",
      label: "Yellow cards",
      format: "integer",
      playerType: "both",
    },
    {
      key: "red-cards",
      label: "Red cards",
      format: "integer",
      playerType: "both",
    },
    {
      key: "goalkeeper-period-starts",
      label: "Recorded goalkeeper period starts",
      format: "integer",
      playerType: "goalkeeper",
    },
  ];

export class TeamEvaluationMetricEvidence extends Schema.Class<TeamEvaluationMetricEvidence>(
  "WorldLacrosseTeamEvaluationMetricEvidence",
)({
  key: TeamEvaluationPlayerMetricKey,
  value: Schema.NullOr(FiniteNumber),
  numerator: NonNegativeInteger,
  denominator: NonNegativeInteger,
  sampleGames: NonNegativeInteger,
  quality: Schema.Literals(["reconciled", "recorded-only"]),
}) {}

export class TeamEvaluationRank extends Schema.Class<TeamEvaluationRank>(
  "WorldLacrosseTeamEvaluationRank",
)({
  rank: NonNegativeInteger,
  total: NonNegativeInteger,
  tied: Schema.Boolean,
}) {}

export class TeamEvaluationSegmentEvidence extends Schema.Class<TeamEvaluationSegmentEvidence>(
  "WorldLacrosseTeamEvaluationSegmentEvidence",
)({
  segment: TeamEvaluationSegment,
  goals: Schema.NullOr(NonNegativeInteger),
  recordedAssists: Schema.NullOr(NonNegativeInteger),
  points: Schema.NullOr(NonNegativeInteger),
  freePositionGoals: Schema.NullOr(NonNegativeInteger),
  sampleGames: NonNegativeInteger,
}) {}

export class TeamEvaluationPlayer extends Schema.Class<TeamEvaluationPlayer>(
  "WorldLacrosseTeamEvaluationPlayer",
)({
  id: Schema.NullOr(Schema.String),
  name: Schema.String,
  number: Schema.NullOr(Schema.String),
  position: Schema.NullOr(Schema.String),
  playerType: Schema.Literals(["FieldPlayer", "Goalkeeper"]),
  rosterListedGames: NonNegativeInteger,
  recordedActivityGames: NonNegativeInteger,
  metrics: Schema.Array(TeamEvaluationMetricEvidence),
  segments: Schema.Array(TeamEvaluationSegmentEvidence),
}) {}

export class TeamEvaluationOpponentRecord extends Schema.Class<TeamEvaluationOpponentRecord>(
  "WorldLacrosseTeamEvaluationOpponentRecord",
)({
  wins: NonNegativeInteger,
  losses: NonNegativeInteger,
  games: NonNegativeInteger,
  group: OpponentRecordGroup,
}) {}

export const teamEvaluationHeadlineMetricKeys = [
  "goals-per-game",
  "goals-against-per-game",
  "shooting-conversion",
  "save-rate",
  "draw-share",
  "turnovers",
  "time-ahead-share",
  "time-behind-share",
  "close-game-share",
  "longest-run",
  "response-rate",
  "yellow-cards",
] as const;

export class TeamEvaluationGame extends Schema.Class<TeamEvaluationGame>(
  "WorldLacrosseTeamEvaluationGame",
)({
  gameId: Schema.String,
  date: Schema.String,
  phase: Schema.String,
  venue: Schema.String,
  opponentId: Schema.NullOr(Schema.String),
  opponentCode: Schema.String,
  opponent: Schema.String,
  opponentFlagUrl: Schema.NullOr(Schema.String),
  result: Schema.Literals(["W", "L"]),
  goalsFor: NonNegativeInteger,
  goalsAgainst: NonNegativeInteger,
  opponentRecord: TeamEvaluationOpponentRecord,
  headlineMetrics: Schema.Array(TeamComparisonMetricEvidence),
}) {}

export class TeamEvaluationPreset extends Schema.Class<TeamEvaluationPreset>(
  "WorldLacrosseTeamEvaluationPreset",
)({
  key: Schema.String,
  label: Schema.String,
  description: Schema.String,
  gameIds: Schema.Array(Schema.String),
}) {}

export class TeamEvaluationSample extends Schema.Class<TeamEvaluationSample>(
  "WorldLacrosseTeamEvaluationSample",
)({
  label: Schema.String,
  gameIds: Schema.Array(Schema.String),
  wins: NonNegativeInteger,
  losses: NonNegativeInteger,
  teamMetrics: Schema.Array(TeamComparisonMetricEvidence),
  players: Schema.Array(TeamEvaluationPlayer),
}) {}

export const TeamEvaluation = Schema.Struct({
  generatedFrom: Schema.String,
  team: Schema.Struct({
    id: Schema.String,
    code: Schema.String,
    name: Schema.String,
    pool: Schema.String,
    flagUrl: Schema.NullOr(Schema.String),
  }),
  games: Schema.Array(TeamEvaluationGame),
  presets: Schema.Array(TeamEvaluationPreset),
  ignoredSampleAGameIds: Schema.Array(Schema.String),
  ignoredSampleBGameIds: Schema.Array(Schema.String),
  sampleA: TeamEvaluationSample,
  sampleB: TeamEvaluationSample,
}).check(
  Schema.makeFilter((report) => {
    const issues: Schema.FilterIssue[] = [];
    const eligibleIds = report.games.map((game) => game.gameId);
    if (new Set(eligibleIds).size !== eligibleIds.length)
      issues.push({
        path: ["games"],
        issue: "eligible game IDs must be unique",
      });
    const eligibleSet = new Set(eligibleIds);
    const expectedPlayerKeys = teamEvaluationPlayerMetricDefinitions.map(
      (definition) => definition.key,
    );
    for (const [gameIndex, game] of report.games.entries()) {
      const record = game.opponentRecord;
      if (record.wins + record.losses !== record.games)
        issues.push({
          path: ["games", gameIndex, "opponentRecord"],
          issue: "opponent decisions must match its leave-team-out games",
        });
      const expectedGroup: OpponentRecordGroup =
        record.games < 2
          ? "unclassified"
          : record.wins > record.losses
            ? "above-500"
            : record.wins < record.losses
              ? "below-500"
              : "at-500";
      if (record.group !== expectedGroup)
        issues.push({
          path: ["games", gameIndex, "opponentRecord", "group"],
          issue: "opponent record group must match its decisions",
        });
      const headlineKeys = game.headlineMetrics.map((metric) => metric.key);
      if (
        headlineKeys.length !== teamEvaluationHeadlineMetricKeys.length ||
        headlineKeys.some(
          (key, index) => key !== teamEvaluationHeadlineMetricKeys[index],
        )
      )
        issues.push({
          path: ["games", gameIndex, "headlineMetrics"],
          issue: "headline metrics must match the unique closed subset",
        });
      issues.push(
        ...teamComparisonMetricEvidenceIssues(
          game.headlineMetrics,
          1,
          ["games", gameIndex, "headlineMetrics"],
          teamEvaluationHeadlineMetricKeys,
        ),
      );
    }
    const presetKeys = report.presets.map((preset) => preset.key);
    if (new Set(presetKeys).size !== presetKeys.length)
      issues.push({
        path: ["presets"],
        issue: "preset keys must be unique",
      });
    for (const [presetIndex, preset] of report.presets.entries()) {
      if (
        new Set(preset.gameIds).size !== preset.gameIds.length ||
        preset.gameIds.some((id) => !eligibleSet.has(id))
      )
        issues.push({
          path: ["presets", presetIndex, "gameIds"],
          issue: "preset game IDs must be unique eligible games",
        });
    }
    for (const side of ["sampleA", "sampleB"] as const) {
      const sample = report[side];
      if (new Set(sample.gameIds).size !== sample.gameIds.length)
        issues.push({
          path: [side, "gameIds"],
          issue: "sample game IDs must be unique",
        });
      if (sample.gameIds.some((id) => !eligibleSet.has(id)))
        issues.push({
          path: [side, "gameIds"],
          issue: "sample games must be eligible",
        });
      if (sample.wins + sample.losses !== sample.gameIds.length)
        issues.push({
          path: [side, "wins"],
          issue: "sample decisions must match its games",
        });
      issues.push(
        ...teamComparisonMetricEvidenceIssues(
          sample.teamMetrics,
          sample.gameIds.length,
          [side, "teamMetrics"],
        ),
      );
      for (const segmentKey of teamEvaluationSegmentOrder) {
        const segmentSamples = sample.players.flatMap((player) => {
          const segment = player.segments.find(
            (entry) => entry.segment === segmentKey,
          );
          return segment === undefined ? [] : [segment.sampleGames];
        });
        const expectedSample = segmentSamples[0];
        if (
          expectedSample !== undefined &&
          segmentSamples.some((sampleGames) => sampleGames !== expectedSample)
        )
          issues.push({
            path: [side, "players"],
            issue: `${segmentKey} sample must be consistent across the team`,
          });
      }
      for (const [playerIndex, player] of sample.players.entries()) {
        if (
          player.recordedActivityGames > player.rosterListedGames ||
          player.rosterListedGames > sample.gameIds.length
        )
          issues.push({
            path: [side, "players", playerIndex, "rosterListedGames"],
            issue:
              "player activity must not exceed roster-listed or selected games",
          });
        const keys = player.metrics.map((metric) => metric.key);
        if (
          keys.length !== expectedPlayerKeys.length ||
          keys.some((key, index) => key !== expectedPlayerKeys[index])
        )
          issues.push({
            path: [side, "players", playerIndex, "metrics"],
            issue: "player metrics must match the closed catalog",
          });
        for (const [metricIndex, metric] of player.metrics.entries()) {
          const definition = teamEvaluationPlayerMetricDefinitions[metricIndex];
          if (definition === undefined) continue;
          if (metric.sampleGames > sample.gameIds.length)
            issues.push({
              path: [
                side,
                "players",
                playerIndex,
                "metrics",
                metricIndex,
                "sampleGames",
              ],
              issue: "player metric sample must not exceed selected games",
            });
          if (metric.denominator === 0 && metric.numerator !== 0)
            issues.push({
              path: [side, "players", playerIndex, "metrics", metricIndex],
              issue: "zero-denominator evidence must have a zero numerator",
            });
          if (
            metric.sampleGames === 0 &&
            (metric.numerator !== 0 ||
              metric.denominator !== 0 ||
              metric.value !== null)
          )
            issues.push({
              path: [side, "players", playerIndex, "metrics", metricIndex],
              issue: "empty metric samples must be unavailable",
            });
          const expected =
            metric.sampleGames === 0 ||
            (definition.format === "percentage" && metric.denominator === 0)
              ? null
              : definition.format === "percentage"
                ? (metric.numerator / metric.denominator) * 100
                : metric.numerator;
          if (
            (expected === null && metric.value !== null) ||
            (expected !== null &&
              (metric.value === null ||
                Math.abs(expected - metric.value) > 0.000_001))
          )
            issues.push({
              path: [
                side,
                "players",
                playerIndex,
                "metrics",
                metricIndex,
                "value",
              ],
              issue: "player metric value must match pooled evidence",
            });
          if (
            definition.format === "percentage" &&
            metric.numerator > metric.denominator
          )
            issues.push({
              path: [
                side,
                "players",
                playerIndex,
                "metrics",
                metricIndex,
                "numerator",
              ],
              issue: "percentage evidence cannot exceed attempts",
            });
        }
        const segmentKeys = player.segments.map((segment) => segment.segment);
        if (
          segmentKeys.length !== teamEvaluationSegmentOrder.length ||
          segmentKeys.some(
            (key, index) => key !== teamEvaluationSegmentOrder[index],
          )
        )
          issues.push({
            path: [side, "players", playerIndex, "segments"],
            issue: "segments must match the unique closed display order",
          });
        for (const [segmentIndex, segment] of player.segments.entries()) {
          if (segment.sampleGames > sample.gameIds.length)
            issues.push({
              path: [
                side,
                "players",
                playerIndex,
                "segments",
                segmentIndex,
                "sampleGames",
              ],
              issue: "segment sample must not exceed selected games",
            });
          const values = [
            segment.goals,
            segment.recordedAssists,
            segment.points,
            segment.freePositionGoals,
          ];
          if (
            segment.sampleGames === 0 &&
            values.some((value) => value !== null)
          )
            issues.push({
              path: [side, "players", playerIndex, "segments", segmentIndex],
              issue: "empty segment samples must be unavailable",
            });
          if (segment.sampleGames > 0 && segment.recordedAssists === null)
            issues.push({
              path: [
                side,
                "players",
                playerIndex,
                "segments",
                segmentIndex,
                "recordedAssists",
              ],
              issue: "recorded assists must be present for sampled segments",
            });
          if (
            (segment.goals === null) !== (segment.points === null) ||
            (segment.goals === null) !== (segment.freePositionGoals === null)
          )
            issues.push({
              path: [side, "players", playerIndex, "segments", segmentIndex],
              issue:
                "attribution-dependent segment values must share availability",
            });
          if (
            segment.goals !== null &&
            segment.recordedAssists !== null &&
            segment.points !== segment.goals + segment.recordedAssists
          )
            issues.push({
              path: [
                side,
                "players",
                playerIndex,
                "segments",
                segmentIndex,
                "points",
              ],
              issue: "segment points must equal goals plus recorded assists",
            });
          if (
            segment.freePositionGoals !== null &&
            segment.goals !== null &&
            segment.freePositionGoals > segment.goals
          )
            issues.push({
              path: [side, "players", playerIndex, "segments", segmentIndex],
              issue: "segment free-position goals cannot exceed goals",
            });
        }
        const segment = (key: TeamEvaluationSegment) =>
          player.segments.find((entry) => entry.segment === key);
        const checkHalf = (
          halfKey: TeamEvaluationSegment,
          firstKey: TeamEvaluationSegment,
          secondKey: TeamEvaluationSegment,
        ): void => {
          const half = segment(halfKey);
          const first = segment(firstKey);
          const second = segment(secondKey);
          if (!half || !first || !second) return;
          for (const key of [
            "goals",
            "recordedAssists",
            "points",
            "freePositionGoals",
          ] as const) {
            if (
              first[key] !== null &&
              second[key] !== null &&
              half[key] !== first[key] + second[key]
            )
              issues.push({
                path: [side, "players", playerIndex, "segments"],
                issue: `${halfKey} must equal its two quarters where available`,
              });
          }
          if (
            first.sampleGames === second.sampleGames &&
            half.sampleGames !== first.sampleGames
          )
            issues.push({
              path: [side, "players", playerIndex, "segments"],
              issue: `${halfKey} sample must match its available quarters`,
            });
        };
        checkHalf("first-half", "quarter-1", "quarter-2");
        checkHalf("second-half", "quarter-3", "quarter-4");
        if (segment("full-game")?.sampleGames !== sample.gameIds.length)
          issues.push({
            path: [side, "players", playerIndex, "segments", 0],
            issue: "full-game segment sample must match selected games",
          });
      }
    }
    return issues;
  }),
);
export type TeamEvaluation = typeof TeamEvaluation.Type;
