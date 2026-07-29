import { useMemo } from "react";

import { buildAnalysisData } from "../analysis-data";
import { InsightsLabContent } from "../components/analysis-insights-content";
import { AnalysisViewNav } from "../components/analysis-view-nav";
import { PageMetadata } from "../components/page-metadata";
import { TournamentDataStatus } from "../components/tournament-data-state";
import { TournamentHeader } from "../components/tournament-header";
import { useCurrentTournamentReadyState } from "../current-tournament";
import { staticTournamentMetadata } from "../static-tournament-data";
import { buildTournamentContext } from "../tournament-context";

const sourceUrl =
  "https://worldlacrosse.sport/events/2026-world-lacrosse-womens-championship/tournament-stats/";

export function AnalysisInsightsPage() {
  const state = useCurrentTournamentReadyState();
  const snapshot = state.snapshot;
  const context = useMemo(
    () =>
      buildTournamentContext(snapshot.games, {
        sourceUpdatedAt: snapshot.updatedAt,
        players: snapshot.players,
        teamPools: staticTournamentMetadata.teams.map((team) => ({
          name: team.name,
          pool: team.pool,
        })),
      }),
    [snapshot.games, snapshot.players, snapshot.updatedAt],
  );
  const eligibleIds = useMemo(
    () =>
      new Set(
        context.games
          .filter((game) => game.eligible)
          .map((game) => game.gameId),
      ),
    [context.games],
  );
  const games = useMemo(
    () =>
      buildAnalysisData(snapshot.games).games.filter((game) =>
        eligibleIds.has(game.id),
      ),
    [eligibleIds, snapshot.games],
  );
  const excludedFromCompleteCase = Math.max(
    0,
    context.sample.eligibleGames - games.length,
  );
  const missingOrConflictedGames = new Set([
    ...snapshot.missingDetailGameIds,
    ...snapshot.conflictedDetailGameIds,
  ]).size;
  const snapshotStatus =
    state.mode === "archived"
      ? "archive"
      : state.freshness === "stale" ||
          state.refresh === "failed" ||
          snapshot.integrity === "partial"
        ? "degraded"
        : "fresh";

  return (
    <main>
      <PageMetadata
        title="Insights Lab"
        description="Confidence-aware tournament signals, team identities, and complete-case fingerprints from the 2026 World Lacrosse Women's Championship."
      />
      <TournamentHeader sourceUrl={sourceUrl} />
      <TournamentDataStatus />
      <article id="main-content" className="tournament-page insights-page">
        <header className="page-title insights-page-title">
          <h1>Analysis</h1>
          <span>{games.length} complete-case games · descriptive evidence</span>
        </header>
        <AnalysisViewNav active="insights" />
        <nav className="game-nav" aria-label="Insights Lab sections">
          <a href="#signals">Signals</a>
          <a href="#team-field">Team field</a>
          <a href="#fingerprint">Fingerprint</a>
          <a href="#methods">Methods</a>
        </nav>
        <InsightsLabContent
          games={games}
          tournamentEligibleGames={context.sample.eligibleGames}
          excludedFromCompleteCase={excludedFromCompleteCase}
          snapshotStatus={snapshotStatus}
          completedGames={snapshot.completedGames}
          detailedGames={snapshot.detailedGames}
          missingOrConflictedGames={missingOrConflictedGames}
          sourceUpdatedAt={snapshot.updatedAt}
          teams={context.teams}
        />
      </article>
    </main>
  );
}
