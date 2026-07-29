import { Link } from "@tanstack/react-router";

import type { GamePreview } from "../game-preview-schema";
import {
  activeGameStatusLabel,
  finalGameStatusLabel,
  isActiveGameStatus,
  isFinalGameStatus,
  isUpcomingGameStatus,
} from "../game-status";
import type {
  TeamAnalysis,
  TeamBenchmarkMetric,
  TeamGameAnalysis,
  TeamPlayerLeaderboard,
} from "../team-analysis-schema";
import type { CurrentTeamSummary } from "../team-summary";

import { GamePreviewPanel } from "./game-preview-panel";

const benchmarkMetrics: readonly TeamBenchmarkMetric[] = [
  "goals-per-game",
  "goals-against-per-game",
  "goal-difference-per-game",
  "shooting-percentage",
  "draw-control-percentage",
  "save-percentage",
];

const benchmarkLabel = (metric: TeamBenchmarkMetric): string => {
  switch (metric) {
    case "goals-per-game":
      return "Goals per game";
    case "goals-against-per-game":
      return "Goals allowed per game";
    case "goal-difference-per-game":
      return "Goal difference per game";
    case "shooting-percentage":
      return "Shooting conversion";
    case "draw-control-percentage":
      return "Draw-control share";
    case "save-percentage":
      return "Team save rate";
  }
};

const benchmarkValue = (metric: TeamBenchmarkMetric, value: number): string => {
  if (
    metric === "shooting-percentage" ||
    metric === "draw-control-percentage" ||
    metric === "save-percentage"
  )
    return `${value.toFixed(1)}%`;
  if (metric === "goal-difference-per-game" && value > 0)
    return `+${value.toFixed(1)}`;
  return value.toFixed(1);
};

const leaderboardLabel = (metric: TeamPlayerLeaderboard["metric"]): string => {
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
  }
};

const rankLabel = (
  rank: TeamPlayerLeaderboard["entries"][number]["rank"],
): string => `${rank.tied ? "T" : ""}${rank.rank}`;

const formatDuration = (seconds: number): string => {
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const gameStatus = (game: TeamGameAnalysis): string => {
  if (isActiveGameStatus(game.status))
    return activeGameStatusLabel(game.status, game.period);
  if (isFinalGameStatus(game.status)) return finalGameStatusLabel(game.status);
  return game.status;
};

const MatchOpponent = ({ game }: { readonly game: TeamGameAnalysis }) => (
  <span className="team-match-opponent">
    <span className="team-match-flag" aria-hidden="true">
      {game.opponentFlagUrl && <img src={game.opponentFlagUrl} alt="" />}
    </span>
    <span>
      <small>{game.opponentCode}</small>
      <strong>{game.opponent}</strong>
    </span>
  </span>
);

const MatchScore = ({ game }: { readonly game: TeamGameAnalysis }) => (
  <span className="team-match-score">
    {game.result && <b>{game.result}</b>}
    <strong>
      {game.goalsFor === null || game.goalsAgainst === null ? (
        "vs"
      ) : (
        <>
          {game.goalsFor}
          <i>:</i>
          {game.goalsAgainst}
        </>
      )}
    </strong>
    <small>{gameStatus(game)}</small>
  </span>
);

const MatchMetrics = ({ game }: { readonly game: TeamGameAnalysis }) => {
  if (!game.eligible)
    return (
      <span className="team-match-analysis-unavailable" aria-hidden="true" />
    );
  return (
    <dl className="team-match-metrics">
      <div>
        <dt>Shooting</dt>
        <dd>
          {game.shooting === null ? "—" : `${game.shooting.value.toFixed(1)}%`}
        </dd>
        {game.shooting && (
          <small>
            {game.shooting.numerator}/{game.shooting.denominator}
          </small>
        )}
      </div>
      <div>
        <dt>Draw share</dt>
        <dd>
          {game.drawControl === null
            ? "—"
            : `${game.drawControl.value.toFixed(1)}%`}
        </dd>
        {game.drawControl && (
          <small>
            {game.drawControl.numerator}/{game.drawControl.denominator}
          </small>
        )}
      </div>
      <div>
        <dt>Longest run</dt>
        <dd>
          {game.longestRunGoals === null
            ? "—"
            : `${game.longestRunGoals} goals`}
        </dd>
      </div>
      <div>
        <dt>Close share</dt>
        <dd>
          {game.closeGame === null
            ? "—"
            : `${game.closeGame.value.toFixed(1)}%`}
        </dd>
        {game.closeGame && (
          <small>
            {formatDuration(game.closeGame.numerator)}/
            {formatDuration(game.closeGame.denominator)}
          </small>
        )}
      </div>
    </dl>
  );
};

const NextMatch = ({ game }: { readonly game: TeamGameAnalysis }) => (
  <Link
    className="team-next-match"
    to="/games/$gameId"
    params={{ gameId: game.gameId }}
    data-active={isActiveGameStatus(game.status) ? "" : undefined}
  >
    <span className="team-next-label">
      {isActiveGameStatus(game.status) ? "Live now" : "Next assignment"}
    </span>
    <MatchOpponent game={game} />
    <MatchScore game={game} />
    <span className="team-next-meta">
      <strong>{game.phase}</strong>
      <span>
        {game.date} · {game.time}
      </span>
      <span>{game.venue}</span>
    </span>
    <span className="team-next-arrow" aria-hidden="true">
      →
    </span>
  </Link>
);

const ResultRow = ({ game }: { readonly game: TeamGameAnalysis }) => (
  <Link
    className="team-result-row"
    to="/games/$gameId"
    params={{ gameId: game.gameId }}
  >
    <span className="team-result-date">
      <strong>{game.date}</strong>
      <small>{game.phase}</small>
    </span>
    <MatchOpponent game={game} />
    <MatchScore game={game} />
    <MatchMetrics game={game} />
    <span className="team-result-arrow" aria-hidden="true">
      →
    </span>
  </Link>
);

export const selectCompletedTeamGames = (
  analysis: TeamAnalysis,
): readonly TeamGameAnalysis[] =>
  analysis.games.filter((game) => game.result !== null);

const TeamMatches = ({
  analysis,
  preview,
}: {
  readonly analysis: TeamAnalysis;
  readonly preview: GamePreview | null;
}) => {
  const activeOrUpcoming = analysis.games.filter(
    (game) =>
      isActiveGameStatus(game.status) || isUpcomingGameStatus(game.status),
  );
  const completed = selectCompletedTeamGames(analysis).toReversed();
  const next = activeOrUpcoming[0];
  return (
    <section className="team-page-section team-matches" id="team-matches">
      <header className="team-section-heading">
        <span>01</span>
        <div>
          <h2>Matches</h2>
          <p>Current assignments and completed results.</p>
        </div>
      </header>
      {next && (
        <div className="team-next-block">
          <NextMatch game={next} />
          {preview?.gameId === next.gameId && (
            <GamePreviewPanel preview={preview} compact />
          )}
        </div>
      )}
      {activeOrUpcoming.length > 1 && (
        <div className="team-future-matches">
          {activeOrUpcoming.slice(1).map((game) => (
            <ResultRow key={game.gameId} game={game} />
          ))}
        </div>
      )}
      <div className="team-results-ledger">
        <header>
          <span>Completed</span>
          <span>{completed.length} results</span>
        </header>
        {completed.map((game) => (
          <ResultRow key={game.gameId} game={game} />
        ))}
      </div>
    </section>
  );
};

const TeamBenchmarks = ({ analysis }: { readonly analysis: TeamAnalysis }) => (
  <div className="team-benchmark-list">
    {benchmarkMetrics.map((metric) => {
      const benchmark = analysis.benchmarks.find(
        (candidate) => candidate.metric === metric,
      );
      return (
        <div key={metric} data-unavailable={benchmark ? undefined : ""}>
          <span>{benchmarkLabel(metric)}</span>
          <strong>
            {benchmark ? benchmarkValue(metric, benchmark.rate.value) : "—"}
          </strong>
          <small>
            {benchmark ? (
              <>
                {benchmark.rate.numerator}/{benchmark.rate.denominator} ·{" "}
                {benchmark.sampleGames}{" "}
                {benchmark.sampleGames === 1 ? "game" : "games"}
              </>
            ) : null}
          </small>
        </div>
      );
    })}
  </div>
);

const periodLabel = (period: string): string => {
  const quarter = period.match(/^Quarter (\d+)$/u);
  if (quarter) return `Q${quarter[1]}`;
  const overtime = period.match(/^Overtime (\d+)$/u);
  if (overtime) return `OT${overtime[1]}`;
  return period;
};

export const TeamPeriodProfile = ({
  analysis,
}: {
  readonly analysis: TeamAnalysis;
}) => {
  const regulation = ["Quarter 1", "Quarter 2", "Quarter 3", "Quarter 4"];
  const extras = [
    ...new Set([
      ...Object.keys(analysis.scoring.periodGoals),
      ...Object.keys(analysis.scoring.periodGoalsAgainst),
    ]),
  ]
    .filter((period) => !regulation.includes(period))
    .toSorted((left, right) =>
      left.localeCompare(right, undefined, { numeric: true }),
    );
  const periods = [...regulation, ...extras];
  const maximum = Math.max(
    1,
    ...periods.flatMap((period) => [
      analysis.scoring.periodGoals[period] ?? 0,
      analysis.scoring.periodGoalsAgainst[period] ?? 0,
    ]),
  );
  return (
    <div className="team-period-profile">
      <header>
        <span>Period scoring</span>
        <span>For / against</span>
      </header>
      {periods.map((period) => {
        const goals = analysis.scoring.periodGoals[period] ?? 0;
        const against = analysis.scoring.periodGoalsAgainst[period] ?? 0;
        return (
          <div className="team-period-row" key={period}>
            <strong>{periodLabel(period)}</strong>
            <span className="team-period-bars" aria-hidden="true">
              <i style={{ width: `${(goals / maximum) * 100}%` }} />
              <i style={{ width: `${(against / maximum) * 100}%` }} />
            </span>
            <span>
              <b>{goals}</b>
              <i>/</i>
              {against}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const GameStateProfile = ({
  analysis,
}: {
  readonly analysis: TeamAnalysis;
}) => {
  const scoring = analysis.scoring;
  if (scoring.observedSeconds === 0) return null;
  const ahead = (scoring.aheadSeconds / scoring.observedSeconds) * 100;
  const tied = (scoring.tiedSeconds / scoring.observedSeconds) * 100;
  const behind = (scoring.behindSeconds / scoring.observedSeconds) * 100;
  return (
    <div className="team-state-profile">
      <header>
        <span>Game-clock state</span>
      </header>
      <div className="team-state-bar" aria-hidden="true">
        <span style={{ width: `${ahead}%` }} />
        <span style={{ width: `${tied}%` }} />
        <span style={{ width: `${behind}%` }} />
      </div>
      <dl>
        <div>
          <dt>Ahead</dt>
          <dd>{ahead.toFixed(1)}%</dd>
        </div>
        <div>
          <dt>Tied</dt>
          <dd>{tied.toFixed(1)}%</dd>
        </div>
        <div>
          <dt>Behind</dt>
          <dd>{behind.toFixed(1)}%</dd>
        </div>
      </dl>
    </div>
  );
};

const TeamScoringFacts = ({
  analysis,
}: {
  readonly analysis: TeamAnalysis;
}) => {
  const scoring = analysis.scoring;
  const assistRate =
    scoring.goals === 0
      ? null
      : (scoring.recordedAssistedGoals / scoring.goals) * 100;
  const responseRate =
    scoring.responseOpportunities === 0
      ? null
      : (scoring.responseGoals / scoring.responseOpportunities) * 100;
  return (
    <dl className="team-scoring-facts">
      <div>
        <dt>Recorded assist share</dt>
        <dd>{assistRate === null ? "—" : `${assistRate.toFixed(1)}%`}</dd>
        <small>
          {scoring.recordedAssistedGoals}/{scoring.goals} goals
        </small>
      </div>
      <div>
        <dt>Recorded scorers</dt>
        <dd>{scoring.recordedScorers}</dd>
        <small>
          {scoring.knownScorerGoals}/{scoring.goals} goals attributed
        </small>
      </div>
      <div>
        <dt>Next-goal responses</dt>
        <dd>{responseRate === null ? "—" : `${responseRate.toFixed(1)}%`}</dd>
        <small>
          {scoring.responseGoals}/{scoring.responseOpportunities} opportunities
        </small>
      </div>
      <div>
        <dt>Goals while tied / trailing</dt>
        <dd>
          {scoring.goalsWhileTied} / {scoring.goalsWhileTrailing}
        </dd>
      </div>
      <div>
        <dt>Largest lead</dt>
        <dd>{scoring.largestLead}</dd>
        <small>
          {scoring.largestLead === 0 ? "No lead" : "Single-game maximum"}
        </small>
      </div>
      <div>
        <dt>Longest scoring run</dt>
        <dd>{scoring.longestRun ? scoring.longestRun.goals : "—"}</dd>
        <small>
          {scoring.longestRun
            ? `vs ${scoring.longestRun.opponent}${
                scoring.longestRun.durationSeconds === null
                  ? ""
                  : ` · ${formatDuration(scoring.longestRun.durationSeconds)}`
              }`
            : "No recorded run"}
        </small>
      </div>
      <div>
        <dt>Average close time</dt>
        <dd>
          {scoring.averageCloseGameSeconds === null
            ? "—"
            : formatDuration(scoring.averageCloseGameSeconds)}
        </dd>
        <small>
          {scoring.closeGameSampleGames}/{scoring.sampleGames} games · tied or
          within one
        </small>
      </div>
    </dl>
  );
};

const totalGroups = [
  {
    label: "Scoring",
    metrics: ["Goals", "Assists", "Points", "Shots on Goal", "Total Shots"],
  },
  {
    label: "Draws & events",
    metrics: ["Draw Controls", "Ground Balls", "Caused Turnovers", "Turnovers"],
  },
  {
    label: "Discipline",
    metrics: ["Penalties", "Yellow Cards", "Red Cards", "Green Cards"],
  },
] as const;

const TeamCurrentTotals = ({
  summary,
}: {
  readonly summary: CurrentTeamSummary;
}) => (
  <div className="team-current-totals">
    <header>
      <h3>Tournament totals</h3>
    </header>
    <div>
      {totalGroups.map((group) => {
        const available = group.metrics.flatMap((metric) => {
          const value = summary.stats[metric];
          return value === undefined ? [] : [{ metric, value }];
        });
        if (available.length === 0) return null;
        return (
          <section key={group.label}>
            <h4>{group.label}</h4>
            <dl>
              {available.map(({ metric, value }) => (
                <div key={metric}>
                  <dt>{metric}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  </div>
);

const TeamPerformance = ({
  analysis,
  summary,
}: {
  readonly analysis: TeamAnalysis;
  readonly summary: CurrentTeamSummary;
}) => {
  const context = analysis.context;
  return (
    <section
      className="team-page-section team-performance"
      id="team-performance"
    >
      <header className="team-section-heading">
        <span>02</span>
        <div>
          <h2>Performance dossier</h2>
        </div>
      </header>
      <div className="team-performance-lede">
        <TeamBenchmarks analysis={analysis} />
        <aside className="team-pool-context">
          <span>Pool-relative context</span>
          {context?.opponentAdjustedMargin !== null &&
          context?.opponentAdjustedMargin !== undefined &&
          context.opponentAdjustedRank ? (
            <>
              <strong>
                {context.opponentAdjustedMargin > 0 ? "+" : ""}
                {context.opponentAdjustedMargin.toFixed(1)}
              </strong>
              <p>
                Adjusted margin · {context.opponentAdjustedRank.tied ? "T" : ""}
                {context.opponentAdjustedRank.rank} of{" "}
                {context.opponentAdjustedRank.total} currently rated teams in
                Pool {context.pool}
              </p>
              <small>{context.opponentAdjustmentGames} pool games used</small>
            </>
          ) : (
            <p>Not enough pool results yet.</p>
          )}
        </aside>
      </div>
      <div className="team-scoring-layout">
        <div>
          <TeamPeriodProfile analysis={analysis} />
          <GameStateProfile analysis={analysis} />
        </div>
        <TeamScoringFacts analysis={analysis} />
      </div>
      <TeamCurrentTotals summary={summary} />
      <p className="team-analysis-method">
        “Close time” means tied or within one goal.
      </p>
    </section>
  );
};

const TeamLeaders = ({ analysis }: { readonly analysis: TeamAnalysis }) => (
  <section className="team-page-section team-leaders" id="team-players">
    <header className="team-section-heading">
      <span>03</span>
      <div>
        <h2>Recorded leaders</h2>
        <p>Points are goals plus recorded assists.</p>
      </div>
    </header>
    <div className="team-leaderboards">
      {analysis.playerLeaderboards.map((leaderboard) => (
        <section key={leaderboard.metric}>
          <header>
            <h3>{leaderboardLabel(leaderboard.metric)}</h3>
          </header>
          {leaderboard.entries.length > 0 ? (
            <ol>
              {leaderboard.entries.map((entry) => (
                <li key={`${entry.id ?? entry.name}-${entry.rank.rank}`}>
                  <span>{rankLabel(entry.rank)}</span>
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
                  <b>{entry.value}</b>
                </li>
              ))}
            </ol>
          ) : (
            <p>
              No entries available.{" "}
              <Link to="/statistics">Open full statistics →</Link>
            </p>
          )}
        </section>
      ))}
    </div>
  </section>
);

export function TeamAnalysisPanel({
  analysis,
  summary,
  preview,
}: {
  readonly analysis: TeamAnalysis;
  readonly summary: CurrentTeamSummary;
  readonly preview: GamePreview | null;
}) {
  return (
    <>
      <TeamMatches analysis={analysis} preview={preview} />
      <TeamPerformance analysis={analysis} summary={summary} />
      <TeamLeaders analysis={analysis} />
    </>
  );
}
