import { createFileRoute } from "@tanstack/react-router";

import { NotFound } from "../../components/not-found";
import { TournamentDataBoundary } from "../../components/tournament-data-state";
import { PlayerDetailsPage } from "../../pages/player-details-page";
import { staticTournamentMetadata } from "../../static-tournament-data";

export const Route = createFileRoute("/players/$playerId")({
  component: PlayerRoutePage,
});

function PlayerRoutePage() {
  const { playerId } = Route.useParams();
  const player = staticTournamentMetadata.playerProfiles.find(
    (item) => item.id === playerId,
  );
  return player ? (
    <TournamentDataBoundary>
      <PlayerDetailsPage player={player} />
    </TournamentDataBoundary>
  ) : (
    <NotFound
      resource="Player"
      actionHref="/statistics"
      actionLabel="Browse player statistics"
    />
  );
}
