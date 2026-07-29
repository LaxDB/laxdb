import { createFileRoute } from "@tanstack/react-router";

import { TournamentDataBoundary } from "../../components/tournament-data-state";
import { TeamRoutePage } from "../../pages/tournament-pages";

export const Route = createFileRoute("/teams/$teamId")({
  component: TeamDataRoutePage,
});

function TeamDataRoutePage() {
  return (
    <TournamentDataBoundary>
      <TeamRoutePage />
    </TournamentDataBoundary>
  );
}
