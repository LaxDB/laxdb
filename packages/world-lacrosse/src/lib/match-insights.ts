import { isFinalGameStatus, isUpcomingGameStatus } from "./game-status";
import {
  buildMatchPeriodWindows,
  formatMatchClock,
  matchElapsedSeconds,
  matchPeriodDuration,
  parseMatchClock,
  type MatchPeriodWindow,
} from "./match-clock";
import {
  MatchInsightAnomaly,
  type MatchInsightAnomalyCode,
  type MatchInsightCompleteness,
  MatchInsightGameStateTime,
  MatchInsightGoal,
  MatchInsightLargestDeficit,
  MatchInsightLargestLead,
  MatchInsightParticipant,
  MatchInsightPeriod,
  MatchInsightQuality,
  MatchInsightScore,
  type MatchInsightScoreConsistency,
  MatchInsightScoringBurst,
  MatchInsightScoringCombination,
  MatchInsightScoringContributor,
  MatchInsightScoringRun,
  MatchInsightScoringSegment,
  type MatchInsightSegmentName,
  type MatchInsightSide,
  MatchInsights,
  MatchInsightsDataset,
  MatchInsightTeam,
  MatchInsightTeamClosing,
  MatchInsightTeamDiscipline,
  MatchInsightTeamEventProfile,
  MatchInsightTeamPerformance,
  MatchInsightTeamScoringProfile,
  MatchInsightTeamShape,
  MatchInsightTeamShotSplit,
} from "./match-insights-schema";
import type { GameDetails } from "./schema";

const goalActions = new Set(["Goal", "Free Position Goal"]);
// This action set reconciles with the source Total Shots summary. The feed
// retains posts, blocks, and missed free-position attempts as separate evidence.
const shotActions = new Set([
  "Goal",
  "Free Position Goal",
  "Shot missed",
  "Shot saved",
  "Free Position Shot saved",
]);
const shotOnGoalActions = new Set([
  "Goal",
  "Free Position Goal",
  "Shot saved",
  "Free Position Shot saved",
]);
const saveActions = new Set(["Shot saved", "Free Position Shot saved"]);
const confirmedFinalStatuses = new Set(["FINAL", "FINISHED", "OFFICIAL"]);
const scorePattern = /^(\d+)\s*-\s*(\d+)$/u;

interface MatchInsightParticipantSource {
  readonly id: string | null;
  readonly number: string | null;
  readonly name: string;
  readonly role: string | null;
  readonly team: string;
}

interface MatchInsightPlaySource {
  readonly period: string;
  readonly home: string;
  readonly time: string;
  readonly result: string;
  readonly action: string;
  readonly away: string;
  readonly participants: readonly MatchInsightParticipantSource[];
}

interface MatchInsightTeamSource {
  readonly id: string | null;
  readonly code: string | null;
  readonly name: string;
  readonly score: number | null;
}

interface MatchInsightPeriodScoreSource {
  readonly team: string;
  readonly scores: Readonly<Record<string, string>>;
}

interface MatchInsightTeamStatsSource {
  readonly team: string;
  readonly stats: Readonly<Record<string, string>>;
}

interface MatchInsightGameSource {
  readonly id: GameDetails["id"];
  readonly status: string;
  readonly home: MatchInsightTeamSource;
  readonly away: MatchInsightTeamSource;
  readonly periodScores: readonly MatchInsightPeriodScoreSource[];
  readonly teamStats: readonly MatchInsightTeamStatsSource[];
  readonly plays: readonly MatchInsightPlaySource[];
}

interface GoalDraft {
  readonly sequence: number;
  readonly sourceIndex: number;
  readonly period: string;
  readonly clock: string;
  readonly side: MatchInsightSide;
  readonly team: string;
  readonly scoreBefore: MatchInsightScore;
  readonly score: MatchInsightScore;
  readonly scorer: MatchInsightParticipant | null;
  readonly recordedAssist: MatchInsightParticipant | null;
  readonly freePosition: boolean;
  readonly equalizer: boolean;
  readonly goAhead: boolean;
  readonly leadChange: boolean;
}

interface LargestLeadDraft {
  readonly side: MatchInsightSide;
  readonly team: string;
  goals: number;
  goalSequence: number | null;
  period: string | null;
  clock: string | null;
  score: MatchInsightScore;
}

interface ScoringRunDraft {
  readonly side: MatchInsightSide;
  readonly team: string;
  goals: number;
  readonly startSequence: number;
  endSequence: number;
  readonly startPeriod: string;
  readonly startClock: string;
  endPeriod: string;
  endClock: string;
  readonly scoreBefore: MatchInsightScore;
  score: MatchInsightScore;
}

interface ContributorDraft {
  readonly id: string | null;
  readonly number: string | null;
  readonly name: string;
  readonly team: string;
  readonly side: MatchInsightSide;
  goals: number;
  recordedAssists: number;
  freePositionGoals: number;
  goalsWithoutRecordedAssist: number;
  goalInvolvements: number;
  equalizingGoals: number;
  goAheadGoals: number;
  responseGoals: number;
  fourthQuarterGoals: number;
}

const makeScore = (home: number, away: number) =>
  MatchInsightScore.make({ home, away });

const leaderOf = (score: MatchInsightScore): MatchInsightSide | null =>
  score.home === score.away ? null : score.home > score.away ? "home" : "away";

const parseScore = (value: string): MatchInsightScore | null => {
  const match = value.match(scorePattern);
  const home = Number.parseInt(match?.[1] ?? "", 10);
  const away = Number.parseInt(match?.[2] ?? "", 10);
  return Number.isFinite(home) && Number.isFinite(away)
    ? makeScore(home, away)
    : null;
};

const participantRole = (
  participant: Readonly<MatchInsightParticipantSource>,
): string => participant.role?.trim().toLowerCase() ?? "";

const makeParticipant = (
  participant: Readonly<MatchInsightParticipantSource>,
) =>
  MatchInsightParticipant.make({
    id: participant.id,
    number: participant.number,
    name: participant.name,
    team: participant.team,
  });

const makeAnomaly = (
  code: MatchInsightAnomalyCode,
  play: MatchInsightPlaySource | null,
  sourceIndex: number | null,
  detail: string,
): MatchInsightAnomaly =>
  MatchInsightAnomaly.make({
    code,
    sourceIndex,
    period: play?.period ?? null,
    clock: play?.time ?? null,
    detail,
  });

const isConfirmedFinalStatus = (status: string): boolean =>
  confirmedFinalStatuses.has(status.toUpperCase());

const scoreConsistencyFor = (
  game: Readonly<MatchInsightGameSource>,
  score: MatchInsightScore,
): MatchInsightScoreConsistency => {
  if (game.home.score === null || game.away.score === null)
    return "not-checkable";
  return game.home.score === score.home && game.away.score === score.away
    ? "consistent"
    : "inconsistent";
};

const completenessFor = (
  game: Readonly<MatchInsightGameSource>,
  scoreConsistency: MatchInsightScoreConsistency,
  periodScoreConsistency: MatchInsightScoreConsistency,
  scoreFlowValid: boolean,
  hasStartGame: boolean,
  hasTerminalEndGame: boolean,
  periodEndsValid: boolean,
  terminalClockValid: boolean,
): MatchInsightCompleteness => {
  if (isConfirmedFinalStatus(game.status))
    return scoreConsistency === "consistent" &&
      periodScoreConsistency === "consistent" &&
      scoreFlowValid &&
      hasStartGame &&
      hasTerminalEndGame &&
      periodEndsValid &&
      terminalClockValid
      ? "final-reconciled"
      : "final-unreconciled";
  if (isFinalGameStatus(game.status)) return "provisional-final";
  if (game.plays.length > 0) return "live";
  return isUpcomingGameStatus(game.status) ? "upcoming" : "unavailable";
};

const gameWinningGoalSequence = (
  goals: readonly GoalDraft[],
  winner: MatchInsightSide | null,
): number | null => {
  if (winner === null) return null;
  for (const [index, goal] of goals.entries()) {
    if (leaderOf(goal.score) !== winner) continue;
    const stayedAhead = goals
      .slice(index + 1)
      .every((later) => leaderOf(later.score) === winner);
    if (stayedAhead) return goal.sequence;
  }
  return null;
};

const buildPeriods = (
  plays: readonly MatchInsightPlaySource[],
  goals: readonly GoalDraft[],
): readonly MatchInsightPeriod[] => {
  const periods = [...new Set(plays.map((play) => play.period))];
  let cumulative = makeScore(0, 0);
  return periods.map((period) => {
    const periodGoals = goals.filter((goal) => goal.period === period);
    const homeGoals = periodGoals.filter((goal) => goal.side === "home").length;
    const awayGoals = periodGoals.length - homeGoals;
    const scoreBefore = cumulative;
    cumulative = makeScore(
      cumulative.home + homeGoals,
      cumulative.away + awayGoals,
    );
    const winner: MatchInsightSide | null =
      homeGoals === awayGoals ? null : homeGoals > awayGoals ? "home" : "away";
    return MatchInsightPeriod.make({
      period,
      homeGoals,
      awayGoals,
      winner,
      scoreBefore,
      score: cumulative,
    });
  });
};

const sourcePeriodKey = (period: string): string =>
  period.replace(/^Quarter\s+(\d+)$/iu, "Q$1");

const parsePeriodScore = (value: string | undefined): number | null => {
  if (!/^\d+$/u.test(value ?? "")) return null;
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const periodScoreConsistencyFor = (
  game: Readonly<MatchInsightGameSource>,
  periods: readonly MatchInsightPeriod[],
): MatchInsightScoreConsistency => {
  const home = game.periodScores.find(
    (row: Readonly<MatchInsightPeriodScoreSource>) =>
      row.team === game.home.name,
  );
  const away = game.periodScores.find(
    (row: Readonly<MatchInsightPeriodScoreSource>) =>
      row.team === game.away.name,
  );
  if (!home || !away) return "not-checkable";

  const sourceKeys = new Set(
    [...Object.keys(home.scores), ...Object.keys(away.scores)].filter(
      (key) => key !== "SCORE",
    ),
  );
  if (
    isConfirmedFinalStatus(game.status) &&
    !["Q1", "Q2", "Q3", "Q4"].every((key) => sourceKeys.has(key))
  )
    return "inconsistent";

  const derivedKeys = new Set<string>();
  for (const period of periods) {
    const key = sourcePeriodKey(period.period);
    derivedKeys.add(key);
    if (!sourceKeys.has(key)) return "inconsistent";
    if (
      parsePeriodScore(home.scores[key]) !== period.homeGoals ||
      parsePeriodScore(away.scores[key]) !== period.awayGoals
    )
      return "inconsistent";
  }
  if (
    isConfirmedFinalStatus(game.status) &&
    !["Q1", "Q2", "Q3", "Q4"].every((key) => derivedKeys.has(key))
  )
    return "inconsistent";
  for (const key of sourceKeys) {
    if (derivedKeys.has(key)) continue;
    if (
      !/^OT\d+$/u.test(key) ||
      parsePeriodScore(home.scores[key]) !== 0 ||
      parsePeriodScore(away.scores[key]) !== 0
    )
      return "inconsistent";
  }
  return "consistent";
};

const buildScoringRuns = (
  goals: readonly GoalDraft[],
  windows: readonly MatchPeriodWindow[] | null,
): readonly MatchInsightScoringRun[] => {
  const runs: ScoringRunDraft[] = [];
  for (const goal of goals) {
    const current = runs.at(-1);
    if (current?.side === goal.side) {
      current.goals += 1;
      current.endSequence = goal.sequence;
      current.endPeriod = goal.period;
      current.endClock = goal.clock;
      current.score = goal.score;
      continue;
    }
    runs.push({
      side: goal.side,
      team: goal.team,
      goals: 1,
      startSequence: goal.sequence,
      endSequence: goal.sequence,
      startPeriod: goal.period,
      startClock: goal.clock,
      endPeriod: goal.period,
      endClock: goal.clock,
      scoreBefore: goal.scoreBefore,
      score: goal.score,
    });
  }
  return runs.map((run: Readonly<ScoringRunDraft>) => {
    const start =
      windows === null
        ? null
        : matchElapsedSeconds(windows, run.startPeriod, run.startClock);
    const end =
      windows === null
        ? null
        : matchElapsedSeconds(windows, run.endPeriod, run.endClock);
    return MatchInsightScoringRun.make({
      ...run,
      durationSeconds:
        start === null || end === null || end < start ? null : end - start,
    });
  });
};

const buildContributors = (
  goals: readonly GoalDraft[],
): readonly MatchInsightScoringContributor[] => {
  const contributors = new Map<string, ContributorDraft>();
  const getContributor = (
    participant: MatchInsightParticipant,
    side: MatchInsightSide,
  ): ContributorDraft => {
    const key = participant.id ?? `${participant.team}:${participant.name}`;
    const current = contributors.get(key);
    if (current) return current;
    const created: ContributorDraft = {
      id: participant.id,
      number: participant.number,
      name: participant.name,
      team: participant.team,
      side,
      goals: 0,
      recordedAssists: 0,
      freePositionGoals: 0,
      goalsWithoutRecordedAssist: 0,
      goalInvolvements: 0,
      equalizingGoals: 0,
      goAheadGoals: 0,
      responseGoals: 0,
      fourthQuarterGoals: 0,
    };
    contributors.set(key, created);
    return created;
  };

  for (const [index, goal] of goals.entries()) {
    const response = index > 0 && goals[index - 1]?.side !== goal.side;
    if (goal.scorer) {
      const scorer = getContributor(goal.scorer, goal.side);
      scorer.goals += 1;
      scorer.goalInvolvements += 1;
      if (goal.freePosition) scorer.freePositionGoals += 1;
      if (goal.recordedAssist === null) scorer.goalsWithoutRecordedAssist += 1;
      if (goal.equalizer) scorer.equalizingGoals += 1;
      if (goal.goAhead) scorer.goAheadGoals += 1;
      if (response) scorer.responseGoals += 1;
      if (goal.period === "Quarter 4") scorer.fourthQuarterGoals += 1;
    }
    if (goal.recordedAssist) {
      const assister = getContributor(goal.recordedAssist, goal.side);
      assister.recordedAssists += 1;
      assister.goalInvolvements += 1;
    }
  }

  return [...contributors.values()]
    .toSorted(
      (left: Readonly<ContributorDraft>, right: Readonly<ContributorDraft>) =>
        right.goals +
          right.recordedAssists -
          (left.goals + left.recordedAssists) ||
        right.goals - left.goals ||
        right.recordedAssists - left.recordedAssists ||
        left.name.localeCompare(right.name),
    )
    .map((contributor: Readonly<ContributorDraft>) => {
      const teamGoals = goals.filter(
        (goal) => goal.side === contributor.side,
      ).length;
      return MatchInsightScoringContributor.make({
        ...contributor,
        points: contributor.goals + contributor.recordedAssists,
        goalInvolvementShare:
          teamGoals === 0 ? 0 : contributor.goalInvolvements / teamGoals,
      });
    });
};

const sideForPlay = (
  play: Readonly<MatchInsightPlaySource>,
  game: Readonly<MatchInsightGameSource>,
): MatchInsightSide | null => {
  const cellSide: MatchInsightSide | null =
    play.home.length > 0 && play.away.length === 0
      ? "home"
      : play.away.length > 0 && play.home.length === 0
        ? "away"
        : null;
  const participantSides = new Set(
    play.participants.flatMap((participant) => {
      if (participant.team === game.home.name) return ["home" as const];
      if (participant.team === game.away.name) return ["away" as const];
      return [];
    }),
  );
  const participantSide =
    participantSides.size !== 1
      ? null
      : participantSides.has("home")
        ? "home"
        : "away";
  if (
    cellSide !== null &&
    participantSide !== null &&
    cellSide !== participantSide
  )
    return null;
  return cellSide ?? participantSide;
};

const wholeNumber = (value: string | undefined): number | null => {
  if (!/^\d+$/u.test(value ?? "")) return null;
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const leadingNumber = (value: string | undefined): number | null => {
  const match = value?.match(/^(\d+)(?:\s*\/|$)/u);
  const parsed = Number.parseInt(match?.[1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const ratio = (numerator: number | null, denominator: number | null) =>
  numerator === null || denominator === null || denominator === 0
    ? null
    : numerator / denominator;

const timedGoals = (
  goals: readonly GoalDraft[],
  windows: readonly MatchPeriodWindow[],
): readonly { readonly goal: GoalDraft; readonly elapsed: number }[] | null => {
  const timed: { goal: GoalDraft; elapsed: number }[] = [];
  let previousElapsed = -1;
  for (const goal of goals) {
    const elapsed = matchElapsedSeconds(windows, goal.period, goal.clock);
    if (elapsed === null || elapsed < previousElapsed) return null;
    timed.push({ goal, elapsed });
    previousElapsed = elapsed;
  }
  return timed;
};

const buildGameStateTime = (
  game: Readonly<MatchInsightGameSource>,
  goals: readonly GoalDraft[],
  windows: readonly MatchPeriodWindow[] | null,
  completeness: MatchInsightCompleteness,
  scoreFlowValid: boolean,
  goalClockFlowValid: boolean,
  periodEndsValid: boolean,
  terminalClockValid: boolean,
): MatchInsightGameStateTime | null => {
  if (
    !scoreFlowValid ||
    !goalClockFlowValid ||
    !periodEndsValid ||
    (isFinalGameStatus(game.status) && !terminalClockValid) ||
    windows === null
  )
    return null;
  const timed = timedGoals(goals, windows);
  if (timed === null) return null;

  const terminal = game.plays.at(-1);
  const ended = terminal?.action === "END Game";
  const endpointPlay = ended
    ? terminal
    : game.plays.findLast(
        (play) => matchElapsedSeconds(windows, play.period, play.time) !== null,
      );
  if (!endpointPlay) return null;
  const endpoint = matchElapsedSeconds(
    windows,
    endpointPlay.period,
    endpointPlay.time,
  );
  const finalGoalElapsed = timed.at(-1)?.elapsed ?? 0;
  if (endpoint === null || endpoint < finalGoalElapsed) return null;

  let homeLeadingSeconds = 0;
  let tiedSeconds = 0;
  let awayLeadingSeconds = 0;
  let oneGoalMarginSeconds = 0;
  let twoGoalMarginSeconds = 0;
  let threePlusMarginSeconds = 0;
  let previousElapsed = 0;
  let score = makeScore(0, 0);
  const addInterval = (seconds: number) => {
    const leader = leaderOf(score);
    if (leader === "home") homeLeadingSeconds += seconds;
    else if (leader === "away") awayLeadingSeconds += seconds;
    else tiedSeconds += seconds;

    const margin = Math.abs(score.home - score.away);
    if (margin === 1) oneGoalMarginSeconds += seconds;
    else if (margin === 2) twoGoalMarginSeconds += seconds;
    else if (margin >= 3) threePlusMarginSeconds += seconds;
  };

  for (const timedGoal of timed) {
    addInterval(timedGoal.elapsed - previousElapsed);
    previousElapsed = timedGoal.elapsed;
    score = timedGoal.goal.score;
  }
  addInterval(endpoint - previousElapsed);

  return MatchInsightGameStateTime.make({
    complete:
      ended &&
      ["final-reconciled", "final-unreconciled", "provisional-final"].includes(
        completeness,
      ),
    observedSeconds: endpoint,
    homeLeadingSeconds,
    tiedSeconds,
    awayLeadingSeconds,
    oneGoalMarginSeconds,
    twoGoalMarginSeconds,
    threePlusMarginSeconds,
    endpointPeriod: endpointPlay.period,
    endpointClock: endpointPlay.time,
  });
};

const buildTeamShapes = (
  game: Readonly<MatchInsightGameSource>,
  goals: readonly GoalDraft[],
  runs: readonly MatchInsightScoringRun[],
  windows: readonly MatchPeriodWindow[] | null,
  gameStateTime: MatchInsightGameStateTime | null,
  terminalOvertimeGoalSequence: number | null,
  wentToOvertime: boolean,
): readonly MatchInsightTeamShape[] => {
  const timed = windows === null ? null : timedGoals(goals, windows);
  return (["home", "away"] as const).map((side) => {
    const longestRunGoals = runs
      .filter((run) => run.side === side)
      .reduce((longest, run) => Math.max(longest, run.goals), 0);
    let longestDroughtSeconds: number | null = null;
    let longestDroughtGoalsConceded: number | null = null;
    if (gameStateTime && timed) {
      const boundaries = [
        { elapsed: 0, sequence: 0 },
        ...timed
          .filter((entry) => entry.goal.side === side)
          .map((entry) => ({
            elapsed: entry.elapsed,
            sequence: entry.goal.sequence,
          })),
        {
          elapsed: gameStateTime.observedSeconds,
          sequence: goals.length + 1,
        },
      ];
      let droughtStartSequence = 0;
      let droughtEndSequence = 0;
      longestDroughtSeconds = 0;
      for (const [index, boundary] of boundaries.slice(1).entries()) {
        const start = boundaries[index];
        if (!start) continue;
        const duration = boundary.elapsed - start.elapsed;
        if (duration <= longestDroughtSeconds) continue;
        longestDroughtSeconds = duration;
        droughtStartSequence = start.sequence;
        droughtEndSequence = boundary.sequence;
      }
      longestDroughtGoalsConceded = goals.filter(
        (goal) =>
          goal.side !== side &&
          goal.sequence > droughtStartSequence &&
          goal.sequence < droughtEndSequence,
      ).length;
    }
    const responseEntries =
      timed?.filter(
        (entry, index) =>
          entry.goal.side === side &&
          index > 0 &&
          timed[index - 1]?.goal.side !== side,
      ) ?? null;
    const responseDurations =
      responseEntries?.flatMap((entry) => {
        const index = timed?.indexOf(entry) ?? -1;
        const previous = index > 0 ? timed?.[index - 1] : undefined;
        return previous ? [entry.elapsed - previous.elapsed] : [];
      }) ?? null;
    const responseGoals = responseEntries?.length ?? 0;
    const opposingSide: MatchInsightSide = side === "home" ? "away" : "home";
    const responseOpportunities = goals.filter(
      (goal) =>
        goal.side === opposingSide &&
        !(
          wentToOvertime &&
          terminalOvertimeGoalSequence !== null &&
          goal.sequence === terminalOvertimeGoalSequence
        ),
    ).length;
    return MatchInsightTeamShape.make({
      side,
      team: side === "home" ? game.home.name : game.away.name,
      longestRunGoals,
      longestDroughtSeconds,
      longestDroughtGoalsConceded,
      responseGoals,
      responseOpportunities,
      fastestResponseSeconds:
        responseDurations === null || responseDurations.length === 0
          ? null
          : Math.min(...responseDurations),
      averageResponseSeconds:
        responseDurations === null || responseDurations.length === 0
          ? null
          : responseDurations.reduce((total, duration) => total + duration, 0) /
            responseDurations.length,
    });
  });
};

const buildFastestScoringBursts = (
  game: Readonly<MatchInsightGameSource>,
  goals: readonly GoalDraft[],
  runs: readonly MatchInsightScoringRun[],
  windows: readonly MatchPeriodWindow[] | null,
): readonly MatchInsightScoringBurst[] => {
  if (windows === null || timedGoals(goals, windows) === null) return [];
  const bursts: MatchInsightScoringBurst[] = [];
  for (const side of ["home", "away"] as const) {
    for (const target of [2, 3, 4] as const) {
      let fastest:
        | {
            readonly start: GoalDraft;
            readonly end: GoalDraft;
            readonly durationSeconds: number;
          }
        | undefined;
      for (const run of runs.filter(
        (candidate) => candidate.side === side && candidate.goals >= target,
      )) {
        const runGoals = goals.filter(
          (goal) =>
            goal.sequence >= run.startSequence &&
            goal.sequence <= run.endSequence,
        );
        for (let index = 0; index <= runGoals.length - target; index += 1) {
          const start = runGoals[index];
          const end = runGoals[index + target - 1];
          if (!start || !end) continue;
          const startElapsed = matchElapsedSeconds(
            windows,
            start.period,
            start.clock,
          );
          const endElapsed = matchElapsedSeconds(
            windows,
            end.period,
            end.clock,
          );
          if (
            startElapsed === null ||
            endElapsed === null ||
            endElapsed < startElapsed
          )
            continue;
          const durationSeconds = endElapsed - startElapsed;
          if (!fastest || durationSeconds < fastest.durationSeconds)
            fastest = { start, end, durationSeconds };
        }
      }
      if (!fastest) continue;
      bursts.push(
        MatchInsightScoringBurst.make({
          side,
          team: side === "home" ? game.home.name : game.away.name,
          goals: target,
          durationSeconds: fastest.durationSeconds,
          startSequence: fastest.start.sequence,
          endSequence: fastest.end.sequence,
          startPeriod: fastest.start.period,
          startClock: fastest.start.clock,
          endPeriod: fastest.end.period,
          endClock: fastest.end.clock,
        }),
      );
    }
  }
  return bursts;
};

const segmentForPeriod = (period: string): MatchInsightSegmentName | null => {
  if (period === "Quarter 1" || period === "Quarter 2") return "first-half";
  if (period === "Quarter 3" || period === "Quarter 4") return "second-half";
  return /^(?:OT|Overtime)/iu.test(period) ? "overtime" : null;
};

const buildScoringSegments = (
  periods: readonly MatchInsightPeriod[],
): readonly MatchInsightScoringSegment[] => {
  const names: readonly MatchInsightSegmentName[] = [
    "first-half",
    "second-half",
    "overtime",
  ];
  return names.flatMap((segment) => {
    const included = periods.filter(
      (period) => segmentForPeriod(period.period) === segment,
    );
    if (included.length === 0) return [];
    const homeGoals = included.reduce(
      (total, period) => total + period.homeGoals,
      0,
    );
    const awayGoals = included.reduce(
      (total, period) => total + period.awayGoals,
      0,
    );
    const winner: MatchInsightSide | null =
      homeGoals === awayGoals ? null : homeGoals > awayGoals ? "home" : "away";
    return [
      MatchInsightScoringSegment.make({
        segment,
        homeGoals,
        awayGoals,
        winner,
      }),
    ];
  });
};

const buildClosing = (
  game: Readonly<MatchInsightGameSource>,
  goals: readonly GoalDraft[],
): readonly MatchInsightTeamClosing[] =>
  (["home", "away"] as const).map((side) => {
    const sideGoals = goals.filter((goal) => goal.side === side);
    const fourthQuarterGoals = sideGoals.filter(
      (goal) => goal.period === "Quarter 4",
    );
    const fourthQuarterClocksValid = fourthQuarterGoals.every((goal) => {
      const clock = parseMatchClock(goal.clock);
      return clock !== null && clock <= 15 * 60;
    });
    return MatchInsightTeamClosing.make({
      side,
      team: side === "home" ? game.home.name : game.away.name,
      fourthQuarterGoals: fourthQuarterGoals.length,
      finalFiveMinuteGoals: fourthQuarterClocksValid
        ? fourthQuarterGoals.filter(
            (goal) => (parseMatchClock(goal.clock) ?? 15 * 60 + 1) <= 5 * 60,
          ).length
        : null,
      overtimeGoals: sideGoals.filter((goal) =>
        /^(?:OT|Overtime)/iu.test(goal.period),
      ).length,
      goalsWhileTied: sideGoals.filter(
        (goal) => leaderOf(goal.scoreBefore) === null,
      ).length,
      goalsWhileTrailing: sideGoals.filter(
        (goal) =>
          leaderOf(goal.scoreBefore) !== null &&
          leaderOf(goal.scoreBefore) !== side,
      ).length,
      equalizingGoals: sideGoals.filter((goal) => goal.equalizer).length,
      goAheadGoals: sideGoals.filter((goal) => goal.goAhead).length,
    });
  });

const buildScoringCombinations = (
  goals: readonly GoalDraft[],
): readonly MatchInsightScoringCombination[] => {
  const combinations = new Map<
    string,
    {
      readonly side: MatchInsightSide;
      readonly team: string;
      readonly scorer: MatchInsightParticipant;
      readonly recordedAssist: MatchInsightParticipant;
      goals: number;
    }
  >();
  for (const goal of goals) {
    if (!goal.scorer || !goal.recordedAssist) continue;
    const scorerKey =
      goal.scorer.id ?? `${goal.scorer.team}:${goal.scorer.name}`;
    const assistKey =
      goal.recordedAssist.id ??
      `${goal.recordedAssist.team}:${goal.recordedAssist.name}`;
    const key = `${scorerKey}:${assistKey}`;
    const current = combinations.get(key);
    if (current) current.goals += 1;
    else
      combinations.set(key, {
        side: goal.side,
        team: goal.team,
        scorer: goal.scorer,
        recordedAssist: goal.recordedAssist,
        goals: 1,
      });
  }
  return [...combinations.values()]
    .toSorted(
      (left, right) =>
        right.goals - left.goals ||
        left.scorer.name.localeCompare(right.scorer.name) ||
        left.recordedAssist.name.localeCompare(right.recordedAssist.name),
    )
    .map((combination) => MatchInsightScoringCombination.make(combination));
};

const buildScoringProfiles = (
  game: Readonly<MatchInsightGameSource>,
  goals: readonly GoalDraft[],
  contributors: readonly MatchInsightScoringContributor[],
  trustedSourceEndExclusive: number,
): {
  readonly profiles: readonly MatchInsightTeamScoringProfile[];
  readonly unattributedFreePositionAttempts: number;
} => {
  const attempts: Record<MatchInsightSide, number> = { home: 0, away: 0 };
  let unattributedFreePositionAttempts = 0;
  const goalSideBySource = new Map(
    goals.map((goal) => [goal.sourceIndex, goal.side] as const),
  );
  const attemptActions = new Set([
    "Free Position Goal",
    "Free Position Shot missed",
    "Free Position Shot saved",
  ]);
  for (const [sourceIndex, play] of game.plays.entries()) {
    if (sourceIndex >= trustedSourceEndExclusive) break;
    if (!attemptActions.has(play.action)) continue;
    const side = goalSideBySource.get(sourceIndex) ?? sideForPlay(play, game);
    if (side === undefined || side === null)
      unattributedFreePositionAttempts += 1;
    else attempts[side] += 1;
  }

  const profiles = (["home", "away"] as const).map((side) => {
    const sideGoals = goals.filter((goal) => goal.side === side);
    const scorers = contributors.filter(
      (contributor) => contributor.side === side && contributor.goals > 0,
    );
    const topScorerGoals = scorers.reduce(
      (most, scorer) => Math.max(most, scorer.goals),
      0,
    );
    const topScorers = scorers
      .filter((scorer) => scorer.goals === topScorerGoals)
      .map((scorer) =>
        MatchInsightParticipant.make({
          id: scorer.id,
          number: scorer.number,
          name: scorer.name,
          team: scorer.team,
        }),
      );
    const recordedAssistedGoals = sideGoals.filter(
      (goal) => goal.recordedAssist !== null,
    ).length;
    const freePositionGoals = sideGoals.filter(
      (goal) => goal.freePosition,
    ).length;
    return MatchInsightTeamScoringProfile.make({
      side,
      team: side === "home" ? game.home.name : game.away.name,
      goals: sideGoals.length,
      knownScorerGoals: sideGoals.filter((goal) => goal.scorer !== null).length,
      uniqueRecordedScorers: scorers.length,
      topScorers,
      topScorerGoals,
      topScorerShare: ratio(topScorerGoals, sideGoals.length),
      recordedAssistedGoals,
      recordedAssistRate: ratio(recordedAssistedGoals, sideGoals.length),
      freePositionGoals,
      freePositionAttempts: attempts[side],
      freePositionConversion: ratio(freePositionGoals, attempts[side]),
    });
  });
  return { profiles, unattributedFreePositionAttempts };
};

const buildShotAndEventProfiles = (
  game: Readonly<MatchInsightGameSource>,
  goals: readonly GoalDraft[],
  trustedSourceEndExclusive: number,
): {
  readonly shotSplits: readonly MatchInsightTeamShotSplit[];
  readonly eventProfiles: readonly MatchInsightTeamEventProfile[];
  readonly unattributedShotEvents: number;
  readonly unattributedShotSourceIndexes: readonly number[];
  readonly unattributedOvertimeSourceIndexes: readonly number[];
} => {
  interface ShotDraft {
    shots: number;
    shotsOnGoal: number;
    goals: number;
    saves: number;
    saveOpportunities: number;
  }
  interface EventDraft {
    closeGameShots: number;
    closeGameShotsOnGoal: number;
    closeGameGoals: number;
    longestSaveRun: number;
    overtimeTurnovers: number;
    overtimeDrawControls: number;
    overtimeGroundBalls: number;
  }

  const segments = ["first-half", "second-half", "overtime"] as const;
  const presentSegments = new Set(
    game.plays.slice(0, trustedSourceEndExclusive).flatMap((play) => {
      const segment = segmentForPeriod(play.period);
      return segment === null ? [] : [segment];
    }),
  );
  const shotDrafts = new Map<string, ShotDraft>();
  const getShotDraft = (
    segment: MatchInsightSegmentName,
    side: MatchInsightSide,
  ): ShotDraft => {
    const key = `${segment}:${side}`;
    const current = shotDrafts.get(key);
    if (current) return current;
    const created: ShotDraft = {
      shots: 0,
      shotsOnGoal: 0,
      goals: 0,
      saves: 0,
      saveOpportunities: 0,
    };
    shotDrafts.set(key, created);
    return created;
  };
  const eventDrafts: Record<MatchInsightSide, EventDraft> = {
    home: {
      closeGameShots: 0,
      closeGameShotsOnGoal: 0,
      closeGameGoals: 0,
      longestSaveRun: 0,
      overtimeTurnovers: 0,
      overtimeDrawControls: 0,
      overtimeGroundBalls: 0,
    },
    away: {
      closeGameShots: 0,
      closeGameShotsOnGoal: 0,
      closeGameGoals: 0,
      longestSaveRun: 0,
      overtimeTurnovers: 0,
      overtimeDrawControls: 0,
      overtimeGroundBalls: 0,
    },
  };
  const currentSaveRun: Record<MatchInsightSide, number> = { home: 0, away: 0 };
  const goalBySource = new Map(
    goals.map((goal) => [goal.sourceIndex, goal] as const),
  );
  let currentScore = makeScore(0, 0);
  const unattributedShotSourceIndexes: number[] = [];
  const unattributedOvertimeSourceIndexes: number[] = [];
  const incompleteShotSegments = new Set<MatchInsightSegmentName>();

  for (const [sourceIndex, play] of game.plays.entries()) {
    if (sourceIndex >= trustedSourceEndExclusive) break;
    const segment = segmentForPeriod(play.period);
    const goal = goalBySource.get(sourceIndex);
    const side = goal?.side ?? sideForPlay(play, game);
    const closeGame = Math.abs(currentScore.home - currentScore.away) <= 1;

    if (shotActions.has(play.action) && segment !== null) {
      if (side === null) {
        unattributedShotSourceIndexes.push(sourceIndex);
        incompleteShotSegments.add(segment);
      } else {
        const attack = getShotDraft(segment, side);
        attack.shots += 1;
        if (shotOnGoalActions.has(play.action)) {
          attack.shotsOnGoal += 1;
          const defense: MatchInsightSide = side === "home" ? "away" : "home";
          const defending = getShotDraft(segment, defense);
          defending.saveOpportunities += 1;
          if (saveActions.has(play.action)) {
            defending.saves += 1;
            currentSaveRun[defense] += 1;
            eventDrafts[defense].longestSaveRun = Math.max(
              eventDrafts[defense].longestSaveRun,
              currentSaveRun[defense],
            );
          } else currentSaveRun[defense] = 0;
        }
        if (goalActions.has(play.action)) attack.goals += 1;
        if (closeGame) {
          eventDrafts[side].closeGameShots += 1;
          if (shotOnGoalActions.has(play.action))
            eventDrafts[side].closeGameShotsOnGoal += 1;
          if (goalActions.has(play.action))
            eventDrafts[side].closeGameGoals += 1;
        }
      }
    }

    const trackedOvertimeEvent =
      segment === "overtime" &&
      ["Turnover", "Draw Control won", "Ground Ball"].includes(play.action);
    if (trackedOvertimeEvent) {
      if (side === null) unattributedOvertimeSourceIndexes.push(sourceIndex);
      else if (play.action === "Turnover")
        eventDrafts[side].overtimeTurnovers += 1;
      else if (play.action === "Draw Control won")
        eventDrafts[side].overtimeDrawControls += 1;
      else eventDrafts[side].overtimeGroundBalls += 1;
    }
    if (goal) currentScore = goal.score;
  }

  return {
    shotSplits: segments.flatMap((segment) =>
      presentSegments.has(segment)
        ? (["home", "away"] as const).map((side) => {
            const draft = getShotDraft(segment, side);
            return MatchInsightTeamShotSplit.make({
              side,
              team: side === "home" ? game.home.name : game.away.name,
              segment,
              attributionComplete: !incompleteShotSegments.has(segment),
              ...draft,
              shotAccuracy: ratio(draft.shotsOnGoal, draft.shots),
              savePercentage: ratio(draft.saves, draft.saveOpportunities),
            });
          })
        : [],
    ),
    eventProfiles: (["home", "away"] as const).map((side) =>
      MatchInsightTeamEventProfile.make({
        side,
        team: side === "home" ? game.home.name : game.away.name,
        ...eventDrafts[side],
        overtimeAttributionComplete:
          unattributedOvertimeSourceIndexes.length === 0,
      }),
    ),
    unattributedShotEvents: unattributedShotSourceIndexes.length,
    unattributedShotSourceIndexes,
    unattributedOvertimeSourceIndexes,
  };
};

const buildTeamPerformance = (
  game: Readonly<MatchInsightGameSource>,
): readonly MatchInsightTeamPerformance[] =>
  (["home", "away"] as const).map((side) => {
    const team = side === "home" ? game.home.name : game.away.name;
    const stats = game.teamStats.find((row) => row.team === team)?.stats;
    const shots = wholeNumber(stats?.["Total Shots"]);
    const shotsOnGoal = wholeNumber(stats?.["Shots on Goal"]);
    const goals = wholeNumber(stats?.Goals);
    const saves = leadingNumber(stats?.Saves);
    const saveChances = (() => {
      const match = stats?.Saves?.match(/^\d+\s*\/\s*(\d+)/u);
      const parsed = Number.parseInt(match?.[1] ?? "", 10);
      return Number.isFinite(parsed) ? parsed : null;
    })();
    return MatchInsightTeamPerformance.make({
      side,
      team,
      shots,
      shotsOnGoal,
      shotAccuracy: ratio(shotsOnGoal, shots),
      shootingPercentage: ratio(goals, shots),
      saves,
      savePercentage: ratio(saves, saveChances),
      drawControls: leadingNumber(stats?.["Draw Controls"]),
      groundBalls: wholeNumber(stats?.["Ground Balls"]),
      causedTurnovers: wholeNumber(stats?.["Caused Turnovers"]),
      turnovers: wholeNumber(stats?.Turnovers),
    });
  });

const buildDiscipline = (
  game: Readonly<MatchInsightGameSource>,
): {
  readonly discipline: readonly MatchInsightTeamDiscipline[];
  readonly unattributedCardEvents: number;
} => {
  const drafts: Record<
    MatchInsightSide,
    {
      cardEvents: number;
      yellowCards: number;
      yellowRedCards: number;
      redCards: number;
      recordedPenaltyMinutes: number;
    }
  > = {
    home: {
      cardEvents: 0,
      yellowCards: 0,
      yellowRedCards: 0,
      redCards: 0,
      recordedPenaltyMinutes: 0,
    },
    away: {
      cardEvents: 0,
      yellowCards: 0,
      yellowRedCards: 0,
      redCards: 0,
      recordedPenaltyMinutes: 0,
    },
  };
  let unattributedCardEvents = 0;
  for (const play of game.plays) {
    const match = play.action.match(
      /^(Yellow Card|Yellow-Red Card|Red Card)\s*\((\d+)\s*min\)/u,
    );
    if (!match) continue;
    const side = sideForPlay(play, game);
    if (side === null) {
      unattributedCardEvents += 1;
      continue;
    }
    const minutes = Number.parseInt(match[2] ?? "", 10);
    const draft = drafts[side];
    draft.cardEvents += 1;
    if (match[1] === "Yellow Card") draft.yellowCards += 1;
    else if (match[1] === "Yellow-Red Card") draft.yellowRedCards += 1;
    else draft.redCards += 1;
    if (Number.isFinite(minutes)) draft.recordedPenaltyMinutes += minutes;
  }
  return {
    discipline: (["home", "away"] as const).map((side) =>
      MatchInsightTeamDiscipline.make({
        side,
        team: side === "home" ? game.home.name : game.away.name,
        ...drafts[side],
      }),
    ),
    unattributedCardEvents,
  };
};

export const buildMatchInsights = (
  game: Readonly<MatchInsightGameSource>,
): MatchInsights => {
  const anomalies: MatchInsightAnomaly[] = [];
  const lastClockByPeriod = new Map<string, number>();
  const periodsWithStartClock = new Set<string>();
  let periodStartsValid = true;

  for (const [sourceIndex, play] of game.plays.entries()) {
    const clock = parseMatchClock(play.time);
    if (clock === null) {
      anomalies.push(
        makeAnomaly(
          "malformed-clock",
          play,
          sourceIndex,
          `Clock is not a valid countdown value: ${play.time}`,
        ),
      );
      continue;
    }

    const periodDuration = matchPeriodDuration(play.period);
    const isPeriodStart =
      play.action === "START Game" || play.action === "START Period";
    if (isPeriodStart) {
      periodsWithStartClock.add(play.period);
      if (periodDuration !== null && clock !== periodDuration) {
        periodStartsValid = false;
        anomalies.push(
          makeAnomaly(
            "period-start-clock-mismatch",
            play,
            sourceIndex,
            `${play.period} should start at ${formatMatchClock(periodDuration)}; the source lists ${play.time}`,
          ),
        );
      }
      lastClockByPeriod.set(play.period, periodDuration ?? clock);
      continue;
    }

    if (play.action === "Starting Goalkeeper") continue;
    if (periodDuration !== null && clock > periodDuration) {
      anomalies.push(
        makeAnomaly(
          "period-clock-out-of-range",
          play,
          sourceIndex,
          `${play.period} is ${formatMatchClock(periodDuration)} long; the source lists ${play.time}`,
        ),
      );
      continue;
    }

    const previousClock = lastClockByPeriod.get(play.period);
    if (previousClock !== undefined && clock > previousClock)
      anomalies.push(
        makeAnomaly(
          "non-monotonic-clock",
          play,
          sourceIndex,
          `Source clock moved from ${formatMatchClock(previousClock)} to ${play.time} within ${play.period}`,
        ),
      );
    lastClockByPeriod.set(play.period, clock);
  }

  const playPeriods = [...new Set(game.plays.map((play) => play.period))];
  for (const period of playPeriods) {
    const duration = matchPeriodDuration(period);
    if (duration === null || periodsWithStartClock.has(period)) continue;
    periodStartsValid = false;
    anomalies.push(
      makeAnomaly(
        "period-start-clock-mismatch",
        null,
        null,
        `${period} has no start-clock event; expected ${formatMatchClock(duration)}`,
      ),
    );
  }
  const clockWindows = buildMatchPeriodWindows(playPeriods);
  if (clockWindows === null && playPeriods.length > 0)
    anomalies.push(
      makeAnomaly(
        "period-sequence-invalid",
        null,
        null,
        `Time-based insights require contiguous periods from Quarter 1; source order is ${playPeriods.join(", ")}`,
      ),
    );
  const goals: GoalDraft[] = [];
  let goalClockFlowValid = clockWindows !== null;
  let lastGoalElapsed = -1;
  let observedScore = makeScore(0, 0);
  let ignoredGoalCount = 0;
  let trustedSourceEndExclusive = game.plays.length;
  let scoreFlowValid = true;
  let leadChanges = 0;
  let timesTied = 0;
  let lastNonTiedLeader: MatchInsightSide | null = null;
  const largestLeads: Record<MatchInsightSide, LargestLeadDraft> = {
    home: {
      side: "home",
      team: game.home.name,
      goals: 0,
      goalSequence: null,
      period: null,
      clock: null,
      score: makeScore(0, 0),
    },
    away: {
      side: "away",
      team: game.away.name,
      goals: 0,
      goalSequence: null,
      period: null,
      clock: null,
      score: makeScore(0, 0),
    },
  };

  for (const [sourceIndex, play] of game.plays.entries()) {
    if (!goalActions.has(play.action)) continue;
    const parsedScore = parseScore(play.result);
    if (parsedScore === null) {
      scoreFlowValid = false;
      trustedSourceEndExclusive = sourceIndex;
      ignoredGoalCount +=
        1 +
        game.plays
          .slice(sourceIndex + 1)
          .filter((later) => goalActions.has(later.action)).length;
      anomalies.push(
        makeAnomaly(
          "malformed-score",
          play,
          sourceIndex,
          `Goal result is not a score: ${play.result}`,
        ),
      );
      break;
    }

    const scoreBefore = observedScore;
    const homeDelta = parsedScore.home - scoreBefore.home;
    const awayDelta = parsedScore.away - scoreBefore.away;
    let side: MatchInsightSide;
    if (homeDelta === 1 && awayDelta === 0) side = "home";
    else if (homeDelta === 0 && awayDelta === 1) side = "away";
    else {
      scoreFlowValid = false;
      trustedSourceEndExclusive = sourceIndex;
      ignoredGoalCount +=
        1 +
        game.plays
          .slice(sourceIndex + 1)
          .filter((later) => goalActions.has(later.action)).length;
      anomalies.push(
        makeAnomaly(
          "invalid-score-transition",
          play,
          sourceIndex,
          `Score changed from ${scoreBefore.home}-${scoreBefore.away} to ${parsedScore.home}-${parsedScore.away}`,
        ),
      );
      break;
    }
    observedScore = parsedScore;

    const team = side === "home" ? game.home.name : game.away.name;
    const matchingParticipants = play.participants.filter(
      (participant) => participant.team === team,
    );
    const explicitScorer = matchingParticipants.find((participant) =>
      participantRole(participant).includes("score"),
    );
    const soleParticipant = matchingParticipants[0];
    const fallbackScorer =
      matchingParticipants.length === 1 &&
      soleParticipant !== undefined &&
      participantRole(soleParticipant).length === 0
        ? soleParticipant
        : undefined;
    const scorerSource = explicitScorer ?? fallbackScorer;
    const assistSource = matchingParticipants.find((participant) =>
      participantRole(participant).includes("assist"),
    );
    const scorer = scorerSource ? makeParticipant(scorerSource) : null;
    const recordedAssist = assistSource ? makeParticipant(assistSource) : null;

    const opposingCellHasContent =
      side === "home" ? play.away.length > 0 : play.home.length > 0;
    if (
      opposingCellHasContent ||
      (play.participants.length > 0 && matchingParticipants.length === 0)
    )
      anomalies.push(
        makeAnomaly(
          "goal-side-mismatch",
          play,
          sourceIndex,
          `Score attributes the goal to ${team}, but the event actors do not`,
        ),
      );
    if (scorer === null)
      anomalies.push(
        makeAnomaly(
          "actorless-goal",
          play,
          sourceIndex,
          `No scorer was recorded for ${team}`,
        ),
      );

    const newLeader = leaderOf(parsedScore);
    const equalizer = newLeader === null;
    const goAhead = leaderOf(scoreBefore) === null && newLeader === side;
    const leadChange =
      newLeader !== null &&
      lastNonTiedLeader !== null &&
      newLeader !== lastNonTiedLeader;
    if (equalizer) timesTied += 1;
    if (leadChange) leadChanges += 1;
    if (newLeader !== null) lastNonTiedLeader = newLeader;

    const sequence = goals.length + 1;
    const goalElapsed =
      clockWindows === null
        ? null
        : matchElapsedSeconds(clockWindows, play.period, play.time);
    if (goalElapsed === null || goalElapsed < lastGoalElapsed)
      goalClockFlowValid = false;
    else lastGoalElapsed = goalElapsed;

    const homeLead = Math.max(0, parsedScore.home - parsedScore.away);
    const awayLead = Math.max(0, parsedScore.away - parsedScore.home);
    if (homeLead > largestLeads.home.goals) {
      largestLeads.home.goals = homeLead;
      largestLeads.home.goalSequence = sequence;
      largestLeads.home.period = play.period;
      largestLeads.home.clock = play.time;
      largestLeads.home.score = parsedScore;
    }
    if (awayLead > largestLeads.away.goals) {
      largestLeads.away.goals = awayLead;
      largestLeads.away.goalSequence = sequence;
      largestLeads.away.period = play.period;
      largestLeads.away.clock = play.time;
      largestLeads.away.score = parsedScore;
    }

    goals.push({
      sequence,
      sourceIndex,
      period: play.period,
      clock: play.time,
      side,
      team,
      scoreBefore,
      score: parsedScore,
      scorer,
      recordedAssist,
      freePosition: play.action === "Free Position Goal",
      equalizer,
      goAhead,
      leadChange,
    });
  }

  const periods = buildPeriods(game.plays, goals);
  const scoreConsistency = scoreConsistencyFor(game, observedScore);
  const periodScoreConsistency = periodScoreConsistencyFor(game, periods);
  const hasStartGame = game.plays[0]?.action === "START Game";
  const hasEndGame = game.plays.some((play) => play.action === "END Game");
  const terminalPlay = game.plays.at(-1);
  const hasTerminalEndGame = terminalPlay?.action === "END Game";
  let periodEndsValid = true;
  for (const [sourceIndex, play] of game.plays.entries()) {
    if (play.action !== "END Period" || play.time === "0:00") continue;
    periodEndsValid = false;
    anomalies.push(
      makeAnomaly(
        "period-end-clock-mismatch",
        play,
        sourceIndex,
        `${play.period} ends at ${play.time}; completed periods should end at 0:00`,
      ),
    );
  }
  for (const period of playPeriods.slice(0, -1)) {
    if (
      game.plays.some(
        (play) => play.period === period && play.action === "END Period",
      )
    )
      continue;
    periodEndsValid = false;
    anomalies.push(
      makeAnomaly(
        "period-end-clock-mismatch",
        null,
        null,
        `${period} has no END Period event`,
      ),
    );
  }

  let terminalClockValid = !isFinalGameStatus(game.status);
  if (isFinalGameStatus(game.status) && hasTerminalEndGame && terminalPlay) {
    const finalGoal = goals.at(-1);
    const overtimeTerminal = /^(?:OT|Overtime)/iu.test(terminalPlay.period);
    const terminalRemaining = parseMatchClock(terminalPlay.time);
    const terminalDuration = matchPeriodDuration(terminalPlay.period);
    const terminalTimeInRange =
      terminalRemaining !== null &&
      terminalDuration !== null &&
      terminalRemaining <= terminalDuration;
    terminalClockValid = overtimeTerminal
      ? terminalTimeInRange &&
        finalGoal !== undefined &&
        finalGoal.period === terminalPlay.period &&
        finalGoal.clock === terminalPlay.time &&
        leaderOf(finalGoal.score) !== null
      : terminalPlay.period === "Quarter 4" && terminalPlay.time === "0:00";
    if (!terminalClockValid)
      anomalies.push(
        makeAnomaly(
          "terminal-clock-mismatch",
          terminalPlay,
          game.plays.length - 1,
          overtimeTerminal
            ? "Sudden-victory END Game must share the winning goal's period and clock"
            : `Regulation END Game should be Quarter 4 at 0:00; the source lists ${terminalPlay.period} ${terminalPlay.time}`,
        ),
      );
  }

  if (isFinalGameStatus(game.status) && !hasStartGame)
    anomalies.push(
      makeAnomaly(
        "missing-start-game",
        null,
        null,
        "Final game does not start with a START Game event",
      ),
    );
  if (isFinalGameStatus(game.status) && !hasEndGame)
    anomalies.push(
      makeAnomaly(
        "missing-end-game",
        null,
        null,
        "Final game has no END Game event",
      ),
    );
  else if (isFinalGameStatus(game.status) && !hasTerminalEndGame)
    anomalies.push(
      makeAnomaly(
        "non-terminal-end-game",
        null,
        null,
        "Final game's END Game event is not the final source row",
      ),
    );
  if (isFinalGameStatus(game.status) && scoreConsistency === "inconsistent")
    anomalies.push(
      makeAnomaly(
        "final-score-mismatch",
        null,
        null,
        `Trusted score flow ends ${observedScore.home}-${observedScore.away}; game score is ${game.home.score}-${game.away.score}`,
      ),
    );
  if (isFinalGameStatus(game.status) && periodScoreConsistency !== "consistent")
    anomalies.push(
      makeAnomaly(
        "period-score-mismatch",
        null,
        null,
        "Derived period scoring does not match the source period-score table",
      ),
    );

  const completeness = completenessFor(
    game,
    scoreConsistency,
    periodScoreConsistency,
    scoreFlowValid,
    hasStartGame,
    hasTerminalEndGame,
    periodEndsValid,
    terminalClockValid,
  );
  const winner =
    completeness === "final-reconciled" ? leaderOf(observedScore) : null;
  const winningSequence = gameWinningGoalSequence(goals, winner);
  const finalizedGoals = goals.map((goal) =>
    MatchInsightGoal.make({
      ...goal,
      gameWinner: goal.sequence === winningSequence,
    }),
  );
  const winnerLargestDeficit =
    winner === null
      ? null
      : goals.reduce(
          (largest, goal) =>
            Math.max(
              largest,
              winner === "home"
                ? goal.score.away - goal.score.home
                : goal.score.home - goal.score.away,
            ),
          0,
        );
  const wentToOvertime = game.plays.some((play) =>
    /^(?:OT|Overtime)/iu.test(play.period),
  );
  const finalGoal = goals.at(-1);
  const terminalOvertimeGoalSequence =
    terminalPlay?.action === "END Game" &&
    /^(?:OT|Overtime)/iu.test(terminalPlay.period) &&
    finalGoal?.period === terminalPlay.period &&
    finalGoal.clock === terminalPlay.time
      ? finalGoal.sequence
      : null;
  const scoringRuns = buildScoringRuns(goals, clockWindows);
  const scoringContributors = buildContributors(goals);
  const gameStateTime = buildGameStateTime(
    game,
    goals,
    clockWindows,
    completeness,
    scoreFlowValid,
    goalClockFlowValid,
    periodEndsValid,
    terminalClockValid,
  );
  const scoringProfiles = buildScoringProfiles(
    game,
    goals,
    scoringContributors,
    trustedSourceEndExclusive,
  );
  const shotAndEventProfiles = buildShotAndEventProfiles(
    game,
    goals,
    trustedSourceEndExclusive,
  );
  for (const sourceIndex of shotAndEventProfiles.unattributedShotSourceIndexes) {
    const play = game.plays[sourceIndex];
    anomalies.push(
      makeAnomaly(
        "unattributed-shot-event",
        play ?? null,
        sourceIndex,
        "Shot event has no consistent team or participant attribution; affected shot splits are partial",
      ),
    );
  }
  for (const sourceIndex of shotAndEventProfiles.unattributedOvertimeSourceIndexes) {
    const play = game.plays[sourceIndex];
    anomalies.push(
      makeAnomaly(
        "unattributed-overtime-event",
        play ?? null,
        sourceIndex,
        "Overtime event has no consistent team or participant attribution; affected overtime counts are partial",
      ),
    );
  }
  const discipline = buildDiscipline(game);
  const maximumPeriodMargin = periods.reduce(
    (maximum, period) =>
      Math.max(maximum, Math.abs(period.homeGoals - period.awayGoals)),
    0,
  );

  return MatchInsights.make({
    gameId: game.id,
    status: game.status,
    home: MatchInsightTeam.make({
      id: game.home.id,
      code: game.home.code,
      name: game.home.name,
    }),
    away: MatchInsightTeam.make({
      id: game.away.id,
      code: game.away.code,
      name: game.away.name,
    }),
    score: observedScore,
    leader: scoreFlowValid ? leaderOf(observedScore) : null,
    winner,
    leadChanges,
    timesTied,
    winnerLargestDeficit,
    wentToOvertime,
    gameWinningGoalSequence: winningSequence,
    largestLeads: [
      MatchInsightLargestLead.make(largestLeads.home),
      MatchInsightLargestLead.make(largestLeads.away),
    ],
    largestDeficits: [
      MatchInsightLargestDeficit.make({
        side: "home",
        team: game.home.name,
        goals: largestLeads.away.goals,
        goalSequence: largestLeads.away.goalSequence,
        period: largestLeads.away.period,
        clock: largestLeads.away.clock,
        score: largestLeads.away.score,
      }),
      MatchInsightLargestDeficit.make({
        side: "away",
        team: game.away.name,
        goals: largestLeads.home.goals,
        goalSequence: largestLeads.home.goalSequence,
        period: largestLeads.home.period,
        clock: largestLeads.home.clock,
        score: largestLeads.home.score,
      }),
    ],
    periods,
    goals: finalizedGoals,
    scoringRuns,
    scoringContributors,
    gameStateTime,
    teamShapes: buildTeamShapes(
      game,
      goals,
      scoringRuns,
      clockWindows,
      gameStateTime,
      terminalOvertimeGoalSequence,
      wentToOvertime,
    ),
    scoringSegments: buildScoringSegments(periods),
    biggestPeriodSwings:
      maximumPeriodMargin === 0
        ? []
        : periods.filter(
            (period) =>
              Math.abs(period.homeGoals - period.awayGoals) ===
              maximumPeriodMargin,
          ),
    fastestScoringBursts: buildFastestScoringBursts(
      game,
      goals,
      scoringRuns,
      clockWindows,
    ),
    closing: buildClosing(game, goals),
    scoringProfiles: scoringProfiles.profiles,
    scoringCombinations: buildScoringCombinations(goals),
    shotSplits: shotAndEventProfiles.shotSplits,
    eventProfiles: shotAndEventProfiles.eventProfiles,
    teamPerformance: buildTeamPerformance(game),
    discipline: discipline.discipline,
    quality: MatchInsightQuality.make({
      completeness,
      scoreConsistency,
      periodScoreConsistency,
      scoreFlowValid,
      periodStartsValid,
      periodEndsValid,
      terminalClockValid,
      goalClockFlowValid,
      sourcePlayCount: game.plays.length,
      parsedGoalCount: goals.length,
      ignoredGoalCount,
      unattributedFreePositionAttempts:
        scoringProfiles.unattributedFreePositionAttempts,
      unattributedShotEvents: shotAndEventProfiles.unattributedShotEvents,
      unattributedOvertimeEvents:
        shotAndEventProfiles.unattributedOvertimeSourceIndexes.length,
      unattributedCardEvents: discipline.unattributedCardEvents,
      anomalies,
    }),
  });
};

export const buildMatchInsightsDataset = (
  games: ReadonlyArray<Readonly<MatchInsightGameSource>>,
): MatchInsightsDataset =>
  MatchInsightsDataset.make({
    generatedFrom: "World Lacrosse game-detail play-by-play",
    games: games.map(buildMatchInsights),
  });
