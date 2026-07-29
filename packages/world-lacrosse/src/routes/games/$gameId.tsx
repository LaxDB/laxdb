import { createFileRoute } from "@tanstack/react-router";

import { GameDetailsPage } from "../../pages/game-details-page";

export const Route = createFileRoute("/games/$gameId")({
  loader: async ({ params }) => {
    const { championship } = await import("../../championship-data");
    return {
      game: championship.games.find((item) => item.id === params.gameId),
      players: championship.players,
    };
  },
  component: GameRoutePage,
});

function GameRoutePage() {
  const { game, players } = Route.useLoaderData();
  const { gameId } = Route.useParams();
  return <GameDetailsPage gameId={gameId} game={game} players={players} />;
}
