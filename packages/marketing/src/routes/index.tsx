import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LaxDB — 2026 World Lacrosse Women’s Championship" },
      {
        name: "description",
        content:
          "Live scores, schedules, standings, player statistics, and match analysis for the 2026 World Lacrosse Women’s Championship.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <main className="w-full px-4 pt-32 pb-36 md:pt-40 md:pb-44">
      <div className="mx-auto max-w-6xl border-x border-border">
        <section
          aria-labelledby="home-title"
          className="px-6 pt-10 pb-14 sm:px-10 md:pt-14 md:pb-16 lg:px-14"
        >
          <h1
            className="max-w-3xl border-l-2 border-brand-accent pl-4 font-serif text-4xl leading-tight text-balance text-foreground italic md:text-5xl"
            id="home-title"
          >
            Follow the 2026 World Lacrosse Women&apos;s Championship.
          </h1>

          <div className="mt-8 max-w-3xl space-y-4 text-base leading-7 text-pretty text-foreground/80">
            <p>
              LaxDB brings the tournament&apos;s schedule, scores, standings, teams, and player
              statistics into one fast, searchable place.
            </p>
            <p>
              Go beyond the box score with live matchdays, game-level analysis, team form, and
              side-by-side comparisons built from the official tournament record.
            </p>
          </div>

          <nav aria-label="Explore LaxDB" className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a
              className="underline decoration-border underline-offset-4 transition-colors duration-150 hover:decoration-foreground"
              href="https://world.laxdb.io"
            >
              Open World Lacrosse →
            </a>
            <a
              className="underline decoration-border underline-offset-4 transition-colors duration-150 hover:decoration-foreground"
              href="https://github.com/LaxDB/laxdb"
              rel="noopener noreferrer"
              target="_blank"
            >
              View the source ↗
            </a>
          </nav>
        </section>

        <section aria-labelledby="coverage-title" className="border-t border-border">
          <div className="flex flex-col gap-2 px-6 py-5 sm:flex-row sm:items-baseline sm:justify-between sm:px-10 lg:px-14">
            <h2 className="font-serif text-lg text-foreground italic" id="coverage-title">
              Tournament coverage
            </h2>
            <p className="text-sm text-pretty text-muted-foreground">
              The championship from opening draw through the final whistle.
            </p>
          </div>
          <ul className="grid grid-cols-2 border-t border-border lg:grid-cols-5">
            <li className="min-w-0 px-5 py-5 sm:px-7">
              <p className="font-medium text-foreground">Schedule</p>
              <p className="mt-1 text-xs leading-5 text-pretty text-muted-foreground">
                Every fixture
              </p>
              <p className="mt-3 text-xs text-muted-foreground">44 games</p>
            </li>
            <li className="min-w-0 border-l border-border px-5 py-5 sm:px-7">
              <p className="font-medium text-foreground">Matchday</p>
              <p className="mt-1 text-xs leading-5 text-pretty text-muted-foreground">
                Scores and status
              </p>
              <p className="mt-3 text-xs text-muted-foreground">Live updates</p>
            </li>
            <li className="min-w-0 border-t border-border px-5 py-5 sm:px-7 lg:border-t-0 lg:border-l">
              <p className="font-medium text-foreground">Standings</p>
              <p className="mt-1 text-xs leading-5 text-pretty text-muted-foreground">
                Pools and records
              </p>
              <p className="mt-3 text-xs text-muted-foreground">Tournament table</p>
            </li>
            <li className="min-w-0 border-t border-l border-border px-5 py-5 sm:px-7 lg:border-t-0">
              <p className="font-medium text-foreground">Players</p>
              <p className="mt-1 text-xs leading-5 text-pretty text-muted-foreground">
                Leaders and game logs
              </p>
              <p className="mt-3 text-xs text-muted-foreground">349 profiles</p>
            </li>
            <li className="min-w-0 border-t border-border px-5 py-5 sm:px-7 lg:border-t-0 lg:border-l">
              <p className="font-medium text-foreground">Analysis</p>
              <p className="mt-1 text-xs leading-5 text-pretty text-muted-foreground">
                Form and comparisons
              </p>
              <p className="mt-3 text-xs text-muted-foreground">Game level</p>
            </li>
          </ul>
        </section>

        <section aria-labelledby="inside-title" className="border-t border-border">
          <div className="px-6 py-8 sm:px-10 lg:px-14">
            <h2 className="font-serif text-2xl text-foreground italic" id="inside-title">
              Inside the tournament
            </h2>
          </div>

          <div className="border-t border-border">
            <article className="grid gap-5 px-6 py-9 sm:px-10 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)] md:gap-12 lg:px-14">
              <header>
                <p className="text-xs font-medium text-muted-foreground tabular-nums">01</p>
                <h3 className="mt-2 font-serif text-2xl text-balance text-foreground italic">
                  Every game, one matchday
                </h3>
              </header>
              <div className="max-w-2xl">
                <p className="leading-7 text-pretty text-foreground/80">
                  Follow the complete schedule with live statuses, period scores, team statistics,
                  play-by-play, rosters, and officials for every matchup.
                </p>
                <a
                  className="mt-4 inline-block text-sm underline decoration-border underline-offset-4 transition-colors duration-150 hover:decoration-foreground"
                  href="https://world.laxdb.io/schedule"
                >
                  View the schedule →
                </a>
              </div>
            </article>

            <article className="grid gap-5 border-t border-border px-6 py-9 sm:px-10 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)] md:gap-12 lg:px-14">
              <header>
                <p className="text-xs font-medium text-muted-foreground tabular-nums">02</p>
                <h3 className="mt-2 font-serif text-2xl text-balance text-foreground italic">
                  Players and teams in context
                </h3>
              </header>
              <div className="max-w-2xl">
                <p className="leading-7 text-pretty text-foreground/80">
                  Search player profiles, tournament totals, game logs, team records, staff, and
                  current pool position without jumping between disconnected tables.
                </p>
                <a
                  className="mt-4 inline-block text-sm underline decoration-border underline-offset-4 transition-colors duration-150 hover:decoration-foreground"
                  href="https://world.laxdb.io/statistics"
                >
                  Explore the statistics →
                </a>
              </div>
            </article>

            <article className="grid gap-5 border-t border-border px-6 py-9 sm:px-10 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)] md:gap-12 lg:px-14">
              <header>
                <p className="text-xs font-medium text-muted-foreground tabular-nums">03</p>
                <h3 className="mt-2 font-serif text-2xl text-balance text-foreground italic">
                  Analysis with receipts
                </h3>
              </header>
              <div className="max-w-2xl">
                <p className="leading-7 text-pretty text-foreground/80">
                  Compare team form, scoring profiles, player leaders, and game-state trends. When
                  the source evidence is missing or conflicts, the analysis is withheld instead of
                  guessed.
                </p>
                <a
                  className="mt-4 inline-block text-sm underline decoration-border underline-offset-4 transition-colors duration-150 hover:decoration-foreground"
                  href="https://world.laxdb.io/analysis"
                >
                  Open match analysis →
                </a>
              </div>
            </article>
          </div>
        </section>

        <section
          aria-labelledby="open-source-title"
          className="grid gap-5 border-y border-border px-6 py-10 sm:px-10 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)] md:gap-12 lg:px-14"
        >
          <h2
            className="font-serif text-2xl text-balance text-foreground italic"
            id="open-source-title"
          >
            Built in public
          </h2>
          <div className="max-w-2xl">
            <p className="leading-7 text-pretty text-foreground/80">
              LaxDB is open source. The data pipeline, API, and website are public so corrections
              can be checked, gaps can be documented, and the sport&apos;s record does not depend on
              a single league website staying online.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <a
                className="underline decoration-border underline-offset-4 transition-colors duration-150 hover:decoration-foreground"
                href="https://github.com/LaxDB/laxdb"
                rel="noopener noreferrer"
                target="_blank"
              >
                View the source ↗
              </a>
              <Link
                className="underline decoration-border underline-offset-4 transition-colors duration-150 hover:decoration-foreground"
                to="/changelog"
              >
                Read the changelog →
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
