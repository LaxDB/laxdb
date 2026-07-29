import type { GamePreview, GamePreviewTeam } from "../game-preview-schema";
import type {
  TeamBenchmark,
  TeamBenchmarkMetric,
} from "../team-analysis-schema";

const metrics: readonly TeamBenchmarkMetric[] = [
  "goals-per-game",
  "goals-against-per-game",
  "goal-difference-per-game",
  "shooting-percentage",
  "draw-control-percentage",
  "save-percentage",
];

const metricLabel = (metric: TeamBenchmarkMetric): string => {
  switch (metric) {
    case "goals-per-game":
      return "Goals per game";
    case "goals-against-per-game":
      return "Goals allowed per game";
    case "goal-difference-per-game":
      return "Goal difference per game";
    case "shooting-percentage":
      return "Shooting conversion";
    case "draw-control-percentage":
      return "Draw-control share";
    case "save-percentage":
      return "Team save rate";
  }
};

const metricValue = (
  metric: TeamBenchmarkMetric,
  benchmark: Readonly<TeamBenchmark> | undefined,
): string => {
  if (!benchmark) return "—";
  const value = benchmark.rate.value;
  if (
    metric === "shooting-percentage" ||
    metric === "draw-control-percentage" ||
    metric === "save-percentage"
  )
    return `${value.toFixed(1)}%`;
  if (metric === "goal-difference-per-game" && value > 0)
    return `+${value.toFixed(1)}`;
  return value.toFixed(1);
};

const metricEvidence = (
  benchmark: Readonly<TeamBenchmark> | undefined,
): string =>
  benchmark
    ? `${benchmark.rate.numerator}/${benchmark.rate.denominator} · ${benchmark.sampleGames} ${benchmark.sampleGames === 1 ? "game" : "games"}`
    : "—";

const benchmarkFor = (
  team: Readonly<GamePreviewTeam>,
  metric: TeamBenchmarkMetric,
): TeamBenchmark | undefined =>
  team.benchmarks.find((benchmark) => benchmark.metric === metric);

const PreviewTeam = ({ team }: { readonly team: GamePreviewTeam }) => (
  <div className="game-preview-team">
    <span className="game-preview-flag" aria-hidden="true">
      {team.flagUrl && <img src={team.flagUrl} alt="" />}
    </span>
    <span>
      <small>{team.code}</small>
      <strong>{team.name}</strong>
    </span>
    <b>
      {team.wins}–{team.losses}
    </b>
    <small>
      {team.eligibleGames} previous{" "}
      {team.eligibleGames === 1 ? "game" : "games"}
    </small>
  </div>
);

const RecentForm = ({ team }: { readonly team: GamePreviewTeam }) => (
  <section className="game-preview-form">
    <header>
      <span>{team.name}</span>
      <small>Latest first</small>
    </header>
    {team.recent.length === 0 ? (
      <p>No previous results.</p>
    ) : (
      <ol>
        {team.recent.map((result) => (
          <li key={result.gameId}>
            <b>{result.result}</b>
            <strong>{result.opponent}</strong>
            <span>
              {result.goalsFor}–{result.goalsAgainst}
            </span>
          </li>
        ))}
      </ol>
    )}
  </section>
);

export function GamePreviewPanel({
  preview,
  compact = false,
}: {
  readonly preview: GamePreview;
  readonly compact?: boolean;
}) {
  const titleId = `game-preview-${preview.gameId}${compact ? "-compact" : ""}`;
  return (
    <section
      className={`game-preview${compact ? " game-preview-compact" : ""}`}
      aria-labelledby={titleId}
    >
      <header className="game-preview-heading">
        <span>Game preview</span>
        <div>
          <h2 id={titleId}>Previous tournament form</h2>
          <p>How the teams have performed before this fixture.</p>
        </div>
      </header>
      <div className="game-preview-matchup">
        <PreviewTeam team={preview.home} />
        <span>vs</span>
        <PreviewTeam team={preview.away} />
      </div>
      <div
        className="table-shell"
        role="region"
        aria-label={`${preview.home.name} and ${preview.away.name} comparison`}
        tabIndex={0}
      >
        <table className="game-preview-comparison">
          <caption className="sr-only">
            Previous tournament statistics for {preview.home.name} and{" "}
            {preview.away.name}
          </caption>
          <thead>
            <tr>
              <th scope="col">{preview.home.name}</th>
              <th scope="col">Previous statistic</th>
              <th scope="col">{preview.away.name}</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => {
              const home = benchmarkFor(preview.home, metric);
              const away = benchmarkFor(preview.away, metric);
              return (
                <tr key={metric}>
                  <td>
                    <strong>{metricValue(metric, home)}</strong>
                    <small>{metricEvidence(home)}</small>
                  </td>
                  <th scope="row">{metricLabel(metric)}</th>
                  <td>
                    <strong>{metricValue(metric, away)}</strong>
                    <small>{metricEvidence(away)}</small>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!compact && (
        <div className="game-preview-form-grid">
          <RecentForm team={preview.home} />
          <RecentForm team={preview.away} />
        </div>
      )}
    </section>
  );
}
