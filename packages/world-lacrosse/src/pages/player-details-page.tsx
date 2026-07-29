import { Link } from "@tanstack/react-router";
import { useMemo } from "react";

import { PageMetadata } from "../components/page-metadata";
import { TournamentDataStatus } from "../components/tournament-data-state";
import { TournamentHeader } from "../components/tournament-header";
import {
  buildCurrentPlayerSummary,
  type CurrentPlayerGameLog,
} from "../current-player";
import { useCurrentTournamentSnapshot } from "../current-tournament";
import type { StaticPlayerProfile } from "../static-tournament-data";

const fieldStatLabels = [
  "Goals",
  "Shots on Goal",
  "Shots",
  "Shooting Percentage",
  "Recorded Assists",
  "Points",
  "Ground Balls",
  "Turnovers",
  "Caused Turnovers",
  "Draw Controls",
  "Green Cards",
  "Yellow Cards",
  "Red Cards",
] as const;

const goalkeeperStatLabels = [
  "Saves",
  "Ground Balls",
  "Turnovers",
  "Caused Turnovers",
  "Draw Controls",
  "Green Cards",
  "Yellow Cards",
  "Red Cards",
] as const;

const fieldGameStats = fieldStatLabels;
const goalkeeperGameStats = [
  "Started",
  "Recorded Period Starts",
  ...goalkeeperStatLabels,
] as const;

const gameStatValue = (game: CurrentPlayerGameLog, label: string): string => {
  if (label === "Started") return game.goalkeeperStarted ? "Yes" : "No";
  if (label === "Recorded Period Starts")
    return String(game.goalkeeperPeriodStarts);
  return game.stats[label] ?? "—";
};

export function PlayerDetailsPage({ player }: { player: StaticPlayerProfile }) {
  const snapshot = useCurrentTournamentSnapshot();
  const current = useMemo(
    () => buildCurrentPlayerSummary(player, snapshot.games),
    [player, snapshot.games],
  );
  const isGoalkeeper = player.playerType === "Goalkeeper";
  const sourceLabels = isGoalkeeper ? goalkeeperStatLabels : fieldStatLabels;
  const gameStatLabels = isGoalkeeper ? goalkeeperGameStats : fieldGameStats;
  const displayStats: readonly (readonly [string, string])[] = [
    ...(isGoalkeeper
      ? [
          ["Games started", String(current.gamesStarted)] as const,
          [
            "Recorded period starts",
            String(current.goalkeeperPeriodStarts),
          ] as const,
        ]
      : []),
    ...sourceLabels.map(
      (label) => [label, current.stats[label] ?? "—"] as const,
    ),
  ];
  return (
    <main>
      <PageMetadata
        title={player.name}
        description={`${player.name} tournament statistics and game log for ${player.team}.`}
      />
      <TournamentHeader sourceUrl={player.url} />
      <TournamentDataStatus />

      <article id="main-content" className="player-page">
        <section className="player-hero" aria-labelledby="player-name">
          <div className="player-title">
            <h1 id="player-name">{player.name}</h1>
            {player.flagUrl && (
              <img src={player.flagUrl} alt={`${player.team} flag`} />
            )}
          </div>
          <dl className="player-facts">
            <div>
              <dt>Team</dt>
              <dd>{player.team}</dd>
            </div>
            <div>
              <dt>Number</dt>
              <dd>{player.number ?? "—"}</dd>
            </div>
            <div>
              <dt>Position</dt>
              <dd>{player.position ?? "—"}</dd>
            </div>
            <div>
              <dt>Height</dt>
              <dd>{player.height ?? "—"}</dd>
            </div>
            <div>
              <dt>Hometown</dt>
              <dd>{player.hometown ?? "—"}</dd>
            </div>
            {player.university && (
              <div>
                <dt>University</dt>
                <dd>{player.university}</dd>
              </div>
            )}
          </dl>
        </section>

        <nav className="game-nav" aria-label="Player details sections">
          <a href="#tournament-stats">Stats</a>
          <a href="#game-log">Game log</a>
        </nav>

        <section className="data-section" id="tournament-stats">
          <div className="section-heading">
            <span>01</span>
            <h2>Stats</h2>
          </div>
          <div>
            <div className="player-stat-grid">
              {displayStats.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            {isGoalkeeper ? (
              <p className="stat-note">
                Exact minutes, goalkeeper-specific goals allowed, and save
                percentage are not available.
              </p>
            ) : (
              <p className="stat-note">
                “Recorded assists” includes assists listed in the match record.
              </p>
            )}
          </div>
        </section>

        <section className="data-section" id="game-log">
          <div className="section-heading">
            <span>02</span>
            <h2>Current game log</h2>
          </div>
          <div
            className="table-shell"
            role="region"
            aria-label={`${player.name} game log`}
            tabIndex={0}
          >
            <table className="player-game-log">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Stage</th>
                  <th>Opponent</th>
                  <th>Result</th>
                  <th>Score</th>
                  {gameStatLabels.map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {current.gameLog.map((game) => (
                  <tr key={game.gameId}>
                    <td>{game.date}</td>
                    <td>{game.phase}</td>
                    <th scope="row">
                      <Link
                        className="player-game-opponent"
                        to="/games/$gameId"
                        params={{ gameId: game.gameId }}
                      >
                        {game.opponentFlagUrl && (
                          <img src={game.opponentFlagUrl} alt="" />
                        )}
                        {game.opponent}
                      </Link>
                    </th>
                    <td>
                      <b
                        className="player-game-result"
                        data-result={game.result}
                      >
                        {game.result ?? "—"}
                      </b>
                      {game.provisional && <small>Unofficial</small>}
                    </td>
                    <td>
                      {game.goalsFor === null || game.goalsAgainst === null
                        ? "—"
                        : `${game.goalsFor}–${game.goalsAgainst}`}
                    </td>
                    {gameStatLabels.map((label) => (
                      <td key={label}>{gameStatValue(game, label)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </article>

      <footer>
        <strong>WORLD LACROSSE PLAYER PROFILE</strong>
        <span>Tournament profile</span>
      </footer>
    </main>
  );
}
