import { Schema } from "effect";

const NonNegativeInteger = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
);

export const TeamComparisonMetricKey = Schema.Literals([
  "goals-total",
  "goals-against-total",
  "goal-difference-total",
  "goals-per-game",
  "goals-against-per-game",
  "goal-difference-per-game",
  "q1-goals",
  "q1-goals-against",
  "q2-goals",
  "q2-goals-against",
  "q3-goals",
  "q3-goals-against",
  "q4-goals",
  "q4-goals-against",
  "first-half-goals",
  "first-half-goals-against",
  "second-half-goals",
  "second-half-goals-against",
  "shots",
  "shots-on-goal",
  "shooting-conversion",
  "shot-accuracy",
  "saves",
  "save-rate",
  "first-half-shooting-conversion",
  "first-half-shot-accuracy",
  "first-half-save-rate",
  "second-half-shooting-conversion",
  "second-half-shot-accuracy",
  "second-half-save-rate",
  "close-game-shooting-conversion",
  "close-game-shot-accuracy",
  "free-position-conversion",
  "longest-save-run",
  "draw-controls",
  "draw-share",
  "ground-balls",
  "turnovers",
  "caused-turnovers",
  "time-ahead-share",
  "time-tied-share",
  "time-behind-share",
  "one-goal-margin-share",
  "two-goal-margin-share",
  "three-plus-goal-margin-share",
  "close-game-share",
  "average-close-game-time",
  "lead-changes-per-game",
  "times-tied-per-game",
  "largest-lead",
  "largest-deficit",
  "largest-recovered-deficit",
  "longest-run",
  "longest-drought",
  "drought-goals-conceded",
  "response-rate",
  "average-response-time",
  "fastest-response-time",
  "fastest-two-goal-burst",
  "fastest-three-goal-burst",
  "fastest-four-goal-burst",
  "fourth-quarter-goals",
  "final-five-minute-goals",
  "goals-while-tied",
  "goals-while-trailing",
  "equalizing-goals",
  "go-ahead-goals",
  "known-scorer-coverage",
  "recorded-assist-share",
  "recorded-scorers",
  "recorded-leading-scorer-share",
  "overtime-appearances",
  "overtime-wins",
  "overtime-losses",
  "overtime-goals",
  "overtime-goals-against",
  "overtime-shooting-conversion",
  "overtime-shot-accuracy",
  "overtime-save-rate",
  "overtime-turnovers",
  "overtime-draw-controls",
  "overtime-ground-balls",
  "card-events",
  "yellow-cards",
  "yellow-red-cards",
  "red-cards",
  "recorded-suspension-minutes",
]);
export type TeamComparisonMetricKey = typeof TeamComparisonMetricKey.Type;

export const TeamComparisonSectionKey = Schema.Literals([
  "scoring",
  "periods",
  "efficiency",
  "events",
  "game-state",
  "situational",
  "overtime",
  "discipline",
]);
export type TeamComparisonSectionKey = typeof TeamComparisonSectionKey.Type;

export const TeamComparisonMetricAggregation = Schema.Literals([
  "total",
  "per-game",
  "percentage",
  "average",
  "maximum",
  "minimum",
  "paired-maximum",
  "unique",
]);
export type TeamComparisonMetricAggregation =
  typeof TeamComparisonMetricAggregation.Type;

export const TeamComparisonMetricFormat = Schema.Literals([
  "integer",
  "decimal",
  "percentage",
  "duration",
]);
export type TeamComparisonMetricFormat = typeof TeamComparisonMetricFormat.Type;

export interface TeamComparisonMetricDefinition {
  readonly key: TeamComparisonMetricKey;
  readonly section: TeamComparisonSectionKey;
  readonly label: string;
  readonly aggregation: TeamComparisonMetricAggregation;
  readonly format: TeamComparisonMetricFormat;
  readonly integerEvidence: boolean;
}

const metric = (
  key: TeamComparisonMetricKey,
  section: TeamComparisonSectionKey,
  label: string,
  aggregation: TeamComparisonMetricAggregation,
  format: TeamComparisonMetricFormat,
  integerEvidence = true,
): TeamComparisonMetricDefinition => ({
  key,
  section,
  label,
  aggregation,
  format,
  integerEvidence,
});

export const teamComparisonMetricDefinitions: readonly TeamComparisonMetricDefinition[] =
  [
    metric("goals-total", "scoring", "Goals", "total", "integer"),
    metric(
      "goals-against-total",
      "scoring",
      "Goals allowed",
      "total",
      "integer",
    ),
    metric(
      "goal-difference-total",
      "scoring",
      "Goal difference",
      "total",
      "integer",
    ),
    metric(
      "goals-per-game",
      "scoring",
      "Goals per game",
      "per-game",
      "decimal",
    ),
    metric(
      "goals-against-per-game",
      "scoring",
      "Goals allowed per game",
      "per-game",
      "decimal",
    ),
    metric(
      "goal-difference-per-game",
      "scoring",
      "Goal difference per game",
      "per-game",
      "decimal",
    ),
    metric("q1-goals", "periods", "Q1 goals", "total", "integer"),
    metric(
      "q1-goals-against",
      "periods",
      "Q1 goals allowed",
      "total",
      "integer",
    ),
    metric("q2-goals", "periods", "Q2 goals", "total", "integer"),
    metric(
      "q2-goals-against",
      "periods",
      "Q2 goals allowed",
      "total",
      "integer",
    ),
    metric("q3-goals", "periods", "Q3 goals", "total", "integer"),
    metric(
      "q3-goals-against",
      "periods",
      "Q3 goals allowed",
      "total",
      "integer",
    ),
    metric("q4-goals", "periods", "Q4 goals", "total", "integer"),
    metric(
      "q4-goals-against",
      "periods",
      "Q4 goals allowed",
      "total",
      "integer",
    ),
    metric(
      "first-half-goals",
      "periods",
      "First-half goals",
      "total",
      "integer",
    ),
    metric(
      "first-half-goals-against",
      "periods",
      "First-half goals allowed",
      "total",
      "integer",
    ),
    metric(
      "second-half-goals",
      "periods",
      "Second-half goals",
      "total",
      "integer",
    ),
    metric(
      "second-half-goals-against",
      "periods",
      "Second-half goals allowed",
      "total",
      "integer",
    ),
    metric("shots", "efficiency", "Total shots", "total", "integer"),
    metric("shots-on-goal", "efficiency", "Shots on goal", "total", "integer"),
    metric(
      "shooting-conversion",
      "efficiency",
      "Shooting conversion",
      "percentage",
      "percentage",
    ),
    metric(
      "shot-accuracy",
      "efficiency",
      "Shot accuracy",
      "percentage",
      "percentage",
    ),
    metric("saves", "efficiency", "Saves", "total", "integer"),
    metric("save-rate", "efficiency", "Save rate", "percentage", "percentage"),
    metric(
      "first-half-shooting-conversion",
      "efficiency",
      "First-half shooting conversion",
      "percentage",
      "percentage",
    ),
    metric(
      "first-half-shot-accuracy",
      "efficiency",
      "First-half shot accuracy",
      "percentage",
      "percentage",
    ),
    metric(
      "first-half-save-rate",
      "efficiency",
      "First-half save rate",
      "percentage",
      "percentage",
    ),
    metric(
      "second-half-shooting-conversion",
      "efficiency",
      "Second-half shooting conversion",
      "percentage",
      "percentage",
    ),
    metric(
      "second-half-shot-accuracy",
      "efficiency",
      "Second-half shot accuracy",
      "percentage",
      "percentage",
    ),
    metric(
      "second-half-save-rate",
      "efficiency",
      "Second-half save rate",
      "percentage",
      "percentage",
    ),
    metric(
      "close-game-shooting-conversion",
      "efficiency",
      "Close-game shooting conversion",
      "percentage",
      "percentage",
    ),
    metric(
      "close-game-shot-accuracy",
      "efficiency",
      "Close-game shot accuracy",
      "percentage",
      "percentage",
    ),
    metric(
      "free-position-conversion",
      "efficiency",
      "Free-position conversion",
      "percentage",
      "percentage",
    ),
    metric(
      "longest-save-run",
      "efficiency",
      "Longest save run",
      "maximum",
      "integer",
    ),
    metric("draw-controls", "events", "Draw controls", "total", "integer"),
    metric(
      "draw-share",
      "events",
      "Draw-control share",
      "percentage",
      "percentage",
    ),
    metric("ground-balls", "events", "Ground balls", "total", "integer"),
    metric("turnovers", "events", "Turnovers", "total", "integer"),
    metric(
      "caused-turnovers",
      "events",
      "Caused turnovers",
      "total",
      "integer",
    ),
    metric(
      "time-ahead-share",
      "game-state",
      "Time ahead",
      "percentage",
      "percentage",
    ),
    metric(
      "time-tied-share",
      "game-state",
      "Time tied",
      "percentage",
      "percentage",
    ),
    metric(
      "time-behind-share",
      "game-state",
      "Time behind",
      "percentage",
      "percentage",
    ),
    metric(
      "one-goal-margin-share",
      "game-state",
      "Time at a one-goal margin",
      "percentage",
      "percentage",
    ),
    metric(
      "two-goal-margin-share",
      "game-state",
      "Time at a two-goal margin",
      "percentage",
      "percentage",
    ),
    metric(
      "three-plus-goal-margin-share",
      "game-state",
      "Time at a three-plus-goal margin",
      "percentage",
      "percentage",
    ),
    metric(
      "close-game-share",
      "game-state",
      "Time tied or within one goal",
      "percentage",
      "percentage",
    ),
    metric(
      "average-close-game-time",
      "game-state",
      "Average close-game time",
      "average",
      "duration",
    ),
    metric(
      "lead-changes-per-game",
      "game-state",
      "Lead changes per game",
      "per-game",
      "decimal",
    ),
    metric(
      "times-tied-per-game",
      "game-state",
      "Times tied per game",
      "per-game",
      "decimal",
    ),
    metric("largest-lead", "game-state", "Largest lead", "maximum", "integer"),
    metric(
      "largest-deficit",
      "game-state",
      "Largest deficit",
      "maximum",
      "integer",
    ),
    metric(
      "largest-recovered-deficit",
      "game-state",
      "Largest recovered deficit in a win",
      "maximum",
      "integer",
    ),
    metric(
      "longest-run",
      "game-state",
      "Longest scoring run",
      "maximum",
      "integer",
    ),
    metric(
      "longest-drought",
      "game-state",
      "Longest scoring drought",
      "maximum",
      "duration",
    ),
    metric(
      "drought-goals-conceded",
      "game-state",
      "Goals conceded during longest-duration drought",
      "paired-maximum",
      "integer",
    ),
    metric(
      "response-rate",
      "game-state",
      "Next-goal response rate",
      "percentage",
      "percentage",
    ),
    metric(
      "average-response-time",
      "game-state",
      "Average successful response time",
      "average",
      "duration",
      false,
    ),
    metric(
      "fastest-response-time",
      "game-state",
      "Fastest response",
      "minimum",
      "duration",
    ),
    metric(
      "fastest-two-goal-burst",
      "game-state",
      "Fastest two-goal burst",
      "minimum",
      "duration",
    ),
    metric(
      "fastest-three-goal-burst",
      "game-state",
      "Fastest three-goal burst",
      "minimum",
      "duration",
    ),
    metric(
      "fastest-four-goal-burst",
      "game-state",
      "Fastest four-goal burst",
      "minimum",
      "duration",
    ),
    metric(
      "fourth-quarter-goals",
      "situational",
      "Fourth-quarter goals",
      "total",
      "integer",
    ),
    metric(
      "final-five-minute-goals",
      "situational",
      "Final-five-minute goals",
      "total",
      "integer",
    ),
    metric(
      "goals-while-tied",
      "situational",
      "Goals while tied",
      "total",
      "integer",
    ),
    metric(
      "goals-while-trailing",
      "situational",
      "Goals while trailing",
      "total",
      "integer",
    ),
    metric(
      "equalizing-goals",
      "situational",
      "Equalizing goals",
      "total",
      "integer",
    ),
    metric(
      "go-ahead-goals",
      "situational",
      "Go-ahead goals",
      "total",
      "integer",
    ),
    metric(
      "known-scorer-coverage",
      "situational",
      "Recorded scorer coverage",
      "percentage",
      "percentage",
    ),
    metric(
      "recorded-assist-share",
      "situational",
      "Recorded assist share",
      "percentage",
      "percentage",
    ),
    metric(
      "recorded-scorers",
      "situational",
      "Unique recorded scorers",
      "unique",
      "integer",
    ),
    metric(
      "recorded-leading-scorer-share",
      "situational",
      "Recorded leading-scorer goal share",
      "percentage",
      "percentage",
    ),
    metric(
      "overtime-appearances",
      "overtime",
      "Overtime appearances",
      "total",
      "integer",
    ),
    metric("overtime-wins", "overtime", "Overtime wins", "total", "integer"),
    metric(
      "overtime-losses",
      "overtime",
      "Overtime losses",
      "total",
      "integer",
    ),
    metric("overtime-goals", "overtime", "Overtime goals", "total", "integer"),
    metric(
      "overtime-goals-against",
      "overtime",
      "Overtime goals allowed",
      "total",
      "integer",
    ),
    metric(
      "overtime-shooting-conversion",
      "overtime",
      "Overtime shooting conversion",
      "percentage",
      "percentage",
    ),
    metric(
      "overtime-shot-accuracy",
      "overtime",
      "Overtime shot accuracy",
      "percentage",
      "percentage",
    ),
    metric(
      "overtime-save-rate",
      "overtime",
      "Overtime save rate",
      "percentage",
      "percentage",
    ),
    metric(
      "overtime-turnovers",
      "overtime",
      "Overtime turnovers",
      "total",
      "integer",
    ),
    metric(
      "overtime-draw-controls",
      "overtime",
      "Overtime draw controls",
      "total",
      "integer",
    ),
    metric(
      "overtime-ground-balls",
      "overtime",
      "Overtime ground balls",
      "total",
      "integer",
    ),
    metric(
      "card-events",
      "discipline",
      "Recorded card events",
      "total",
      "integer",
    ),
    metric("yellow-cards", "discipline", "Yellow cards", "total", "integer"),
    metric(
      "yellow-red-cards",
      "discipline",
      "Yellow-red cards",
      "total",
      "integer",
    ),
    metric("red-cards", "discipline", "Red cards", "total", "integer"),
    metric(
      "recorded-suspension-minutes",
      "discipline",
      "Recorded suspension minutes",
      "total",
      "decimal",
      false,
    ),
  ];

export class TeamComparisonMetricEvidence extends Schema.Class<TeamComparisonMetricEvidence>(
  "WorldLacrosseTeamComparisonMetricEvidence",
)({
  key: TeamComparisonMetricKey,
  value: Schema.NullOr(Schema.Finite),
  numerator: Schema.Finite,
  denominator: NonNegativeInteger,
  sampleGames: NonNegativeInteger,
}) {}

export class TeamComparisonTeam extends Schema.Class<TeamComparisonTeam>(
  "WorldLacrosseTeamComparisonTeam",
)({
  id: Schema.String,
  code: Schema.String,
  name: Schema.String,
  flagUrl: Schema.NullOr(Schema.String),
  pool: Schema.String,
  completedGames: NonNegativeInteger,
  eligibleGames: NonNegativeInteger,
  excludedCompletedGames: NonNegativeInteger,
  wins: NonNegativeInteger,
  losses: NonNegativeInteger,
  metrics: Schema.Array(TeamComparisonMetricEvidence),
}) {}

export const TeamComparisonMeetingWinner = Schema.Literals(["left", "right"]);
export type TeamComparisonMeetingWinner =
  typeof TeamComparisonMeetingWinner.Type;

export class TeamComparisonMeeting extends Schema.Class<TeamComparisonMeeting>(
  "WorldLacrosseTeamComparisonMeeting",
)({
  gameId: Schema.String,
  date: Schema.String,
  phase: Schema.String,
  leftGoals: NonNegativeInteger,
  rightGoals: NonNegativeInteger,
  winner: TeamComparisonMeetingWinner,
}) {}

const signedMetricKeys: ReadonlySet<TeamComparisonMetricKey> = new Set([
  "goal-difference-total",
  "goal-difference-per-game",
]);

export const teamComparisonMetricEvidenceIssues = (
  metrics: readonly TeamComparisonMetricEvidence[],
  eligibleGames: number,
  path: readonly (string | number)[],
  expectedKeys: readonly TeamComparisonMetricKey[] = teamComparisonMetricDefinitions.map(
    (definition) => definition.key,
  ),
): readonly Schema.FilterIssue[] => {
  const issues: Schema.FilterIssue[] = [];
  const keys = metrics.map((entry) => entry.key);
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  )
    issues.push({
      path,
      issue: "metrics must match the closed catalog in display order",
    });
  for (const [index, entry] of metrics.entries()) {
    const definition = teamComparisonMetricDefinitions.find(
      (candidate) => candidate.key === entry.key,
    );
    if (definition === undefined) continue;
    if (entry.sampleGames > eligibleGames)
      issues.push({
        path: [...path, index, "sampleGames"],
        issue: "metric sample must not exceed eligible games",
      });
    if (
      (definition.aggregation === "total" ||
        definition.aggregation === "per-game" ||
        definition.aggregation === "unique") &&
      entry.denominator !== entry.sampleGames
    )
      issues.push({
        path: [...path, index, "denominator"],
        issue:
          "total, unique, and per-game denominators must match their game sample",
      });
    if (
      (definition.aggregation === "maximum" ||
        definition.aggregation === "minimum" ||
        definition.aggregation === "paired-maximum") &&
      entry.denominator > entry.sampleGames
    )
      issues.push({
        path: [...path, index, "denominator"],
        issue: "qualifying observations must fit the metric game sample",
      });
    if (!signedMetricKeys.has(entry.key) && entry.numerator < 0)
      issues.push({
        path: [...path, index, "numerator"],
        issue: "unsigned metric evidence must not be negative",
      });
    if (definition.integerEvidence && !Number.isInteger(entry.numerator))
      issues.push({
        path: [...path, index, "numerator"],
        issue: "integer metric evidence must be a whole number",
      });
    if (
      definition.format === "integer" &&
      entry.value !== null &&
      !Number.isInteger(entry.value)
    )
      issues.push({
        path: [...path, index, "value"],
        issue: "integer metric values must be whole numbers",
      });
    if (
      definition.aggregation === "percentage" &&
      (entry.numerator < 0 || entry.numerator > entry.denominator)
    )
      issues.push({
        path: [...path, index, "numerator"],
        issue:
          "percentage evidence must remain between zero and its denominator",
      });
    if (entry.denominator === 0 && entry.numerator !== 0)
      issues.push({
        path: [...path, index, "numerator"],
        issue: "zero-denominator evidence must have a zero numerator",
      });
    if (
      entry.sampleGames === 0 &&
      (entry.numerator !== 0 || entry.denominator !== 0)
    )
      issues.push({
        path: [...path, index],
        issue: "empty metric samples must not retain evidence",
      });
    const expectedValue =
      definition.aggregation === "percentage"
        ? entry.denominator === 0
          ? null
          : (entry.numerator / entry.denominator) * 100
        : definition.aggregation === "per-game" ||
            definition.aggregation === "average"
          ? entry.denominator === 0
            ? null
            : entry.numerator / entry.denominator
          : definition.aggregation === "maximum" ||
              definition.aggregation === "minimum" ||
              definition.aggregation === "paired-maximum"
            ? entry.denominator === 0
              ? null
              : entry.numerator
            : entry.sampleGames === 0
              ? null
              : entry.numerator;
    if (
      (expectedValue === null && entry.value !== null) ||
      (expectedValue !== null &&
        (entry.value === null ||
          Math.abs(entry.value - expectedValue) > 0.000_001))
    )
      issues.push({
        path: [...path, index, "value"],
        issue: "metric value must match its aggregation evidence",
      });
  }
  const longestDrought = metrics.find(
    (entry) => entry.key === "longest-drought",
  );
  const droughtDamage = metrics.find(
    (entry) => entry.key === "drought-goals-conceded",
  );
  if (
    longestDrought !== undefined &&
    droughtDamage !== undefined &&
    (longestDrought.sampleGames !== droughtDamage.sampleGames ||
      longestDrought.denominator !== droughtDamage.denominator ||
      (longestDrought.value === null) !== (droughtDamage.value === null))
  )
    issues.push({
      path,
      issue:
        "longest drought and its paired goals conceded must share one sample",
    });
  return issues;
};

export const TeamComparison = Schema.Struct({
  generatedFrom: Schema.String,
  left: TeamComparisonTeam,
  right: TeamComparisonTeam,
  directMeetings: Schema.Array(TeamComparisonMeeting),
}).check(
  Schema.makeFilter((comparison) => {
    const issues: Schema.FilterIssue[] = [];
    if (comparison.left.id === comparison.right.id)
      issues.push({
        path: ["right", "id"],
        issue: "comparison teams must be distinct",
      });
    const sides: readonly ("left" | "right")[] = ["left", "right"];
    for (const side of sides) {
      const team = comparison[side];
      if (
        team.eligibleGames + team.excludedCompletedGames !==
        team.completedGames
      )
        issues.push({
          path: [side, "excludedCompletedGames"],
          issue: "completed sample must split into eligible and excluded games",
        });
      if (team.wins + team.losses !== team.eligibleGames)
        issues.push({
          path: [side, "wins"],
          issue: "eligible sample must split into wins and losses",
        });
      issues.push(
        ...teamComparisonMetricEvidenceIssues(
          team.metrics,
          team.eligibleGames,
          [side, "metrics"],
        ),
      );
    }
    const meetingIds = comparison.directMeetings.map(
      (meeting) => meeting.gameId,
    );
    if (
      comparison.directMeetings.some(
        (meeting) =>
          meeting.leftGoals === meeting.rightGoals ||
          (meeting.winner === "left" &&
            meeting.leftGoals < meeting.rightGoals) ||
          (meeting.winner === "right" &&
            meeting.rightGoals < meeting.leftGoals),
      )
    )
      issues.push({
        path: ["directMeetings"],
        issue: "direct meeting winner must match its decisive score",
      });
    if (new Set(meetingIds).size !== meetingIds.length)
      issues.push({
        path: ["directMeetings"],
        issue: "direct meeting game IDs must be unique",
      });
    return issues;
  }),
);
export type TeamComparison = typeof TeamComparison.Type;
