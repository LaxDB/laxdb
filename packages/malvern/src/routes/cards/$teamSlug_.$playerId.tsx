import { Button } from "@laxdb/ui/components/ui/button";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useEffect, useState } from "react";

import { InteractivePlayerCard } from "../../components/player-cards/interactive-player-card";
import {
  cardFontPreload,
  cardPhotoPreloads,
  preloadPlayerPhoto,
} from "../../lib/player-card-assets";
import {
  cardSideSearch,
  findCardTeam,
  getCardPlayers,
} from "../../lib/player-cards";

// The trailing underscore keeps this full-page view outside the team gallery.
export const Route = createFileRoute("/cards/$teamSlug_/$playerId")({
  validateSearch: cardSideSearch,
  loader: ({ params }) => {
    const team = findCardTeam(params.teamSlug);
    if (!team) throw notFound();
    const player = team.players.find((entry) => entry.id === params.playerId);
    if (!player) throw notFound();
    return { team, player };
  },
  head: ({ loaderData }) => ({
    links: [
      cardFontPreload,
      ...(loaderData ? cardPhotoPreloads(loaderData.player) : []),
    ],
    meta: [
      {
        title: loaderData
          ? `${loaderData.player.firstName} ${loaderData.player.lastName} | ${loaderData.team.teamLabel} player cards`
          : "Player card not found | Malvern Lacrosse",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PlayerCardPage,
  notFoundComponent: () => (
    <main className="mx-auto flex max-w-5xl flex-col items-start gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">Player card not found</h1>
      <Link to="/cards" className="underline underline-offset-4">
        All teams
      </Link>
    </main>
  ),
});

const cycleVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    y: `${direction * 55}%`,
    scale: 0.94,
  }),
  visible: { opacity: 1, y: "0%", scale: 1 },
  exit: (direction: number) => ({
    opacity: 0,
    y: `${-direction * 55}%`,
    scale: 0.98,
  }),
};

function PlayerCardPage() {
  const { team, player } = Route.useLoaderData();
  const { side } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [cycleDirection, setCycleDirection] = useState(1);
  const [flipDirection, setFlipDirection] = useState<-1 | 1>(1);

  useEffect(() => {
    const players = getCardPlayers(team);
    const index = players.findIndex((entry) => entry.id === player.id);
    if (index < 0 || players.length < 2) return;
    for (const direction of [-1, 1]) {
      const neighbor =
        players[(index + direction + players.length) % players.length];
      if (neighbor) preloadPlayerPhoto(neighbor);
    }
  }, [player.id, team]);

  useEffect(() => {
    const handleCardKeys = (event: KeyboardEvent) => {
      if (
        !["Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          event.key,
        ) ||
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"]',
        )
      )
        return;
      event.preventDefault();
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        setFlipDirection(event.key === "ArrowLeft" ? -1 : 1);
        void navigate({
          search: { side: side === "front" ? "back" : "front" },
          replace: true,
          resetScroll: false,
        });
        return;
      }
      if (event.key !== "Escape") {
        const players = getCardPlayers(team);
        const index = players.findIndex((entry) => entry.id === player.id);
        if (index < 0) return;
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const next =
          players[(index + direction + players.length) % players.length];
        if (!next) return;
        setCycleDirection(direction);
        void navigate({
          to: "/cards/$teamSlug/$playerId",
          params: { teamSlug: team.slug, playerId: next.id },
          search: { side },
          replace: true,
          resetScroll: false,
        });
        return;
      }
      void navigate({
        to: "/cards/$teamSlug",
        params: { teamSlug: team.slug },
        search: { side },
        hash: player.id,
        hashScrollIntoView: { behavior: "instant", block: "center" },
        viewTransition: true,
      });
    };
    window.addEventListener("keydown", handleCardKeys);
    return () => {
      window.removeEventListener("keydown", handleCardKeys);
    };
  }, [navigate, player.id, side, team]);

  return (
    <main className="flex h-svh items-center justify-center overflow-clip px-4 py-4 sm:px-8">
      <header className="fixed top-4 left-4 z-10 sm:left-8">
        <Button
          variant="ghost"
          size="icon-xl"
          aria-label={`Back to ${team.name}`}
          nativeButton={false}
          render={
            <Link
              to="/cards/$teamSlug"
              params={{ teamSlug: team.slug }}
              search={{ side }}
              hash={player.id}
              hashScrollIntoView={{ behavior: "instant", block: "center" }}
              viewTransition
            />
          }
        >
          <ArrowLeft data-icon="inline-start" />
        </Button>
        <h1 className="sr-only">
          {player.firstName} {player.lastName}
        </h1>
      </header>
      <div className="flex w-full items-center justify-center">
        <div className="player-card-fullscreen aspect-[5/7]">
          <MotionConfig reducedMotion="user">
            <AnimatePresence
              initial={false}
              mode="popLayout"
              custom={cycleDirection}
            >
              <motion.div
                key={player.id}
                custom={cycleDirection}
                variants={cycleVariants}
                initial="enter"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="w-full"
              >
                <InteractivePlayerCard
                  player={player}
                  team={team}
                  side={side}
                  flipDirection={flipDirection}
                  onSideChange={(next) => {
                    void navigate({
                      search: { side: next },
                      replace: true,
                      resetScroll: false,
                    });
                  }}
                />
              </motion.div>
            </AnimatePresence>
          </MotionConfig>
        </div>
      </div>
    </main>
  );
}
