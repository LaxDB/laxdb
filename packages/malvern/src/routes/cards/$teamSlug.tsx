import { Button } from "@laxdb/ui/components/ui/button";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@laxdb/ui/components/ui/toggle-group";
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
  cardSideSearch,
  findCardTeam,
  getCardPlayers,
  type CardTeam,
} from "../../lib/player-cards";

export const Route = createFileRoute("/cards/$teamSlug")({
  validateSearch: cardSideSearch,
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
  const { side } = Route.useSearch();
  const navigate = Route.useNavigate();
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
        <div className="flex w-full flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-3">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {team.teamLabel} · {team.season}
            </span>
            <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">
              {team.name}
            </h1>
          </div>
          <ToggleGroup
            aria-label="Card side"
            variant="outline"
            value={[side]}
            onValueChange={(value) => {
              const next = value[0];
              if (next === "front" || next === "back") {
                void navigate({ search: { side: next }, replace: true });
              }
            }}
          >
            <ToggleGroupItem value="front" className="min-h-11 px-4">
              Fronts
            </ToggleGroupItem>
            <ToggleGroupItem value="back" className="min-h-11 px-4">
              Backs
            </ToggleGroupItem>
          </ToggleGroup>
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
              search={{ side }}
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
                  side={side}
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
