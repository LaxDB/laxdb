import { createFileRoute } from "@tanstack/react-router";

import { StatisticsPage } from "../pages/statistics-page";

export const Route = createFileRoute("/statistics")({
  component: StatisticsPage,
});
