import { buildMatchInsights } from "./match-insights";
import type {
  MatchInsightScoringBurst,
  MatchInsightSide,
  MatchInsights,
} from "./match-insights-schema";
import type {
  DerivedPlayerStats,
  GameDetails,
  PlayerDetails,
  PlayerGameLog,
} from "./schema";
import {
  TournamentBurstPlacement,
  TournamentBurstRecord,
  TournamentCloseGameRecord,
  TournamentCloseShootingRecord,
  TournamentComebackPlacement,
  TournamentComebackRecord,
  TournamentContext,
  TournamentContextGame,
  TournamentContextSample,
  TournamentGameContext,
  TournamentGoalkeeperRank,
  TournamentPlayerLeaderboard,
  TournamentPlayerRank,
  TournamentRecentResult,
  TournamentTeamContext,
  type TournamentContextRank,
  type TournamentGamePlacement,
  type TournamentPlayerMetric,
} from "./tournament-context-schema";

export const CLOSE_GAME_SHOOTING_MINIMUM_SHOTS = 5;
export const GOALKEEPER_RANKING_MINIMUM_MINUTES = 60;
export const GOALKEEPER_RANKING_MINIMUM_SHOTS_FACED = 10;

const insightSides: readonly MatchInsightSide[] = ["home", "away"];

interface TournamentContextOptions {
  readonly sourceUpdatedAt?: string;
  readonly playerRankLimit?: number | null;
  readonly players?: readonly PlayerDetails[];
  readonly teamPools?: readonly {
    readonly name: string;
    readonly pool: string;
  }[];
}

interface EligibleGame {
  readonly source: GameDetails;
  readonly insight: MatchInsights;
  readonly game: TournamentContextGame;
  readonly sourceOrder: number;
}

interface Ranked<T> {
  readonly item: T;
  readonly rank: TournamentContextRank;
}

const average = (values: readonly number[]): number | null =>
  values.length === 0
    ? null
    : values.reduce((total, value) => total + value, 0) / values.length;

const throughRank = <T>(
  entries: readonly Ranked<T>[],
  maximumRank: number,
): readonly Ranked<T>[] =>
  entries.filter((entry) => entry.rank.rank <= maximumRank);

const rankItems = <T>(
  items: readonly T[],
  valueOf: (item: T) => number,
  keyOf: (item: T) => string,
  direction: "ascending" | "descending",
  total = items.length,
): readonly Ranked<T>[] => {
  const sorted = items.toSorted((left, right) => {
    const difference =
      direction === "ascending"
        ? valueOf(left) - valueOf(right)
        : valueOf(right) - valueOf(left);
    return difference === 0
      ? keyOf(left).localeCompare(keyOf(right))
      : difference;
  });
  let previousValue: number | null = null;
  let currentRank = 0;
  return sorted.map((item, index) => {
    const value = valueOf(item);
    if (previousValue === null || value !== previousValue)
      currentRank = index + 1;
    previousValue = value;
    const tied = sorted.some(
      (candidate, candidateIndex) =>
        candidateIndex !== index && valueOf(candidate) === value,
    );
    return {
      item,
      rank: {
        rank: currentRank,
        total,
        percentile:
          total <= 1 ? 100 : ((total - currentRank) / (total - 1)) * 100,
        tied,
      },
    };
  });
};

const gameReference = (source: GameDetails, insight: MatchInsights) =>
  TournamentContextGame.make({
    gameId: source.id,
    date: source.date,
    phase: source.phase,
    home: insight.home,
    away: insight.away,
    score: insight.score,
  });

const eligibleForTournamentContext = (insight: MatchInsights): boolean =>
  insight.quality.completeness === "final-reconciled" &&
  insight.quality.scoreFlowValid &&
  insight.quality.scoreConsistency === "consistent";

const closeGameSeconds = (insight: MatchInsights): number | null =>
  insight.gameStateTime?.complete
    ? insight.gameStateTime.tiedSeconds +
      insight.gameStateTime.oneGoalMarginSeconds
    : null;

const shotEventsReconcile = (insight: Readonly<MatchInsights>): boolean =>
  insightSides.every((side) => {
    const eventShots = insight.shotSplits
      .filter((split) => split.side === side)
      .reduce((total, split) => total + split.shots, 0);
    const sourceShots = insight.teamPerformance.find(
      (performance) => performance.side === side,
    )?.shots;
    return (
      sourceShots !== null &&
      sourceShots !== undefined &&
      eventShots === sourceShots
    );
  });

interface CloseGameCandidate {
  readonly eligible: EligibleGame;
  readonly seconds: number;
  readonly observedSeconds: number;
  readonly share: number;
}

interface BurstCandidate {
  readonly eligible: EligibleGame;
  readonly burst: MatchInsightScoringBurst;
}

interface ComebackCandidate {
  readonly eligible: EligibleGame;
  readonly winner: string;
  readonly deficitGoals: number;
}

interface CloseShootingCandidate {
  readonly eligible: EligibleGame;
  readonly side: MatchInsightSide;
  readonly team: string;
  readonly goals: number;
  readonly shots: number;
  readonly percentage: number;
}

interface TeamAppearance {
  readonly eligible: EligibleGame;
  readonly opponent: string;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDifference: number;
  readonly closeGameSeconds: number | null;
}

interface TeamDraft {
  readonly team: string;
  readonly pool: string | null;
  readonly games: number;
  readonly wins: number;
  readonly losses: number;
  readonly ties: number;
  readonly averageGoalsFor: number;
  readonly averageGoalsAgainst: number;
  readonly averageGoalDifference: number;
  readonly averageCloseGameSeconds: number | null;
  readonly closeGameSampleGames: number;
  readonly recent: readonly TournamentRecentResult[];
  readonly opponentAdjustedMargin: number | null;
  readonly opponentAdjustmentGames: number;
}

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

const playerIdentity = (player: {
  readonly id: string | null;
  readonly name: string;
  readonly team: string;
}): string => player.id ?? `${player.team}\u0000${player.name}`;

const unexpectedPlayerMetric = (metric: never): never => {
  throw new Error(`Unsupported tournament player metric: ${String(metric)}`);
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
    default:
      return unexpectedPlayerMetric(metric);
  }
};

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
    default:
      return unexpectedPlayerMetric(metric);
  }
};

const normalizeDate = (value: string): string => {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed)
    ? value.trim()
    : new Date(parsed).toISOString().slice(0, 10);
};

const numericStat = (log: PlayerGameLog, key: string): number | null => {
  const match = log.stats[key]?.match(/^\s*(\d+)\s*$/u);
  if (!match) return null;
  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const leadingStatNumber = (value: string | undefined): number | null => {
  const match = value?.match(/^\s*(\d+)/u);
  if (!match) return null;
  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const playerMetricTeamReconciles = (
  entry: Readonly<EligibleGame>,
  team: string,
  metric: TournamentPlayerMetric,
): boolean => {
  if (metric === "points")
    return (
      playerMetricTeamReconciles(entry, team, "goals") &&
      playerMetricTeamReconciles(entry, team, "recorded-assists")
    );
  const players = entry.source.derivedPlayerStats.filter(
    (player) => player.team === team,
  );
  const derived = players.reduce(
    (total, player) => total + derivedPlayerMetricValue(player, metric),
    0,
  );
  const teamStats = entry.source.teamStats.find(
    (stats) => stats.team === team,
  )?.stats;
  switch (metric) {
    case "goals": {
      const score =
        entry.insight.home.name === team
          ? entry.insight.score.home
          : entry.insight.away.name === team
            ? entry.insight.score.away
            : null;
      return score !== null && derived === score;
    }
    case "recorded-assists": {
      const source = leadingStatNumber(teamStats?.Assists);
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
      const source = leadingStatNumber(teamStats?.["Draw Controls"]);
      return source !== null && derived === source;
    }
    case "ground-balls": {
      const source = leadingStatNumber(teamStats?.["Ground Balls"]);
      return source !== null && derived === source;
    }
    case "caused-turnovers": {
      const source = leadingStatNumber(teamStats?.["Caused Turnovers"]);
      return source !== null && derived === source;
    }
    default:
      return unexpectedPlayerMetric(metric);
  }
};

const opponentForTeam = (entry: EligibleGame, team: string): string | null =>
  entry.insight.home.name === team
    ? entry.insight.away.name
    : entry.insight.away.name === team
      ? entry.insight.home.name
      : null;

const playerLogForGame = (
  player: PlayerDetails,
  entry: EligibleGame,
): PlayerGameLog | undefined => {
  const opponent = opponentForTeam(entry, player.team);
  if (opponent === null) return undefined;
  const gameDate = normalizeDate(entry.source.date);
  return player.gameLog.find(
    (candidate) =>
      normalizeDate(candidate.date) === gameDate &&
      candidate.opponent === opponent,
  );
};

interface GoalkeeperDraft {
  readonly id: string | null;
  readonly name: string;
  readonly team: string;
  games: number;
  estimatedMinutes: number;
  saves: number;
  goalsAllowed: number;
}

const gamePlacements = (
  sourceGames: readonly GameDetails[],
  eligible: readonly EligibleGame[],
  closest: readonly Ranked<CloseGameCandidate>[],
  bursts: readonly Ranked<BurstCandidate>[],
  comebacks: readonly Ranked<ComebackCandidate>[],
  closeShooting: readonly Ranked<CloseShootingCandidate>[],
): readonly TournamentGameContext[] => {
  const eligibleIds = new Set(eligible.map((entry) => entry.source.id));
  return sourceGames.map((source) => {
    const placements: TournamentGamePlacement[] = [];
    for (const entry of closest.filter(
      (candidate) => candidate.item.eligible.source.id === source.id,
    ))
      placements.push({
        metric: "close-game-share",
        side: null,
        team: null,
        value: entry.item.share * 100,
        numerator: entry.item.seconds,
        denominator: entry.item.observedSeconds,
        rank: entry.rank,
      });
    for (const entry of comebacks.filter(
      (candidate) => candidate.item.eligible.source.id === source.id,
    ))
      placements.push(
        TournamentComebackPlacement.make({
          metric: "recovered-deficit",
          side: null,
          team: entry.item.winner,
          value: entry.item.deficitGoals,
          rank: entry.rank,
        }),
      );
    for (const entry of bursts.filter(
      (candidate) => candidate.item.eligible.source.id === source.id,
    )) {
      const metric =
        entry.item.burst.goals === 2
          ? "fastest-2-goal-burst"
          : entry.item.burst.goals === 3
            ? "fastest-3-goal-burst"
            : "fastest-4-goal-burst";
      placements.push(
        TournamentBurstPlacement.make({
          metric,
          side: entry.item.burst.side,
          team: entry.item.burst.team,
          value: entry.item.burst.durationSeconds,
          rank: entry.rank,
        }),
      );
    }
    for (const entry of closeShooting.filter(
      (candidate) => candidate.item.eligible.source.id === source.id,
    ))
      placements.push({
        metric: "close-game-shooting",
        side: entry.item.side,
        team: entry.item.team,
        value: entry.item.percentage,
        numerator: entry.item.goals,
        denominator: entry.item.shots,
        rank: entry.rank,
      });
    return TournamentGameContext.make({
      gameId: source.id,
      eligible: eligibleIds.has(source.id),
      placements,
    });
  });
};

export const buildTournamentContext = (
  games: readonly GameDetails[],
  options: TournamentContextOptions = {},
): TournamentContext => {
  const analyzed = games.map((source, sourceOrder) => {
    const insight = buildMatchInsights(source);
    return { source, insight, sourceOrder };
  });
  const eligible: EligibleGame[] = analyzed
    .filter(({ insight }) => eligibleForTournamentContext(insight))
    .map(({ source, insight, sourceOrder }) => ({
      source,
      insight,
      sourceOrder,
      game: gameReference(source, insight),
    }));
  const eligibleTeamGames = eligible.length * 2;

  const closeCandidates: CloseGameCandidate[] = eligible.flatMap((entry) => {
    const seconds = closeGameSeconds(entry.insight);
    const observedSeconds = entry.insight.gameStateTime?.observedSeconds ?? 0;
    return seconds === null || observedSeconds <= 0
      ? []
      : [
          {
            eligible: entry,
            seconds,
            observedSeconds,
            share: seconds / observedSeconds,
          },
        ];
  });
  const rankedClosest = rankItems(
    closeCandidates,
    (entry) => entry.share,
    (entry) => entry.eligible.source.id,
    "descending",
  );

  const burstCandidates: BurstCandidate[] = eligible.flatMap((entry) =>
    entry.insight.fastestScoringBursts.map((burst) => ({
      eligible: entry,
      burst,
    })),
  );
  const timeEligibleTeamGames = closeCandidates.length * 2;
  const rankedBursts = [2, 3, 4].flatMap((goals) =>
    rankItems(
      burstCandidates.filter((entry) => entry.burst.goals === goals),
      (entry) => entry.burst.durationSeconds,
      (entry) => `${entry.eligible.source.id}\u0000${entry.burst.team}`,
      "ascending",
      timeEligibleTeamGames,
    ),
  );

  const comebackCandidates: ComebackCandidate[] = eligible.flatMap((entry) => {
    const deficitGoals = entry.insight.winnerLargestDeficit ?? 0;
    const winnerSide = entry.insight.winner;
    if (deficitGoals <= 0 || winnerSide === null) return [];
    return [
      {
        eligible: entry,
        winner:
          winnerSide === "home"
            ? entry.insight.home.name
            : entry.insight.away.name,
        deficitGoals,
      },
    ];
  });
  const rankedComebacks = rankItems(
    comebackCandidates,
    (entry) => entry.deficitGoals,
    (entry) => entry.eligible.source.id,
    "descending",
    eligible.length,
  );

  const closeShootingCandidates: CloseShootingCandidate[] = eligible.flatMap(
    (entry) => {
      if (
        entry.insight.quality.unattributedShotEvents > 0 ||
        !shotEventsReconcile(entry.insight)
      )
        return [];
      return entry.insight.eventProfiles.flatMap((profile) =>
        profile.closeGameShots < CLOSE_GAME_SHOOTING_MINIMUM_SHOTS
          ? []
          : [
              {
                eligible: entry,
                side: profile.side,
                team: profile.team,
                goals: profile.closeGameGoals,
                shots: profile.closeGameShots,
                percentage:
                  (profile.closeGameGoals / profile.closeGameShots) * 100,
              },
            ],
      );
    },
  );
  const rankedCloseShooting = rankItems(
    closeShootingCandidates,
    (entry) => entry.percentage,
    (entry) => `${entry.eligible.source.id}\u0000${entry.team}`,
    "descending",
  );

  const appearances = new Map<string, TeamAppearance[]>();
  for (const entry of eligible) {
    const homeAppearance: TeamAppearance = {
      eligible: entry,
      opponent: entry.insight.away.name,
      goalsFor: entry.insight.score.home,
      goalsAgainst: entry.insight.score.away,
      goalDifference: entry.insight.score.home - entry.insight.score.away,
      closeGameSeconds: closeGameSeconds(entry.insight),
    };
    const awayAppearance: TeamAppearance = {
      eligible: entry,
      opponent: entry.insight.home.name,
      goalsFor: entry.insight.score.away,
      goalsAgainst: entry.insight.score.home,
      goalDifference: entry.insight.score.away - entry.insight.score.home,
      closeGameSeconds: closeGameSeconds(entry.insight),
    };
    appearances.set(entry.insight.home.name, [
      ...(appearances.get(entry.insight.home.name) ?? []),
      homeAppearance,
    ]);
    appearances.set(entry.insight.away.name, [
      ...(appearances.get(entry.insight.away.name) ?? []),
      awayAppearance,
    ]);
  }
  const poolFor = (team: string): string | null =>
    options.teamPools?.find((entry) => entry.name === team)?.pool ?? null;
  const teamDrafts: TeamDraft[] = [...appearances.entries()].map(
    ([team, teamAppearances]) => {
      const sortedAppearances = teamAppearances.toSorted(
        (left, right) => left.eligible.sourceOrder - right.eligible.sourceOrder,
      );
      const pool = poolFor(team);
      const poolAppearances =
        pool === null
          ? []
          : teamAppearances.filter(
              (appearance) =>
                appearance.eligible.source.phase
                  .toUpperCase()
                  .startsWith("POOL") && poolFor(appearance.opponent) === pool,
            );
      const adjustedMargins: number[] = [];
      for (const appearance of poolAppearances) {
        const opponentOtherMargins = (
          appearances.get(appearance.opponent) ?? []
        )
          .filter(
            (other) =>
              other.opponent !== team &&
              other.eligible.source.phase.toUpperCase().startsWith("POOL") &&
              poolFor(other.opponent) === pool,
          )
          .map((other) => other.goalDifference);
        const opponentBaseline = average(opponentOtherMargins);
        if (opponentBaseline !== null)
          adjustedMargins.push(appearance.goalDifference + opponentBaseline);
      }
      const recent = sortedAppearances
        .slice(-3)
        .toReversed()
        .map((appearance) =>
          TournamentRecentResult.make({
            gameId: appearance.eligible.source.id,
            date: appearance.eligible.source.date,
            opponent: appearance.opponent,
            result:
              appearance.goalDifference > 0
                ? "W"
                : appearance.goalDifference < 0
                  ? "L"
                  : "T",
            goalsFor: appearance.goalsFor,
            goalsAgainst: appearance.goalsAgainst,
          }),
        );
      const closeSamples = teamAppearances.flatMap((appearance) =>
        appearance.closeGameSeconds === null
          ? []
          : [appearance.closeGameSeconds],
      );
      return {
        team,
        pool,
        games: teamAppearances.length,
        wins: teamAppearances.filter(
          (appearance) => appearance.goalDifference > 0,
        ).length,
        losses: teamAppearances.filter(
          (appearance) => appearance.goalDifference < 0,
        ).length,
        ties: teamAppearances.filter(
          (appearance) => appearance.goalDifference === 0,
        ).length,
        averageGoalsFor:
          average(teamAppearances.map((entry) => entry.goalsFor)) ?? 0,
        averageGoalsAgainst:
          average(teamAppearances.map((entry) => entry.goalsAgainst)) ?? 0,
        averageGoalDifference:
          average(teamAppearances.map((entry) => entry.goalDifference)) ?? 0,
        averageCloseGameSeconds: average(closeSamples),
        closeGameSampleGames: closeSamples.length,
        recent,
        opponentAdjustedMargin: average(adjustedMargins),
        opponentAdjustmentGames: adjustedMargins.length,
      };
    },
  );
  const adjustedRanks = new Map<string, TournamentContextRank>();
  const pools = new Set(
    teamDrafts.flatMap((team) => (team.pool === null ? [] : [team.pool])),
  );
  for (const pool of pools) {
    const ranked = rankItems(
      teamDrafts.filter(
        (team) => team.pool === pool && team.opponentAdjustedMargin !== null,
      ),
      (team) => team.opponentAdjustedMargin ?? 0,
      (team) => team.team,
      "descending",
    );
    for (const entry of ranked) adjustedRanks.set(entry.item.team, entry.rank);
  }
  const teamContexts = teamDrafts
    .map((team) =>
      TournamentTeamContext.make({
        ...team,
        opponentAdjustedRank: adjustedRanks.get(team.team) ?? null,
      }),
    )
    .toSorted(
      (left, right) =>
        (left.pool ?? "").localeCompare(right.pool ?? "") ||
        left.team.localeCompare(right.team),
    );

  const playerMetrics: readonly TournamentPlayerMetric[] = [
    "points",
    "goals",
    "recorded-assists",
    "draw-controls",
    "ground-balls",
    "caused-turnovers",
  ];
  const playerLeaderboards = playerMetrics.map((metric) => {
    const metricEligibleGames = eligible.filter(
      (entry) =>
        playerMetricTeamReconciles(entry, entry.insight.home.name, metric) &&
        playerMetricTeamReconciles(entry, entry.insight.away.name, metric),
    );
    const playerDrafts = new Map<string, PlayerDraft>();
    for (const entry of metricEligibleGames) {
      for (const player of entry.source.derivedPlayerStats) {
        const identity = playerIdentity(player);
        const existing = playerDrafts.get(identity) ?? {
          id: player.id,
          name: player.name,
          team: player.team,
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
        playerDrafts.set(identity, existing);
      }
    }
    const ranked = rankItems(
      [...playerDrafts.values()].filter(
        (player) => playerMetricValue(player, metric) > 0,
      ),
      (player) => playerMetricValue(player, metric),
      (player) => `${player.team}\u0000${player.name}`,
      "descending",
    );
    const published =
      options.playerRankLimit === null
        ? ranked
        : throughRank(ranked, options.playerRankLimit ?? 10);
    return TournamentPlayerLeaderboard.make({
      metric,
      sampleGames: metricEligibleGames.length,
      entries: published.map((entry) =>
        TournamentPlayerRank.make({
          id: entry.item.id,
          name: entry.item.name,
          team: entry.item.team,
          value: playerMetricValue(entry.item, metric),
          rank: entry.rank,
        }),
      ),
    });
  });

  const goalkeeperPlayers = (options.players ?? []).filter(
    (player) => player.playerType === "Goalkeeper",
  );
  const reconciledGoalkeeperTeamGames = new Set<string>();
  for (const entry of eligible) {
    for (const side of insightSides) {
      const team = entry.insight[side].name;
      const opponentGoals =
        side === "home" ? entry.insight.score.away : entry.insight.score.home;
      const sourceSaves = leadingStatNumber(
        entry.source.teamStats.find((stats) => stats.team === team)?.stats
          .Saves,
      );
      const logs = goalkeeperPlayers.flatMap((player) => {
        if (player.team !== team) return [];
        const log = playerLogForGame(player, entry);
        return log ? [log] : [];
      });
      const parsedLogs = logs.flatMap((log) => {
        const saves = numericStat(log, "Saves");
        const goalsAllowed = numericStat(log, "Goals Allowed");
        return saves === null || goalsAllowed === null
          ? []
          : [{ saves, goalsAllowed }];
      });
      if (parsedLogs.length !== logs.length) continue;
      const loggedSaves = parsedLogs.reduce(
        (total, log) => total + log.saves,
        0,
      );
      const loggedGoalsAllowed = parsedLogs.reduce(
        (total, log) => total + log.goalsAllowed,
        0,
      );
      if (
        sourceSaves !== null &&
        loggedSaves === sourceSaves &&
        loggedGoalsAllowed === opponentGoals
      )
        reconciledGoalkeeperTeamGames.add(`${entry.source.id}\u0000${team}`);
    }
  }
  const goalkeeperDrafts: GoalkeeperDraft[] = goalkeeperPlayers.flatMap(
    (player) => {
      const teamGames = eligible.filter(
        (entry) =>
          reconciledGoalkeeperTeamGames.has(
            `${entry.source.id}\u0000${player.team}`,
          ) && opponentForTeam(entry, player.team) !== null,
      );
      const draft: GoalkeeperDraft = {
        id: player.id,
        name: player.name,
        team: player.team,
        games: 0,
        estimatedMinutes: 0,
        saves: 0,
        goalsAllowed: 0,
      };
      for (const entry of teamGames) {
        const log = playerLogForGame(player, entry);
        if (!log) continue;
        const saves = numericStat(log, "Saves");
        const goalsAllowed = numericStat(log, "Goals Allowed");
        if (saves === null || goalsAllowed === null) continue;
        if (log.estimatedMinutesPlayed <= 0 && saves + goalsAllowed === 0)
          continue;
        draft.games += 1;
        draft.estimatedMinutes += log.estimatedMinutesPlayed;
        draft.saves += saves;
        draft.goalsAllowed += goalsAllowed;
      }
      return draft.estimatedMinutes >= GOALKEEPER_RANKING_MINIMUM_MINUTES &&
        draft.saves + draft.goalsAllowed >=
          GOALKEEPER_RANKING_MINIMUM_SHOTS_FACED
        ? [draft]
        : [];
    },
  );
  const rankedGoalkeepers = rankItems(
    goalkeeperDrafts,
    (goalkeeper) =>
      goalkeeper.saves / (goalkeeper.saves + goalkeeper.goalsAllowed),
    (goalkeeper) => `${goalkeeper.team}\u0000${goalkeeper.name}`,
    "descending",
  );
  const goalkeeperRankings = rankedGoalkeepers.map((entry) =>
    TournamentGoalkeeperRank.make({
      ...entry.item,
      savePercentage:
        (entry.item.saves / (entry.item.saves + entry.item.goalsAllowed)) * 100,
      rank: entry.rank,
    }),
  );

  const sourceDates = eligible
    .map((entry) => entry.source.date)
    .toSorted((left, right) => Date.parse(left) - Date.parse(right));
  return TournamentContext.make({
    generatedFrom: "world-lacrosse-game-details-v1",
    sample: TournamentContextSample.make({
      eligibleGames: eligible.length,
      excludedGames: games.length - eligible.length,
      eligibleTeamGames,
      completedThrough: sourceDates.at(-1) ?? null,
      sourceUpdatedAt: options.sourceUpdatedAt ?? null,
      criteria:
        "Official finals with reconciled final score and valid source score flow; time and shot rankings apply additional metric-specific checks.",
    }),
    games: gamePlacements(
      games,
      eligible,
      rankedClosest,
      rankedBursts,
      rankedComebacks,
      rankedCloseShooting,
    ),
    closestGames: throughRank(rankedClosest, 5).map((entry) =>
      TournamentCloseGameRecord.make({
        game: entry.item.eligible.game,
        closeGameSeconds: entry.item.seconds,
        observedSeconds: entry.item.observedSeconds,
        closeGameShare: entry.item.share * 100,
        rank: entry.rank,
      }),
    ),
    fastestBursts: rankedBursts
      .filter((entry) => entry.rank.rank <= 3)
      .map((entry) =>
        TournamentBurstRecord.make({
          game: entry.item.eligible.game,
          side: entry.item.burst.side,
          team: entry.item.burst.team,
          goals: entry.item.burst.goals,
          durationSeconds: entry.item.burst.durationSeconds,
          startPeriod: entry.item.burst.startPeriod,
          startClock: entry.item.burst.startClock,
          endPeriod: entry.item.burst.endPeriod,
          endClock: entry.item.burst.endClock,
          rank: entry.rank,
        }),
      ),
    largestComebacks: throughRank(rankedComebacks, 5).map((entry) =>
      TournamentComebackRecord.make({
        game: entry.item.eligible.game,
        winner: entry.item.winner,
        deficitGoals: entry.item.deficitGoals,
        rank: entry.rank,
      }),
    ),
    bestCloseGameShooting: throughRank(rankedCloseShooting, 10).map((entry) =>
      TournamentCloseShootingRecord.make({
        game: entry.item.eligible.game,
        side: entry.item.side,
        team: entry.item.team,
        goals: entry.item.goals,
        shots: entry.item.shots,
        percentage: entry.item.percentage,
        rank: entry.rank,
      }),
    ),
    teams: teamContexts,
    playerLeaderboards,
    goalkeeperTeamGameSample: reconciledGoalkeeperTeamGames.size,
    goalkeeperExpectedTeamGames: eligible.length * insightSides.length,
    goalkeeperRankings,
  });
};
