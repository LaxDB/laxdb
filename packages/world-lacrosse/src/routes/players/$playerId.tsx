import { createFileRoute } from "@tanstack/react-router";

import { NotFound } from "../../components/not-found";
import { PlayerDetailsPage } from "../../pages/player-details-page";

export const Route = createFileRoute("/players/$playerId")({
  loader: async ({ params }) => {
    const { championship } = await import("../../championship-data");
    return championship.players.find((item) => item.id === params.playerId);
  },
  component: PlayerRoutePage,
});

function PlayerRoutePage() {
  const player = Route.useLoaderData();
  return player ? (
    <PlayerDetailsPage player={player} />
  ) : (
    <NotFound
      resource="Player"
      actionHref="/statistics"
      actionLabel="Browse player statistics"
    />
  );
}
