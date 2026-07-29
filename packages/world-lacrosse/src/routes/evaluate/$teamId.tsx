import { createFileRoute } from "@tanstack/react-router";

import { TournamentDataBoundary } from "../../components/tournament-data-state";
import { TeamEvaluationPage } from "../../pages/team-evaluation-page";
import { parseTeamEvaluationSearch } from "../../team-evaluation-search";

export const Route = createFileRoute("/evaluate/$teamId")({
  validateSearch: parseTeamEvaluationSearch,
  component: TeamEvaluationRoute,
});

function TeamEvaluationRoute() {
  const { teamId } = Route.useParams();
  const search = Route.useSearch();
  return (
    <TournamentDataBoundary>
      <TeamEvaluationPage teamId={teamId} search={search} />
    </TournamentDataBoundary>
  );
}
