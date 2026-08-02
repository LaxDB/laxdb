import type { buildAnalysisData } from "./analysis-data";

export type AnalysisGame = ReturnType<
  typeof buildAnalysisData
>["games"][number];

export type MetricKey =
  | "shots"
  | "shotsOnGoal"
  | "shootingPercentage"
  | "drawPercentage"
  | "groundBalls"
  | "causedTurnovers"
  | "turnovers"
  | "assists"
  | "savePercentage";

export interface MetricDefinition {
  readonly key: MetricKey;
  readonly label: string;
  readonly signalLabel: string;
  readonly higherIsBetter: boolean;
  readonly format: "number" | "percentage";
  readonly interpretation: string;
}

export const analysisMetrics: readonly MetricDefinition[] = [
  {
    key: "shots",
    label: "Total shots",
    signalLabel: "Total shots",
    higherIsBetter: true,
    format: "number",
    interpretation:
      "Counts total shooting attempts; read beside shot quality and conversion.",
  },
  {
    key: "shotsOnGoal",
    label: "Shots on goal",
    signalLabel: "Shots on goal",
    higherIsBetter: true,
    format: "number",
    interpretation:
      "Counts attempts recorded on target; read beside conversion and opponent save rate.",
  },
  {
    key: "shootingPercentage",
    label: "Shooting percentage",
    signalLabel: "Shooting percentage",
    higherIsBetter: true,
    format: "percentage",
    interpretation:
      "Goals per recorded shot; read beside shot volume and game state.",
  },
  {
    key: "drawPercentage",
    label: "Draw-control percentage",
    signalLabel: "Draw-control percentage",
    higherIsBetter: true,
    format: "percentage",
    interpretation:
      "Share of recorded draw controls; possession after the draw determines its later value.",
  },
  {
    key: "groundBalls",
    label: "Ground balls",
    signalLabel: "Ground balls",
    higherIsBetter: true,
    format: "number",
    interpretation:
      "Counts recorded loose-ball recoveries; read beside turnovers and possession outcomes.",
  },
  {
    key: "causedTurnovers",
    label: "Caused turnovers",
    signalLabel: "Caused turnovers",
    higherIsBetter: true,
    format: "number",
    interpretation:
      "Counts credited defensive disruptions; read beside subsequent possession and scoring.",
  },
  {
    key: "turnovers",
    label: "Turnovers",
    signalLabel: "Fewer turnovers",
    higherIsBetter: false,
    format: "number",
    interpretation:
      "Counts recorded possession losses; fewer is treated as favorable and should be read beside pace.",
  },
  {
    key: "assists",
    label: "Assists",
    signalLabel: "Assists",
    higherIsBetter: true,
    format: "number",
    interpretation:
      "Counts credited assists; read beside total scoring and unassisted goals.",
  },
  {
    key: "savePercentage",
    label: "Save percentage",
    signalLabel: "Save percentage",
    higherIsBetter: true,
    format: "percentage",
    interpretation:
      "Saves per shot on goal faced; read beside shot quality and goals allowed.",
  },
];

const average = (values: readonly number[]): number =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;

const correlation = (
  left: readonly number[],
  right: readonly number[],
): number => {
  const leftMean = average(left);
  const rightMean = average(right);
  const numerator = left.reduce(
    (sum, value, index) =>
      sum + (value - leftMean) * ((right[index] ?? 0) - rightMean),
    0,
  );
  const leftScale = Math.sqrt(
    left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0),
  );
  const rightScale = Math.sqrt(
    right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0),
  );
  return leftScale === 0 || rightScale === 0
    ? 0
    : numerator / (leftScale * rightScale);
};

export interface OutcomeMetric extends MetricDefinition {
  readonly advantageGames: number;
  readonly advantageWins: number;
  readonly advantageWinRate: number;
  readonly winnerAverage: number;
  readonly loserAverage: number;
  readonly correlation: number;
}

export const analyzeOutcomeGames = (games: readonly AnalysisGame[]) => {
  const analysis: readonly OutcomeMetric[] = analysisMetrics.map((metric) => {
    let advantageGames = 0;
    let advantageWins = 0;
    const winnerValues: number[] = [];
    const loserValues: number[] = [];
    const differences: number[] = [];
    const outcomes: number[] = [];

    for (const game of games) {
      const homeWins = game.home.score > game.away.score;
      const homeValue = game.home[metric.key];
      const awayValue = game.away[metric.key];
      const direction = metric.higherIsBetter ? 1 : -1;
      const advantage = direction * (homeValue - awayValue);
      if (advantage !== 0) {
        advantageGames += 1;
        if ((advantage > 0 && homeWins) || (advantage < 0 && !homeWins))
          advantageWins += 1;
      }
      winnerValues.push(homeWins ? homeValue : awayValue);
      loserValues.push(homeWins ? awayValue : homeValue);
      differences.push(advantage);
      outcomes.push(homeWins ? 1 : -1);
    }

    return {
      ...metric,
      advantageGames,
      advantageWins,
      advantageWinRate:
        advantageGames === 0 ? 0 : (advantageWins / advantageGames) * 100,
      winnerAverage: average(winnerValues),
      loserAverage: average(loserValues),
      correlation: correlation(differences, outcomes),
    };
  });
  const majorityDrawSides = games
    .flatMap((game) => [
      {
        percentage: game.home.drawPercentage,
        won: game.home.score > game.away.score,
      },
      {
        percentage: game.away.drawPercentage,
        won: game.away.score > game.home.score,
      },
    ])
    .filter((side) => side.percentage > 50);
  return {
    analysis,
    majorityDrawSides,
    drawMajorityWinRate:
      majorityDrawSides.length === 0
        ? 0
        : (majorityDrawSides.filter((side) => side.won).length /
            majorityDrawSides.length) *
          100,
  };
};

export interface WilsonInterval {
  readonly lower: number;
  readonly upper: number;
}

export const wilsonInterval = (
  successes: number,
  sample: number,
): WilsonInterval | null => {
  if (sample <= 0) return null;
  const proportion = successes / sample;
  const z = 1.959_963_984_540_054;
  const zSquared = z ** 2;
  const denominator = 1 + zSquared / sample;
  const centre = proportion + zSquared / (2 * sample);
  const spread =
    z *
    Math.sqrt(
      (proportion * (1 - proportion) + zSquared / (4 * sample)) / sample,
    );
  return {
    lower: ((centre - spread) / denominator) * 100,
    upper: ((centre + spread) / denominator) * 100,
  };
};

export type AnalysisLens = "all" | "tight" | "clear";

export const filterGamesByLens = (
  games: readonly AnalysisGame[],
  lens: AnalysisLens,
): readonly AnalysisGame[] =>
  games.filter((game) => {
    const margin = Math.abs(game.home.score - game.away.score);
    return lens === "all" || (lens === "tight" ? margin <= 3 : margin >= 6);
  });

export interface SignalResult extends MetricDefinition {
  readonly wins: number;
  readonly sample: number;
  readonly observedRate: number | null;
  readonly interval: WilsonInterval | null;
}

export const buildSignalResults = (
  games: readonly AnalysisGame[],
  lens: AnalysisLens,
): readonly SignalResult[] => {
  const outcome = analyzeOutcomeGames(filterGamesByLens(games, lens));
  return outcome.analysis.map((metric) => ({
    key: metric.key,
    label: metric.label,
    signalLabel: metric.signalLabel,
    higherIsBetter: metric.higherIsBetter,
    format: metric.format,
    interpretation: metric.interpretation,
    wins: metric.advantageWins,
    sample: metric.advantageGames,
    observedRate: metric.advantageGames === 0 ? null : metric.advantageWinRate,
    interval: wilsonInterval(metric.advantageWins, metric.advantageGames),
  }));
};

export const selectStrongestSignal = (
  signals: readonly SignalResult[],
): SignalResult | null => {
  const available = signals.filter(
    (signal) => signal.interval !== null && signal.observedRate !== null,
  );
  return (
    available.toSorted((left, right) => {
      const lowerDifference =
        (right.interval?.lower ?? 0) - (left.interval?.lower ?? 0);
      if (lowerDifference !== 0) return lowerDifference;
      return (right.observedRate ?? 0) - (left.observedRate ?? 0);
    })[0] ?? null
  );
};

export interface TeamRateValues {
  readonly attackOutput: number;
  readonly goalPrevention: number;
  readonly shotConversion: number;
  readonly drawShare: number;
  readonly ballSecurity: number;
}

export type FingerprintMetricKey = keyof TeamRateValues;

export interface TeamFingerprintMetric {
  readonly key: FingerprintMetricKey;
  readonly label: string;
  readonly value: number;
  readonly percentile: number;
  readonly higherIsBetter: boolean;
  readonly unit: "per-game" | "percentage";
}

export interface TeamFingerprint {
  readonly team: string;
  readonly games: number;
  readonly metrics: readonly TeamFingerprintMetric[];
  readonly strongest: TeamFingerprintMetric;
  readonly weakest: TeamFingerprintMetric;
}

interface TeamAccumulator {
  readonly team: string;
  games: number;
  goals: number;
  goalsAllowed: number;
  shots: number;
  drawControls: number;
  totalDrawControls: number;
  turnovers: number;
}

const fingerprintDefinitions: readonly {
  readonly key: FingerprintMetricKey;
  readonly label: string;
  readonly higherIsBetter: boolean;
  readonly unit: "per-game" | "percentage";
}[] = [
  {
    key: "attackOutput",
    label: "Attack output",
    higherIsBetter: true,
    unit: "per-game",
  },
  {
    key: "goalPrevention",
    label: "Goal prevention",
    higherIsBetter: false,
    unit: "per-game",
  },
  {
    key: "shotConversion",
    label: "Shot conversion",
    higherIsBetter: true,
    unit: "percentage",
  },
  {
    key: "drawShare",
    label: "Draw share",
    higherIsBetter: true,
    unit: "percentage",
  },
  {
    key: "ballSecurity",
    label: "Ball security",
    higherIsBetter: false,
    unit: "per-game",
  },
];

const valuesForAccumulator = (
  accumulator: Readonly<TeamAccumulator>,
): TeamRateValues => ({
  attackOutput: accumulator.goals / accumulator.games,
  goalPrevention: accumulator.goalsAllowed / accumulator.games,
  shotConversion:
    accumulator.shots === 0 ? 0 : (accumulator.goals / accumulator.shots) * 100,
  drawShare:
    accumulator.totalDrawControls === 0
      ? 0
      : (accumulator.drawControls / accumulator.totalDrawControls) * 100,
  ballSecurity: accumulator.turnovers / accumulator.games,
});

export const fieldPercentile = (
  value: number,
  field: readonly number[],
  higherIsBetter: boolean,
): number => {
  if (field.length <= 1) return 100;
  const favorable = field.filter((candidate) =>
    higherIsBetter ? candidate > value : candidate < value,
  ).length;
  return ((field.length - 1 - favorable) / (field.length - 1)) * 100;
};

export const buildTeamFingerprints = (
  games: readonly AnalysisGame[],
): readonly TeamFingerprint[] => {
  const accumulators = new Map<string, TeamAccumulator>();
  const addSide = (
    side: AnalysisGame["home"],
    opponent: AnalysisGame["away"],
  ) => {
    const current = accumulators.get(side.team) ?? {
      team: side.team,
      games: 0,
      goals: 0,
      goalsAllowed: 0,
      shots: 0,
      drawControls: 0,
      totalDrawControls: 0,
      turnovers: 0,
    };
    current.games += 1;
    current.goals += side.goals;
    current.goalsAllowed += opponent.goals;
    current.shots += side.shots;
    current.drawControls += side.drawControls;
    current.totalDrawControls += side.drawControls + opponent.drawControls;
    current.turnovers += side.turnovers;
    accumulators.set(side.team, current);
  };
  for (const game of games) {
    addSide(game.home, game.away);
    addSide(game.away, game.home);
  }

  const drafts = [...accumulators.values()]
    .map((accumulator) => ({
      team: accumulator.team,
      games: accumulator.games,
      values: valuesForAccumulator(accumulator),
    }))
    .toSorted((left, right) => left.team.localeCompare(right.team));

  return drafts.map((draft) => {
    const metrics = fingerprintDefinitions.map((definition) => {
      const value = draft.values[definition.key];
      return {
        ...definition,
        value,
        percentile: fieldPercentile(
          value,
          drafts.map((candidate) => candidate.values[definition.key]),
          definition.higherIsBetter,
        ),
      };
    });
    const strongest = metrics.toSorted(
      (left, right) => right.percentile - left.percentile,
    )[0];
    const weakest = metrics.toSorted(
      (left, right) => left.percentile - right.percentile,
    )[0];
    if (strongest === undefined || weakest === undefined)
      throw new Error("Fingerprint metrics are required");
    return {
      team: draft.team,
      games: draft.games,
      metrics,
      strongest,
      weakest,
    };
  });
};

export const formatOutcomeValue = (
  value: number,
  type: MetricDefinition["format"],
): string =>
  type === "percentage" ? `${value.toFixed(1)}%` : value.toFixed(1);
