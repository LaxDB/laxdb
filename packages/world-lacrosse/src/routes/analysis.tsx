import { createFileRoute } from "@tanstack/react-router";

import { TournamentDataBoundary } from "../components/tournament-data-state";
import { AdvancedStatisticsPage } from "../pages/advanced-statistics-page";

export const Route = createFileRoute("/analysis")({
  component: AnalysisRoutePage,
});

function AnalysisRoutePage() {
  return (
    <TournamentDataBoundary>
      <AdvancedStatisticsPage />
    </TournamentDataBoundary>
  );
}
