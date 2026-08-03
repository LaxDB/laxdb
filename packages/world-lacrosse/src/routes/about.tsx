import { createFileRoute } from "@tanstack/react-router";

import { PageMetadata } from "../components/page-metadata";
import { TournamentHeader } from "../components/tournament-header";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <main>
      <PageMetadata
        title="About"
        description="About the World LaxDB championship record."
      />
      <TournamentHeader />
      <article id="main-content" className="tournament-page">
        <header className="page-title">
          <h1>About</h1>
        </header>
        <div className="about-overview">
          <p className="about-lede">
            World LaxDB is an independent, public record of the 2026 World
            Lacrosse Women&apos;s Championship.
          </p>
          <div className="about-sections">
            <section>
              <h2>What it covers</h2>
              <p>
                Follow the schedule, results, standings, player statistics, and
                game-level analysis from the opening draw through the
                championship final.
              </p>
            </section>
            <section>
              <h2>Where the data comes from</h2>
              <p>
                Tournament records are compiled from the official World Lacrosse
                schedule, match reports, and statistics. Source links remain
                available throughout the site.
              </p>
              <a
                href="https://worldlacrosse.sport/events/2026-world-lacrosse-womens-championship/"
                target="_blank"
                rel="noreferrer"
              >
                Visit the official championship site ↗
              </a>
            </section>
            <section>
              <h2>About LaxDB</h2>
              <p>
                LaxDB builds open, searchable records for lacrosse. This site is
                not affiliated with or endorsed by World Lacrosse.
              </p>
              <a href="https://laxdb.io/" target="_blank" rel="noreferrer">
                Visit LaxDB ↗
              </a>
            </section>
          </div>
        </div>
      </article>
    </main>
  );
}
