import { createFileRoute } from "@tanstack/react-router";

import { TournamentDataBoundary } from "../../components/tournament-data-state";
import { GameDetailsPage } from "../../pages/game-details-page";

export const Route = createFileRoute("/games/$gameId")({
  component: GameRoutePage,
});

function GameRoutePage() {
  const { gameId } = Route.useParams();
  return (
    <TournamentDataBoundary>
      <GameDetailsPage gameId={gameId} />
    </TournamentDataBoundary>
  );
}
