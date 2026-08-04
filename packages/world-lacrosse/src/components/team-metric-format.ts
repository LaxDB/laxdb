import type {
  TeamComparisonMetricAggregation,
  TeamComparisonMetricEvidence,
  TeamComparisonMetricFormat,
  TeamComparisonMetricKey,
} from "../lib/team-comparison-schema";

export const formatTeamMetricDuration = (seconds: number): string => {
  const rounded = Math.round(Math.abs(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

export const formatTeamMetricValue = (
  value: number | null,
  format: TeamComparisonMetricFormat,
  key: TeamComparisonMetricKey,
): string => {
  if (value === null) return "—";
  if (format === "percentage") return `${value.toFixed(1)}%`;
  if (format === "duration") return formatTeamMetricDuration(value);
  if (format === "decimal") {
    const rendered = value.toFixed(1);
    return key.includes("difference") && value > 0 ? `+${rendered}` : rendered;
  }
  const rendered = String(Math.round(value));
  return key.includes("difference") && value > 0 ? `+${rendered}` : rendered;
};

const formatEvidenceNumber = (
  value: number,
  format: TeamComparisonMetricFormat,
): string =>
  format === "duration"
    ? formatTeamMetricDuration(value)
    : Number.isInteger(value)
      ? String(value)
      : value.toFixed(1);

export const formatTeamMetricEvidence = (
  metric: Readonly<TeamComparisonMetricEvidence>,
  aggregation: TeamComparisonMetricAggregation,
  format: TeamComparisonMetricFormat,
): string => {
  const games = `${metric.sampleGames} ${metric.sampleGames === 1 ? "game" : "games"}`;
  if (metric.sampleGames === 0) return "No eligible evidence";
  if (metric.value === null) return `No qualifying evidence · ${games}`;
  const numerator = formatEvidenceNumber(metric.numerator, format);
  if (aggregation === "unique") return `${numerator} distinct · ${games}`;
  if (aggregation === "total")
    return `${numerator} across ${metric.denominator} game observations · ${games}`;
  if (aggregation === "paired-maximum")
    return `${numerator} paired with the longest drought · ${metric.denominator} qualifying observations · ${games}`;
  if (aggregation === "maximum" || aggregation === "minimum")
    return `${numerator} from ${metric.denominator} qualifying observations · ${games}`;
  return `${numerator} / ${formatEvidenceNumber(metric.denominator, "integer")} · ${games}`;
};

export const formatTeamMetricDifference = (
  left: number | null,
  right: number | null,
  format: TeamComparisonMetricFormat,
): string => {
  if (left === null || right === null) return "—";
  const difference = left - right;
  const sign = difference > 0 ? "+" : difference < 0 ? "−" : "";
  const absolute = Math.abs(difference);
  if (format === "percentage") return `${sign}${absolute.toFixed(1)} pp`;
  if (format === "duration")
    return `${sign}${formatTeamMetricDuration(absolute)}`;
  if (format === "decimal") return `${sign}${absolute.toFixed(1)}`;
  return `${sign}${Math.round(absolute)}`;
};
