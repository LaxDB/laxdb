import { Link } from "@tanstack/react-router";

import type {
  TeamEvaluation,
  TeamEvaluationPlayer,
  TeamEvaluationPlayerMetricKey,
  TeamEvaluationSegment,
} from "../lib/team-evaluation-schema";
import { teamEvaluationPlayerMetricDefinitions } from "../lib/team-evaluation-schema";

import { TeamEvaluationPlayerLedger } from "./team-evaluation-player-ledger";

const segmentLabels: Readonly<Record<TeamEvaluationSegment, string>> = {
  "full-game": "Full game",
  "quarter-1": "Quarter 1",
  "quarter-2": "Quarter 2",
  "quarter-3": "Quarter 3",
  "quarter-4": "Quarter 4",
  "first-half": "First half",
  "second-half": "Second half",
  overtime: "Overtime",
};
const segmentOptions: readonly TeamEvaluationSegment[] = [
  "full-game",
  "quarter-1",
  "quarter-2",
  "quarter-3",
  "quarter-4",
  "first-half",
  "second-half",
  "overtime",
];
const segmentMetrics = new Set<TeamEvaluationPlayerMetricKey>([
  "points",
  "goals",
  "recorded-assists",
  "free-position-goals",
]);

const playerMetric = (
  player: Readonly<TeamEvaluationPlayer>,
  key: TeamEvaluationPlayerMetricKey,
  segment: TeamEvaluationSegment,
): { readonly value: number | null; readonly evidence: string } => {
  if (segment !== "full-game") {
    const split = player.segments.find((entry) => entry.segment === segment);
    if (!split || !segmentMetrics.has(key))
      return { value: null, evidence: "Not available for this segment" };
    if (split.sampleGames === 0)
      return { value: null, evidence: "No eligible segment evidence" };
    const value =
      key === "goals"
        ? split.goals
        : key === "recorded-assists"
          ? split.recordedAssists
          : key === "free-position-goals"
            ? split.freePositionGoals
            : split.points;
    return {
      value,
      evidence:
        value === null
          ? `Scorer attribution incomplete · ${split.sampleGames} eligible games`
          : `${value} across ${split.sampleGames} eligible games`,
    };
  }
  const metric = player.metrics.find((entry) => entry.key === key);
  if (!metric || metric.value === null)
    return { value: null, evidence: "No reconciled evidence" };
  const definition = teamEvaluationPlayerMetricDefinitions.find(
    (entry) => entry.key === key,
  );
  return {
    value: metric.value,
    evidence:
      definition?.format === "percentage"
        ? `${metric.numerator}/${metric.denominator} across ${metric.sampleGames} eligible games · ${metric.quality}`
        : `${metric.numerator} across ${metric.sampleGames} eligible games · ${metric.quality}`,
  };
};

const formatted = (value: number | null, percentage: boolean): string =>
  value === null
    ? "—"
    : percentage
      ? `${value.toFixed(1)}%`
      : String(Math.round(value));

const signedDifference = (
  left: number | null,
  right: number | null,
  percentage: boolean,
): string => {
  if (left === null || right === null) return "—";
  const difference = left - right;
  const sign = difference > 0 ? "+" : difference < 0 ? "−" : "";
  const rendered = percentage
    ? `${Math.abs(difference).toFixed(1)} pp`
    : String(Math.round(Math.abs(difference)));
  return `${sign}${rendered}`;
};

const ranked = (
  players: readonly TeamEvaluationPlayer[],
  key: TeamEvaluationPlayerMetricKey,
  segment: TeamEvaluationSegment,
): ReadonlyMap<string, { readonly rank: number; readonly tied: boolean }> => {
  const values = players
    .flatMap((player) => {
      const value = playerMetric(player, key, segment).value;
      return value === null ? [] : [{ player, value }];
    })
    .toSorted(
      (left, right) =>
        right.value - left.value ||
        left.player.name.localeCompare(right.player.name),
    );
  const output = new Map<
    string,
    { readonly rank: number; readonly tied: boolean }
  >();
  let previous: number | null = null;
  let rank = 0;
  for (const [index, entry] of values.entries()) {
    if (previous === null || entry.value !== previous) rank = index + 1;
    previous = entry.value;
    output.set(entry.player.id ?? entry.player.name, {
      rank,
      tied: values.some(
        (candidate, candidateIndex) =>
          candidateIndex !== index && candidate.value === entry.value,
      ),
    });
  }
  return output;
};

function PlayerComparisonTable({
  title,
  playersA,
  playersB,
  metric,
  segment,
  selectedPlayerId,
}: {
  readonly title: string;
  readonly playersA: readonly TeamEvaluationPlayer[];
  readonly playersB: readonly TeamEvaluationPlayer[];
  readonly metric: TeamEvaluationPlayerMetricKey;
  readonly segment: TeamEvaluationSegment;
  readonly selectedPlayerId: string | undefined;
}) {
  const ranksA = ranked(playersA, metric, segment);
  const ranksB = ranked(playersB, metric, segment);
  const definition = teamEvaluationPlayerMetricDefinitions.find(
    (entry) => entry.key === metric,
  );
  const percentage = definition?.format === "percentage";
  return (
    <div
      className="team-evaluation-table-shell"
      role="region"
      aria-label={`${title} player comparison`}
      tabIndex={0}
    >
      <table>
        <caption>
          {title}: {definition?.label ?? metric} in sample A and sample B
        </caption>
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Roster / activity A</th>
            <th scope="col">Roster / activity B</th>
            <th scope="col">Sample A</th>
            <th scope="col">Rank A</th>
            <th scope="col">Sample B</th>
            <th scope="col">Rank B</th>
            <th scope="col">A − B</th>
          </tr>
        </thead>
        <tbody>
          {playersA.map((left) => {
            const right =
              playersB.find((candidate) => candidate.id === left.id) ?? left;
            const leftValue = playerMetric(left, metric, segment);
            const rightValue = playerMetric(right, metric, segment);
            const rankA = ranksA.get(left.id ?? left.name);
            const rankB = ranksB.get(right.id ?? right.name);
            return (
              <tr
                key={left.id ?? left.name}
                data-selected={left.id === selectedPlayerId ? "" : undefined}
              >
                <th scope="row">
                  {left.id ? (
                    <Link
                      to="/players/$playerId"
                      params={{ playerId: left.id }}
                    >
                      {left.name}
                      {left.id === selectedPlayerId && (
                        <span className="sr-only"> (selected player)</span>
                      )}
                    </Link>
                  ) : (
                    left.name
                  )}
                  <small>
                    {left.number ?? "—"} · {left.position ?? left.playerType}
                  </small>
                </th>
                <td>
                  {left.rosterListedGames} / {left.recordedActivityGames}
                  <small>listed / activity games</small>
                </td>
                <td>
                  {right.rosterListedGames} / {right.recordedActivityGames}
                  <small>listed / activity games</small>
                </td>
                <td>
                  <strong>{formatted(leftValue.value, percentage)}</strong>
                  <small>{leftValue.evidence}</small>
                </td>
                <td>{rankA ? `${rankA.tied ? "T" : ""}${rankA.rank}` : "—"}</td>
                <td>
                  <strong>{formatted(rightValue.value, percentage)}</strong>
                  <small>{rightValue.evidence}</small>
                </td>
                <td>{rankB ? `${rankB.tied ? "T" : ""}${rankB.rank}` : "—"}</td>
                <td>
                  {signedDifference(
                    leftValue.value,
                    rightValue.value,
                    percentage,
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TeamEvaluationPlayerPanel({
  report,
  metric,
  segment,
  selectedPlayerId,
  onMetricChange,
  onSegmentChange,
}: {
  readonly report: TeamEvaluation;
  readonly metric: TeamEvaluationPlayerMetricKey;
  readonly segment: TeamEvaluationSegment;
  readonly selectedPlayerId: string | undefined;
  readonly onMetricChange: (metric: TeamEvaluationPlayerMetricKey) => void;
  readonly onSegmentChange: (segment: TeamEvaluationSegment) => void;
}) {
  const fieldA = report.sampleA.players.filter(
    (player) => player.playerType === "FieldPlayer",
  );
  const fieldB = report.sampleB.players.filter(
    (player) => player.playerType === "FieldPlayer",
  );
  const goalkeeperA = report.sampleA.players.filter(
    (player) => player.playerType === "Goalkeeper",
  );
  const goalkeeperB = report.sampleB.players.filter(
    (player) => player.playerType === "Goalkeeper",
  );
  const definition = teamEvaluationPlayerMetricDefinitions.find(
    (entry) => entry.key === metric,
  );
  const fieldMetric = definition?.playerType !== "goalkeeper";
  return (
    <section
      className="team-evaluation-players"
      id="player-comparison"
      aria-labelledby="player-split-title"
    >
      <header className="team-evaluation-section-heading">
        <span>03</span>
        <div>
          <h2 id="player-split-title">Teammate sample difference</h2>
          <p>
            Choose one metric; ranks order teammates high to low by the recorded
            value only. Rank 1 for turnovers or cards means most recorded, not
            favorable or better. These are not quality rankings or a composite
            grade.
          </p>
        </div>
      </header>
      <div className="team-evaluation-player-controls">
        <label>
          <span>Player metric</span>
          <select
            value={metric}
            onChange={(event) => {
              const next = teamEvaluationPlayerMetricDefinitions.find(
                (entry) => entry.key === event.currentTarget.value,
              );
              if (next) onMetricChange(next.key);
            }}
          >
            {teamEvaluationPlayerMetricDefinitions.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Scoring segment</span>
          <select
            value={segment}
            disabled={!segmentMetrics.has(metric)}
            onChange={(event) => {
              const next = segmentOptions.find(
                (entry) => entry === event.currentTarget.value,
              );
              if (next) onSegmentChange(next);
            }}
          >
            {segmentOptions.map((key) => (
              <option key={key} value={key}>
                {segmentLabels[key]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!fieldMetric && (
        <p className="team-evaluation-note">
          This goalkeeper-specific metric is shown in the separate goalkeeper
          table below.
        </p>
      )}
      {fieldMetric && (
        <PlayerComparisonTable
          title="Field players"
          playersA={fieldA}
          playersB={fieldB}
          metric={metric}
          segment={segment}
          selectedPlayerId={selectedPlayerId}
        />
      )}
      <h3>Goalkeepers</h3>
      <PlayerComparisonTable
        title="Goalkeepers"
        playersA={goalkeeperA}
        playersB={goalkeeperB}
        metric={
          definition?.playerType === "goalkeeper" ||
          definition?.playerType === "both"
            ? metric
            : "saves"
        }
        segment="full-game"
        selectedPlayerId={selectedPlayerId}
      />
      <TeamEvaluationPlayerLedger
        sampleA={report.sampleA}
        sampleB={report.sampleB}
        selectedPlayerId={selectedPlayerId}
      />
      <details className="team-evaluation-period-matrix">
        <summary>Quarter and half scoring matrix</summary>
        <div
          className="team-evaluation-table-shell"
          role="region"
          aria-label="Player scoring by quarter and half"
          tabIndex={0}
        >
          <table>
            <caption>
              Sample A player points by segment; values are goals plus recorded
              assists
            </caption>
            <thead>
              <tr>
                <th scope="col">Player</th>
                {segmentOptions
                  .filter((key) => key !== "full-game")
                  .map((key) => (
                    <th scope="col" key={key}>
                      {segmentLabels[key]}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {fieldA.map((player) => (
                <tr key={player.id ?? player.name}>
                  <th scope="row">{player.name}</th>
                  {segmentOptions
                    .filter((key) => key !== "full-game")
                    .map((key) => {
                      const split = player.segments.find(
                        (entry) => entry.segment === key,
                      );
                      return (
                        <td key={key}>
                          {split?.sampleGames === 0
                            ? "—"
                            : (split?.points ?? "—")}
                          <small>
                            {split?.sampleGames === 0
                              ? "No eligible segment evidence"
                              : `${split?.goals ?? "—"} G · ${split?.recordedAssists ?? "—"} A*`}
                          </small>
                        </td>
                      );
                    })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="team-evaluation-note">
        Roster-listed games do not prove field-player participation. Activity
        games require a recorded event or goalkeeper start. Field-player minutes
        are unavailable. A* means source-recorded assists.
      </p>
    </section>
  );
}
