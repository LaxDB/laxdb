import { Button } from "@laxdb/ui/components/ui/button";
import {
  createFileRoute,
  Link,
  notFound,
  useLocation,
} from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { flushSync } from "react-dom";

import { PlayerCard } from "../../components/player-cards/player-card";
import {
  cardFontPreload,
  collectionFontPreload,
  preloadPlayerPhoto,
} from "../../lib/player-card-assets";
import {
  findCardTeam,
  getCardPlayers,
  type CardTeam,
} from "../../lib/player-cards";

export const Route = createFileRoute("/cards/$teamSlug")({
  loader: ({ params }) => {
    const team = findCardTeam(params.teamSlug);
    if (!team) throw notFound();
    return team;
  },
  head: ({ loaderData }) => ({
    links: [cardFontPreload, collectionFontPreload],
    meta: [
      {
        title: loaderData
          ? `${loaderData.name} ${loaderData.season} player cards | ${loaderData.teamLabel}`
          : "Player cards | Malvern Lacrosse",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TeamCardRoute,
  notFoundComponent: () => (
    <main className="mx-auto flex max-w-5xl flex-col items-start gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">Card collection not found</h1>
      <Link to="/cards" className="underline underline-offset-4">
        All teams
      </Link>
    </main>
  ),
});

function TeamCardRoute() {
  const team = Route.useLoaderData();
  return <TeamCards key={team.slug} team={team} />;
}

function TeamCards({ team }: { team: CardTeam }) {
  const hash = useLocation({ select: (location) => location.hash });
  const [activePlayerId, setActivePlayerId] = useState(hash);
  const players = getCardPlayers(team);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-10 px-4 py-8 sm:px-8">
      <header className="flex flex-col items-start gap-6">
        <Button
          variant="ghost"
          size="xl"
          nativeButton={false}
          render={<Link to="/cards" />}
        >
          <ArrowLeft data-icon="inline-start" />
          All teams
        </Button>
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {team.teamLabel} · {team.season}
          </span>
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">
            {team.name}
          </h1>
        </div>
      </header>
      <ul
        aria-label="Players"
        className="grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2 xl:grid-cols-3"
      >
        {players.map((player, index) => (
          <li
            key={player.id}
            id={player.id}
            className="flex min-w-0 flex-col gap-3"
          >
            <Link
              to="/cards/$teamSlug/$playerId"
              params={{ teamSlug: team.slug, playerId: player.id }}
              search={{ side: "front" }}
              viewTransition
              onMouseEnter={() => {
                preloadPlayerPhoto(player);
              }}
              onFocus={() => {
                preloadPlayerPhoto(player);
              }}
              onClick={(event) => {
                if (
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return;
                flushSync(() => {
                  setActivePlayerId(player.id);
                });
              }}
              aria-label={`View ${player.firstName} ${player.lastName}'s card`}
              className="flex flex-col gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
            >
              <div
                style={{
                  viewTransitionName:
                    activePlayerId === player.id
                      ? `player-card-${player.id}`
                      : "none",
                }}
              >
                <PlayerCard
                  player={player}
                  team={team}
                  side="front"
                  priority={index < 3}
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
