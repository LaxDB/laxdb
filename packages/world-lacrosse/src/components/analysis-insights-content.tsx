import { useMemo, useState } from "react";

import {
  buildSignalResults,
  buildTeamFingerprints,
  filterGamesByLens,
  selectStrongestSignal,
  type AnalysisGame,
  type AnalysisLens,
  type SignalResult,
  type TeamFingerprintMetric,
} from "../analysis-insights";

export interface InsightsTeamContext {
  readonly team: string;
  readonly games: number;
  readonly averageGoalsFor: number;
  readonly averageGoalsAgainst: number;
  readonly opponentAdjustedMargin: number | null;
}

interface InsightsLabContentProps {
  readonly games: readonly AnalysisGame[];
  readonly tournamentEligibleGames: number;
  readonly excludedFromCompleteCase: number;
  readonly snapshotStatus: "fresh" | "degraded" | "archive";
  readonly completedGames: number;
  readonly detailedGames: number;
  readonly missingOrConflictedGames: number;
  readonly sourceUpdatedAt: string;
  readonly teams: readonly InsightsTeamContext[];
}

const percent = (value: number): string => `${value.toFixed(1)}%`;

const timestamp = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(parsed);
};

const lensOptions: readonly {
  readonly key: AnalysisLens;
  readonly label: string;
  readonly definition: string;
}[] = [
  { key: "all", label: "All games", definition: "all complete cases" },
  { key: "tight", label: "Tight ≤ 3", definition: "final margin ≤ 3" },
  { key: "clear", label: "Clear ≥ 6", definition: "final margin ≥ 6" },
];

function SignalRow({
  signal,
  strongest,
}: {
  readonly signal: SignalResult;
  readonly strongest: boolean;
}) {
  const interval = signal.interval;
  const observed = signal.observedRate;
  return (
    <div className="insights-signal" data-strongest={strongest || undefined}>
      <strong>{signal.signalLabel}</strong>
      <div className="insights-signal-visual" aria-hidden="true">
        <i className="insights-reference" />
        {interval !== null && observed !== null && (
          <>
            <i
              className="insights-interval"
              style={{
                left: `${interval.lower}%`,
                width: `${interval.upper - interval.lower}%`,
              }}
            />
            <i
              className="insights-signal-dot"
              style={{ left: `${observed}%` }}
            />
          </>
        )}
      </div>
      <b>{observed === null ? "Not available" : percent(observed)}</b>
      <small>
        {interval === null
          ? "No metric-decisive games in this lens."
          : `${signal.wins} wins / ${signal.sample} decisive · 95% CI ${percent(interval.lower)}–${percent(interval.upper)}`}
        <span>{signal.interpretation}</span>
      </small>
    </div>
  );
}

function SignalRunway({ games }: { readonly games: readonly AnalysisGame[] }) {
  const [lens, setLens] = useState<AnalysisLens>("all");
  const signals = useMemo(() => buildSignalResults(games, lens), [games, lens]);
  const strongest = selectStrongestSignal(signals);
  const lensGames = filterGamesByLens(games, lens);
  const activeLens = lensOptions.find((option) => option.key === lens);
  return (
    <section className="insights-section" id="signals">
      <header className="insights-section-head">
        <span>01</span>
        <div>
          <h2>What travels with winning</h2>
          <p>
            Observed favorable-advantage win share with a 95% Wilson interval.
            Wider ranges mean less certainty; the vertical rule marks 50%.
          </p>
        </div>
        <div className="insights-lens" role="group" aria-label="Game lens">
          {lensOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={lens === option.key}
              onClick={() => {
                setLens(option.key);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>
      <p className="insights-lens-sample" aria-live="polite">
        {lensGames.length} complete-case games · {activeLens?.definition}
      </p>
      <div
        className="insights-signals"
        role="group"
        aria-label="Outcome signal estimates"
      >
        {signals.map((signal) => (
          <SignalRow
            key={signal.key}
            signal={signal}
            strongest={signal.key === strongest?.key}
          />
        ))}
      </div>
    </section>
  );
}

const median = (values: readonly number[]): number => {
  const sorted = values.toSorted((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  const middle = sorted[midpoint];
  if (middle === undefined) return 0;
  if (sorted.length % 2 === 1) return middle;
  return ((sorted[midpoint - 1] ?? middle) + middle) / 2;
};

const scale = (
  value: number,
  minimum: number,
  maximum: number,
  start: number,
  end: number,
): number =>
  minimum === maximum
    ? (start + end) / 2
    : start + ((value - minimum) / (maximum - minimum)) * (end - start);

const labelOffsets: readonly { readonly x: number; readonly y: number }[] = [
  { x: 9, y: -9 },
  { x: 9, y: 15 },
  { x: -9, y: -10 },
  { x: -9, y: 16 },
  { x: 10, y: -15 },
  { x: 10, y: 20 },
  { x: -10, y: -16 },
  { x: -10, y: 21 },
];

function TeamField({
  teams,
}: {
  readonly teams: readonly InsightsTeamContext[];
}) {
  const entries = teams
    .filter((team) => team.games > 0)
    .toSorted((left, right) => left.team.localeCompare(right.team));
  if (entries.length === 0)
    return (
      <section className="insights-section" id="team-field">
        <header className="insights-section-head">
          <span>02</span>
          <div>
            <h2>The field, at a glance</h2>
            <p>
              Average goals for runs rightward; fewer goals allowed runs upward.
              Median rules describe the current eligible tournament sample.
            </p>
          </div>
        </header>
        <div className="insights-empty-state" role="status">
          <h3>Team field unavailable</h3>
          <p>
            No teams with eligible tournament games are available. Medians and
            field positions are not calculated.
          </p>
        </div>
      </section>
    );

  const goalsFor = entries.map((team) => team.averageGoalsFor);
  const goalsAgainst = entries.map((team) => team.averageGoalsAgainst);
  const xMedian = median(goalsFor);
  const yMedian = median(goalsAgainst);
  const xMinimum = Math.min(...goalsFor);
  const xMaximum = Math.max(...goalsFor);
  const yMinimum = Math.min(...goalsAgainst);
  const yMaximum = Math.max(...goalsAgainst);
  const pairedAboveMedian = entries.filter(
    (team) =>
      team.averageGoalsFor >= xMedian && team.averageGoalsAgainst <= yMedian,
  ).length;

  return (
    <section className="insights-section" id="team-field">
      <header className="insights-section-head">
        <span>02</span>
        <div>
          <h2>The field, at a glance</h2>
          <p>
            Average goals for runs rightward; fewer goals allowed runs upward.
            Median rules describe the current eligible tournament sample.
          </p>
        </div>
      </header>
      <div className="insights-field-layout">
        <figure className="insights-field-figure">
          <div
            className="insights-field-overflow"
            role="region"
            aria-label="Scrollable team offense and defense field"
            tabIndex={0}
          >
            <svg
              className="insights-field-chart"
              viewBox="0 0 760 500"
              role="img"
              aria-labelledby="team-field-title team-field-description"
            >
              <title id="team-field-title">
                Team average goals for and goals allowed
              </title>
              <desc id="team-field-description">
                Offense increases from left to right. Goal prevention improves
                from bottom to top. Exact values follow in the team ledger.
              </desc>
              <line
                className="insights-field-median"
                x1={scale(xMedian, xMinimum, xMaximum, 70, 710)}
                x2={scale(xMedian, xMinimum, xMaximum, 70, 710)}
                y1="45"
                y2="440"
              />
              <line
                className="insights-field-median"
                x1="70"
                x2="710"
                y1={scale(yMedian, yMinimum, yMaximum, 440, 45)}
                y2={scale(yMedian, yMinimum, yMaximum, 440, 45)}
              />
              <text className="insights-axis-label" x="70" y="25">
                STRONGER PREVENTION ↑
              </text>
              <text
                className="insights-axis-label"
                x="710"
                y="478"
                textAnchor="end"
              >
                HIGHER ATTACK OUTPUT →
              </text>
              {entries.map((team, index) => {
                const x = scale(
                  team.averageGoalsFor,
                  xMinimum,
                  xMaximum,
                  70,
                  710,
                );
                const y = scale(
                  team.averageGoalsAgainst,
                  yMinimum,
                  yMaximum,
                  440,
                  45,
                );
                const offset = labelOffsets[index % labelOffsets.length] ?? {
                  x: 9,
                  y: -9,
                };
                return (
                  <g key={team.team}>
                    <circle cx={x} cy={y} r="5" />
                    <text
                      x={x + offset.x}
                      y={y + offset.y}
                      textAnchor={offset.x < 0 ? "end" : "start"}
                    >
                      {team.team}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <figcaption>
            Identity map, not a ranking. Tournament-sample averages are not
            pace- or opponent-adjusted.
          </figcaption>
        </figure>
        <aside
          className="insights-field-ledger"
          aria-label="Exact team field values"
        >
          <span className="insights-kicker">Tournament read</span>
          <h3>
            {pairedAboveMedian} teams pair above-median output with above-median
            prevention.
          </h3>
          <p>
            Exact rates keep close labels honest. Opponent-adjusted margin is
            included as context, not folded into either axis.
          </p>
          <div
            className="table-shell"
            role="region"
            aria-label="Team field ledger"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>GF</th>
                  <th>GA</th>
                  <th>Adj.</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((team) => (
                  <tr key={team.team}>
                    <th>{team.team}</th>
                    <td>{team.averageGoalsFor.toFixed(1)}</td>
                    <td>{team.averageGoalsAgainst.toFixed(1)}</td>
                    <td>
                      {team.opponentAdjustedMargin === null
                        ? "—"
                        : `${team.opponentAdjustedMargin >= 0 ? "+" : ""}${team.opponentAdjustedMargin.toFixed(1)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <small>
            Field medians: {xMedian.toFixed(1)} goals for · {yMedian.toFixed(1)}
            goals allowed.
          </small>
        </aside>
      </div>
    </section>
  );
}

const metricValue = (metric: TeamFingerprintMetric): string =>
  metric.unit === "percentage"
    ? percent(metric.value)
    : `${metric.value.toFixed(1)} / game`;

export const roundedPercentile = (value: number): string => {
  const rounded = Math.round(value);
  const remainder100 = rounded % 100;
  if (remainder100 >= 11 && remainder100 <= 13)
    return `${rounded}th percentile`;
  switch (rounded % 10) {
    case 1:
      return `${rounded}st percentile`;
    case 2:
      return `${rounded}nd percentile`;
    case 3:
      return `${rounded}rd percentile`;
    default:
      return `${rounded}th percentile`;
  }
};

const metricList = (metrics: readonly TeamFingerprintMetric[]): string => {
  const labels = metrics.map((metric) => metric.label);
  if (labels.length < 2) return labels[0] ?? "No metric";
  if (labels.length === 2) return labels.join(" and ");
  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
};

function TeamFingerprintSection({
  games,
}: {
  readonly games: readonly AnalysisGame[];
}) {
  const profiles = useMemo(() => buildTeamFingerprints(games), [games]);
  const [selectedTeam, setSelectedTeam] = useState(profiles[0]?.team ?? "");
  const selected =
    profiles.find((profile) => profile.team === selectedTeam) ?? profiles[0];
  if (selected === undefined)
    return (
      <section className="insights-section" id="fingerprint">
        <header className="insights-section-head">
          <span>03</span>
          <div>
            <h2>Team fingerprint</h2>
            <p>
              Tournament-sample percentile position among teams with complete
              analysis evidence. Direction is handled in the favorable sense.
            </p>
          </div>
        </header>
        <div className="insights-empty-state" role="status">
          <h3>Team fingerprint unavailable</h3>
          <p>
            No teams have complete-case analysis evidence for a comparable
            fingerprint yet.
          </p>
        </div>
      </section>
    );
  const strongestMetrics = selected.metrics.filter(
    (metric) => metric.percentile === selected.strongest.percentile,
  );
  const weakestMetrics = selected.metrics.filter(
    (metric) => metric.percentile === selected.weakest.percentile,
  );
  const strongestNames = metricList(strongestMetrics);
  const weakestNames = metricList(weakestMetrics);
  const strongestTied = strongestMetrics.length > 1;
  const weakestTied = weakestMetrics.length > 1;
  return (
    <section className="insights-section" id="fingerprint">
      <header className="insights-section-head">
        <span>03</span>
        <div>
          <h2>Team fingerprint</h2>
          <p>
            Tournament-sample percentile position among teams with complete
            analysis evidence. Direction is handled in the favorable sense.
          </p>
        </div>
      </header>
      <div className="insights-fingerprint">
        <div className="insights-fingerprint-copy">
          <label htmlFor="insights-team-select">Team</label>
          <select
            id="insights-team-select"
            value={selected.team}
            onChange={(event) => {
              setSelectedTeam(event.currentTarget.value);
            }}
          >
            {profiles.map((profile) => (
              <option key={profile.team} value={profile.team}>
                {profile.team}
              </option>
            ))}
          </select>
          <h3>
            {strongestNames}{" "}
            {strongestTied ? "share the top" : "sets the profile"}.
          </h3>
          <p>
            {strongestNames} {strongestTied ? "share" : "has"} the top
            percentile position in this field at the{" "}
            {roundedPercentile(selected.strongest.percentile)}. {weakestNames}{" "}
            {weakestTied ? "share" : "has"} the bottom percentile position at
            the {roundedPercentile(selected.weakest.percentile)}—a descriptive
            field comparison, not a forecast of what happens next.
          </p>
          <small>
            {selected.games} complete-case{" "}
            {selected.games === 1 ? "game" : "games"}. Rates use only that
            evidence.
          </small>
        </div>
        <div
          className="insights-fingerprint-lines"
          role="group"
          aria-label={`${selected.team} percentile fingerprint`}
        >
          {selected.metrics.map((metric) => (
            <div key={metric.key} className="insights-fingerprint-line">
              <span>{metric.label}</span>
              <div className="insights-fingerprint-track" aria-hidden="true">
                <i
                  className={
                    metric.percentile === selected.strongest.percentile
                      ? "is-strongest"
                      : undefined
                  }
                  style={{ width: `${metric.percentile}%` }}
                />
              </div>
              <b>{Math.round(metric.percentile)}</b>
              <small>
                {metricValue(metric)} · {roundedPercentile(metric.percentile)}
              </small>
            </div>
          ))}
        </div>
      </div>
      <p className="insights-fingerprint-note">
        Percentiles describe this tournament complete-case field only. Goal
        prevention and ball security reward lower rates; all other dimensions
        reward higher rates.
      </p>
    </section>
  );
}

function Methods({
  completeGames,
  eligibleGames,
}: {
  readonly completeGames: number;
  readonly eligibleGames: number;
}) {
  return (
    <section className="insights-methods" id="methods">
      <details>
        <summary>
          <h2>Methods &amp; limitations</h2>
        </summary>
        <div>
          <p>
            <strong>Eligibility intersection.</strong> The lab first uses games
            accepted by Tournament Context: official, final-reconciled
            score-flow evidence with consistent scores. It then intersects those{" "}
            {eligibleGames}
            {" games with the "}
            {completeGames} games where both teams have every analysis stat
            parsed.
          </p>
          <p>
            <strong>Metric decisions.</strong> A game enters a metric
            denominator only when the teams differ on that metric. Ties are
            excluded. The favorable side is higher for every runway metric
            except turnovers, where fewer is favorable.
          </p>
          <p>
            <strong>Uncertainty.</strong> Intervals are two-sided 95% Wilson
            score intervals for the observed favorable-side win share. They
            quantify sampling uncertainty; they do not make the association
            causal or predictive. The best-supported association is selected
            first by highest 95% Wilson lower bound, then observed rate, then
            definition order.
          </p>
          <p>
            <strong>Lenses.</strong> All games includes every complete case.
            Tight uses a final margin of three goals or fewer. Clear uses six
            goals or more. Games with margins of four or five appear only in All
            games.
          </p>
          <p>
            <strong>Recomputed team rates.</strong> Attack output, goals
            allowed, and turnovers are per game. Conversion is total goals
            divided by total shots, not an average of displayed percentages.
            Draw share is team draw controls divided by both teams’ draw
            controls across those games.
          </p>
          <p>
            <strong>Limits.</strong> This is a descriptive tournament sample
            with no pace adjustment. Schedule strength and game state can
            differ. Shooting and save percentages are mathematically coupled to
            goals scored and allowed, which also determine results, so those
            associations are partly structural. The scatter shows eligible
            Tournament Context games, while the fingerprint and runway require
            the stricter complete-case intersection.
          </p>
        </div>
      </details>
    </section>
  );
}

export function InsightsLabContent({
  games,
  tournamentEligibleGames,
  excludedFromCompleteCase,
  snapshotStatus,
  completedGames,
  detailedGames,
  missingOrConflictedGames,
  sourceUpdatedAt,
  teams,
}: InsightsLabContentProps) {
  const strongest = selectStrongestSignal(buildSignalResults(games, "all"));
  const strongestRate = strongest?.observedRate;
  return (
    <>
      <section
        className="insights-readout"
        aria-labelledby="insights-readout-title"
      >
        <div>
          <span className="insights-kicker">Field brief / current sample</span>
          <h2 id="insights-readout-title">
            {strongest === null
              ? "The current sample does not contain a decisive signal."
              : `The sample’s best-supported observed association is ${strongest.signalLabel.toLowerCase()}.`}
          </h2>
          <p>
            {strongest === null ||
            strongestRate === null ||
            strongestRate === undefined
              ? "More complete evidence is needed before describing the metric relationships."
              : `The favorable side won ${percent(strongestRate)} of ${strongest.sample} metric-decisive complete-case games.`}{" "}
            This is a descriptive tournament sample, not a causal claim or
            prediction.
          </p>
          {snapshotStatus === "degraded" && (
            <p className="insights-coverage-note" data-freshness="degraded">
              Evidence uses a degraded live snapshot because the latest refresh
              is delayed, failed, incomplete, or conflicted. The figures may lag
              the source or omit unresolved details and may not represent the
              complete tournament sample.
            </p>
          )}
        </div>
        <dl>
          <div>
            <dt>Complete-case games</dt>
            <dd>{games.length}</dd>
          </div>
          <div>
            <dt>Tournament eligible</dt>
            <dd>{tournamentEligibleGames}</dd>
          </div>
          <div>
            <dt>Eligible, not complete-case</dt>
            <dd>{excludedFromCompleteCase}</dd>
          </div>
          <div>
            <dt>Snapshot status</dt>
            <dd>
              {snapshotStatus === "fresh"
                ? "Fresh live"
                : snapshotStatus === "degraded"
                  ? "Degraded live"
                  : "Archived final"}
            </dd>
          </div>
          <div>
            <dt>Completed detail coverage</dt>
            <dd>
              {detailedGames} of {completedGames}
            </dd>
          </div>
          <div>
            <dt>Missing / conflicted details</dt>
            <dd>{missingOrConflictedGames}</dd>
          </div>
          <div>
            <dt>Source updated</dt>
            <dd>{timestamp(sourceUpdatedAt)}</dd>
          </div>
        </dl>
      </section>
      <SignalRunway games={games} />
      <TeamField teams={teams} />
      <TeamFingerprintSection games={games} />
      <Methods
        completeGames={games.length}
        eligibleGames={tournamentEligibleGames}
      />
    </>
  );
}
