import { createFileRoute } from "@tanstack/react-router";

import { TournamentDataBoundary } from "../components/tournament-data-state";
import { HomePage } from "../pages/tournament-pages";

export const Route = createFileRoute("/")({ component: HomeRoutePage });

function HomeRoutePage() {
  return (
    <TournamentDataBoundary>
      <HomePage />
    </TournamentDataBoundary>
  );
}
