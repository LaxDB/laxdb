import type {
  TournamentGameContext,
  TournamentGamePlacement,
} from "../lib/tournament-context-schema";

const formatDuration = (seconds: number): string => {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
};

const ordinal = (value: number): string => {
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
};

const unexpectedMetric = (metric: never): never => {
  throw new Error(`Unsupported tournament context metric: ${String(metric)}`);
};

const placementLabel = (placement: TournamentGamePlacement): string => {
  const team = placement.team ? `${placement.team} · ` : "";
  const metric = placement.metric;
  switch (metric) {
    case "close-game-share":
      return "Close-game share";
    case "recovered-deficit":
      return `${team}Recovered deficit`;
    case "fastest-2-goal-burst":
      return `${team}Two-goal burst`;
    case "fastest-3-goal-burst":
      return `${team}Three-goal burst`;
    case "fastest-4-goal-burst":
      return `${team}Four-goal burst`;
    case "close-game-shooting":
      return `${team}Close-game shooting`;
    default:
      return unexpectedMetric(metric);
  }
};

const placementValue = (placement: TournamentGamePlacement): string => {
  const metric = placement.metric;
  switch (metric) {
    case "close-game-share":
      return `${formatDuration(placement.numerator)} · ${placement.value.toFixed(1)}% of game`;
    case "recovered-deficit":
      return `${placement.value} goal${placement.value === 1 ? "" : "s"}`;
    case "fastest-2-goal-burst":
    case "fastest-3-goal-burst":
    case "fastest-4-goal-burst":
      return formatDuration(placement.value);
    case "close-game-shooting":
      return `${placement.numerator}/${placement.denominator} · ${placement.value.toFixed(1)}%`;
    default:
      return unexpectedMetric(metric);
  }
};

const placementRank = (placement: TournamentGamePlacement): string =>
  `#${placement.rank.rank} of ${placement.rank.total}${placement.rank.tied ? " · tied" : ""} · ${ordinal(Math.round(placement.rank.percentile))} percentile`;

export function TournamentGameContextPanel({
  context,
}: {
  readonly context: Readonly<TournamentGameContext>;
}) {
  if (!context.eligible || context.placements.length === 0) return null;
  return (
    <section
      className="tournament-game-context"
      aria-labelledby="tournament-game-context-title"
    >
      <header className="insight-subheading">
        <span>Tournament context</span>
        <h3 id="tournament-game-context-title">Against the tournament field</h3>
      </header>
      <div
        className="table-shell"
        role="region"
        aria-label="Tournament ranking comparison"
        tabIndex={0}
      >
        <table className="tournament-context-table">
          <thead>
            <tr>
              <th scope="col">Fact</th>
              <th scope="col">This game</th>
              <th scope="col">Tournament rank</th>
            </tr>
          </thead>
          <tbody>
            {context.placements.map((placement) => (
              <tr key={`${placement.metric}-${placement.side ?? "game"}`}>
                <th scope="row">{placementLabel(placement)}</th>
                <td>{placementValue(placement)}</td>
                <td>{placementRank(placement)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
