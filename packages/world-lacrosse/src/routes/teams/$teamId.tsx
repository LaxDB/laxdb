import { createFileRoute } from "@tanstack/react-router";

import { TeamRoutePage } from "../../pages/tournament-pages";

export const Route = createFileRoute("/teams/$teamId")({
  component: TeamRoutePage,
});
