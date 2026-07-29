import { Schema } from "effect";

import { gameDetailMatchesSchedule } from "./game-evidence";
import { isCompletedGame } from "./game-status";
import { buildMatchInsights } from "./match-insights";
import type { MatchInsights, MatchInsightSide } from "./match-insights-schema";
import type { DerivedPlayerStats, GameDetails, ScheduledGame } from "./schema";
import {
  TeamAnalysis,
  type TeamAnalysis as TeamAnalysisValue,
  type TeamBenchmark,
  type TeamBenchmarkMetric,
  type TeamGameAnalysis,
  type TeamGameRate,
  TeamPlayerLeaderboard,
  TeamRunSummary,
  type TeamScoringProfile,
} from "./team-analysis-schema";
import { buildTournamentContext } from "./tournament-context";
import {
  TournamentPlayerRank,
  type TournamentPlayerMetric,
} from "./tournament-context-schema";

interface TeamPool {
  readonly name: string;
  readonly pool: string;
}

interface CurrentTeamAnalysisSource {
  readonly updatedAt: string;
  readonly schedule: readonly ScheduledGame[];
  readonly games: readonly GameDetails[];
}

interface EligibleGame {
  readonly source: GameDetails;
  readonly insight: MatchInsights;
}

interface TeamBenchmarkDraft {
  readonly team: string;
  games: number;
  goals: number;
  goalsAgainst: number;
  shots: number;
  shootingGames: number;
  drawControls: number;
  drawOpportunities: number;
  drawGames: number;
  saves: number;
  saveOpportunities: number;
  saveGames: number;
}

interface BenchmarkCandidate {
  readonly team: string;
  readonly metric: TeamBenchmarkMetric;
  readonly value: number;
  readonly numerator: number;
  readonly denominator: number;
  readonly sampleGames: number;
}

const duplicateIds = (
  entries: readonly { readonly id: string }[],
): ReadonlySet<string> => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) duplicates.add(entry.id);
    else seen.add(entry.id);
  }
  return duplicates;
};

interface PlayerDraft {
  readonly id: string | null;
  readonly name: string;
  readonly team: string;
  goals: number;
  recordedAssists: number;
  drawControls: number;
  groundBalls: number;
  causedTurnovers: number;
}

const benchmarkOrder: readonly TeamBenchmarkMetric[] = [
  "goals-per-game",
  "goals-against-per-game",
  "goal-difference-per-game",
  "shooting-percentage",
  "draw-control-percentage",
  "save-percentage",
];

const playerMetrics: readonly TournamentPlayerMetric[] = [
  "points",
  "goals",
  "recorded-assists",
  "draw-controls",
];

const percentileFor = (rank: number, total: number): number =>
  total <= 1 ? 100 : ((total - rank) / (total - 1)) * 100;

const teamSide = (
  insight: Readonly<MatchInsights>,
  team: string,
): MatchInsightSide | null =>
  insight.home.name === team
    ? "home"
    : insight.away.name === team
      ? "away"
      : null;

const scoreFor = (
  insight: Readonly<MatchInsights>,
  side: MatchInsightSide,
): { readonly goals: number; readonly goalsAgainst: number } =>
  side === "home"
    ? { goals: insight.score.home, goalsAgainst: insight.score.away }
    : { goals: insight.score.away, goalsAgainst: insight.score.home };

const opponentFor = (
  insight: Readonly<MatchInsights>,
  side: MatchInsightSide,
): string => (side === "home" ? insight.away.name : insight.home.name);

const ratioStat = (
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

const strictStatNumber = (value: string | undefined): number | null => {
  const match = value?.match(/^\s*(\d+)\s*$/u);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const strictSaveRatio = (
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

const uniqueTeamStats = (
  game: Readonly<GameDetails>,
  team: string,
): Readonly<Record<string, string>> | null => {
  const matches = game.teamStats.filter((candidate) => candidate.team === team);
  return matches.length === 1 ? (matches[0]?.stats ?? null) : null;
};

const percentageRate = (
  numerator: number,
  denominator: number,
): TeamGameRate | null =>
  denominator > 0 && numerator >= 0 && numerator <= denominator
    ? {
        value: (numerator / denominator) * 100,
        numerator,
        denominator,
      }
    : null;

const playerMetricValue = (
  player: Readonly<PlayerDraft>,
  metric: TournamentPlayerMetric,
): number => {
  switch (metric) {
    case "points":
      return player.goals + player.recordedAssists;
    case "goals":
      return player.goals;
    case "recorded-assists":
      return player.recordedAssists;
    case "draw-controls":
      return player.drawControls;
    case "ground-balls":
      return player.groundBalls;
    case "caused-turnovers":
      return player.causedTurnovers;
  }
};

const derivedPlayerMetricValue = (
  player: Readonly<DerivedPlayerStats>,
  metric: TournamentPlayerMetric,
): number => {
  switch (metric) {
    case "points":
      return player.goals + player.assists;
    case "goals":
      return player.goals;
    case "recorded-assists":
      return player.assists;
    case "draw-controls":
      return player.drawControls;
    case "ground-balls":
      return player.groundBalls;
    case "caused-turnovers":
      return player.causedTurnovers;
  }
};

const playerMetricReconciles = (
  entry: Readonly<EligibleGame>,
  team: string,
  metric: TournamentPlayerMetric,
): boolean => {
  if (metric === "points")
    return (
      playerMetricReconciles(entry, team, "goals") &&
      playerMetricReconciles(entry, team, "recorded-assists")
    );
  const derived = entry.source.derivedPlayerStats
    .filter((player) => player.team === team)
    .reduce(
      (total, player) => total + derivedPlayerMetricValue(player, metric),
      0,
    );
  const teamStats = uniqueTeamStats(entry.source, team);
  switch (metric) {
    case "goals": {
      const side = teamSide(entry.insight, team);
      if (side === null) return false;
      return derived === scoreFor(entry.insight, side).goals;
    }
    case "recorded-assists": {
      const source = strictStatNumber(teamStats?.Assists);
      const traced = entry.insight.scoringProfiles.find(
        (profile) => profile.team === team,
      )?.recordedAssistedGoals;
      return (
        source !== null &&
        traced !== undefined &&
        derived === source &&
        derived === traced
      );
    }
    case "draw-controls": {
      const source = ratioStat(teamStats?.["Draw Controls"])?.numerator ?? null;
      return source !== null && derived === source;
    }
    case "ground-balls": {
      const source = strictStatNumber(teamStats?.["Ground Balls"]);
      return source !== null && derived === source;
    }
    case "caused-turnovers": {
      const source = strictStatNumber(teamStats?.["Caused Turnovers"]);
      return source !== null && derived === source;
    }
  }
};

const playerIdentity = (player: Readonly<DerivedPlayerStats>): string =>
  player.id ?? `${player.team}\u0000${player.name}`;

const buildPlayerLeaderboards = (
  eligible: readonly EligibleGame[],
  team: string,
): readonly TeamPlayerLeaderboard[] =>
  playerMetrics.map((metric) => {
    const metricGames = eligible.filter((entry) =>
      playerMetricReconciles(entry, team, metric),
    );
    const players = new Map<string, PlayerDraft>();
    for (const entry of metricGames) {
      for (const player of entry.source.derivedPlayerStats) {
        if (player.team !== team) continue;
        const identity = playerIdentity(player);
        const existing = players.get(identity) ?? {
          id: player.id,
          name: player.name,
          team,
          goals: 0,
          recordedAssists: 0,
          drawControls: 0,
          groundBalls: 0,
          causedTurnovers: 0,
        };
        existing.goals += player.goals;
        existing.recordedAssists += player.assists;
        existing.drawControls += player.drawControls;
        existing.groundBalls += player.groundBalls;
        existing.causedTurnovers += player.causedTurnovers;
        players.set(identity, existing);
      }
    }
    const ranked = [...players.values()]
      .filter((player) => playerMetricValue(player, metric) > 0)
      .toSorted(
        (left, right) =>
          playerMetricValue(right, metric) - playerMetricValue(left, metric) ||
          left.name.localeCompare(right.name),
      );
    const entries: TournamentPlayerRank[] = [];
    for (const [index, player] of ranked.entries()) {
      const previous = ranked[index - 1];
      const value = playerMetricValue(player, metric);
      const rank =
        previous && playerMetricValue(previous, metric) === value
          ? (entries[index - 1]?.rank.rank ?? index + 1)
          : index + 1;
      if (rank > 3) continue;
      entries.push(
        TournamentPlayerRank.make({
          id: player.id,
          name: player.name,
          team,
          value,
          rank: {
            rank,
            total: ranked.length,
            percentile: percentileFor(rank, ranked.length),
            tied: ranked.some(
              (candidate) =>
                candidate !== player &&
                playerMetricValue(candidate, metric) === value,
            ),
          },
        }),
      );
    }
    return TeamPlayerLeaderboard.make({
      metric,
      sampleGames: metricGames.length,
      entries,
    });
  });

const reconciledShootingRate = (
  entry: Readonly<EligibleGame>,
  team: string,
): TeamGameRate | null => {
  const side = teamSide(entry.insight, team);
  const stats = uniqueTeamStats(entry.source, team);
  if (side === null || stats === null) return null;
  const shots = strictStatNumber(stats["Total Shots"]);
  if (shots === null) return null;
  return percentageRate(scoreFor(entry.insight, side).goals, shots);
};

const reconciledSaveRate = (
  entry: Readonly<EligibleGame>,
  team: string,
): TeamGameRate | null => {
  const side = teamSide(entry.insight, team);
  if (side === null) return null;
  const opponent = opponentFor(entry.insight, side);
  const stats = uniqueTeamStats(entry.source, team);
  const opponentStats = uniqueTeamStats(entry.source, opponent);
  if (stats === null || opponentStats === null) return null;
  const saves = strictSaveRatio(stats.Saves);
  const opponentShotsOnGoal = strictStatNumber(opponentStats["Shots on Goal"]);
  const goalsAgainst = scoreFor(entry.insight, side).goalsAgainst;
  if (
    saves === null ||
    opponentShotsOnGoal === null ||
    saves.numerator + goalsAgainst !== saves.denominator ||
    saves.denominator !== opponentShotsOnGoal
  )
    return null;
  return percentageRate(saves.numerator, saves.denominator);
};

const reconciledDrawRatio = (
  game: Readonly<GameDetails>,
  team: string,
): TeamGameRate | null => {
  const home = ratioStat(
    uniqueTeamStats(game, game.home.name)?.["Draw Controls"],
  );
  const away = ratioStat(
    uniqueTeamStats(game, game.away.name)?.["Draw Controls"],
  );
  if (
    home === null ||
    away === null ||
    home.denominator !== away.denominator ||
    home.numerator + away.numerator !== home.denominator
  )
    return null;
  const selected =
    team === game.home.name ? home : team === game.away.name ? away : null;
  return selected === null
    ? null
    : percentageRate(selected.numerator, selected.denominator);
};

const benchmarkCandidates = (
  eligible: readonly EligibleGame[],
): readonly BenchmarkCandidate[] => {
  const drafts = new Map<string, TeamBenchmarkDraft>();
  const draftFor = (team: string): TeamBenchmarkDraft => {
    const existing = drafts.get(team);
    if (existing) return existing;
    const created: TeamBenchmarkDraft = {
      team,
      games: 0,
      goals: 0,
      goalsAgainst: 0,
      shots: 0,
      shootingGames: 0,
      drawControls: 0,
      drawOpportunities: 0,
      drawGames: 0,
      saves: 0,
      saveOpportunities: 0,
      saveGames: 0,
    };
    drafts.set(team, created);
    return created;
  };
  for (const entry of eligible) {
    for (const side of ["home", "away"] as const) {
      const team =
        side === "home" ? entry.insight.home.name : entry.insight.away.name;
      const score = scoreFor(entry.insight, side);
      const draft = draftFor(team);
      draft.games += 1;
      draft.goals += score.goals;
      draft.goalsAgainst += score.goalsAgainst;
      const shooting = reconciledShootingRate(entry, team);
      if (shooting !== null) {
        draft.shots += shooting.denominator;
        draft.shootingGames += 1;
      }
      const saves = reconciledSaveRate(entry, team);
      if (saves !== null) {
        draft.saves += saves.numerator;
        draft.saveOpportunities += saves.denominator;
        draft.saveGames += 1;
      }
      const draws = reconciledDrawRatio(entry.source, team);
      if (draws !== null) {
        draft.drawControls += draws.numerator;
        draft.drawOpportunities += draws.denominator;
        draft.drawGames += 1;
      }
    }
  }
  return [...drafts.values()].flatMap((draft) => {
    if (draft.games === 0) return [];
    const output: BenchmarkCandidate[] = [
      {
        team: draft.team,
        metric: "goals-per-game",
        value: draft.goals / draft.games,
        numerator: draft.goals,
        denominator: draft.games,
        sampleGames: draft.games,
      },
      {
        team: draft.team,
        metric: "goals-against-per-game",
        value: draft.goalsAgainst / draft.games,
        numerator: draft.goalsAgainst,
        denominator: draft.games,
        sampleGames: draft.games,
      },
      {
        team: draft.team,
        metric: "goal-difference-per-game",
        value: (draft.goals - draft.goalsAgainst) / draft.games,
        numerator: draft.goals - draft.goalsAgainst,
        denominator: draft.games,
        sampleGames: draft.games,
      },
    ];
    if (draft.shootingGames === draft.games && draft.shots > 0)
      output.push({
        team: draft.team,
        metric: "shooting-percentage",
        value: (draft.goals / draft.shots) * 100,
        numerator: draft.goals,
        denominator: draft.shots,
        sampleGames: draft.shootingGames,
      });
    if (draft.drawGames === draft.games && draft.drawOpportunities > 0)
      output.push({
        team: draft.team,
        metric: "draw-control-percentage",
        value: (draft.drawControls / draft.drawOpportunities) * 100,
        numerator: draft.drawControls,
        denominator: draft.drawOpportunities,
        sampleGames: draft.drawGames,
      });
    if (draft.saveGames === draft.games && draft.saveOpportunities > 0)
      output.push({
        team: draft.team,
        metric: "save-percentage",
        value: (draft.saves / draft.saveOpportunities) * 100,
        numerator: draft.saves,
        denominator: draft.saveOpportunities,
        sampleGames: draft.saveGames,
      });
    return output;
  });
};

const buildBenchmarks = (
  eligible: readonly EligibleGame[],
  team: string,
): readonly TeamBenchmark[] => {
  const candidates = benchmarkCandidates(eligible);
  return benchmarkOrder.flatMap((metric) => {
    const benchmark = candidates.find(
      (candidate) => candidate.team === team && candidate.metric === metric,
    );
    if (!benchmark) return [];
    return [
      {
        metric: benchmark.metric,
        rate: {
          value: benchmark.value,
          numerator: benchmark.numerator,
          denominator: benchmark.denominator,
          scale: benchmark.metric.endsWith("percentage")
            ? "percentage"
            : "per-unit",
        },
        sampleGames: benchmark.sampleGames,
      },
    ];
  });
};

const buildScoringProfile = (
  eligible: readonly EligibleGame[],
  team: string,
  context: ReturnType<typeof buildTournamentContext>["teams"][number] | null,
): TeamScoringProfile => {
  const periodGoals: Record<string, number> = {};
  const periodGoalsAgainst: Record<string, number> = {};
  let goals = 0;
  let recordedAssistedGoals = 0;
  let knownScorerGoals = 0;
  let goalsWhileTied = 0;
  let goalsWhileTrailing = 0;
  let responseGoals = 0;
  let responseOpportunities = 0;
  let largestLead = 0;
  let longestRun: TeamRunSummary | null = null;
  let aheadSeconds = 0;
  let tiedSeconds = 0;
  let behindSeconds = 0;
  let observedSeconds = 0;
  let timeSampleGames = 0;
  const recordedScorers = new Set<string>();
  for (const entry of eligible) {
    const side = teamSide(entry.insight, team);
    if (side === null) continue;
    const score = scoreFor(entry.insight, side);
    goals += score.goals;
    for (const period of entry.insight.periods) {
      const value = side === "home" ? period.homeGoals : period.awayGoals;
      const opponentValue =
        side === "home" ? period.awayGoals : period.homeGoals;
      periodGoals[period.period] = (periodGoals[period.period] ?? 0) + value;
      periodGoalsAgainst[period.period] =
        (periodGoalsAgainst[period.period] ?? 0) + opponentValue;
    }
    const state = entry.insight.gameStateTime;
    if (state?.complete) {
      aheadSeconds +=
        side === "home" ? state.homeLeadingSeconds : state.awayLeadingSeconds;
      tiedSeconds += state.tiedSeconds;
      behindSeconds +=
        side === "home" ? state.awayLeadingSeconds : state.homeLeadingSeconds;
      observedSeconds += state.observedSeconds;
      timeSampleGames += 1;
    }
    const profile = entry.insight.scoringProfiles.find(
      (candidate) => candidate.team === team,
    );
    if (profile) {
      recordedAssistedGoals += profile.recordedAssistedGoals;
      knownScorerGoals += profile.knownScorerGoals;
    }
    const closing = entry.insight.closing.find(
      (candidate) => candidate.team === team,
    );
    if (closing) {
      goalsWhileTied += closing.goalsWhileTied;
      goalsWhileTrailing += closing.goalsWhileTrailing;
    }
    const shape = entry.insight.teamShapes.find(
      (candidate) => candidate.team === team,
    );
    if (shape) {
      responseGoals += shape.responseGoals;
      responseOpportunities += shape.responseOpportunities;
    }
    const lead = entry.insight.largestLeads.find(
      (candidate) => candidate.team === team,
    );
    largestLead = Math.max(largestLead, lead?.goals ?? 0);
    for (const run of entry.insight.scoringRuns) {
      if (run.team !== team || run.goals <= (longestRun?.goals ?? 0)) continue;
      longestRun = TeamRunSummary.make({
        gameId: entry.source.id,
        opponent: opponentFor(entry.insight, side),
        goals: run.goals,
        durationSeconds: run.durationSeconds,
      });
    }
    for (const contributor of entry.insight.scoringContributors) {
      if (contributor.team !== team || contributor.goals <= 0) continue;
      recordedScorers.add(
        contributor.id ?? `${contributor.team}\u0000${contributor.name}`,
      );
    }
  }
  return {
    sampleGames: eligible.length,
    periodGoals,
    periodGoalsAgainst,
    goals,
    recordedAssistedGoals,
    knownScorerGoals,
    recordedScorers: recordedScorers.size,
    goalsWhileTied,
    goalsWhileTrailing,
    responseGoals,
    responseOpportunities,
    largestLead,
    longestRun,
    aheadSeconds,
    tiedSeconds,
    behindSeconds,
    observedSeconds,
    timeSampleGames,
    averageCloseGameSeconds: context?.averageCloseGameSeconds ?? null,
    closeGameSampleGames: context?.closeGameSampleGames ?? 0,
  };
};

const buildGameAnalyses = (
  team: string,
  schedule: readonly ScheduledGame[],
  detailsById: ReadonlyMap<string, GameDetails>,
  eligibleById: ReadonlyMap<string, EligibleGame>,
): readonly TeamGameAnalysis[] =>
  schedule.flatMap((game) => {
    const isHome = game.home.name === team;
    if (!isHome && game.away.name !== team) return [];
    const opponent = isHome ? game.away : game.home;
    const goalsFor = isHome ? game.home.score : game.away.score;
    const goalsAgainst = isHome ? game.away.score : game.home.score;
    const final = isCompletedGame(game);
    const eligible = eligibleById.get(game.id);
    const insight = eligible?.insight;
    const state = insight?.gameStateTime;
    const lead = insight?.largestLeads.find(
      (candidate) => candidate.team === team,
    );
    const shape = insight?.teamShapes.find(
      (candidate) => candidate.team === team,
    );
    const details = detailsById.get(game.id);
    const shooting = eligible ? reconciledShootingRate(eligible, team) : null;
    const draws =
      eligible && details ? reconciledDrawRatio(details, team) : null;
    const closeGame =
      eligible && state?.complete && state.observedSeconds > 0
        ? percentageRate(
            state.tiedSeconds + state.oneGoalMarginSeconds,
            state.observedSeconds,
          )
        : null;
    return [
      {
        gameId: game.id,
        date: game.date,
        time: game.time,
        phase: game.phase,
        venue: game.venue,
        status: game.status,
        period: game.period ?? null,
        opponentId: opponent.id,
        opponentCode: opponent.code ?? opponent.name,
        opponent: opponent.name,
        opponentFlagUrl: opponent.flagUrl,
        isHome,
        goalsFor,
        goalsAgainst,
        result:
          final && goalsFor !== null && goalsAgainst !== null
            ? goalsFor > goalsAgainst
              ? "W"
              : "L"
            : null,
        provisional: game.status.toUpperCase() === "UNOFFICIAL",
        eligible: eligible !== undefined,
        shooting,
        drawControl: draws,
        closeGame,
        largestLead: eligible ? (lead?.goals ?? 0) : null,
        longestRunGoals: eligible ? (shape?.longestRunGoals ?? 0) : null,
      },
    ];
  });

export const buildTeamAnalysis = (
  team: string,
  source: Readonly<CurrentTeamAnalysisSource>,
  teamPools: readonly TeamPool[],
): TeamAnalysisValue => {
  const duplicateScheduleIds = duplicateIds(source.schedule);
  const schedule = source.schedule.filter(
    (game) => !duplicateScheduleIds.has(game.id),
  );
  const scheduleById = new Map(schedule.map((game) => [game.id, game]));
  const duplicateDetailIds = duplicateIds(source.games);
  const acceptedGames = source.games.filter((game) => {
    const scheduled = scheduleById.get(game.id);
    return (
      scheduled !== undefined &&
      !duplicateDetailIds.has(game.id) &&
      gameDetailMatchesSchedule(scheduled, game)
    );
  });
  const completedIds = new Set(
    schedule.filter(isCompletedGame).map((game) => game.id),
  );
  const context = buildTournamentContext(
    acceptedGames.filter((game) => completedIds.has(game.id)),
    {
      sourceUpdatedAt: source.updatedAt,
      teamPools,
    },
  );
  const eligibleIds = new Set(
    context.games.filter((game) => game.eligible).map((game) => game.gameId),
  );
  const eligible: EligibleGame[] = acceptedGames.flatMap((game) => {
    if (!eligibleIds.has(game.id)) return [];
    return [{ source: game, insight: buildMatchInsights(game) }];
  });
  const teamEligible = eligible.filter(
    (entry) => teamSide(entry.insight, team) !== null,
  );
  const teamContext =
    context.teams.find((candidate) => candidate.team === team) ?? null;
  const completedGames = schedule.filter(
    (game) =>
      isCompletedGame(game) &&
      (game.home.name === team || game.away.name === team),
  ).length;
  const detailsById = new Map(acceptedGames.map((game) => [game.id, game]));
  const eligibleById = new Map(
    teamEligible.map((entry) => [entry.source.id, entry]),
  );
  return Schema.decodeUnknownSync(TeamAnalysis)({
    generatedFrom: source.updatedAt,
    team,
    completedGames,
    eligibleGames: teamEligible.length,
    excludedCompletedGames: completedGames - teamEligible.length,
    context: teamContext,
    benchmarks: buildBenchmarks(eligible, team),
    scoring: buildScoringProfile(teamEligible, team, teamContext),
    playerLeaderboards: buildPlayerLeaderboards(teamEligible, team),
    games: buildGameAnalyses(team, schedule, detailsById, eligibleById),
  });
};
