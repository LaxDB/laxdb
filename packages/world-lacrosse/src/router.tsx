import {
  createRoute,
  createRootRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  redirect,
} from "@tanstack/react-router";

import { PageMetadata } from "./components/page-metadata";
import { GameDetailsPage } from "./routes/game-details-page";
import { PlayerDetailsPage } from "./routes/player-details-page";

const NotFound = ({
  resource = "Page",
  actionHref = "/",
  actionLabel = "Return home",
}: {
  readonly resource?: string;
  readonly actionHref?: string;
  readonly actionLabel?: string;
}) => (
  <main className="not-found">
    <PageMetadata
      title={`${resource} not found`}
      description={`The requested ${resource.toLowerCase()} could not be found.`}
    />
    <span>404</span>
    <h1>{resource} not found</h1>
    <a href={actionHref}>{actionLabel}</a>
  </main>
);

const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: () => <NotFound />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: lazyRouteComponent(
    () => import("./routes/tournament-pages"),
    "HomePage",
  ),
});

const gameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/games/$gameId",
  loader: async ({ params }) => {
    const { championship } = await import("./championship-data");
    return {
      game: championship.games.find((item) => item.id === params.gameId),
      players: championship.players,
    };
  },
  component: GameRoute,
});

function GameRoute() {
  const { game, players } = gameRoute.useLoaderData();
  const { gameId } = gameRoute.useParams();
  return <GameDetailsPage gameId={gameId} game={game} players={players} />;
}

const playerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/players/$playerId",
  loader: async ({ params }) => {
    const { championship } = await import("./championship-data");
    return championship.players.find((item) => item.id === params.playerId);
  },
  component: PlayerRoute,
});

function PlayerRoute() {
  const player = playerRoute.useLoaderData();
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

const scheduleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/schedule",
  component: lazyRouteComponent(
    () => import("./routes/tournament-pages"),
    "SchedulePage",
  ),
});
const teamsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/teams",
  beforeLoad: () => {
    throw redirect({ to: "/standings", replace: true });
  },
});
const teamRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/teams/$teamId",
  component: lazyRouteComponent(
    () => import("./routes/tournament-pages"),
    "TeamRoutePage",
  ),
});
const standingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/standings",
  component: lazyRouteComponent(
    () => import("./routes/tournament-pages"),
    "StandingsPage",
  ),
});
const statisticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/statistics",
  component: lazyRouteComponent(
    () => import("./routes/statistics-page"),
    "StatisticsPage",
  ),
});
const analysisRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/analysis",
  component: lazyRouteComponent(
    () => import("./routes/advanced-statistics-page"),
    "AdvancedStatisticsPage",
  ),
});
const formatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/format",
  component: lazyRouteComponent(
    () => import("./routes/tournament-pages"),
    "FormatPage",
  ),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  scheduleRoute,
  teamsRoute,
  teamRoute,
  standingsRoute,
  statisticsRoute,
  analysisRoute,
  formatRoute,
  gameRoute,
  playerRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
