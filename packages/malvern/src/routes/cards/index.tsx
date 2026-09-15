import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import { cardTeams } from "../../lib/player-cards";

export const Route = createFileRoute("/cards/")({
  head: () => ({
    meta: [
      { title: "Player cards | Malvern Lacrosse" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CardCollections,
});

function CardCollections() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-4 py-10 sm:px-8 sm:py-16">
      <header className="flex flex-col gap-3">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Malvern Lacrosse
        </span>
        <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">
          Player cards
        </h1>
      </header>
      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {cardTeams.map((team) => (
          <li key={team.slug}>
            <Link
              to="/cards/$teamSlug"
              params={{ teamSlug: team.slug }}
              search={{ side: "front" }}
              className="flex items-center justify-between gap-6 py-6 outline-none hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
            >
              <div className="flex flex-col gap-1">
                <h2 className="font-sans text-xl font-semibold not-italic">
                  {team.name}
                </h2>
                <span className="text-sm text-muted-foreground">
                  {team.teamLabel} · {team.season} · {team.players.length}{" "}
                  players
                </span>
              </div>
              <ArrowUpRight aria-hidden="true" className="size-5 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
