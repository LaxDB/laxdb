import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { TournamentDataBoundary } from "../components/tournament-data-state";
import { StatisticsPage } from "../pages/statistics-page";
import type { StatisticsThrough } from "../statistics-scope";

interface StatisticsSearch {
  readonly through?: number;
}

const positiveInteger = (value: unknown): number | undefined => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/u.test(value)
        ? Number(value)
        : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export const parseStatisticsSearch = (
  search: Record<string, unknown>,
): StatisticsSearch => {
  const through = positiveInteger(search.through);
  return through === undefined ? {} : { through };
};

export const Route = createFileRoute("/statistics")({
  validateSearch: parseStatisticsSearch,
  component: StatisticsRoute,
});

function StatisticsRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const through: StatisticsThrough = search.through ?? "latest";

  return (
    <TournamentDataBoundary>
      <StatisticsPage
        through={through}
        onThroughChange={(nextThrough) => {
          void navigate({
            to: "/statistics",
            search: nextThrough === "latest" ? {} : { through: nextThrough },
            replace: true,
          });
        }}
      />
    </TournamentDataBoundary>
  );
}
