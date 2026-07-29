import { createFileRoute } from "@tanstack/react-router";

import { TeamComparisonPage } from "../../../pages/team-comparison-page";

export const Route = createFileRoute("/compare/$leftTeamId/$rightTeamId")({
  component: TeamComparisonRoutePage,
});

function TeamComparisonRoutePage() {
  const { leftTeamId, rightTeamId } = Route.useParams();
  return (
    <TeamComparisonPage
      key={`${leftTeamId}-${rightTeamId}`}
      leftTeamId={leftTeamId}
      rightTeamId={rightTeamId}
    />
  );
}
