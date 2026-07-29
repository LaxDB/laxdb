import { createFileRoute } from "@tanstack/react-router";

import { TournamentDataBoundary } from "../components/tournament-data-state";
import { StandingsPage } from "../pages/tournament-pages";

export const Route = createFileRoute("/standings")({
  component: StandingsRoutePage,
});

function StandingsRoutePage() {
  return (
    <TournamentDataBoundary>
      <StandingsPage />
    </TournamentDataBoundary>
  );
}
