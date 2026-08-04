import type { ReactNode } from "react";

import { PageMetadata } from "./page-metadata";
import { TournamentDataStatus } from "./tournament-data-state";
import { TournamentHeader } from "./tournament-header";

const sourceBase =
  "https://worldlacrosse.sport/events/2026-world-lacrosse-womens-championship";

export function TournamentPage({
  title,
  description,
  source,
  showTournamentStatus = false,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly source?: string;
  readonly showTournamentStatus?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <main>
      <PageMetadata
        title={title}
        description={
          description ??
          `${title}: schedules, results, and tournament information for the 2026 World Lacrosse Women's Championship.`
        }
      />
      <TournamentHeader
        sourceUrl={
          source
            ? source.startsWith("http")
              ? source
              : `${sourceBase}/${source}/`
            : undefined
        }
      />
      {showTournamentStatus && <TournamentDataStatus />}
      <article id="main-content" className="tournament-page">
        <header className="page-title">
          <h1>{title}</h1>
        </header>
        {children}
      </article>
    </main>
  );
}
