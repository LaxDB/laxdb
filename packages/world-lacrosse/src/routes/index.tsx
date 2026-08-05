import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";

import { PageMetadata } from "../components/page-metadata";
import { StandingsTables } from "../components/standings-tables";
import {
  TournamentData,
  TournamentDataStatus,
} from "../components/tournament-data-state";
import { TournamentHeader } from "../components/tournament-header";
import {
  type CurrentTournamentReadyController,
  currentTournamentAtom,
} from "../lib/current-tournament";
import { gameAccessibleLabel } from "../lib/game-accessible-label";
import {
  finalGameStatusLabel,
  isActiveGameStatus,
  isFinalGameStatus,
} from "../lib/game-status";
import { activeGameStatusWithClock } from "../lib/live-game-clock";
import { selectMatchday } from "../lib/matchday";

export const Route = createFileRoute("/")({ component: HomeRoutePage });

function HomeRoutePage() {
  const tournament = {
    state: useAtomValue(currentTournamentAtom),
    retry: useAtomRefresh(currentTournamentAtom),
  };
  return (
    <TournamentData tournament={tournament}>
      {(ready) => <HomeContent tournament={ready} />}
    </TournamentData>
  );
}

function HomeContent({
  tournament,
}: {
  readonly tournament: CurrentTournamentReadyController;
}) {
  const snapshot = tournament.state.snapshot;
  const schedule = snapshot.schedule;
  const detailsByGameId = useMemo(
    () => new Map(snapshot.games.map((game) => [game.id, game])),
    [snapshot.games],
  );
  const matchday = selectMatchday(schedule, new Date());

  return (
    <main>
      <PageMetadata description="Schedules, results, standings, player statistics, and game analysis for the 2026 World Lacrosse Women's Championship." />
      <TournamentHeader />
      <TournamentDataStatus tournament={tournament} />
      <article id="main-content" className="tournament-page home-page">
        <header className="home-intro">
          <h1 className="sr-only">2026 Women&apos;s Lacrosse Championship</h1>
          <p>
            Schedules, results, standings, player statistics, and deeper game
            analysis for the 2026 World Lacrosse Women&apos;s Championship.
          </p>
        </header>
        <div className="home-dashboard">
          <section className="home-matchday">
            <header className="home-section-header">
              <div>
                <span>Matchday</span>
                <h2 className="home-matchday-title">
                  {matchday.date ?? "Latest results"}
                </h2>
              </div>
              <Link to="/schedule">Full schedule →</Link>
            </header>
            <div className="home-games">
              {matchday.games.map((game) => (
                <Link
                  key={game.id}
                  className="home-game"
                  to="/games/$gameId"
                  params={{ gameId: game.id }}
                  aria-label={gameAccessibleLabel(
                    game,
                    detailsByGameId.get(game.id),
                  )}
                >
                  <div className="home-game-meta">
                    <time>{game.time}</time>
                    {isActiveGameStatus(game.status) && (
                      <span className="live-badge">
                        {activeGameStatusWithClock(
                          game.status,
                          game.period,
                          detailsByGameId.get(game.id),
                        )}
                      </span>
                    )}
                    {isFinalGameStatus(game.status) && (
                      <span className="final-badge">
                        {finalGameStatusLabel(game.status)}
                      </span>
                    )}
                  </div>
                  <div className="home-game-teams">
                    <span>
                      <strong className="schedule-team">
                        <span className="schedule-flag" aria-hidden="true">
                          {game.home.flagUrl && (
                            <img src={game.home.flagUrl} alt="" />
                          )}
                        </span>
                        {game.home.code}
                      </strong>
                      <b>{game.home.score ?? "–"}</b>
                    </span>
                    <span>
                      <strong className="schedule-team">
                        <span className="schedule-flag" aria-hidden="true">
                          {game.away.flagUrl && (
                            <img src={game.away.flagUrl} alt="" />
                          )}
                        </span>
                        {game.away.code}
                      </strong>
                      <b>{game.away.score ?? "–"}</b>
                    </span>
                  </div>
                  <small>
                    {game.phase} · {game.venue}
                  </small>
                </Link>
              ))}
            </div>
          </section>

          <section className="home-standings">
            <header className="home-section-header">
              <div>
                <span>Standings</span>
                <h2>All pools</h2>
              </div>
              <Link to="/standings">Standings page →</Link>
            </header>
            <StandingsTables schedule={schedule} />
          </section>
        </div>
      </article>
    </main>
  );
}
