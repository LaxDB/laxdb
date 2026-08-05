import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";

import { TournamentData } from "../components/tournament-data-state";
import { TournamentPage } from "../components/tournament-page";
import {
  type CurrentTournamentReadyController,
  currentTournamentAtom,
} from "../lib/current-tournament";
import { useFollowedTeams } from "../lib/followed-teams";
import { gameAccessibleLabel } from "../lib/game-accessible-label";
import {
  finalGameStatusLabel,
  isActiveGameStatus,
  isFinalGameStatus,
  isUpcomingGameStatus,
} from "../lib/game-status";
import { activeGameStatusWithClock } from "../lib/live-game-clock";
import { scheduleDateLabel } from "../lib/schedule-date";
import type { ScheduledGame } from "../lib/schema";
import { staticTournamentMetadata } from "../lib/static-tournament-data";

export const Route = createFileRoute("/schedule")({
  component: ScheduleRoutePage,
});

function ScheduleRoutePage() {
  const tournament = {
    state: useAtomValue(currentTournamentAtom),
    retry: useAtomRefresh(currentTournamentAtom),
  };
  return (
    <TournamentData tournament={tournament}>
      {(ready) => <ScheduleContent tournament={ready} />}
    </TournamentData>
  );
}

const gameHasFollowedTeam = (
  game: Readonly<ScheduledGame>,
  followedTeamNames: ReadonlySet<string>,
): boolean =>
  followedTeamNames.has(game.home.name) ||
  followedTeamNames.has(game.away.name);

function ScheduleContent({
  tournament,
}: {
  readonly tournament: CurrentTournamentReadyController;
}) {
  const snapshot = tournament.state.snapshot;
  const { followedTeamIds } = useFollowedTeams();
  const followedTeamNames = useMemo(
    () =>
      new Set(
        staticTournamentMetadata.teams
          .filter((team) => followedTeamIds.includes(team.id))
          .map((team) => team.name),
      ),
    [followedTeamIds],
  );
  const schedule = snapshot.schedule;
  const detailsByGameId = useMemo(
    () => new Map(snapshot.games.map((game) => [game.id, game])),
    [snapshot.games],
  );
  const dates = [...new Set(schedule.map((game) => game.date))];
  const localDate = scheduleDateLabel(new Date());
  const focusDate =
    dates.find((date) => date === localDate) ??
    schedule.find((game) => isActiveGameStatus(game.status))?.date ??
    schedule.find((game) => isUpcomingGameStatus(game.status))?.date ??
    dates.at(-1);
  const focusIndex = focusDate ? dates.indexOf(focusDate) : -1;
  const currentAndUpcomingDates =
    focusIndex >= 0 ? dates.slice(focusIndex) : dates;
  const earlierDates =
    focusIndex > 0 ? dates.slice(0, focusIndex).toReversed() : [];
  const renderDate = (date: string) => (
    <section key={date}>
      <h2>{date}</h2>
      {schedule
        .filter((game) => game.date === date)
        .map((game) => (
          <Link
            key={game.id}
            className="schedule-game"
            to="/games/$gameId"
            params={{ gameId: game.id }}
            aria-label={`${gameAccessibleLabel(
              game,
              detailsByGameId.get(game.id),
            )}${
              gameHasFollowedTeam(game, followedTeamNames)
                ? ", includes a followed team"
                : ""
            }`}
          >
            <span className="schedule-time">{game.time}</span>
            <strong>
              <span className="schedule-team">
                <span className="schedule-flag" aria-hidden="true">
                  {game.home.flagUrl && <img src={game.home.flagUrl} alt="" />}
                </span>
                <span className="schedule-team-name">{game.home.name}</span>
                <span className="schedule-team-code">{game.home.code}</span>
              </span>
              <b>{game.home.score ?? "–"}</b>
            </strong>
            <i>vs</i>
            <strong>
              <span className="schedule-team">
                <span className="schedule-flag" aria-hidden="true">
                  {game.away.flagUrl && <img src={game.away.flagUrl} alt="" />}
                </span>
                <span className="schedule-team-name">{game.away.name}</span>
                <span className="schedule-team-code">{game.away.code}</span>
              </span>
              <b>{game.away.score ?? "–"}</b>
            </strong>
            <span className="schedule-details">
              <span className="schedule-location">
                {game.phase} · {game.venue}
              </span>
              {gameHasFollowedTeam(game, followedTeamNames) && (
                <span className="following-badge">Following</span>
              )}
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
            </span>
          </Link>
        ))}
    </section>
  );

  return (
    <TournamentPage
      title="Schedule"
      source="schedule"
      tournament={tournament}
      showTournamentStatus
    >
      <div className="schedule-list">
        {currentAndUpcomingDates.map(renderDate)}
        {earlierDates.length > 0 && (
          <div className="schedule-archive">
            <header>
              <h2>Earlier results</h2>
            </header>
            {earlierDates.map(renderDate)}
          </div>
        )}
      </div>
    </TournamentPage>
  );
}
