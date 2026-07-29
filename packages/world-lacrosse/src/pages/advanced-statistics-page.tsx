import { useMemo } from "react";

import { buildAnalysisData } from "../analysis-data";
import { PageMetadata } from "../components/page-metadata";
import { TournamentContextOverview } from "../components/tournament-context-overview";
import { TournamentDataStatus } from "../components/tournament-data-state";
import { TournamentHeader } from "../components/tournament-header";
import { useCurrentTournamentSnapshot } from "../current-tournament";
import { staticTournamentMetadata } from "../static-tournament-data";
import { buildTournamentContext } from "../tournament-context";

const sourceUrl =
  "https://worldlacrosse.sport/events/2026-world-lacrosse-womens-championship/tournament-stats/";

type MetricKey =
  | "shots"
  | "shotsOnGoal"
  | "shootingPercentage"
  | "drawPercentage"
  | "groundBalls"
  | "causedTurnovers"
  | "turnovers"
  | "assists"
  | "savePercentage";

interface MetricDefinition {
  readonly key: MetricKey;
  readonly label: string;
  readonly higherIsBetter: boolean;
  readonly format: "number" | "percentage";
}

const metrics: readonly MetricDefinition[] = [
  {
    key: "shots",
    label: "Total shots",
    higherIsBetter: true,
    format: "number",
  },
  {
    key: "shotsOnGoal",
    label: "Shots on goal",
    higherIsBetter: true,
    format: "number",
  },
  {
    key: "shootingPercentage",
    label: "Shooting percentage",
    higherIsBetter: true,
    format: "percentage",
  },
  {
    key: "drawPercentage",
    label: "Draw-control percentage",
    higherIsBetter: true,
    format: "percentage",
  },
  {
    key: "groundBalls",
    label: "Ground balls",
    higherIsBetter: true,
    format: "number",
  },
  {
    key: "causedTurnovers",
    label: "Caused turnovers",
    higherIsBetter: true,
    format: "number",
  },
  {
    key: "turnovers",
    label: "Turnovers",
    higherIsBetter: false,
    format: "number",
  },
  { key: "assists", label: "Assists", higherIsBetter: true, format: "number" },
  {
    key: "savePercentage",
    label: "Save percentage",
    higherIsBetter: true,
    format: "percentage",
  },
];

type AnalysisGame = ReturnType<typeof buildAnalysisData>["games"][number];

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

const analyzeGames = (games: readonly AnalysisGame[]) => {
  const analysis = metrics.map((metric) => {
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

const format = (value: number, type: MetricDefinition["format"]): string =>
  type === "percentage" ? `${value.toFixed(1)}%` : value.toFixed(1);

export function AdvancedStatisticsPage() {
  const snapshot = useCurrentTournamentSnapshot();
  const tournamentContext = useMemo(
    () =>
      buildTournamentContext(snapshot.games, {
        sourceUpdatedAt: snapshot.updatedAt,
        players: snapshot.players,
        teamPools: staticTournamentMetadata.teams.map((team) => ({
          name: team.name,
          pool: team.pool,
        })),
      }),
    [snapshot.games, snapshot.updatedAt],
  );
  const eligibleGameIds = useMemo(
    () =>
      new Set(
        tournamentContext.games
          .filter((game) => game.eligible)
          .map((game) => game.gameId),
      ),
    [tournamentContext.games],
  );
  const outcome = useMemo(() => {
    const currentAnalysis = buildAnalysisData(snapshot.games);
    return analyzeGames(
      currentAnalysis.games.filter((game) => eligibleGameIds.has(game.id)),
    );
  }, [eligibleGameIds, snapshot.games]);
  const findMetric = (key: MetricKey) =>
    outcome.analysis.find((metric) => metric.key === key);
  const cards = [
    [
      "Win rate with >50% draws",
      outcome.drawMajorityWinRate,
      `${outcome.majorityDrawSides.length} team-games`,
    ],
    [
      "Win rate when outshooting",
      findMetric("shots")?.advantageWinRate ?? 0,
      `${findMetric("shots")?.advantageGames ?? 0} games`,
    ],
    [
      "Win rate with more SOG",
      findMetric("shotsOnGoal")?.advantageWinRate ?? 0,
      `${findMetric("shotsOnGoal")?.advantageGames ?? 0} games`,
    ],
    [
      "Win rate with fewer turnovers",
      findMetric("turnovers")?.advantageWinRate ?? 0,
      `${findMetric("turnovers")?.advantageGames ?? 0} games`,
    ],
  ] as const;
  return (
    <main>
      <PageMetadata
        title="Analysis"
        description="Tournament records, team form, player leaders, and match analysis from the 2026 World Lacrosse Women's Championship."
      />
      <TournamentHeader sourceUrl={sourceUrl} />
      <TournamentDataStatus />
      <article id="main-content" className="tournament-page advanced-page">
        <header className="page-title">
          <h1>Analysis</h1>
        </header>
        <nav className="game-nav" aria-label="Analysis sections">
          <a href="#overview">Overview</a>
          <a href="#records">Records</a>
          <a href="#team-context">Teams</a>
          <a href="#player-leaders">Players</a>
          {tournamentContext.goalkeeperTeamGameSample ===
            tournamentContext.goalkeeperExpectedTeamGames && (
            <a href="#goalkeepers">Goalkeepers</a>
          )}
          <a href="#outcome-associations">Outcomes</a>
          <a href="#stat-advantages">Stat advantages</a>
        </nav>
        <TournamentContextOverview context={tournamentContext} />
        <section
          className="analysis-section outcome-associations"
          id="outcome-associations"
        >
          <div className="analysis-section-heading">
            <span>05</span>
            <div>
              <h2>Outcome associations</h2>
              <p>Descriptive results, not causal claims.</p>
            </div>
          </div>
          <div className="analysis-cards">
            {cards.map(([label, value, note]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value.toFixed(1)}%</strong>
                <small>{note}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="analysis-section" id="stat-advantages">
          <div className="analysis-section-heading">
            <span>06</span>
            <div>
              <h2>Stat advantages</h2>
              <p>Winner/loser averages and simple associations.</p>
            </div>
          </div>
          <div
            className="table-shell"
            role="region"
            aria-label="Stat advantages"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Factor</th>
                  <th>Advantage won</th>
                  <th>Winner avg</th>
                  <th>Loser avg</th>
                  <th>Correlation</th>
                  <th>Games</th>
                </tr>
              </thead>
              <tbody>
                {outcome.analysis.map((metric) => (
                  <tr key={metric.key}>
                    <th>{metric.label}</th>
                    <td>{metric.advantageWinRate.toFixed(1)}%</td>
                    <td>{format(metric.winnerAverage, metric.format)}</td>
                    <td>{format(metric.loserAverage, metric.format)}</td>
                    <td>{metric.correlation.toFixed(2)}</td>
                    <td>{metric.advantageGames}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </article>
    </main>
  );
}
