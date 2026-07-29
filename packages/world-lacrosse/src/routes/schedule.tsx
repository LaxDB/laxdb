import { createFileRoute } from "@tanstack/react-router";

import { TournamentDataBoundary } from "../components/tournament-data-state";
import { SchedulePage } from "../pages/tournament-pages";

export const Route = createFileRoute("/schedule")({
  component: ScheduleRoutePage,
});

function ScheduleRoutePage() {
  return (
    <TournamentDataBoundary>
      <SchedulePage />
    </TournamentDataBoundary>
  );
}
