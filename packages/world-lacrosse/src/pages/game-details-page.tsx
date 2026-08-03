import { Link } from "@tanstack/react-router";
import { useLayoutEffect, useMemo, useRef } from "react";

import { GamePreviewPanel } from "../components/game-preview-panel";
import { MatchInsightsPanel } from "../components/match-insights-panel";
import { PageMetadata } from "../components/page-metadata";
import { PlayByPlayTimeline } from "../components/play-by-play-timeline";
import { ScoringTimeline } from "../components/scoring-timeline";
import { TournamentDataStatus } from "../components/tournament-data-state";
import { TournamentHeader } from "../components/tournament-header";
import { useCurrentTournamentSnapshot } from "../current-tournament";
import { buildGamePreview } from "../game-preview";
import {
  finalGameStatusLabel,
  isActiveGameStatus,
  isFinalGameStatus,
  isUpcomingGameStatus,
} from "../game-status";
import { activeGameStatusWithClock } from "../live-game-clock";
import { buildMatchInsights } from "../match-insights";
import type { DerivedPlayerStats, Roster } from "../schema";
import {
  staticTournamentMetadata,
  type StaticPlayerProfile,
} from "../static-tournament-data";
import { buildTournamentContext } from "../tournament-context";

const tournamentTeamPools = staticTournamentMetadata.teams.map((team) => ({
  name: team.name,
  pool: team.pool,
}));

const StatHeading = ({
  abbreviation,
  label,
}: {
  abbreviation: string;
  label: string;
}) => <abbr title={label}>{abbreviation}</abbr>;

const RosterTable = ({
  roster,
  derivedStats,
  players,
}: {
  roster: Roster;
  derivedStats: readonly DerivedPlayerStats[];
  players: readonly StaticPlayerProfile[];
}) => (
  <section className="roster-table-block">
    <div className="roster-title">
      <h3>{roster.team}</h3>
      <span>{roster.players.length} players</span>
    </div>
    <div
      className="table-shell"
      role="region"
      aria-label={`${roster.team} player statistics`}
      tabIndex={0}
    >
      <table className="roster-stats">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>
              <StatHeading abbreviation="Pos" label="Position" />
            </th>
            <th>
              <StatHeading abbreviation="G" label="Goals" />
            </th>
            <th>
              <StatHeading abbreviation="A*" label="Recorded assists" />
            </th>
            <th>
              <StatHeading
                abbreviation="NRA"
                label="Goals without a recorded assist"
              />
            </th>
            <th>
              <StatHeading abbreviation="SH" label="Shots" />
            </th>
            <th>
              <StatHeading abbreviation="SOG" label="Shots on goal" />
            </th>
            <th>
              <StatHeading abbreviation="FPG" label="Free-position goals" />
            </th>
            <th>
              <StatHeading abbreviation="FPA" label="Free-position attempts" />
            </th>
            <th>
              <StatHeading abbreviation="GB" label="Ground balls" />
            </th>
            <th>
              <StatHeading abbreviation="DC" label="Draw controls" />
            </th>
            <th>
              <StatHeading abbreviation="TO" label="Turnovers" />
            </th>
            <th>
              <StatHeading abbreviation="CT" label="Caused turnovers" />
            </th>
            <th>
              <StatHeading abbreviation="SV" label="Saves" />
            </th>
            <th>
              <StatHeading abbreviation="GC" label="Green cards" />
            </th>
            <th>
              <StatHeading abbreviation="YC" label="Yellow cards" />
            </th>
            <th>
              <StatHeading abbreviation="RC" label="Red cards" />
            </th>
          </tr>
        </thead>
        <tbody>
          {roster.players.map((player) => {
            const derived = derivedStats.find((stats) =>
              player.id
                ? stats.id === player.id
                : stats.name === player.name && stats.team === roster.team,
            );
            const details = players.find((item) => item.id === player.id);
            return (
              <tr key={player.id ?? player.name}>
                <td className="roster-number">{player.number}</td>
                <th>
                  {player.id ? (
                    <Link
                      to="/players/$playerId"
                      params={{ playerId: player.id }}
                    >
                      {player.name}
                    </Link>
                  ) : (
                    player.name
                  )}
                  {derived?.startedGame && (
                    <sup
                      className="goalie-marker"
                      title="Starting goalkeeper"
                      aria-label="Starting goalkeeper"
                    >
                      *
                    </sup>
                  )}
                </th>
                <td>
                  {details?.position ??
                    (player.positionGroup === "Goalkeepers" ? "GK" : "Field")}
                </td>
                <td>{derived?.goals ?? 0}</td>
                <td>{derived?.assists ?? 0}</td>
                <td>{derived?.unassistedGoals ?? 0}</td>
                <td>{derived?.shots ?? 0}</td>
                <td>{derived?.shotsOnGoal ?? 0}</td>
                <td>{derived?.freePositionGoals ?? 0}</td>
                <td>{derived?.freePositionAttempts ?? 0}</td>
                <td>{derived?.groundBalls ?? 0}</td>
                <td>{derived?.drawControls ?? 0}</td>
                <td>{derived?.turnovers ?? 0}</td>
                <td>{derived?.causedTurnovers ?? 0}</td>
                <td>{player.stats.Saves ?? "—"}</td>
                <td>{derived?.greenCards ?? 0}</td>
                <td>{derived?.yellowCards ?? 0}</td>
                <td>{derived?.redCards ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </section>
);

const teamNameClass = (name: string): string | undefined =>
  name.length > 18
    ? "team-name-wide"
    : name.length > 12
      ? "team-name-long"
      : undefined;

const fitTeamName = (element: HTMLElement): void => {
  element.style.removeProperty("font-size");
  const preferredSize = Number.parseFloat(getComputedStyle(element).fontSize);
  if (!Number.isFinite(preferredSize) || element.clientWidth === 0) return;
  element.style.fontSize = `${preferredSize}px`;
  if (element.scrollWidth <= element.clientWidth) return;

  const minimumSize = 16;
  let fittingSize = minimumSize;
  let overflowingSize = preferredSize;
  while (overflowingSize - fittingSize > 0.25) {
    const candidate = (fittingSize + overflowingSize) / 2;
    element.style.fontSize = `${candidate}px`;
    if (element.scrollWidth <= element.clientWidth) fittingSize = candidate;
    else overflowingSize = candidate;
  }
  element.style.fontSize = `${Math.floor(fittingSize * 4) / 4}px`;
};

const TeamName = ({ name }: { name: string }) => {
  const headingRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const heading = headingRef.current;
    if (heading === null) return;
    fitTeamName(heading);
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(() => {
      fitTeamName(heading);
    });
    observer.observe(heading.parentElement ?? heading);
    return () => {
      observer.disconnect();
    };
  }, [name]);
  return (
    <strong
      ref={headingRef}
      className={`game-team-name ${teamNameClass(name) ?? ""}`.trim()}
    >
      {name}
    </strong>
  );
};

const SectionHeading = ({ index, title }: { index: string; title: string }) => (
  <div className="section-heading">
    <span>{index}</span>
    <h2>{title}</h2>
  </div>
);

export function GameDetailsPage({ gameId }: { gameId: string }) {
  const snapshot = useCurrentTournamentSnapshot();
  const scheduledGame = snapshot.schedule.find((item) => item.id === gameId);
  const snapshotGame = snapshot.games.find((item) => item.id === gameId);
  const currentStatus = scheduledGame?.status ?? snapshotGame?.status;
  const upcoming =
    currentStatus !== undefined && isUpcomingGameStatus(currentStatus);
  const currentGame = upcoming ? undefined : snapshotGame;
  const tournamentContext = useMemo(
    () =>
      buildTournamentContext(snapshot.games, {
        sourceUpdatedAt: snapshot.updatedAt,
        players: snapshot.players,
        teamPools: tournamentTeamPools,
      }),
    [snapshot.games, snapshot.updatedAt],
  );
  const preview = useMemo(
    () => buildGamePreview(gameId, snapshot, tournamentTeamPools),
    [gameId, snapshot],
  );
  if (currentGame === undefined) {
    const current = scheduledGame;
    if (current === undefined)
      return (
        <main className="not-found">
          <PageMetadata
            title="Game not found"
            description="The requested championship game could not be found."
          />
          <span>404</span>
          <h1>Game not found</h1>
          <a href="/schedule">Return to schedule</a>
        </main>
      );
    const statusLabel = isActiveGameStatus(current.status)
      ? activeGameStatusWithClock(
          current.status,
          scheduledGame?.period,
          snapshotGame,
        )
      : isFinalGameStatus(current.status)
        ? finalGameStatusLabel(current.status)
        : current.status;
    return (
      <main>
        <PageMetadata
          title={`${current.home.name} vs ${current.away.name}`}
          description={`${current.home.name} vs ${current.away.name}: score, schedule details, and tournament form.`}
        />
        <TournamentHeader sourceUrl={current.url} />
        <TournamentDataStatus />
        <article id="main-content">
          <section
            className="hero game-details-unavailable"
            aria-labelledby="game-title"
          >
            <h1 className="sr-only" id="game-title">
              {current.home.name} vs {current.away.name}
            </h1>
            <div className="scoreboard">
              <div className="team team-home">
                {current.home.flagUrl && (
                  <img src={current.home.flagUrl} alt="" />
                )}
                <div>
                  <span>{current.home.code}</span>
                  <TeamName name={current.home.name} />
                </div>
              </div>
              <div className="score">
                <span className="game-final-label">{statusLabel}</span>
                <strong>
                  {isUpcomingGameStatus(current.status)
                    ? 0
                    : (current.home.score ?? "–")}
                </strong>
                <i>—</i>
                <strong>
                  {isUpcomingGameStatus(current.status)
                    ? 0
                    : (current.away.score ?? "–")}
                </strong>
              </div>
              <div className="team team-away">
                <div>
                  <span>{current.away.code}</span>
                  <TeamName name={current.away.name} />
                </div>
                {current.away.flagUrl && (
                  <img src={current.away.flagUrl} alt="" />
                )}
              </div>
            </div>
            <dl className="game-facts">
              <div>
                <dt>Date</dt>
                <dd>{current.date}</dd>
              </div>
              <div>
                <dt>Local time</dt>
                <dd>{current.time}</dd>
              </div>
              <div>
                <dt>Venue</dt>
                <dd>{current.venue}</dd>
              </div>
              <div>
                <dt>Stage</dt>
                <dd>{current.phase}</dd>
              </div>
            </dl>
          </section>
          {preview ? (
            <GamePreviewPanel preview={preview} />
          ) : isUpcomingGameStatus(current.status) ? (
            <p className="game-preview-unavailable">
              A preview will appear once both participants are confirmed.
            </p>
          ) : null}
        </article>
      </main>
    );
  }
  const matchInsights = buildMatchInsights(currentGame);
  const gameTournamentContext = tournamentContext.games.find(
    (context) => context.gameId === gameId,
  );
  const home = scheduledGame?.home ?? snapshotGame?.home ?? currentGame.home;
  const away = scheduledGame?.away ?? snapshotGame?.away ?? currentGame.away;
  const periods = Object.keys(currentGame.periodScores[0]?.scores ?? {});
  const homeStats =
    currentGame.teamStats.find((entry) => entry.team === home.name)?.stats ??
    {};
  const awayStats =
    currentGame.teamStats.find((entry) => entry.team === away.name)?.stats ??
    {};
  const saves = (value: string | undefined): string => {
    const match = value?.match(/^(\d+)\s*\/\s*\d+\s*(\([^)]*\))$/u);
    return match ? `${match[1]} ${match[2]}` : (value ?? "—");
  };
  const playerStatsFor = (team: string) =>
    currentGame.derivedPlayerStats.filter((player) => player.team === team);
  const homePlayerStats = playerStatsFor(home.name);
  const awayPlayerStats = playerStatsFor(away.name);
  const freePositionGoals = (players: readonly DerivedPlayerStats[]) =>
    players.reduce((total, player) => total + player.freePositionGoals, 0);
  const freePositionAttempts = (players: readonly DerivedPlayerStats[]) =>
    players.reduce((total, player) => total + player.freePositionAttempts, 0);
  const cardTotal = (
    players: readonly DerivedPlayerStats[],
    card: "greenCards" | "yellowCards" | "redCards",
  ) => players.reduce((total, player) => total + player[card], 0);
  const percentage = (made: number, attempted: number): string =>
    attempted === 0 ? "—" : `${((made / attempted) * 100).toFixed(1)}%`;
  const teamStats = [
    ["Goals", String(home.score ?? "—"), String(away.score ?? "—")],
    ["Assisted goals", homeStats.Assists ?? "—", awayStats.Assists ?? "—"],
    [
      "Shots on goal",
      homeStats["Shots on Goal"] ?? "—",
      awayStats["Shots on Goal"] ?? "—",
    ],
    [
      "Total shots",
      homeStats["Total Shots"] ?? "—",
      awayStats["Total Shots"] ?? "—",
    ],
    [
      "Shooting percentage",
      homeStats["Shooting Percentage"] ?? "—",
      awayStats["Shooting Percentage"] ?? "—",
    ],
    [
      "Free-position goals",
      String(freePositionGoals(homePlayerStats)),
      String(freePositionGoals(awayPlayerStats)),
    ],
    [
      "Free-position attempts",
      String(freePositionAttempts(homePlayerStats)),
      String(freePositionAttempts(awayPlayerStats)),
    ],
    [
      "Free-position percentage",
      percentage(
        freePositionGoals(homePlayerStats),
        freePositionAttempts(homePlayerStats),
      ),
      percentage(
        freePositionGoals(awayPlayerStats),
        freePositionAttempts(awayPlayerStats),
      ),
    ],
    [
      "Draw controls",
      homeStats["Draw Controls"] ?? "—",
      awayStats["Draw Controls"] ?? "—",
    ],
    [
      "Ground balls",
      homeStats["Ground Balls"] ?? "—",
      awayStats["Ground Balls"] ?? "—",
    ],
    [
      "Caused turnovers",
      homeStats["Caused Turnovers"] ?? "—",
      awayStats["Caused Turnovers"] ?? "—",
    ],
    ["Turnovers", homeStats.Turnovers ?? "—", awayStats.Turnovers ?? "—"],
    [
      "Shots on goal against",
      awayStats["Shots on Goal"] ?? "—",
      homeStats["Shots on Goal"] ?? "—",
    ],
    ["Saves", saves(homeStats.Saves), saves(awayStats.Saves)],
    ["Penalties", homeStats.Penalties ?? "—", awayStats.Penalties ?? "—"],
    [
      "Green cards",
      homeStats["Green Cards"] ??
        String(cardTotal(homePlayerStats, "greenCards")),
      awayStats["Green Cards"] ??
        String(cardTotal(awayPlayerStats, "greenCards")),
    ],
    [
      "Yellow cards",
      homeStats["Yellow Cards"] ??
        String(cardTotal(homePlayerStats, "yellowCards")),
      awayStats["Yellow Cards"] ??
        String(cardTotal(awayPlayerStats, "yellowCards")),
    ],
    [
      "Red cards",
      homeStats["Red Cards"] ?? String(cardTotal(homePlayerStats, "redCards")),
      awayStats["Red Cards"] ?? String(cardTotal(awayPlayerStats, "redCards")),
    ],
  ] as const;
  return (
    <main>
      <PageMetadata
        title={`${home.name} vs ${away.name}`}
        description={`${home.name} vs ${away.name}: score, match statistics, player totals, and game analysis.`}
      />
      <TournamentHeader sourceUrl={currentGame.url} />
      <TournamentDataStatus />
      <article id="main-content">
        <section className="hero" aria-labelledby="game-title">
          <h1 className="sr-only" id="game-title">
            {home.name} vs {away.name}
          </h1>
          <div className="scoreboard">
            <div className="team team-home">
              {home.flagUrl && <img src={home.flagUrl} alt="" />}
              <div>
                <span>{home.code}</span>
                <TeamName name={home.name} />
              </div>
            </div>
            <div className="score">
              {scheduledGame && isActiveGameStatus(scheduledGame.status) && (
                <span className="game-live-badge">
                  {activeGameStatusWithClock(
                    scheduledGame.status,
                    scheduledGame.period,
                    currentGame,
                  )}
                </span>
              )}
              {scheduledGame && isFinalGameStatus(scheduledGame.status) && (
                <span className="game-final-label">
                  {finalGameStatusLabel(scheduledGame.status)}
                </span>
              )}
              <strong>{home.score ?? "–"}</strong>
              <i>—</i>
              <strong>{away.score ?? "–"}</strong>
            </div>
            <div className="team team-away">
              <div>
                <span>{away.code}</span>
                <TeamName name={away.name} />
              </div>
              {away.flagUrl && <img src={away.flagUrl} alt="" />}
            </div>
          </div>
          <dl className="game-facts">
            <div>
              <dt>Date</dt>
              <dd>{scheduledGame?.date ?? currentGame.date}</dd>
            </div>
            <div>
              <dt>Local time</dt>
              <dd>{scheduledGame?.time ?? currentGame.time}</dd>
            </div>
            <div>
              <dt>Venue</dt>
              <dd>{scheduledGame?.venue ?? currentGame.venue}</dd>
            </div>
            <div>
              <dt>Stage</dt>
              <dd>{scheduledGame?.phase ?? currentGame.phase}</dd>
            </div>
          </dl>
        </section>

        <nav className="game-nav" aria-label="Game details sections">
          <a href="#summary">Score</a>
          <a href="#insights">Match insights</a>
          <a href="#comparison">Team stats</a>
          <a href="#rosters">Player stats</a>
          <a href="#officials">Officials</a>
          <a href="#play-by-play">Play-by-play</a>
        </nav>

        <section className="data-section" id="summary">
          <SectionHeading index="01" title="Score" />
          <div
            className="table-shell"
            role="region"
            aria-label="Period scores"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Team</th>
                  {periods.map((period) => (
                    <th scope="col" key={period}>
                      {period}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentGame.periodScores.map((row) => (
                  <tr key={row.team}>
                    <th scope="row">{row.team}</th>
                    {periods.map((period) => (
                      <td key={period}>{row.scores[period]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="data-section insights-section" id="insights">
          <SectionHeading index="02" title="Match insights" />
          <MatchInsightsPanel
            insights={matchInsights}
            tournamentContext={gameTournamentContext}
          />
        </section>

        <section className="data-section stats-section" id="comparison">
          <SectionHeading index="03" title="Team stats" />
          <div className="comparison" aria-label="Team statistics comparison">
            {teamStats.map(([label, home, away]) => (
              <div className="comparison-row" key={label}>
                <strong>{home}</strong>
                <span>{label}</span>
                <strong>{away}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="data-section roster-section" id="rosters">
          <SectionHeading index="04" title="Player stats" />
          <div className="roster-tables">
            {currentGame.rosters.map((roster) => (
              <RosterTable
                key={roster.team}
                roster={roster}
                derivedStats={currentGame.derivedPlayerStats}
                players={staticTournamentMetadata.playerProfiles}
              />
            ))}
          </div>
        </section>

        <section className="data-section officials-section" id="officials">
          <SectionHeading index="05" title="Officials" />
          <div className="officials">
            {currentGame.officials.map((official) => (
              <div key={`${official.role}-${official.name}`}>
                <span>{official.role}</span>
                <strong>{official.name}</strong>
                <small>{official.nationality}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="data-section" id="play-by-play">
          <SectionHeading index="06" title="Play-by-play" />
          <div className="play-timeline-options">
            <details className="play-details" name="play-by-play-view">
              <summary>
                <span>Full event timeline</span>
                <strong>{currentGame.plays.length} events</strong>
              </summary>
              <PlayByPlayTimeline
                plays={currentGame.plays}
                homeName={home.name}
                awayName={away.name}
              />
            </details>

            <details className="play-details" name="play-by-play-view">
              <summary>
                <span>Full scoring timeline</span>
                <strong>
                  {matchInsights.goals.length} goal
                  {matchInsights.goals.length === 1 ? "" : "s"}
                </strong>
              </summary>
              {matchInsights.quality.ignoredGoalCount > 0 && (
                <p className="play-timeline-warning">
                  This timeline stops at the first unverified score change;{" "}
                  {matchInsights.quality.ignoredGoalCount} scoring{" "}
                  {matchInsights.quality.ignoredGoalCount === 1
                    ? "row"
                    : "rows"}{" "}
                  at or after that point remain available in the full event
                  timeline.
                </p>
              )}
              <ScoringTimeline insights={matchInsights} />
            </details>
          </div>
        </section>
      </article>

      <footer>
        <strong>WORLD LACROSSE GAME CENTER</strong>
        <span>Score, player stats and complete event log</span>
      </footer>
    </main>
  );
}
