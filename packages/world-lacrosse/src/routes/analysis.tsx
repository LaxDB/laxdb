import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import { AnalysisViewNav } from "../components/analysis-view-nav";
import { PageMetadata } from "../components/page-metadata";
import { TournamentContextOverview } from "../components/tournament-context-overview";
import {
  TournamentDataBoundary,
  TournamentDataStatus,
} from "../components/tournament-data-state";
import { TournamentHeader } from "../components/tournament-header";
import { buildAnalysisData } from "../lib/analysis-data";
import {
  analyzeOutcomeGames,
  formatOutcomeValue,
  type MetricKey,
} from "../lib/analysis-insights";
import { useCurrentTournamentSnapshot } from "../lib/current-tournament";
import { staticTournamentMetadata } from "../lib/static-tournament-data";
import { buildTournamentContext } from "../lib/tournament-context";

export const Route = createFileRoute("/analysis")({
  component: AnalysisRoutePage,
});

function AnalysisRoutePage() {
  return (
    <TournamentDataBoundary>
      <AnalysisContent />
    </TournamentDataBoundary>
  );
}

const sourceUrl =
  "https://worldlacrosse.sport/events/2026-world-lacrosse-womens-championship/tournament-stats/";

function AnalysisContent() {
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
    return analyzeOutcomeGames(
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
        <AnalysisViewNav active="overview" />
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
                    <td>
                      {formatOutcomeValue(metric.winnerAverage, metric.format)}
                    </td>
                    <td>
                      {formatOutcomeValue(metric.loserAverage, metric.format)}
                    </td>
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
