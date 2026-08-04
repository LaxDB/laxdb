import { Link } from "@tanstack/react-router";

import type {
  MatchInsightScoringBurst,
  MatchInsightScoringCombination,
  MatchInsightScoringContributor,
  MatchInsightScoringSegment,
  MatchInsightTeamEventProfile,
  MatchInsightTeamPerformance,
  MatchInsightTeamScoringProfile,
  MatchInsightTeamShape,
  MatchInsightTeamShotSplit,
  MatchInsights,
} from "../lib/match-insights-schema";
import type { TournamentGameContext } from "../lib/tournament-context-schema";

import { ScoreWorm } from "./score-worm";
import { TournamentGameContextPanel } from "./tournament-game-context";

const formatDuration = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined) return "—";
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
};

const formatPercentage = (value: number | null): string =>
  value === null ? "—" : `${(value * 100).toFixed(1)}%`;

const sideItem = <Item extends { readonly side: "home" | "away" }>(
  items: readonly Item[],
  side: "home" | "away",
): Item | undefined => items.find((item) => item.side === side);

const segmentItem = (
  segments: readonly MatchInsightScoringSegment[],
  segment: MatchInsightScoringSegment["segment"],
): MatchInsightScoringSegment | undefined =>
  segments.find((item) => item.segment === segment);

const topScorerLabel = (
  profile: Readonly<MatchInsightTeamScoringProfile> | undefined,
): string => {
  if (!profile || profile.topScorers.length === 0) return "—";
  const names = profile.topScorers.map((scorer) => scorer.name).join(", ");
  return `${names} · ${profile.topScorerGoals} / ${formatPercentage(profile.topScorerShare)}`;
};

const rateCount = (count: number, rate: number | null): string =>
  rate === null ? String(count) : `${count} · ${formatPercentage(rate)}`;

const attemptRate = (
  made: number,
  attempts: number,
  rate: number | null,
): string =>
  attempts === 0 ? "—" : `${made}/${attempts} · ${formatPercentage(rate)}`;

const responseValue = (
  shape: Readonly<MatchInsightTeamShape> | undefined,
): string =>
  !shape || shape.responseOpportunities === 0
    ? "—"
    : `${shape.responseGoals}/${shape.responseOpportunities}`;

const droughtValue = (
  shape: Readonly<MatchInsightTeamShape> | undefined,
): string =>
  !shape || shape.longestDroughtSeconds === null
    ? "—"
    : `${formatDuration(shape.longestDroughtSeconds)} · ${shape.longestDroughtGoalsConceded ?? 0} conceded`;

const burstItem = (
  bursts: readonly MatchInsightScoringBurst[],
  side: "home" | "away",
  goals: number,
): MatchInsightScoringBurst | undefined =>
  bursts.find((burst) => burst.side === side && burst.goals === goals);

const burstValue = (
  burst: Readonly<MatchInsightScoringBurst> | undefined,
): string => (burst ? formatDuration(burst.durationSeconds) : "—");

const shotSplitItem = (
  splits: readonly MatchInsightTeamShotSplit[],
  side: "home" | "away",
  segment: MatchInsightTeamShotSplit["segment"],
): MatchInsightTeamShotSplit | undefined =>
  splits.find((split) => split.side === side && split.segment === segment);

const splitRate = (
  split: Readonly<MatchInsightTeamShotSplit> | undefined,
  rate: "shotAccuracy" | "savePercentage",
): string => {
  if (!split) return "—";
  const formatted = formatPercentage(split[rate]);
  return split.attributionComplete ? formatted : `${formatted} · partial`;
};

const splitCount = (
  split: Readonly<MatchInsightTeamShotSplit> | undefined,
  field: "shots" | "shotsOnGoal" | "goals" | "saves",
): string => {
  if (!split) return "—";
  return `${split[field]}${split.attributionComplete ? "" : " · partial"}`;
};

const topInvolvementLabel = (
  contributors: readonly MatchInsightScoringContributor[],
  side: "home" | "away",
): string => {
  const top = contributors
    .filter((contributor) => contributor.side === side)
    .toSorted(
      (left, right) =>
        right.goalInvolvementShare - left.goalInvolvementShare ||
        left.name.localeCompare(right.name),
    )[0];
  return top
    ? `${top.name} · ${formatPercentage(top.goalInvolvementShare)}`
    : "—";
};

const situationalContributorLabel = (
  contributors: readonly MatchInsightScoringContributor[],
  side: "home" | "away",
  field: "equalizingGoals" | "responseGoals" | "fourthQuarterGoals",
): string => {
  const eligible = contributors.filter(
    (contributor) => contributor.side === side && contributor[field] > 0,
  );
  const most = eligible.reduce(
    (maximum, contributor) => Math.max(maximum, contributor[field]),
    0,
  );
  return most === 0
    ? "—"
    : `${eligible
        .filter((contributor) => contributor[field] === most)
        .map((contributor) => contributor.name)
        .join(", ")} · ${most}`;
};

const combinationLabel = (
  combinations: readonly MatchInsightScoringCombination[],
  side: "home" | "away",
): string => {
  const combination = combinations.find((item) => item.side === side);
  return combination
    ? `${combination.scorer.name} ← ${combination.recordedAssist.name} · ${combination.goals}`
    : "—";
};

const closeGameShotLabel = (
  profile: Readonly<MatchInsightTeamEventProfile> | undefined,
  complete: boolean,
): string =>
  profile
    ? `${profile.closeGameGoals}/${profile.closeGameShots}${complete ? "" : " · recorded"}`
    : "—";

const recordedCount = (value: number | undefined, complete: boolean): string =>
  value === undefined ? "—" : `${value}${complete ? "" : " · recorded"}`;

const ComparisonRows = ({
  homeLabel,
  awayLabel,
  rows,
}: {
  readonly homeLabel: string;
  readonly awayLabel: string;
  readonly rows: readonly {
    readonly label: string;
    readonly home: string;
    readonly away: string;
  }[];
}) => (
  <table className="insight-comparison">
    <thead>
      <tr>
        <th scope="col">{homeLabel}</th>
        <th scope="col">Metric</th>
        <th scope="col">{awayLabel}</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <tr className="insight-comparison-row" key={row.label}>
          <td>
            <strong>{row.home}</strong>
          </td>
          <th scope="row">{row.label}</th>
          <td>
            <strong>{row.away}</strong>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

const LeadTime = ({
  insights,
}: {
  readonly insights: Readonly<MatchInsights>;
}) => {
  const time = insights.gameStateTime;
  if (!time)
    return (
      <p className="insight-unavailable">
        Game-clock lead time is unavailable for this game.
      </p>
    );
  const width = (seconds: number): string =>
    `${time.observedSeconds === 0 ? 0 : (seconds / time.observedSeconds) * 100}%`;
  const description = `${insights.home.name} led for ${formatDuration(time.homeLeadingSeconds)}, the game was tied for ${formatDuration(time.tiedSeconds)}, and ${insights.away.name} led for ${formatDuration(time.awayLeadingSeconds)}.`;
  return (
    <div className="insight-lead-time">
      <div className="insight-lead-bar" role="img" aria-label={description}>
        <i
          className="insight-lead-home"
          style={{ width: width(time.homeLeadingSeconds) }}
        />
        <i
          className="insight-lead-tied"
          style={{ width: width(time.tiedSeconds) }}
        />
        <i
          className="insight-lead-away"
          style={{ width: width(time.awayLeadingSeconds) }}
        />
      </div>
      <dl className="insight-lead-labels">
        <div>
          <dt>{insights.home.name} led</dt>
          <dd>{formatDuration(time.homeLeadingSeconds)}</dd>
        </div>
        <div>
          <dt>Tied</dt>
          <dd>{formatDuration(time.tiedSeconds)}</dd>
        </div>
        <div>
          <dt>{insights.away.name} led</dt>
          <dd>{formatDuration(time.awayLeadingSeconds)}</dd>
        </div>
      </dl>
      <div className="insight-margin-time">
        <span>Game-clock time by score margin</span>
        <dl>
          <div>
            <dt>Tied</dt>
            <dd>{formatDuration(time.tiedSeconds)}</dd>
          </div>
          <div>
            <dt>One goal</dt>
            <dd>{formatDuration(time.oneGoalMarginSeconds)}</dd>
          </div>
          <div>
            <dt>Two goals</dt>
            <dd>{formatDuration(time.twoGoalMarginSeconds)}</dd>
          </div>
          <div>
            <dt>Three-plus</dt>
            <dd>{formatDuration(time.threePlusMarginSeconds)}</dd>
          </div>
        </dl>
      </div>
      {!time.complete && (
        <small>
          Through {time.endpointPeriod} {time.endpointClock}
        </small>
      )}
    </div>
  );
};

const edgeValues = (
  home: number | null,
  away: number | null,
  lowerIsBetter = false,
): { readonly home: string; readonly away: string } => {
  if (home === null || away === null) return { home: "—", away: "—" };
  if (home === away) return { home: "Even", away: "Even" };
  const homeHasEdge = lowerIsBetter ? home < away : home > away;
  const difference = Math.abs(home - away);
  return homeHasEdge
    ? {
        home: lowerIsBetter ? `${difference} fewer` : `+${difference}`,
        away: "—",
      }
    : {
        home: "—",
        away: lowerIsBetter ? `${difference} fewer` : `+${difference}`,
      };
};

const performanceRows = (
  home: Readonly<MatchInsightTeamPerformance> | undefined,
  away: Readonly<MatchInsightTeamPerformance> | undefined,
): readonly {
  readonly label: string;
  readonly home: string;
  readonly away: string;
}[] => {
  const drawEdge = edgeValues(
    home?.drawControls ?? null,
    away?.drawControls ?? null,
  );
  const groundBallEdge = edgeValues(
    home?.groundBalls ?? null,
    away?.groundBalls ?? null,
  );
  const turnoverEdge = edgeValues(
    home?.turnovers ?? null,
    away?.turnovers ?? null,
    true,
  );
  const causedTurnoverEdge = edgeValues(
    home?.causedTurnovers ?? null,
    away?.causedTurnovers ?? null,
  );
  return [
    {
      label: "Shot accuracy",
      home: formatPercentage(home?.shotAccuracy ?? null),
      away: formatPercentage(away?.shotAccuracy ?? null),
    },
    {
      label: "Save rate",
      home: formatPercentage(home?.savePercentage ?? null),
      away: formatPercentage(away?.savePercentage ?? null),
    },
    { label: "Draw-control edge", ...drawEdge },
    { label: "Ground-ball edge", ...groundBallEdge },
    { label: "Turnover edge", ...turnoverEdge },
    { label: "Caused-turnover edge", ...causedTurnoverEdge },
  ];
};

export function MatchInsightsPanel({
  insights,
  tournamentContext,
}: {
  readonly insights: Readonly<MatchInsights>;
  readonly tournamentContext?: Readonly<TournamentGameContext> | undefined;
}) {
  const isTimelineEmpty =
    insights.goals.length === 0 || !insights.quality.scoreFlowValid;
  const homeDeficit = sideItem(insights.largestDeficits, "home");
  const awayDeficit = sideItem(insights.largestDeficits, "away");
  const homeShape = sideItem(insights.teamShapes, "home");
  const awayShape = sideItem(insights.teamShapes, "away");
  const homeClosing = sideItem(insights.closing, "home");
  const awayClosing = sideItem(insights.closing, "away");
  const homeEventProfile = sideItem(insights.eventProfiles, "home");
  const awayEventProfile = sideItem(insights.eventProfiles, "away");
  const homeProfile = sideItem(insights.scoringProfiles, "home");
  const awayProfile = sideItem(insights.scoringProfiles, "away");
  const homePerformance = sideItem(insights.teamPerformance, "home");
  const awayPerformance = sideItem(insights.teamPerformance, "away");
  const homeDiscipline = sideItem(insights.discipline, "home");
  const awayDiscipline = sideItem(insights.discipline, "away");
  const firstHalf = segmentItem(insights.scoringSegments, "first-half");
  const secondHalf = segmentItem(insights.scoringSegments, "second-half");
  const overtime = segmentItem(insights.scoringSegments, "overtime");
  const homeFirstHalfShots = shotSplitItem(
    insights.shotSplits,
    "home",
    "first-half",
  );
  const awayFirstHalfShots = shotSplitItem(
    insights.shotSplits,
    "away",
    "first-half",
  );
  const homeSecondHalfShots = shotSplitItem(
    insights.shotSplits,
    "home",
    "second-half",
  );
  const awaySecondHalfShots = shotSplitItem(
    insights.shotSplits,
    "away",
    "second-half",
  );
  const homeOvertimeShots = shotSplitItem(
    insights.shotSplits,
    "home",
    "overtime",
  );
  const awayOvertimeShots = shotSplitItem(
    insights.shotSplits,
    "away",
    "overtime",
  );
  const biggestSwing = insights.biggestPeriodSwings[0];
  const winningGoal = insights.goals.find((goal) => goal.gameWinner);
  const winningLeadLabel = winningGoal
    ? `${winningGoal.period.replace("Quarter ", "Q")} ${winningGoal.clock} · ${winningGoal.scorer?.name ?? "Scorer unrecorded"}`
    : "—";

  return (
    <div className="insights-panel">
      {isTimelineEmpty ? (
        <div className="insight-empty">
          <p>Match insights are unavailable for this game.</p>
          <Link to="/schedule">View tournament schedule →</Link>
        </div>
      ) : (
        <>
          <dl className="insight-facts">
            <div>
              <dt>Lead changes</dt>
              <dd>{insights.leadChanges}</dd>
              <small>{insights.timesTied} tying goals</small>
            </div>
            <div>
              <dt>Close-game time</dt>
              <dd>
                {formatDuration(
                  insights.gameStateTime
                    ? insights.gameStateTime.tiedSeconds +
                        insights.gameStateTime.oneGoalMarginSeconds
                    : null,
                )}
              </dd>
              <small>Tied or a one-goal margin</small>
            </div>
            <div>
              <dt>Largest deficits</dt>
              <dd>
                {insights.home.code ?? insights.home.name}{" "}
                {homeDeficit?.goals ?? 0}
                {" · "}
                {insights.away.code ?? insights.away.name}{" "}
                {awayDeficit?.goals ?? 0}
              </dd>
              <small>Deepest each team fell behind</small>
            </div>
            <div>
              <dt>Winner trailed by</dt>
              <dd>
                {insights.winnerLargestDeficit === null
                  ? "—"
                  : insights.winnerLargestDeficit === 0
                    ? "Never"
                    : `${insights.winnerLargestDeficit} goals`}
              </dd>
              <small>
                {insights.winner === null
                  ? "Available after verification"
                  : insights.winnerLargestDeficit === 0
                    ? "Never behind"
                    : "Largest recovered deficit"}
              </small>
            </div>
          </dl>

          <ScoreWorm insights={insights} />

          <div className="insight-deep-grid">
            <section
              className="insight-lead-section"
              aria-labelledby="lead-time-title"
            >
              <header className="insight-subheading">
                <span>Game state</span>
                <h3 id="lead-time-title">Time leading, trailing and tied</h3>
              </header>
              <LeadTime insights={insights} />
            </section>

            <section
              className="insight-wide-section"
              aria-labelledby="pressure-title"
            >
              <header className="insight-subheading">
                <span>Pressure and response</span>
                <h3 id="pressure-title">Runs, droughts and answers</h3>
              </header>
              <ComparisonRows
                homeLabel={insights.home.name}
                awayLabel={insights.away.name}
                rows={[
                  {
                    label: "Longest scoring run",
                    home: `${homeShape?.longestRunGoals ?? 0} goals`,
                    away: `${awayShape?.longestRunGoals ?? 0} goals`,
                  },
                  {
                    label: "Longest scoring drought",
                    home: droughtValue(homeShape),
                    away: droughtValue(awayShape),
                  },
                  {
                    label: "Next-goal responses / goals conceded",
                    home: responseValue(homeShape),
                    away: responseValue(awayShape),
                  },
                  {
                    label: "Average time for successful response",
                    home: formatDuration(homeShape?.averageResponseSeconds),
                    away: formatDuration(awayShape?.averageResponseSeconds),
                  },
                  {
                    label: "Fastest successful response",
                    home: formatDuration(homeShape?.fastestResponseSeconds),
                    away: formatDuration(awayShape?.fastestResponseSeconds),
                  },
                  {
                    label: "Fastest two-goal burst",
                    home: burstValue(
                      burstItem(insights.fastestScoringBursts, "home", 2),
                    ),
                    away: burstValue(
                      burstItem(insights.fastestScoringBursts, "away", 2),
                    ),
                  },
                  {
                    label: "Fastest three-goal burst",
                    home: burstValue(
                      burstItem(insights.fastestScoringBursts, "home", 3),
                    ),
                    away: burstValue(
                      burstItem(insights.fastestScoringBursts, "away", 3),
                    ),
                  },
                  {
                    label: "Fastest four-goal burst",
                    home: burstValue(
                      burstItem(insights.fastestScoringBursts, "home", 4),
                    ),
                    away: burstValue(
                      burstItem(insights.fastestScoringBursts, "away", 4),
                    ),
                  },
                ]}
              />
            </section>

            <section
              className="insight-wide-section"
              aria-labelledby="splits-title"
            >
              <header className="insight-subheading">
                <span>Closing performance</span>
                <h3 id="splits-title">When the goals arrived</h3>
              </header>
              <ComparisonRows
                homeLabel={insights.home.name}
                awayLabel={insights.away.name}
                rows={[
                  {
                    label: "First half",
                    home:
                      firstHalf === undefined
                        ? "—"
                        : String(firstHalf.homeGoals),
                    away:
                      firstHalf === undefined
                        ? "—"
                        : String(firstHalf.awayGoals),
                  },
                  {
                    label: "Second half",
                    home:
                      secondHalf === undefined
                        ? "—"
                        : String(secondHalf.homeGoals),
                    away:
                      secondHalf === undefined
                        ? "—"
                        : String(secondHalf.awayGoals),
                  },
                  {
                    label: "Fourth quarter",
                    home: String(homeClosing?.fourthQuarterGoals ?? 0),
                    away: String(awayClosing?.fourthQuarterGoals ?? 0),
                  },
                  {
                    label: "Final five minutes of regulation",
                    home:
                      homeClosing?.finalFiveMinuteGoals === null ||
                      homeClosing?.finalFiveMinuteGoals === undefined
                        ? "—"
                        : String(homeClosing.finalFiveMinuteGoals),
                    away:
                      awayClosing?.finalFiveMinuteGoals === null ||
                      awayClosing?.finalFiveMinuteGoals === undefined
                        ? "—"
                        : String(awayClosing.finalFiveMinuteGoals),
                  },
                  ...(overtime
                    ? [
                        {
                          label: "Overtime",
                          home: String(overtime.homeGoals),
                          away: String(overtime.awayGoals),
                        },
                      ]
                    : []),
                  {
                    label: "Goals from a tied score",
                    home: String(homeClosing?.goalsWhileTied ?? 0),
                    away: String(awayClosing?.goalsWhileTied ?? 0),
                  },
                  {
                    label: "Goals while trailing",
                    home: String(homeClosing?.goalsWhileTrailing ?? 0),
                    away: String(awayClosing?.goalsWhileTrailing ?? 0),
                  },
                  {
                    label: "Equalizers",
                    home: String(homeClosing?.equalizingGoals ?? 0),
                    away: String(awayClosing?.equalizingGoals ?? 0),
                  },
                  {
                    label: "Go-ahead goals",
                    home: String(homeClosing?.goAheadGoals ?? 0),
                    away: String(awayClosing?.goAheadGoals ?? 0),
                  },
                  {
                    label: "Winning lead secured",
                    home: winningGoal?.side === "home" ? winningLeadLabel : "—",
                    away: winningGoal?.side === "away" ? winningLeadLabel : "—",
                  },
                  {
                    label: "Biggest period edge",
                    home:
                      biggestSwing &&
                      biggestSwing.homeGoals > biggestSwing.awayGoals
                        ? `+${biggestSwing.homeGoals - biggestSwing.awayGoals} · ${biggestSwing.period.replace("Quarter ", "Q")}`
                        : "—",
                    away:
                      biggestSwing &&
                      biggestSwing.awayGoals > biggestSwing.homeGoals
                        ? `+${biggestSwing.awayGoals - biggestSwing.homeGoals} · ${biggestSwing.period.replace("Quarter ", "Q")}`
                        : "—",
                  },
                ]}
              />
            </section>

            <section
              className="insight-wide-section"
              aria-labelledby="scoring-profile-title"
            >
              <header className="insight-subheading">
                <span>Scoring profile</span>
                <h3 id="scoring-profile-title">Who finished the chances</h3>
              </header>
              <ComparisonRows
                homeLabel={insights.home.name}
                awayLabel={insights.away.name}
                rows={[
                  {
                    label: "Recorded scorers",
                    home: String(homeProfile?.uniqueRecordedScorers ?? 0),
                    away: String(awayProfile?.uniqueRecordedScorers ?? 0),
                  },
                  {
                    label: "Top scorer / goal share",
                    home: topScorerLabel(homeProfile),
                    away: topScorerLabel(awayProfile),
                  },
                  {
                    label: "Top recorded goal involvement",
                    home: topInvolvementLabel(
                      insights.scoringContributors,
                      "home",
                    ),
                    away: topInvolvementLabel(
                      insights.scoringContributors,
                      "away",
                    ),
                  },
                  {
                    label: "Leading equalizer scorer",
                    home: situationalContributorLabel(
                      insights.scoringContributors,
                      "home",
                      "equalizingGoals",
                    ),
                    away: situationalContributorLabel(
                      insights.scoringContributors,
                      "away",
                      "equalizingGoals",
                    ),
                  },
                  {
                    label: "Leading response scorer",
                    home: situationalContributorLabel(
                      insights.scoringContributors,
                      "home",
                      "responseGoals",
                    ),
                    away: situationalContributorLabel(
                      insights.scoringContributors,
                      "away",
                      "responseGoals",
                    ),
                  },
                  {
                    label: "Leading fourth-quarter scorer",
                    home: situationalContributorLabel(
                      insights.scoringContributors,
                      "home",
                      "fourthQuarterGoals",
                    ),
                    away: situationalContributorLabel(
                      insights.scoringContributors,
                      "away",
                      "fourthQuarterGoals",
                    ),
                  },
                  {
                    label: "Top scorer-assister combination",
                    home: combinationLabel(
                      insights.scoringCombinations,
                      "home",
                    ),
                    away: combinationLabel(
                      insights.scoringCombinations,
                      "away",
                    ),
                  },
                  {
                    label: "Recorded scoring combinations",
                    home: String(
                      insights.scoringCombinations.filter(
                        (combination) => combination.side === "home",
                      ).length,
                    ),
                    away: String(
                      insights.scoringCombinations.filter(
                        (combination) => combination.side === "away",
                      ).length,
                    ),
                  },
                  {
                    label: "Goals with recorded assist",
                    home: rateCount(
                      homeProfile?.recordedAssistedGoals ?? 0,
                      homeProfile?.recordedAssistRate ?? null,
                    ),
                    away: rateCount(
                      awayProfile?.recordedAssistedGoals ?? 0,
                      awayProfile?.recordedAssistRate ?? null,
                    ),
                  },
                  {
                    label: "Free-position conversion",
                    home: attemptRate(
                      homeProfile?.freePositionGoals ?? 0,
                      homeProfile?.freePositionAttempts ?? 0,
                      homeProfile?.freePositionConversion ?? null,
                    ),
                    away: attemptRate(
                      awayProfile?.freePositionGoals ?? 0,
                      awayProfile?.freePositionAttempts ?? 0,
                      awayProfile?.freePositionConversion ?? null,
                    ),
                  },
                ]}
              />
            </section>

            <section
              className={overtime ? undefined : "insight-performance-section"}
              aria-labelledby="shot-splits-title"
            >
              <header className="insight-subheading">
                <span>Shot and goalkeeper splits</span>
                <h3 id="shot-splits-title">How efficiency changed</h3>
              </header>
              <ComparisonRows
                homeLabel={insights.home.name}
                awayLabel={insights.away.name}
                rows={[
                  {
                    label: "First-half shot accuracy",
                    home: splitRate(homeFirstHalfShots, "shotAccuracy"),
                    away: splitRate(awayFirstHalfShots, "shotAccuracy"),
                  },
                  {
                    label: "Second-half shot accuracy",
                    home: splitRate(homeSecondHalfShots, "shotAccuracy"),
                    away: splitRate(awaySecondHalfShots, "shotAccuracy"),
                  },
                  {
                    label: "First-half save rate",
                    home: splitRate(homeFirstHalfShots, "savePercentage"),
                    away: splitRate(awayFirstHalfShots, "savePercentage"),
                  },
                  {
                    label: "Second-half save rate",
                    home: splitRate(homeSecondHalfShots, "savePercentage"),
                    away: splitRate(awaySecondHalfShots, "savePercentage"),
                  },
                  {
                    label: "Goals / shots in close-game time",
                    home: closeGameShotLabel(
                      homeEventProfile,
                      insights.quality.unattributedShotEvents === 0,
                    ),
                    away: closeGameShotLabel(
                      awayEventProfile,
                      insights.quality.unattributedShotEvents === 0,
                    ),
                  },
                  {
                    label: "Longest consecutive-save run",
                    home: recordedCount(
                      homeEventProfile?.longestSaveRun,
                      insights.quality.unattributedShotEvents === 0,
                    ),
                    away: recordedCount(
                      awayEventProfile?.longestSaveRun,
                      insights.quality.unattributedShotEvents === 0,
                    ),
                  },
                ]}
              />
            </section>

            {overtime && (
              <section aria-labelledby="overtime-detail-title">
                <header className="insight-subheading">
                  <span>Overtime detail</span>
                  <h3 id="overtime-detail-title">Sudden-victory events</h3>
                </header>
                <ComparisonRows
                  homeLabel={insights.home.name}
                  awayLabel={insights.away.name}
                  rows={[
                    {
                      label: "Shots",
                      home: splitCount(homeOvertimeShots, "shots"),
                      away: splitCount(awayOvertimeShots, "shots"),
                    },
                    {
                      label: "Shots on goal",
                      home: splitCount(homeOvertimeShots, "shotsOnGoal"),
                      away: splitCount(awayOvertimeShots, "shotsOnGoal"),
                    },
                    {
                      label: "Goals",
                      home: splitCount(homeOvertimeShots, "goals"),
                      away: splitCount(awayOvertimeShots, "goals"),
                    },
                    {
                      label: "Saves",
                      home: splitCount(homeOvertimeShots, "saves"),
                      away: splitCount(awayOvertimeShots, "saves"),
                    },
                    {
                      label: "Draw controls",
                      home: recordedCount(
                        homeEventProfile?.overtimeDrawControls,
                        homeEventProfile?.overtimeAttributionComplete ?? false,
                      ),
                      away: recordedCount(
                        awayEventProfile?.overtimeDrawControls,
                        awayEventProfile?.overtimeAttributionComplete ?? false,
                      ),
                    },
                    {
                      label: "Turnovers",
                      home: recordedCount(
                        homeEventProfile?.overtimeTurnovers,
                        homeEventProfile?.overtimeAttributionComplete ?? false,
                      ),
                      away: recordedCount(
                        awayEventProfile?.overtimeTurnovers,
                        awayEventProfile?.overtimeAttributionComplete ?? false,
                      ),
                    },
                    {
                      label: "Ground balls",
                      home: recordedCount(
                        homeEventProfile?.overtimeGroundBalls,
                        homeEventProfile?.overtimeAttributionComplete ?? false,
                      ),
                      away: recordedCount(
                        awayEventProfile?.overtimeGroundBalls,
                        awayEventProfile?.overtimeAttributionComplete ?? false,
                      ),
                    },
                  ]}
                />
              </section>
            )}

            <section
              className="insight-performance-section"
              aria-labelledby="performance-title"
            >
              <header className="insight-subheading">
                <span>Performance edges</span>
                <h3 id="performance-title">Efficiency and possession events</h3>
              </header>
              <ComparisonRows
                homeLabel={insights.home.name}
                awayLabel={insights.away.name}
                rows={[
                  ...performanceRows(homePerformance, awayPerformance),
                  {
                    label: "Card events",
                    home: String(homeDiscipline?.cardEvents ?? 0),
                    away: String(awayDiscipline?.cardEvents ?? 0),
                  },
                  {
                    label: "Recorded penalty minutes",
                    home: String(homeDiscipline?.recordedPenaltyMinutes ?? 0),
                    away: String(awayDiscipline?.recordedPenaltyMinutes ?? 0),
                  },
                ]}
              />
              <p className="insight-method-note">
                Draw controls, ground balls and turnovers are event counts—not a
                possession estimate.
              </p>
            </section>
          </div>
          {tournamentContext && (
            <TournamentGameContextPanel context={tournamentContext} />
          )}
        </>
      )}
    </div>
  );
}
