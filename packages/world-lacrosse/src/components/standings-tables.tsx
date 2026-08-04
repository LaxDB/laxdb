import { Link } from "@tanstack/react-router";

import { useFollowedTeams } from "../lib/followed-teams";
import {
  activeGameStatusLabel,
  isActiveGameStatus,
  isUpcomingGameStatus,
} from "../lib/game-status";
import type { ScheduledGame } from "../lib/schema";
import { buildCurrentStandings, formatGoalDifference } from "../lib/standings";
import { staticTournamentMetadata } from "../lib/static-tournament-data";

import { FollowTeamButton } from "./follow-team-button";

const pools = ["A", "B", "C", "D"] as const;
const tournamentTeamByName = new Map(
  staticTournamentMetadata.teams.map((team) => [team.name, team]),
);

export const StandingsTables = ({
  schedule,
  showFollowing = false,
}: {
  readonly schedule: readonly ScheduledGame[];
  readonly showFollowing?: boolean;
}) => {
  const standings = buildCurrentStandings(
    schedule,
    staticTournamentMetadata.teams,
  );
  const { followedTeamIds, toggleTeam } = useFollowedTeams();
  const followedRows = standings.flatMap((standing) => {
    const team = tournamentTeamByName.get(standing.team);
    const nextGame = schedule.find(
      (game) =>
        (isActiveGameStatus(game.status) ||
          isUpcomingGameStatus(game.status)) &&
        (game.home.name === standing.team || game.away.name === standing.team),
    );
    return team && followedTeamIds.includes(team.id)
      ? [{ standing, team, nextGame }]
      : [];
  });
  return (
    <>
      {showFollowing && followedRows.length > 0 && (
        <section className="followed-teams" aria-labelledby="following-title">
          <header>
            <span>Saved on this device</span>
            <h2 id="following-title">Following</h2>
          </header>
          <ul>
            {followedRows.map(({ standing, team, nextGame }) => {
              const opponent =
                nextGame?.home.name === team.name
                  ? nextGame.away.name
                  : nextGame?.away.name === team.name
                    ? nextGame.home.name
                    : null;
              return (
                <li key={team.id}>
                  <Link
                    to="/teams/$teamId"
                    params={{ teamId: team.id }}
                    className="followed-team-link"
                  >
                    <span className="standings-flag" aria-hidden="true">
                      {team.flagUrl && <img src={team.flagUrl} alt="" />}
                    </span>
                    <span>
                      <strong>{team.name}</strong>
                      <small>
                        Pool {team.pool} ·{" "}
                        {standing.unresolvedTie
                          ? "Position unresolved"
                          : `${standing.position} of 4`}{" "}
                        · {standing.wins}–{standing.losses}
                        {standing.provisional ? " · unofficial final" : ""}
                      </small>
                      <small>
                        {nextGame && opponent
                          ? `${
                              isActiveGameStatus(nextGame.status)
                                ? activeGameStatusLabel(
                                    nextGame.status,
                                    nextGame.period,
                                  )
                                : "Next"
                            } · ${opponent} · ${nextGame.date}, ${nextGame.time}`
                          : "Next assignment pending"}
                      </small>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <div className="standings-grid">
        {pools.map((pool) => {
          const rows = standings.filter((row) => row.pool === pool);
          const provisional = rows.some((row) => row.provisional);
          const unresolved = rows.some((row) => row.unresolvedTie);
          return (
            <section key={pool}>
              <header className="standings-pool-heading">
                <h2>Pool {pool}</h2>
                {provisional && <span>Includes unofficial final</span>}
              </header>
              <div
                className="table-shell"
                role="region"
                aria-label={`Pool ${pool} standings`}
                tabIndex={0}
              >
                <table>
                  <thead>
                    <tr>
                      <th scope="col" aria-label="Position">
                        Pos
                      </th>
                      <th scope="col">Team</th>
                      <th scope="col" aria-label="Played">
                        P
                      </th>
                      <th scope="col" aria-label="Wins">
                        W
                      </th>
                      <th scope="col" aria-label="Losses">
                        L
                      </th>
                      <th scope="col" aria-label="Goals for">
                        GF
                      </th>
                      <th scope="col" aria-label="Goals against">
                        GA
                      </th>
                      <th scope="col" aria-label="Goal difference">
                        GD
                      </th>
                      {showFollowing && <th scope="col">Follow</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const team = tournamentTeamByName.get(row.team);
                      const followed =
                        team !== undefined && followedTeamIds.includes(team.id);
                      return (
                        <tr
                          key={row.team}
                          data-followed={followed || undefined}
                        >
                          <td>{row.unresolvedTie ? "—†" : row.position}</td>
                          <th scope="row">
                            {team ? (
                              <Link
                                className="standings-team"
                                to="/teams/$teamId"
                                params={{ teamId: team.id }}
                              >
                                <span
                                  className="standings-flag"
                                  aria-hidden="true"
                                >
                                  {row.flagUrl && (
                                    <img src={row.flagUrl} alt="" />
                                  )}
                                </span>
                                <span>{row.team}</span>
                              </Link>
                            ) : (
                              row.team
                            )}
                          </th>
                          <td>{row.played}</td>
                          <td>{row.wins}</td>
                          <td>{row.losses}</td>
                          <td>{row.goalsFor}</td>
                          <td>{row.goalsAgainst}</td>
                          <td>
                            {formatGoalDifference(
                              row.goalsFor,
                              row.goalsAgainst,
                            )}
                          </td>
                          {showFollowing && (
                            <td>
                              {team && (
                                <FollowTeamButton
                                  teamId={team.id}
                                  teamName={team.name}
                                  followed={followed}
                                  onToggle={toggleTeam}
                                />
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {unresolved && (
                <p className="standings-tie-note">
                  † Standings cannot resolve the final coin-flip tiebreak.
                </p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
};
