import { createFileRoute } from "@tanstack/react-router";

import { StandingsTables } from "../components/standings-tables";
import { TournamentDataBoundary } from "../components/tournament-data-state";
import { TournamentPage } from "../components/tournament-page";
import { useCurrentTournamentSnapshot } from "../lib/current-tournament";

export const Route = createFileRoute("/standings")({
  component: StandingsRoutePage,
});

function StandingsRoutePage() {
  return (
    <TournamentDataBoundary>
      <StandingsContent />
    </TournamentDataBoundary>
  );
}

function StandingsContent() {
  const snapshot = useCurrentTournamentSnapshot();
  return (
    <TournamentPage
      title="Standings"
      description="Pool standings and team pages for the 2026 World Lacrosse Women's Championship."
      source="standings"
      showTournamentStatus
    >
      <StandingsTables schedule={snapshot.schedule} showFollowing />
    </TournamentPage>
  );
}
