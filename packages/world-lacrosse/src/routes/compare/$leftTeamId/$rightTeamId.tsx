import { createFileRoute } from "@tanstack/react-router";

import { TournamentDataBoundary } from "../../../components/tournament-data-state";
import { TeamComparisonPage } from "../../../pages/team-comparison-page";

export const Route = createFileRoute("/compare/$leftTeamId/$rightTeamId")({
  component: TeamComparisonRoutePage,
});

function TeamComparisonRoutePage() {
  const { leftTeamId, rightTeamId } = Route.useParams();
  return (
    <TournamentDataBoundary>
      <TeamComparisonPage
        key={`${leftTeamId}-${rightTeamId}`}
        leftTeamId={leftTeamId}
        rightTeamId={rightTeamId}
      />
    </TournamentDataBoundary>
  );
}
