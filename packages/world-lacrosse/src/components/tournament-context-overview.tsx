import { Link } from "@tanstack/react-router";

import {
  CLOSE_GAME_SHOOTING_MINIMUM_SHOTS,
  GOALKEEPER_RANKING_MINIMUM_MINUTES,
  GOALKEEPER_RANKING_MINIMUM_SHOTS_FACED,
} from "../lib/tournament-context";
import type {
  TournamentContext,
  TournamentContextGame,
  TournamentPlayerMetric,
} from "../lib/tournament-context-schema";

const formatDuration = (seconds: number | null): string => {
  if (seconds === null) return "—";
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
};

const signed = (value: number): string =>
  `${value > 0 ? "+" : ""}${value.toFixed(1)}`;

const gameLabel = (game: TournamentContextGame) =>
  `${game.home.name} ${game.score.home}–${game.score.away} ${game.away.name}`;

const unexpectedPlayerMetric = (metric: never): never => {
  throw new Error(`Unsupported tournament player metric: ${String(metric)}`);
};

const metricLabel = (metric: TournamentPlayerMetric): string => {
  switch (metric) {
    case "points":
      return "Points";
    case "goals":
      return "Goals";
    case "recorded-assists":
      return "Recorded assists";
    case "draw-controls":
      return "Draw controls";
    case "ground-balls":
      return "Ground balls";
    case "caused-turnovers":
      return "Caused turnovers";
    default:
      return unexpectedPlayerMetric(metric);
  }
};

const rankLabel = (rank: { readonly rank: number; readonly total: number }) =>
  `#${rank.rank} of ${rank.total}`;

export function TournamentContextOverview({
  context,
}: {
  readonly context: Readonly<TournamentContext>;
}) {
  const closest = context.closestGames[0];
  const fastestFour = context.fastestBursts.find((burst) => burst.goals === 4);
  const comeback = context.largestComebacks[0];
  const closeShooting = context.bestCloseGameShooting[0];
  const goalkeeperCoverageComplete =
    context.goalkeeperTeamGameSample === context.goalkeeperExpectedTeamGames;
  return (
    <>
      <section
        className="tournament-context-summary"
        id="overview"
        aria-labelledby="context-title"
      >
        <div className="analysis-section-heading">
          <span>00</span>
          <div>
            <h2 id="context-title">Tournament context</h2>
          </div>
        </div>
        <div className="analysis-cards tournament-record-cards">
          <div>
            <span>Most closely contested</span>
            <strong>
              {closest ? `${closest.closeGameShare.toFixed(1)}%` : "—"}
            </strong>
            <small>
              {closest
                ? `${gameLabel(closest.game)} · ${rankLabel(closest.rank)}`
                : "—"}
            </small>
          </div>
          <div>
            <span>Fastest four-goal burst</span>
            <strong>
              {fastestFour ? formatDuration(fastestFour.durationSeconds) : "—"}
            </strong>
            <small>
              {fastestFour
                ? `${fastestFour.team} · ${rankLabel(fastestFour.rank)}`
                : "No qualifying run"}
            </small>
          </div>
          <div>
            <span>Largest recovered deficit</span>
            <strong>{comeback ? `${comeback.deficitGoals} goals` : "—"}</strong>
            <small>
              {comeback
                ? `${comeback.winner} · ${rankLabel(comeback.rank)}`
                : "No recovered deficit"}
            </small>
          </div>
          <div>
            <span>Best close-game shooting</span>
            <strong>
              {closeShooting ? `${closeShooting.percentage.toFixed(1)}%` : "—"}
            </strong>
            <small>
              {closeShooting
                ? `${closeShooting.team} · ${closeShooting.goals}/${closeShooting.shots} · ${rankLabel(closeShooting.rank)}`
                : `Minimum ${CLOSE_GAME_SHOOTING_MINIMUM_SHOTS} shots`}
            </small>
          </div>
        </div>
      </section>

      <section
        className="analysis-section tournament-records-section"
        id="records"
      >
        <div className="analysis-section-heading">
          <span>01</span>
          <div>
            <h2>Tournament records</h2>
          </div>
        </div>
        <div className="tournament-record-grid">
          <section>
            <h3>Closest games</h3>
            <div
              className="table-shell"
              role="region"
              aria-label="Closest games"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Game</th>
                    <th>Within one</th>
                    <th>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {context.closestGames.map((record) => (
                    <tr key={record.game.gameId}>
                      <td>{rankLabel(record.rank)}</td>
                      <th>
                        <Link
                          to="/games/$gameId"
                          params={{ gameId: record.game.gameId }}
                        >
                          {gameLabel(record.game)}
                        </Link>
                      </th>
                      <td>{formatDuration(record.closeGameSeconds)}</td>
                      <td>{record.closeGameShare.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h3>Fastest scoring bursts</h3>
            <div
              className="table-shell"
              role="region"
              aria-label="Fastest scoring bursts"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Run</th>
                    <th>Rank</th>
                    <th>Team</th>
                    <th>Time</th>
                    <th>Game</th>
                  </tr>
                </thead>
                <tbody>
                  {context.fastestBursts.map((record) => (
                    <tr
                      key={`${record.goals}-${record.game.gameId}-${record.side}`}
                    >
                      <th>{record.goals} goals</th>
                      <td>{rankLabel(record.rank)}</td>
                      <td>{record.team}</td>
                      <td>{formatDuration(record.durationSeconds)}</td>
                      <td>
                        <Link
                          to="/games/$gameId"
                          params={{ gameId: record.game.gameId }}
                        >
                          {record.game.home.name}–{record.game.away.name}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h3>Recovered deficits</h3>
            <div
              className="table-shell"
              role="region"
              aria-label="Recovered deficits"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Winner</th>
                    <th>Deficit</th>
                    <th>Game</th>
                  </tr>
                </thead>
                <tbody>
                  {context.largestComebacks.map((record) => (
                    <tr key={record.game.gameId}>
                      <td>{rankLabel(record.rank)}</td>
                      <th>{record.winner}</th>
                      <td>
                        {record.deficitGoals} goal
                        {record.deficitGoals === 1 ? "" : "s"}
                      </td>
                      <td>
                        <Link
                          to="/games/$gameId"
                          params={{ gameId: record.game.gameId }}
                        >
                          {gameLabel(record.game)}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h3>Close-game shooting</h3>
            <div
              className="table-shell"
              role="region"
              aria-label="Close-game shooting"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Team</th>
                    <th>Goals/shots</th>
                    <th>Rate</th>
                    <th>Game</th>
                  </tr>
                </thead>
                <tbody>
                  {context.bestCloseGameShooting.map((record) => (
                    <tr key={`${record.game.gameId}-${record.side}`}>
                      <td>{rankLabel(record.rank)}</td>
                      <th>{record.team}</th>
                      <td>
                        {record.goals}/{record.shots}
                      </td>
                      <td>{record.percentage.toFixed(1)}%</td>
                      <td>
                        <Link
                          to="/games/$gameId"
                          params={{ gameId: record.game.gameId }}
                        >
                          {record.game.home.name}–{record.game.away.name}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="analysis-method-note">
              Minimum {CLOSE_GAME_SHOOTING_MINIMUM_SHOTS} attributed shots while
              tied or within one goal;{" "}
              {context.bestCloseGameShooting[0]?.rank.total ?? 0} qualifying
              team-games.
            </p>
          </section>
        </div>
      </section>

      <section className="analysis-section" id="team-context">
        <div className="analysis-section-heading">
          <span>02</span>
          <div>
            <h2>Team averages and recent form</h2>
          </div>
        </div>
        <div
          className="table-shell"
          role="region"
          aria-label="Team averages and recent form"
          tabIndex={0}
        >
          <table className="tournament-team-context-table">
            <thead>
              <tr>
                <th>Pool</th>
                <th>Team</th>
                <th>GP</th>
                <th>Record</th>
                <th>Avg GF</th>
                <th>Avg GA</th>
                <th>Avg diff</th>
                <th>Avg close</th>
                <th>Recent</th>
                <th>Opponent-adjusted</th>
                <th>Pool rank</th>
              </tr>
            </thead>
            <tbody>
              {context.teams.map((team) => (
                <tr key={team.team}>
                  <td>{team.pool ?? "—"}</td>
                  <th>{team.team}</th>
                  <td>{team.games}</td>
                  <td>
                    {team.wins}–{team.losses}
                    {team.ties > 0 ? `–${team.ties}` : ""}
                  </td>
                  <td>{team.averageGoalsFor.toFixed(1)}</td>
                  <td>{team.averageGoalsAgainst.toFixed(1)}</td>
                  <td>{signed(team.averageGoalDifference)}</td>
                  <td>
                    {formatDuration(team.averageCloseGameSeconds)}{" "}
                    <small>({team.closeGameSampleGames})</small>
                  </td>
                  <td>
                    <span
                      className="recent-form"
                      aria-label={team.recent
                        .map(
                          (result) =>
                            `${result.result} ${result.goalsFor}-${result.goalsAgainst} against ${result.opponent}`,
                        )
                        .join(", ")}
                    >
                      {team.recent.map((result) => (
                        <b key={result.gameId} data-result={result.result}>
                          {result.result}
                        </b>
                      ))}
                    </span>
                  </td>
                  <td>
                    {team.opponentAdjustedMargin === null
                      ? "—"
                      : `${signed(team.opponentAdjustedMargin)} (${team.opponentAdjustmentGames})`}
                  </td>
                  <td>
                    {team.opponentAdjustedRank
                      ? rankLabel(team.opponentAdjustedRank)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="analysis-method-note">
          Opponent-adjusted margin = average pool-game goal difference plus that
          opponent’s average margin in its other pool games. The parenthetical
          sample is adjusted games used.
        </p>
      </section>

      <section className="analysis-section" id="player-leaders">
        <div className="analysis-section-heading">
          <span>03</span>
          <div>
            <h2>Player leaders</h2>
          </div>
        </div>
        <div className="player-leaderboard-grid">
          {context.playerLeaderboards.map((leaderboard) => (
            <section key={leaderboard.metric}>
              <h3>{metricLabel(leaderboard.metric)}</h3>
              <ol>
                {leaderboard.entries
                  .filter((entry) => entry.rank.rank <= 5)
                  .map((entry) => (
                    <li key={`${entry.team}-${entry.id ?? entry.name}`}>
                      <span>{entry.rank.rank}</span>
                      <div>
                        <strong>
                          {entry.id ? (
                            <Link
                              to="/players/$playerId"
                              params={{ playerId: entry.id }}
                            >
                              {entry.name}
                            </Link>
                          ) : (
                            entry.name
                          )}
                        </strong>
                        <small>
                          {entry.team} · {rankLabel(entry.rank)}
                        </small>
                      </div>
                      <b>{entry.value}</b>
                    </li>
                  ))}
              </ol>
            </section>
          ))}
        </div>
      </section>

      {goalkeeperCoverageComplete && (
        <section className="analysis-section" id="goalkeepers">
          <div className="analysis-section-heading">
            <span>04</span>
            <div>
              <h2>Goalkeeper rankings</h2>
            </div>
          </div>
          <div
            className="table-shell"
            role="region"
            aria-label="Goalkeeper rankings"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Goalkeeper</th>
                  <th>Team</th>
                  <th>Games</th>
                  <th>Est. minutes</th>
                  <th>Saves</th>
                  <th>Goals allowed</th>
                  <th>Save rate</th>
                </tr>
              </thead>
              <tbody>
                {context.goalkeeperRankings.map((goalkeeper) => (
                  <tr
                    key={`${goalkeeper.team}-${goalkeeper.id ?? goalkeeper.name}`}
                  >
                    <td>{rankLabel(goalkeeper.rank)}</td>
                    <th>
                      {goalkeeper.id ? (
                        <Link
                          to="/players/$playerId"
                          params={{ playerId: goalkeeper.id }}
                        >
                          {goalkeeper.name}
                        </Link>
                      ) : (
                        goalkeeper.name
                      )}
                    </th>
                    <td>{goalkeeper.team}</td>
                    <td>{goalkeeper.games}</td>
                    <td>{goalkeeper.estimatedMinutes}</td>
                    <td>{goalkeeper.saves}</td>
                    <td>{goalkeeper.goalsAllowed}</td>
                    <td>{goalkeeper.savePercentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="analysis-method-note">
            Qualification: at least {GOALKEEPER_RANKING_MINIMUM_MINUTES}{" "}
            estimated minutes and {GOALKEEPER_RANKING_MINIMUM_SHOTS_FACED}{" "}
            recorded shots faced. Save rate = saves ÷ (saves + goals allowed).
          </p>
        </section>
      )}
    </>
  );
}
