import { Schema } from "effect";

import { buildMatchInsights } from "./match-insights";
import type {
  MatchInsights,
  MatchInsightScoringSegment,
  MatchInsightSide,
  MatchInsightTeamShotSplit,
} from "./match-insights-schema";
import type { GameDetails, ScheduledGame } from "./schema";
import { buildTeamAnalysis } from "./team-analysis";
import {
  TeamComparison,
  type TeamComparison as TeamComparisonValue,
  TeamComparisonMeeting,
  TeamComparisonMetricEvidence,
  type TeamComparisonMetricKey,
  TeamComparisonTeam,
  teamComparisonMetricDefinitions,
} from "./team-comparison-schema";

export interface TeamComparisonSource {
  readonly updatedAt: string;
  readonly schedule: readonly ScheduledGame[];
  readonly games: readonly GameDetails[];
}

export interface TeamComparisonTeamSource {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly flagUrl: string | null;
  readonly pool: string;
}

interface TeamPool {
  readonly name: string;
  readonly pool: string;
}

interface EligibleEntry {
  readonly source: GameDetails;
  readonly insight: MatchInsights;
  readonly side: MatchInsightSide;
}

interface MetricDraft {
  numerator: number;
  denominator: number;
  sampleGames: number;
}

const sideFor = (
  insight: Readonly<MatchInsights>,
  team: string,
): MatchInsightSide | null =>
  insight.home.name === team
    ? "home"
    : insight.away.name === team
      ? "away"
      : null;

const opposingSide = (side: MatchInsightSide): MatchInsightSide =>
  side === "home" ? "away" : "home";

const teamScore = (
  insight: Readonly<MatchInsights>,
  side: MatchInsightSide,
): number => (side === "home" ? insight.score.home : insight.score.away);

const scoreForSide = (
  score: Readonly<{ readonly home: number; readonly away: number }>,
  side: MatchInsightSide,
): number => (side === "home" ? score.home : score.away);

const uniqueTeamStats = (
  game: Readonly<GameDetails>,
  team: string,
): Readonly<Record<string, string>> | null => {
  const matches = game.teamStats.filter((row) => row.team === team);
  return matches.length === 1 ? (matches[0]?.stats ?? null) : null;
};

const strictWholeNumber = (value: string | undefined): number | null => {
  const match = value?.match(/^\s*(\d+)\s*$/u);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const strictRatio = (
  value: string | undefined,
): { readonly numerator: number; readonly denominator: number } | null => {
  const match = value
    ?.trim()
    .match(/^(\d+)\s*\/\s*(\d+)\s*\(\d+(?:\.\d+)?%\)$/u);
  if (!match) return null;
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  return Number.isSafeInteger(numerator) &&
    Number.isSafeInteger(denominator) &&
    numerator >= 0 &&
    denominator > 0 &&
    numerator <= denominator
    ? { numerator, denominator }
    : null;
};

const reconciledSave = (
  game: Readonly<GameDetails>,
  team: string,
  opponent: string,
  goalsAgainst: number,
): { readonly saves: number; readonly chances: number } | null => {
  const stats = uniqueTeamStats(game, team);
  const opponentStats = uniqueTeamStats(game, opponent);
  const saves = strictRatio(stats?.Saves);
  const opponentShotsOnGoal = strictWholeNumber(
    opponentStats?.["Shots on Goal"],
  );
  return saves !== null &&
    opponentShotsOnGoal !== null &&
    saves.numerator + goalsAgainst === saves.denominator &&
    saves.denominator === opponentShotsOnGoal
    ? { saves: saves.numerator, chances: saves.denominator }
    : null;
};

const reconciledDraw = (
  game: Readonly<GameDetails>,
  team: string,
  opponent: string,
): { readonly wins: number; readonly opportunities: number } | null => {
  const selected = strictRatio(uniqueTeamStats(game, team)?.["Draw Controls"]);
  const opposing = strictRatio(
    uniqueTeamStats(game, opponent)?.["Draw Controls"],
  );
  return selected !== null &&
    opposing !== null &&
    selected.denominator === opposing.denominator &&
    selected.numerator + opposing.numerator === selected.denominator
    ? { wins: selected.numerator, opportunities: selected.denominator }
    : null;
};

const segmentFor = (
  insight: Readonly<MatchInsights>,
  segment: MatchInsightScoringSegment["segment"],
): MatchInsightScoringSegment | undefined =>
  insight.scoringSegments.find((entry) => entry.segment === segment);

const shotSplitFor = (
  insight: Readonly<MatchInsights>,
  side: MatchInsightSide,
  segment: MatchInsightTeamShotSplit["segment"],
): MatchInsightTeamShotSplit | undefined =>
  insight.shotSplits.find(
    (entry) => entry.side === side && entry.segment === segment,
  );

const periodKeys: readonly {
  readonly period: string;
  readonly goals: TeamComparisonMetricKey;
  readonly against: TeamComparisonMetricKey;
}[] = [
  { period: "Quarter 1", goals: "q1-goals", against: "q1-goals-against" },
  { period: "Quarter 2", goals: "q2-goals", against: "q2-goals-against" },
  { period: "Quarter 3", goals: "q3-goals", against: "q3-goals-against" },
  { period: "Quarter 4", goals: "q4-goals", against: "q4-goals-against" },
];

const exactTeam = (
  teams: readonly TeamComparisonTeamSource[],
  id: string,
): TeamComparisonTeamSource | null => {
  const matches = teams.filter((team) => team.id === id);
  return matches.length === 1 ? (matches[0] ?? null) : null;
};

const regulationSegments: readonly MatchInsightScoringSegment["segment"][] = [
  "first-half",
  "second-half",
];

const buildMetrics = (
  entries: readonly EligibleEntry[],
): readonly TeamComparisonMetricEvidence[] => {
  const drafts = new Map<TeamComparisonMetricKey, MetricDraft>();
  const recordedScorers = new Set<string>();
  const recordedScorerGoals = new Map<string, number>();
  for (const definition of teamComparisonMetricDefinitions)
    drafts.set(definition.key, {
      numerator: 0,
      denominator: 0,
      sampleGames: 0,
    });

  const draftFor = (key: TeamComparisonMetricKey): MetricDraft => {
    const existing = drafts.get(key);
    if (existing) return existing;
    const created = { numerator: 0, denominator: 0, sampleGames: 0 };
    drafts.set(key, created);
    return created;
  };
  const addTotal = (key: TeamComparisonMetricKey, value: number): void => {
    const draft = draftFor(key);
    draft.numerator += value;
    draft.denominator += 1;
    draft.sampleGames += 1;
  };
  const addRate = (
    key: TeamComparisonMetricKey,
    numerator: number,
    denominator: number,
  ): void => {
    const draft = draftFor(key);
    draft.numerator += numerator;
    draft.denominator += denominator;
    draft.sampleGames += 1;
  };
  const considerExtreme = (
    key: TeamComparisonMetricKey,
    value: number | null,
    mode: "maximum" | "minimum",
  ): void => {
    const draft = draftFor(key);
    draft.sampleGames += 1;
    if (value === null) return;
    if (
      draft.denominator === 0 ||
      (mode === "maximum" && value > draft.numerator) ||
      (mode === "minimum" && value < draft.numerator)
    )
      draft.numerator = value;
    draft.denominator += 1;
  };
  const considerDrought = (
    durationSeconds: number | null,
    goalsConceded: number | null,
  ): void => {
    const duration = draftFor("longest-drought");
    const damage = draftFor("drought-goals-conceded");
    duration.sampleGames += 1;
    damage.sampleGames += 1;
    if (durationSeconds === null || goalsConceded === null) return;
    if (duration.denominator === 0 || durationSeconds > duration.numerator) {
      duration.numerator = durationSeconds;
      damage.numerator = goalsConceded;
    }
    duration.denominator += 1;
    damage.denominator += 1;
  };

  for (const entry of entries) {
    const opponentSide = opposingSide(entry.side);
    const goals = teamScore(entry.insight, entry.side);
    const goalsAgainst = teamScore(entry.insight, opponentSide);
    const difference = goals - goalsAgainst;
    addTotal("goals-total", goals);
    addTotal("goals-against-total", goalsAgainst);
    addTotal("goal-difference-total", difference);
    addRate("goals-per-game", goals, 1);
    addRate("goals-against-per-game", goalsAgainst, 1);
    addRate("goal-difference-per-game", difference, 1);

    for (const keys of periodKeys) {
      const period = entry.insight.periods.find(
        (candidate) => candidate.period === keys.period,
      );
      if (!period) continue;
      addTotal(
        keys.goals,
        scoreForSide(period.score, entry.side) -
          scoreForSide(period.scoreBefore, entry.side),
      );
      addTotal(
        keys.against,
        scoreForSide(period.score, opponentSide) -
          scoreForSide(period.scoreBefore, opponentSide),
      );
    }

    for (const segmentName of regulationSegments) {
      const segment = segmentFor(entry.insight, segmentName);
      if (!segment) continue;
      const prefix =
        segmentName === "first-half" ? "first-half" : "second-half";
      addTotal(
        prefix === "first-half" ? "first-half-goals" : "second-half-goals",
        entry.side === "home" ? segment.homeGoals : segment.awayGoals,
      );
      addTotal(
        prefix === "first-half"
          ? "first-half-goals-against"
          : "second-half-goals-against",
        entry.side === "home" ? segment.awayGoals : segment.homeGoals,
      );
    }

    const teamName =
      entry.side === "home" ? entry.insight.home.name : entry.insight.away.name;
    const opponentName =
      entry.side === "home" ? entry.insight.away.name : entry.insight.home.name;
    const teamStats = uniqueTeamStats(entry.source, teamName);
    const shots = strictWholeNumber(teamStats?.["Total Shots"]);
    const shotsOnGoal = strictWholeNumber(teamStats?.["Shots on Goal"]);
    const coherentShots = shots !== null && goals <= shots;
    const coherentShotsOnGoal =
      shotsOnGoal !== null &&
      goals <= shotsOnGoal &&
      (shots === null || shotsOnGoal <= shots);
    if (coherentShots) {
      addTotal("shots", shots);
      addRate("shooting-conversion", goals, shots);
    }
    if (coherentShotsOnGoal) addTotal("shots-on-goal", shotsOnGoal);
    if (coherentShots && coherentShotsOnGoal)
      addRate("shot-accuracy", shotsOnGoal, shots);
    const save = reconciledSave(
      entry.source,
      teamName,
      opponentName,
      goalsAgainst,
    );
    if (save) {
      addTotal("saves", save.saves);
      addRate("save-rate", save.saves, save.chances);
    }
    const draw = reconciledDraw(entry.source, teamName, opponentName);
    if (draw) {
      addTotal("draw-controls", draw.wins);
      addRate("draw-share", draw.wins, draw.opportunities);
    }
    const groundBalls = strictWholeNumber(teamStats?.["Ground Balls"]);
    const turnovers = strictWholeNumber(teamStats?.Turnovers);
    const causedTurnovers = strictWholeNumber(teamStats?.["Caused Turnovers"]);
    if (groundBalls !== null) addTotal("ground-balls", groundBalls);
    if (turnovers !== null) addTotal("turnovers", turnovers);
    if (causedTurnovers !== null) addTotal("caused-turnovers", causedTurnovers);

    for (const segmentName of regulationSegments) {
      const split = shotSplitFor(entry.insight, entry.side, segmentName);
      if (!split?.attributionComplete) continue;
      const conversionKey =
        segmentName === "first-half"
          ? "first-half-shooting-conversion"
          : "second-half-shooting-conversion";
      const accuracyKey =
        segmentName === "first-half"
          ? "first-half-shot-accuracy"
          : "second-half-shot-accuracy";
      const saveKey =
        segmentName === "first-half"
          ? "first-half-save-rate"
          : "second-half-save-rate";
      if (split.goals <= split.shots)
        addRate(conversionKey, split.goals, split.shots);
      if (split.goals <= split.shotsOnGoal && split.shotsOnGoal <= split.shots)
        addRate(accuracyKey, split.shotsOnGoal, split.shots);
      if (split.saves <= split.saveOpportunities)
        addRate(saveKey, split.saves, split.saveOpportunities);
    }

    const scoringProfile = entry.insight.scoringProfiles.find(
      (profile) => profile.side === entry.side,
    );
    if (scoringProfile) {
      if (scoringProfile.knownScorerGoals <= scoringProfile.goals)
        addRate(
          "known-scorer-coverage",
          scoringProfile.knownScorerGoals,
          scoringProfile.goals,
        );
      if (scoringProfile.recordedAssistedGoals <= scoringProfile.goals)
        addRate(
          "recorded-assist-share",
          scoringProfile.recordedAssistedGoals,
          scoringProfile.goals,
        );
      if (
        entry.insight.quality.unattributedFreePositionAttempts === 0 &&
        scoringProfile.freePositionGoals <= scoringProfile.freePositionAttempts
      )
        addRate(
          "free-position-conversion",
          scoringProfile.freePositionGoals,
          scoringProfile.freePositionAttempts,
        );
    }
    for (const contributor of entry.insight.scoringContributors) {
      if (contributor.side !== entry.side || contributor.goals <= 0) continue;
      const identity =
        contributor.id ?? `${contributor.team}\u0000${contributor.name}`;
      recordedScorers.add(identity);
      recordedScorerGoals.set(
        identity,
        (recordedScorerGoals.get(identity) ?? 0) + contributor.goals,
      );
    }
    const eventProfile = entry.insight.eventProfiles.find(
      (profile) => profile.side === entry.side,
    );
    if (eventProfile && entry.insight.quality.unattributedShotEvents === 0) {
      if (eventProfile.closeGameGoals <= eventProfile.closeGameShots)
        addRate(
          "close-game-shooting-conversion",
          eventProfile.closeGameGoals,
          eventProfile.closeGameShots,
        );
      if (
        eventProfile.closeGameGoals <= eventProfile.closeGameShotsOnGoal &&
        eventProfile.closeGameShotsOnGoal <= eventProfile.closeGameShots
      )
        addRate(
          "close-game-shot-accuracy",
          eventProfile.closeGameShotsOnGoal,
          eventProfile.closeGameShots,
        );
      considerExtreme(
        "longest-save-run",
        eventProfile.longestSaveRun,
        "maximum",
      );
    }

    const gameState = entry.insight.gameStateTime;
    if (gameState?.complete) {
      const ahead =
        entry.side === "home"
          ? gameState.homeLeadingSeconds
          : gameState.awayLeadingSeconds;
      const behind =
        entry.side === "home"
          ? gameState.awayLeadingSeconds
          : gameState.homeLeadingSeconds;
      const close = gameState.tiedSeconds + gameState.oneGoalMarginSeconds;
      addRate("time-ahead-share", ahead, gameState.observedSeconds);
      addRate(
        "time-tied-share",
        gameState.tiedSeconds,
        gameState.observedSeconds,
      );
      addRate("time-behind-share", behind, gameState.observedSeconds);
      addRate(
        "one-goal-margin-share",
        gameState.oneGoalMarginSeconds,
        gameState.observedSeconds,
      );
      addRate(
        "two-goal-margin-share",
        gameState.twoGoalMarginSeconds,
        gameState.observedSeconds,
      );
      addRate(
        "three-plus-goal-margin-share",
        gameState.threePlusMarginSeconds,
        gameState.observedSeconds,
      );
      addRate("close-game-share", close, gameState.observedSeconds);
      addRate("average-close-game-time", close, 1);
    }
    addRate("lead-changes-per-game", entry.insight.leadChanges, 1);
    addRate("times-tied-per-game", entry.insight.timesTied, 1);

    const largestLead = entry.insight.largestLeads.find(
      (candidate) => candidate.side === entry.side,
    );
    const largestDeficit = entry.insight.largestDeficits.find(
      (candidate) => candidate.side === entry.side,
    );
    considerExtreme("largest-lead", largestLead?.goals ?? 0, "maximum");
    considerExtreme("largest-deficit", largestDeficit?.goals ?? 0, "maximum");
    if (entry.insight.winner === entry.side)
      considerExtreme(
        "largest-recovered-deficit",
        entry.insight.winnerLargestDeficit ?? 0,
        "maximum",
      );

    const teamShape = entry.insight.teamShapes.find(
      (shape) => shape.side === entry.side,
    );
    if (teamShape) {
      considerExtreme("longest-run", teamShape.longestRunGoals, "maximum");
      considerDrought(
        teamShape.longestDroughtSeconds,
        teamShape.longestDroughtGoalsConceded,
      );
      addRate(
        "response-rate",
        teamShape.responseGoals,
        teamShape.responseOpportunities,
      );
      if (teamShape.averageResponseSeconds === null)
        addRate("average-response-time", 0, 0);
      else
        addRate(
          "average-response-time",
          teamShape.averageResponseSeconds * teamShape.responseGoals,
          teamShape.responseGoals,
        );
      considerExtreme(
        "fastest-response-time",
        teamShape.fastestResponseSeconds,
        "minimum",
      );
    }

    for (const burstGoals of [2, 3, 4]) {
      const burst = entry.insight.fastestScoringBursts.find(
        (candidate) =>
          candidate.side === entry.side && candidate.goals === burstGoals,
      );
      const key: TeamComparisonMetricKey =
        burstGoals === 2
          ? "fastest-two-goal-burst"
          : burstGoals === 3
            ? "fastest-three-goal-burst"
            : "fastest-four-goal-burst";
      considerExtreme(key, burst?.durationSeconds ?? null, "minimum");
    }

    const closing = entry.insight.closing.find(
      (candidate) => candidate.side === entry.side,
    );
    if (closing) {
      addTotal("fourth-quarter-goals", closing.fourthQuarterGoals);
      if (closing.finalFiveMinuteGoals !== null)
        addTotal("final-five-minute-goals", closing.finalFiveMinuteGoals);
      addTotal("goals-while-tied", closing.goalsWhileTied);
      addTotal("goals-while-trailing", closing.goalsWhileTrailing);
      addTotal("equalizing-goals", closing.equalizingGoals);
      addTotal("go-ahead-goals", closing.goAheadGoals);
    }

    addTotal("overtime-appearances", entry.insight.wentToOvertime ? 1 : 0);
    if (entry.insight.wentToOvertime) {
      const won = entry.insight.winner === entry.side;
      addTotal("overtime-wins", won ? 1 : 0);
      addTotal("overtime-losses", won ? 0 : 1);
      const overtime = segmentFor(entry.insight, "overtime");
      addTotal(
        "overtime-goals",
        overtime
          ? entry.side === "home"
            ? overtime.homeGoals
            : overtime.awayGoals
          : 0,
      );
      addTotal(
        "overtime-goals-against",
        overtime
          ? entry.side === "home"
            ? overtime.awayGoals
            : overtime.homeGoals
          : 0,
      );
      const split = shotSplitFor(entry.insight, entry.side, "overtime");
      if (split?.attributionComplete) {
        if (split.goals <= split.shots)
          addRate("overtime-shooting-conversion", split.goals, split.shots);
        if (
          split.goals <= split.shotsOnGoal &&
          split.shotsOnGoal <= split.shots
        )
          addRate("overtime-shot-accuracy", split.shotsOnGoal, split.shots);
        if (split.saves <= split.saveOpportunities)
          addRate("overtime-save-rate", split.saves, split.saveOpportunities);
      }
      if (eventProfile?.overtimeAttributionComplete) {
        addTotal("overtime-turnovers", eventProfile.overtimeTurnovers);
        addTotal("overtime-draw-controls", eventProfile.overtimeDrawControls);
        addTotal("overtime-ground-balls", eventProfile.overtimeGroundBalls);
      }
    }

    const discipline = entry.insight.discipline.find(
      (profile) => profile.side === entry.side,
    );
    if (discipline && entry.insight.quality.unattributedCardEvents === 0) {
      addTotal("card-events", discipline.cardEvents);
      addTotal("yellow-cards", discipline.yellowCards);
      addTotal("yellow-red-cards", discipline.yellowRedCards);
      addTotal("red-cards", discipline.redCards);
      addTotal(
        "recorded-suspension-minutes",
        discipline.recordedPenaltyMinutes,
      );
    }
  }

  const recordedScorersDraft = draftFor("recorded-scorers");
  recordedScorersDraft.numerator = recordedScorers.size;
  recordedScorersDraft.denominator = entries.length;
  recordedScorersDraft.sampleGames = entries.length;
  const leadingScorerShare = draftFor("recorded-leading-scorer-share");
  leadingScorerShare.numerator = Math.max(0, ...recordedScorerGoals.values());
  leadingScorerShare.denominator = draftFor("goals-total").numerator;
  leadingScorerShare.sampleGames = entries.length;

  return teamComparisonMetricDefinitions.map((definition) => {
    const draft = draftFor(definition.key);
    const value =
      definition.aggregation === "percentage"
        ? draft.denominator === 0
          ? null
          : (draft.numerator / draft.denominator) * 100
        : definition.aggregation === "per-game" ||
            definition.aggregation === "average"
          ? draft.denominator === 0
            ? null
            : draft.numerator / draft.denominator
          : definition.aggregation === "maximum" ||
              definition.aggregation === "minimum" ||
              definition.aggregation === "paired-maximum"
            ? draft.denominator === 0
              ? null
              : draft.numerator
            : draft.sampleGames === 0
              ? null
              : draft.numerator;
    return TeamComparisonMetricEvidence.make({
      key: definition.key,
      value,
      numerator: draft.numerator,
      denominator: draft.denominator,
      sampleGames: draft.sampleGames,
    });
  });
};

const eligibleEntriesFor = (
  team: Readonly<TeamComparisonTeamSource>,
  source: Readonly<TeamComparisonSource>,
  teamPools: readonly TeamPool[],
): {
  readonly analysis: ReturnType<typeof buildTeamAnalysis>;
  readonly entries: readonly EligibleEntry[];
} => {
  const analysis = buildTeamAnalysis(team.name, source, teamPools);
  const eligibleIds = new Set(
    analysis.games.filter((game) => game.eligible).map((game) => game.gameId),
  );
  const entries = [...eligibleIds].flatMap((id) => {
    const matches = source.games.filter((game) => game.id === id);
    const detail = matches.length === 1 ? matches[0] : undefined;
    if (!detail) return [];
    const insight = buildMatchInsights(detail);
    const side = sideFor(insight, team.name);
    return insight.quality.completeness === "final-reconciled" &&
      insight.quality.scoreFlowValid &&
      side !== null
      ? [{ source: detail, insight, side }]
      : [];
  });
  return { analysis, entries };
};

const buildTeam = (
  team: Readonly<TeamComparisonTeamSource>,
  source: Readonly<TeamComparisonSource>,
  teamPools: readonly TeamPool[],
): {
  readonly team: TeamComparisonTeam;
  readonly entries: readonly EligibleEntry[];
} => {
  const eligible = eligibleEntriesFor(team, source, teamPools);
  const wins = eligible.entries.filter(
    (entry) => entry.insight.winner === entry.side,
  ).length;
  return {
    team: TeamComparisonTeam.make({
      id: team.id,
      code: team.code,
      name: team.name,
      flagUrl: team.flagUrl,
      pool: team.pool,
      completedGames: eligible.analysis.completedGames,
      eligibleGames: eligible.entries.length,
      excludedCompletedGames:
        eligible.analysis.completedGames - eligible.entries.length,
      wins,
      losses: eligible.entries.length - wins,
      metrics: buildMetrics(eligible.entries),
    }),
    entries: eligible.entries,
  };
};

const buildDirectMeetings = (
  left: Readonly<TeamComparisonTeamSource>,
  right: Readonly<TeamComparisonTeamSource>,
  leftEntries: readonly EligibleEntry[],
  schedule: readonly ScheduledGame[],
): readonly TeamComparisonMeeting[] => {
  const scheduleById = new Map(schedule.map((game) => [game.id, game]));
  return leftEntries.flatMap((entry) => {
    const hasRight =
      entry.insight.home.name === right.name ||
      entry.insight.away.name === right.name;
    if (!hasRight) return [];
    const scheduled = scheduleById.get(entry.source.id);
    if (!scheduled) return [];
    const leftSide = sideFor(entry.insight, left.name);
    if (leftSide === null || entry.insight.winner === null) return [];
    const rightSide = opposingSide(leftSide);
    return [
      TeamComparisonMeeting.make({
        gameId: entry.source.id,
        date: scheduled.date,
        phase: scheduled.phase,
        leftGoals: teamScore(entry.insight, leftSide),
        rightGoals: teamScore(entry.insight, rightSide),
        winner: entry.insight.winner === leftSide ? "left" : "right",
      }),
    ];
  });
};

export const buildTeamMetricSample = (
  teamId: string,
  gameIds: readonly string[],
  source: Readonly<TeamComparisonSource>,
  teams: readonly TeamComparisonTeamSource[],
): readonly TeamComparisonMetricEvidence[] | null => {
  const selected = exactTeam(teams, teamId);
  if (selected === null) return null;
  const selectedIds = new Set(gameIds);
  const filtered = {
    updatedAt: source.updatedAt,
    schedule: source.schedule.filter((game) => selectedIds.has(game.id)),
    games: source.games.filter((game) => selectedIds.has(game.id)),
  };
  const teamPools = teams.map((team) => ({ name: team.name, pool: team.pool }));
  return buildTeam(selected, filtered, teamPools).team.metrics;
};

export const buildTeamComparison = (
  leftTeamId: string,
  rightTeamId: string,
  source: Readonly<TeamComparisonSource>,
  teams: readonly TeamComparisonTeamSource[],
): TeamComparisonValue | null => {
  if (leftTeamId === rightTeamId) return null;
  const leftSource = exactTeam(teams, leftTeamId);
  const rightSource = exactTeam(teams, rightTeamId);
  if (leftSource === null || rightSource === null) return null;
  const teamPools = teams.map((team) => ({ name: team.name, pool: team.pool }));
  const left = buildTeam(leftSource, source, teamPools);
  const right = buildTeam(rightSource, source, teamPools);
  return Schema.decodeUnknownSync(TeamComparison)({
    generatedFrom: source.updatedAt,
    left: left.team,
    right: right.team,
    directMeetings: buildDirectMeetings(
      leftSource,
      rightSource,
      left.entries,
      source.schedule,
    ),
  });
};
