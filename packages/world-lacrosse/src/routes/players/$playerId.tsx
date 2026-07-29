import { createFileRoute } from "@tanstack/react-router";

import { NotFound } from "../../components/not-found";
import { TournamentDataBoundary } from "../../components/tournament-data-state";
import { PlayerDetailsPage } from "../../pages/player-details-page";

export const Route = createFileRoute("/players/$playerId")({
  loader: async ({ params }) => {
    const { staticTournamentMetadata } =
      await import("../../static-tournament-data");
    return staticTournamentMetadata.playerProfiles.find(
      (item) => item.id === params.playerId,
    );
  },
  component: PlayerRoutePage,
});

function PlayerRoutePage() {
  const player = Route.useLoaderData();
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
