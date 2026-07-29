import { cn } from "@laxdb/ui/lib/utils";
import { Link, useParams } from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";

import { PageMetadata } from "../components/page-metadata";
import { TeamAnalysisPanel } from "../components/team-analysis-panel";
import { TournamentHeader } from "../components/tournament-header";
import {
  type CurrentTournamentSnapshot,
  useCurrentTournamentSnapshot,
} from "../current-tournament";
import { useFollowedTeams } from "../followed-teams";
import { buildGamePreview } from "../game-preview";
import {
  activeGameStatusLabel,
  finalGameStatusLabel,
  isActiveGameStatus,
  isFinalGameStatus,
  isUpcomingGameStatus,
} from "../game-status";
import { selectMatchday } from "../matchday";
import { scheduleDateLabel } from "../schedule-date";
import type { ScheduledGame, TeamDetails } from "../schema";
import { buildCurrentStandings, formatGoalDifference } from "../standings";
import { buildTeamAnalysis } from "../team-analysis";
import { buildCurrentTeamSummary } from "../team-summary";
import { tournament } from "../tournament-data";

const sourceBase =
  "https://worldlacrosse.sport/events/2026-world-lacrosse-womens-championship";
const pools = ["A", "B", "C", "D"] as const;
const tournamentTeamPools = tournament.teams.map((team) => ({
  name: team.name,
  pool: team.pool,
}));
const tournamentTeamByName = new Map(
  tournament.teams.map((team) => [team.name, team]),
);
const gameHasFollowedTeam = (
  game: Readonly<ScheduledGame>,
  followedTeamNames: ReadonlySet<string>,
): boolean =>
  followedTeamNames.has(game.home.name) ||
  followedTeamNames.has(game.away.name);

const gameAccessibleLabel = (game: Readonly<ScheduledGame>): string => {
  const status = isActiveGameStatus(game.status)
    ? activeGameStatusLabel(game.status, game.period)
    : isFinalGameStatus(game.status)
      ? finalGameStatusLabel(game.status)
      : game.status;
  return `${game.home.name} ${game.home.score ?? ""} vs ${game.away.name} ${game.away.score ?? ""}, ${status}, ${game.date} at ${game.time}, ${game.phase}, ${game.venue}`;
};

const Page = ({
  title,
  description,
  source,
  children,
}: {
  title: string;
  description?: string;
  source?: string;
  children: ReactNode;
}) => (
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
    <article id="main-content" className="tournament-page">
      <header className="page-title">
        <h1>{title}</h1>
      </header>
      {children}
    </article>
  </main>
);

const FollowTeamButton = ({
  teamId,
  teamName,
  followed,
  onToggle,
}: {
  readonly teamId: string;
  readonly teamName: string;
  readonly followed: boolean;
  readonly onToggle: (teamId: string) => void;
}) => (
  <button
    type="button"
    className={cn(
      "follow-team-button",
      "button-compact",
      followed ? "button-primary" : "button-secondary",
    )}
    aria-pressed={followed}
    aria-label={`${followed ? "Stop following" : "Follow"} ${teamName}`}
    onClick={() => {
      onToggle(teamId);
    }}
  >
    {followed ? "Following" : "Follow"}
  </button>
);

const StandingsTables = ({
  schedule,
  showFollowing = false,
}: {
  readonly schedule: readonly ScheduledGame[];
  readonly showFollowing?: boolean;
}) => {
  const standings = buildCurrentStandings(schedule, tournament.teams);
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

export function HomePage() {
  const snapshot = useCurrentTournamentSnapshot();
  const schedule = snapshot.schedule;
  const matchday = selectMatchday(schedule, new Date());

  return (
    <main>
      <PageMetadata description="Schedules, results, standings, player statistics, and game analysis for the 2026 World Lacrosse Women's Championship." />
      <TournamentHeader />
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
                  aria-label={gameAccessibleLabel(game)}
                >
                  <div className="home-game-meta">
                    <time>{game.time}</time>
                    {isActiveGameStatus(game.status) && (
                      <span className="live-badge">
                        {activeGameStatusLabel(game.status, game.period)}
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

export function SchedulePage() {
  const snapshot = useCurrentTournamentSnapshot();
  const { followedTeamIds } = useFollowedTeams();
  const followedTeamNames = useMemo(
    () =>
      new Set(
        tournament.teams
          .filter((team) => followedTeamIds.includes(team.id))
          .map((team) => team.name),
      ),
    [followedTeamIds],
  );
  const schedule = snapshot.schedule;
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
            aria-label={`${gameAccessibleLabel(game)}${
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
                  {activeGameStatusLabel(game.status, game.period)}
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
    <Page title="Schedule" source="schedule">
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
    </Page>
  );
}

export function StandingsPage() {
  const snapshot = useCurrentTournamentSnapshot();
  return (
    <Page
      title="Standings"
      description="Pool standings and team pages for the 2026 World Lacrosse Women's Championship."
      source="standings"
    >
      <StandingsTables schedule={snapshot.schedule} showFollowing />
    </Page>
  );
}

const quarterfinals = [
  ["QF1", "Pool A winner", "Pool C runner-up"],
  ["QF2", "Pool D winner", "Pool B runner-up"],
  ["QF3", "Pool B winner", "Pool D runner-up"],
  ["QF4", "Pool C winner", "Pool A runner-up"],
] as const;

const tieBreakers = [
  ["Head-to-head record", "Results among the teams tied on points."],
  [
    "Head-to-head goal difference",
    "Goal difference in those games, capped at 12 per game.",
  ],
  ["Fewest goals conceded", "Goals allowed in games among the tied teams."],
  [
    "Overall pool goal difference",
    "Goal difference across all pool games, capped at 12 per game.",
  ],
  ["Overall fewest goals conceded", "Goals allowed across all pool games."],
  ["Coin flip", "Used only if every earlier measure remains inconclusive."],
] as const;

export function FormatPage() {
  return (
    <Page title="Format & progression" source="format-and-progression">
      <div className="format-overview">
        <p className="format-lede">
          Pool position determines each team&apos;s championship or placement
          path. Every game must produce a winner; there are no tied results.
        </p>

        <section className="format-paths" aria-labelledby="progression-title">
          <div className="format-section-heading">
            <span>01</span>
            <h2 id="progression-title">From pool play to medals</h2>
          </div>
          <div className="format-path-grid">
            <article>
              <span>Pool finish</span>
              <strong>1st–2nd</strong>
              <p>Advance to the quarterfinals.</p>
            </article>
            <article>
              <span>Pool finish</span>
              <strong>3rd</strong>
              <p>Move to the 9–12 placement bracket.</p>
            </article>
            <article>
              <span>Pool finish</span>
              <strong>4th</strong>
              <p>Move to the 13–16 placement bracket.</p>
            </article>
            <article>
              <span>Quarterfinals</span>
              <strong>Win / loss</strong>
              <p>Winners reach the semifinals; losing teams play for 5–8.</p>
            </article>
            <article>
              <span>Semifinals</span>
              <strong>Win / loss</strong>
              <p>Winners play for gold; losing teams play for bronze.</p>
            </article>
          </div>
        </section>

        <section className="format-quarterfinals" aria-labelledby="draw-title">
          <div className="format-section-heading">
            <span>02</span>
            <h2 id="draw-title">Quarterfinal draw</h2>
          </div>
          <p>
            The bracket is reset after pool play to avoid repeat pool matchups.
          </p>
          <div className="quarterfinal-grid">
            {quarterfinals.map(([label, first, second]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{first}</strong>
                <i>vs</i>
                <strong>{second}</strong>
              </article>
            ))}
          </div>
          <p className="semifinal-route">
            QF1 winner vs QF2 winner · QF3 winner vs QF4 winner
          </p>
        </section>

        <section
          className="format-tiebreakers"
          aria-labelledby="tiebreak-title"
        >
          <div className="format-section-heading">
            <span>03</span>
            <h2 id="tiebreak-title">Pool tie-breakers</h2>
          </div>
          <p>
            A win is worth one point and a loss zero. Teams level on points are
            separated in this order:
          </p>
          <ol>
            {tieBreakers.map(([title, description]) => (
              <li key={title}>
                <strong>{title}</strong>
                <span>{description}</span>
              </li>
            ))}
          </ol>
          <p className="format-note">
            Goal difference means goals for minus goals against. Where used as a
            tie-breaker, each game&apos;s contribution is capped at ±12.
          </p>
        </section>
      </div>
    </Page>
  );
}

export function TeamRoutePage() {
  const { teamId } = useParams({ from: "/teams/$teamId" });
  return <TeamDetailsPage teamId={teamId} />;
}

function TeamDetailsPage({ teamId }: { teamId: string }) {
  const snapshot = useCurrentTournamentSnapshot();
  const team = tournament.teamDetails.find((item) => item.id === teamId);
  if (!team)
    return (
      <Page title="Team not found">
        <p>No team exists for this ID.</p>
        <Link to="/standings">Browse standings →</Link>
      </Page>
    );
  return <TeamDetailsContent team={team} snapshot={snapshot} />;
}

function TeamDetailsContent({
  team,
  snapshot,
}: {
  readonly team: TeamDetails;
  readonly snapshot: CurrentTournamentSnapshot;
}) {
  const { followedTeamIds, toggleTeam } = useFollowedTeams();
  const linkedPlayer = (player: Record<string, string>) => player.Id ?? null;
  const summary = useMemo(
    () => buildCurrentTeamSummary(team, snapshot),
    [snapshot, team],
  );
  const analysis = useMemo(
    () => buildTeamAnalysis(team.name, snapshot, tournamentTeamPools),
    [snapshot, team.name],
  );
  const standing = buildCurrentStandings(
    snapshot.schedule,
    tournament.teams,
  ).find((candidate) => candidate.team === team.name);
  const nextGame = analysis.games.find(
    (game) =>
      isActiveGameStatus(game.status) || isUpcomingGameStatus(game.status),
  );
  const preview = useMemo(
    () =>
      nextGame
        ? buildGamePreview(nextGame.gameId, snapshot, tournamentTeamPools)
        : null,
    [nextGame, snapshot],
  );
  const tournamentGoalsFor = Number(summary.stats.Goals ?? "");
  const tournamentGoalsAgainst = Number(summary.stats["Goals Allowed"] ?? "");
  const tournamentGoalsAvailable =
    Number.isSafeInteger(tournamentGoalsFor) &&
    Number.isSafeInteger(tournamentGoalsAgainst);
  const organization = team.info.Organization;
  const showOrganization =
    organization !== undefined &&
    organization !== team.name &&
    organization !== team.code;
  return (
    <Page
      title={team.name}
      description={`${team.name} results, tournament statistics, player leaders, squad, and staff.`}
      source={team.url}
    >
      <section className="team-competition-brief" aria-label="Team summary">
        <div className="team-brief-flag">
          {team.flagUrl && <img src={team.flagUrl} alt="" />}
          <span>
            {team.code} · Pool {team.pool}
          </span>
          <FollowTeamButton
            teamId={team.id}
            teamName={team.name}
            followed={followedTeamIds.includes(team.id)}
            onToggle={toggleTeam}
          />
        </div>
        <div className="team-brief-record">
          <span>Tournament record</span>
          <strong>
            {summary.record.Wins ?? 0}–{summary.record.Losses ?? 0}
          </strong>
          <p>
            {tournamentGoalsAvailable
              ? `${tournamentGoalsFor}–${tournamentGoalsAgainst} goals · ${formatGoalDifference(
                  tournamentGoalsFor,
                  tournamentGoalsAgainst,
                )} difference`
              : "Current tournament totals unavailable"}
            {summary.provisional ? " · includes unofficial final" : ""}
          </p>
        </div>
        <dl className="team-brief-facts">
          <div>
            <dt>Pool position</dt>
            <dd>
              {standing?.unresolvedTie
                ? "Unresolved"
                : standing
                  ? `${standing.position} of 4`
                  : "—"}
            </dd>
          </div>
          <div>
            <dt>
              {nextGame && isActiveGameStatus(nextGame.status)
                ? "Live"
                : "Next"}
            </dt>
            <dd>{nextGame?.opponent ?? "Awaiting assignment"}</dd>
          </div>
        </dl>
        {showOrganization && (
          <p className="team-organization">{organization}</p>
        )}
      </section>
      <nav
        className="team-page-index"
        aria-label={`${team.name} page sections`}
      >
        <a href="#team-matches">Matches</a>
        <a href="#team-performance">Performance</a>
        <a href="#team-players">Leaders</a>
        <a href="#team-roster">Squad</a>
        <a href="#team-staff">Staff</a>
      </nav>
      <TeamAnalysisPanel
        analysis={analysis}
        summary={summary}
        preview={preview}
      />
      <section className="team-page-section team-roster" id="team-roster">
        <header className="team-section-heading">
          <span>04</span>
          <div>
            <h2>Squad</h2>
            <p>Select a player to view their tournament totals.</p>
          </div>
        </header>
        <div
          className="table-shell team-roster-shell"
          role="region"
          aria-label={`${team.name} squad`}
          tabIndex={0}
        >
          <table className="team-roster-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Position</th>
                <th>Height</th>
                <th>Hometown</th>
              </tr>
            </thead>
            <tbody>
              {team.players.map((player, index) => {
                const playerName = player.Name ?? "Unknown player";
                const playerId = linkedPlayer(player);
                return (
                  <tr key={`${playerName}-${index}`}>
                    <td>{player.Number}</td>
                    <th scope="row">
                      {playerId ? (
                        <Link to="/players/$playerId" params={{ playerId }}>
                          {playerName}
                        </Link>
                      ) : (
                        playerName
                      )}
                    </th>
                    <td>{player.Position}</td>
                    <td>{player.Height}</td>
                    <td>{player.Hometown}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="team-page-section team-staff" id="team-staff">
        <header className="team-section-heading">
          <span>05</span>
          <div>
            <h2>Staff</h2>
          </div>
        </header>
        <div className="team-staff-ledger">
          {team.officials.map((person) => (
            <div key={`${person.Name}-${person.Role}`}>
              <span>{person.Role}</span>
              <strong>{person.Name}</strong>
            </div>
          ))}
        </div>
      </section>
    </Page>
  );
}
