import { createFileRoute } from "@tanstack/react-router";

import { SchedulePage } from "../pages/tournament-pages";

export const Route = createFileRoute("/schedule")({ component: SchedulePage });
