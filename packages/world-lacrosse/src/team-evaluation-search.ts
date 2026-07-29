import {
  type TeamEvaluationPlayerMetricKey as PlayerMetricKey,
  type TeamEvaluationSegment as PlayerSegment,
  teamEvaluationPlayerMetricDefinitions,
} from "./team-evaluation-schema";

const playerMetricKeys = teamEvaluationPlayerMetricDefinitions.map(
  (definition) => definition.key,
);
const playerSegments: readonly PlayerSegment[] = [
  "full-game",
  "quarter-1",
  "quarter-2",
  "quarter-3",
  "quarter-4",
  "first-half",
  "second-half",
  "overtime",
];

export interface TeamEvaluationSearch {
  readonly a?: string;
  readonly b?: string;
  readonly player?: string;
  readonly metric?: PlayerMetricKey;
  readonly segment?: PlayerSegment;
}

const stringValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;

const identifierValue = (value: unknown): string | undefined =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? String(value)
    : stringValue(value);

const literalValue = <T extends string>(
  value: unknown,
  literals: readonly T[],
): T | undefined => {
  const parsed = stringValue(value);
  return parsed === undefined
    ? undefined
    : literals.find((literal) => literal === parsed);
};

export const parseEvaluationGameIds = (
  value?: unknown,
): readonly string[] | undefined => {
  const parsed = identifierValue(value);
  if (parsed === undefined) return undefined;
  if (parsed === "none") return [];
  const valid = [
    ...new Set(
      parsed
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => /^[A-Za-z0-9_-]+$/u.test(entry)),
    ),
  ];
  return valid.length === 0 ? undefined : valid;
};

export const encodeEvaluationGameIds = (ids: readonly string[]): string =>
  ids.length === 0 ? "none" : ids.join(",");

export const parseTeamEvaluationSearch = (
  search: Record<string, unknown>,
): TeamEvaluationSearch => {
  const parsedA = parseEvaluationGameIds(search.a);
  const parsedB = parseEvaluationGameIds(search.b);
  const player = identifierValue(search.player);
  const metric = literalValue(search.metric, playerMetricKeys);
  const requestedSegment = literalValue(search.segment, playerSegments);
  const segmentAllowed =
    metric === undefined ||
    metric === "points" ||
    metric === "goals" ||
    metric === "recorded-assists" ||
    metric === "free-position-goals";
  const segment = segmentAllowed ? requestedSegment : undefined;
  return {
    ...(parsedA === undefined ? {} : { a: encodeEvaluationGameIds(parsedA) }),
    ...(parsedB === undefined ? {} : { b: encodeEvaluationGameIds(parsedB) }),
    ...(player === undefined ? {} : { player }),
    ...(metric === undefined ? {} : { metric }),
    ...(segment === undefined ? {} : { segment }),
  };
};
