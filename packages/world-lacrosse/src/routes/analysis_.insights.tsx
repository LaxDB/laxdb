import { createFileRoute } from "@tanstack/react-router";

import { TournamentDataBoundary } from "../components/tournament-data-state";
import { AnalysisInsightsPage } from "../pages/analysis-insights-page";

export const Route = createFileRoute("/analysis_/insights")({
  component: AnalysisInsightsRoutePage,
});

function AnalysisInsightsRoutePage() {
  return (
    <TournamentDataBoundary>
      <AnalysisInsightsPage />
    </TournamentDataBoundary>
  );
}
