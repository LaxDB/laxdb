import { createFileRoute } from "@tanstack/react-router";

import { StandingsPage } from "../pages/tournament-pages";

export const Route = createFileRoute("/standings")({
  component: StandingsPage,
});
