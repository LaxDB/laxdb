import { createFileRoute } from "@tanstack/react-router";

import { AdvancedStatisticsPage } from "../pages/advanced-statistics-page";

export const Route = createFileRoute("/analysis")({
  component: AdvancedStatisticsPage,
});
