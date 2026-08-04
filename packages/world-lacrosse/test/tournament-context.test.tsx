import { Schema } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TournamentGameContextPanel } from "../src/components/tournament-game-context";
import { championship } from "../src/lib/championship-data";
import { buildMatchInsights } from "../src/lib/match-insights";
import {
  DerivedPlayerStats,
  GameDetails,
  PlayerDetails,
  PlayerGameLog,
  type Play,
} from "../src/lib/schema";
import {
  buildTournamentContext,
  CLOSE_GAME_SHOOTING_MINIMUM_SHOTS,
  GOALKEEPER_RANKING_MINIMUM_MINUTES,
  GOALKEEPER_RANKING_MINIMUM_SHOTS_FACED,
} from "../src/lib/tournament-context";
import {
  TournamentContext,
  TournamentContextRank,
  TournamentGameContext,
} from "../src/lib/tournament-context-schema";
import { tournament } from "../src/lib/tournament-data";

const context = buildTournamentContext(championship.games, {
  sourceUpdatedAt: championship.scrapedAt,
  players: championship.players,
  teamPools: tournament.teams.map((team) => ({
    name: team.name,
    pool: team.pool,
  })),
});

const eligibleGameIds = new Set(
  context.games.filter((game) => game.eligible).map((game) => game.gameId),
);

const copyDerivedPlayer = (
  player: Readonly<DerivedPlayerStats>,
  groundBalls: number,
) =>
  DerivedPlayerStats.make({
    id: player.id,
    name: player.name,
    team: player.team,
    goals: player.goals,
    assists: player.assists,
    unassistedGoals: player.unassistedGoals,
    shots: player.shots,
    shotsOnGoal: player.shotsOnGoal,
    shotsOffTarget: player.shotsOffTarget,
    freePositionGoals: player.freePositionGoals,
    freePositionAttempts: player.freePositionAttempts,
    groundBalls,
    drawControls: player.drawControls,
    turnovers: player.turnovers,
    causedTurnovers: player.causedTurnovers,
    yellowCards: player.yellowCards,
    greenCards: player.greenCards,
    redCards: player.redCards,
    startedGame: player.startedGame,
    goalkeeperStarts: player.goalkeeperStarts,
  });

const copyGame = (
  game: Readonly<GameDetails>,
  changes: {
    readonly phase?: string;
    readonly plays?: readonly Play[];
    readonly derivedPlayerStats?: readonly DerivedPlayerStats[];
  },
) =>
  GameDetails.make({
    id: game.id,
    url: game.url,
    competition: game.competition,
    phase: changes.phase ?? game.phase,
    date: game.date,
    time: game.time,
    venue: game.venue,
    status: game.status,
    home: game.home,
    away: game.away,
    periodScores: game.periodScores,
    teamStats: game.teamStats,
    plays: changes.plays ?? game.plays,
    derivedPlayerStats: changes.derivedPlayerStats ?? game.derivedPlayerStats,
    rosters: game.rosters,
    officials: game.officials,
  });

const copyPlayerLog = (log: Readonly<PlayerGameLog>, saves: string) =>
  PlayerGameLog.make({
    date: log.date,
    opponent: log.opponent,
    goalkeeperStarted: log.goalkeeperStarted,
    goalkeeperPeriodStarts: log.goalkeeperPeriodStarts,
    estimatedMinutesPlayed: log.estimatedMinutesPlayed,
    estimatedShots: log.estimatedShots,
    estimatedGoals: log.estimatedGoals,
    stats: { ...log.stats, Saves: saves },
  });

const copyPlayer = (
  player: Readonly<PlayerDetails>,
  gameLog: readonly PlayerGameLog[],
) =>
  PlayerDetails.make({
    id: player.id,
    url: player.url,
    name: player.name,
    teamId: player.teamId,
    team: player.team,
    teamUrl: player.teamUrl,
    flagUrl: player.flagUrl,
    number: player.number,
    playerType: player.playerType,
    position: player.position,
    height: player.height,
    hometown: player.hometown,
    university: player.university,
    gamesStarted: player.gamesStarted,
    goalkeeperPeriodStarts: player.goalkeeperPeriodStarts,
    estimatedMinutesPlayed: player.estimatedMinutesPlayed,
    estimatedShots: player.estimatedShots,
    estimatedGoals: player.estimatedGoals,
    stats: player.stats,
    gameLog,
  });

describe("tournament context", () => {
  it("round-trips through its runtime schema", () => {
    const encoded = Schema.encodeSync(TournamentContext)(context);
    expect(Schema.decodeUnknownSync(TournamentContext)(encoded)).toEqual(
      context,
    );
  });

  it("includes only official reconciled finals in the shared sample", () => {
    const expectedEligible = championship.games.filter(
      (game) =>
        buildMatchInsights(game).quality.completeness === "final-reconciled",
    );
    expect(context.sample.eligibleGames).toBe(expectedEligible.length);
    expect(context.sample.excludedGames).toBe(
      championship.games.length - expectedEligible.length,
    );
    expect(context.sample.sourceUpdatedAt).toBe(championship.scrapedAt);
    expect(eligibleGameIds).toEqual(
      new Set(expectedEligible.map((game) => game.id)),
    );
    expect(
      context.games.every(
        (game) => game.eligible === eligibleGameIds.has(game.gameId),
      ),
    ).toBe(true);
  });

  it("uses metric-specific denominators and competition ranks", () => {
    const timeEligibleGames = context.games.filter((game) =>
      game.placements.some(
        (placement) => placement.metric === "close-game-share",
      ),
    ).length;
    expect(context.closestGames).toEqual(
      context.closestGames.toSorted(
        (left, right) =>
          right.closeGameShare - left.closeGameShare ||
          left.game.gameId.localeCompare(right.game.gameId),
      ),
    );
    for (const record of context.closestGames) {
      expect(record.closeGameShare).toBeCloseTo(
        (record.closeGameSeconds / record.observedSeconds) * 100,
      );
      expect(record.rank.total).toBe(timeEligibleGames);
      expect(record.rank.percentile).toBeCloseTo(
        timeEligibleGames <= 1
          ? 100
          : ((timeEligibleGames - record.rank.rank) / (timeEligibleGames - 1)) *
              100,
      );
    }

    for (const goals of [2, 3, 4]) {
      const bursts = context.fastestBursts.filter(
        (record) => record.goals === goals,
      );
      expect(bursts.map((record) => record.durationSeconds)).toEqual(
        bursts
          .map((record) => record.durationSeconds)
          .toSorted((left, right) => left - right),
      );
      expect(
        bursts.every((record) => record.rank.total === timeEligibleGames * 2),
      ).toBe(true);
    }

    const comebackRanksByDeficit = new Map<number, Set<number>>();
    for (const comeback of context.largestComebacks) {
      const ranks =
        comebackRanksByDeficit.get(comeback.deficitGoals) ?? new Set();
      ranks.add(comeback.rank.rank);
      comebackRanksByDeficit.set(comeback.deficitGoals, ranks);
    }
    expect(
      [...comebackRanksByDeficit.values()].every((ranks) => ranks.size === 1),
    ).toBe(true);
    expect(
      context.largestComebacks.every(
        (record) => record.rank.total === context.sample.eligibleGames,
      ),
    ).toBe(true);
    const tieFixtureIds = new Set(["73", "76", "110", "70", "107", "111"]);
    const tieContext = buildTournamentContext(
      championship.games.filter((game) => tieFixtureIds.has(game.id)),
    );
    expect(
      tieContext.largestComebacks.map((record) => record.rank.rank),
    ).toEqual([1, 1, 3, 3, 5, 5]);
    expect(
      context.playerLeaderboards.every((leaderboard) =>
        leaderboard.entries.every((entry) => entry.rank.rank <= 10),
      ),
    ).toBe(true);
  });

  it("enforces qualification and provenance boundaries for player, shooting, and goalkeeper ranks", () => {
    for (const leaderboard of context.playerLeaderboards) {
      expect(leaderboard.sampleGames).toBeLessThanOrEqual(
        context.sample.eligibleGames,
      );
      const values = leaderboard.entries.map((entry) => entry.value);
      expect(values).toEqual(values.toSorted((left, right) => right - left));
    }
    expect(
      context.playerLeaderboards.every(
        (leaderboard) =>
          leaderboard.sampleGames <= context.sample.eligibleGames,
      ),
    ).toBe(true);
    for (const record of context.bestCloseGameShooting) {
      expect(record.shots).toBeGreaterThanOrEqual(
        CLOSE_GAME_SHOOTING_MINIMUM_SHOTS,
      );
      expect(record.percentage).toBeCloseTo(
        (record.goals / record.shots) * 100,
      );
      expect(eligibleGameIds.has(record.game.gameId)).toBe(true);
    }
    for (const goalkeeper of context.goalkeeperRankings) {
      expect(goalkeeper.estimatedMinutes).toBeGreaterThanOrEqual(
        GOALKEEPER_RANKING_MINIMUM_MINUTES,
      );
      expect(goalkeeper.saves + goalkeeper.goalsAllowed).toBeGreaterThanOrEqual(
        GOALKEEPER_RANKING_MINIMUM_SHOTS_FACED,
      );
      expect(goalkeeper.savePercentage).toBeCloseTo(
        (goalkeeper.saves / (goalkeeper.saves + goalkeeper.goalsAllowed)) * 100,
      );
    }
  });

  it("fails player metric samples closed on per-team attribution mismatches", () => {
    const source = championship.games.find((game) => game.id === "110");
    expect(source).toBeDefined();
    if (!source) return;
    const wales = source.derivedPlayerStats.find(
      (player) => player.id === "1451",
    );
    const germany = source.derivedPlayerStats.find(
      (player) => player.id === "1242",
    );
    expect(wales).toBeDefined();
    expect(germany).toBeDefined();
    if (!wales || !germany) return;
    const derivedPlayerStats = source.derivedPlayerStats.map((player) => {
      if (player.id === wales.id)
        return copyDerivedPlayer(player, player.groundBalls - 1);
      if (player.id === germany.id)
        return copyDerivedPlayer(player, player.groundBalls + 1);
      return player;
    });
    expect(
      derivedPlayerStats.reduce(
        (total, player) => total + player.groundBalls,
        0,
      ),
    ).toBe(
      source.derivedPlayerStats.reduce(
        (total, player) => total + player.groundBalls,
        0,
      ),
    );
    const corrupted = copyGame(source, { derivedPlayerStats });
    const result = buildTournamentContext([corrupted]);

    expect(
      result.playerLeaderboards.find(
        (leaderboard) => leaderboard.metric === "ground-balls",
      )?.sampleGames,
    ).toBe(0);
  });

  it("withholds close-game shooting when event shots do not reconcile", () => {
    const source = championship.games.find((game) => game.id === "73");
    expect(source).toBeDefined();
    if (!source) return;
    let removed = false;
    const plays = source.plays.filter((play) => {
      if (!removed && play.action === "Shot missed") {
        removed = true;
        return false;
      }
      return true;
    });
    expect(removed).toBe(true);
    const incomplete = copyGame(source, { plays });
    const result = buildTournamentContext([incomplete]);

    expect(result.sample.eligibleGames).toBe(1);
    expect(result.bestCloseGameShooting).toEqual([]);
  });

  it("withholds a goalkeeper team-game when player logs contain malformed numbers", () => {
    const source = championship.games.find((game) => game.id === "110");
    expect(source).toBeDefined();
    if (!source) return;
    const players = championship.players.map((player) => {
      if (player.name !== "BROOKS Harriet") return player;
      const gameLog = player.gameLog.map((log) =>
        log.opponent === "Germany"
          ? copyPlayerLog(log, `${log.stats.Saves ?? "0"}garbage`)
          : log,
      );
      return copyPlayer(player, gameLog);
    });
    const result = buildTournamentContext([source], { players });

    expect(
      result.goalkeeperRankings.some(
        (goalkeeper) => goalkeeper.team === "Wales",
      ),
    ).toBe(false);
    expect(
      result.goalkeeperRankings.some(
        (goalkeeper) => goalkeeper.team === "Germany",
      ),
    ).toBe(true);
  });

  it("requires real pool provenance and pool-stage games for adjusted ranks", () => {
    const withoutPools = buildTournamentContext(championship.games);
    expect(
      withoutPools.teams.every(
        (team) =>
          team.opponentAdjustedMargin === null &&
          team.opponentAdjustedRank === null,
      ),
    ).toBe(true);

    const knockoutGames = championship.games.map((game) =>
      copyGame(game, { phase: "QUARTERFINAL" }),
    );
    const knockoutContext = buildTournamentContext(knockoutGames, {
      teamPools: tournament.teams.map((team) => ({
        name: team.name,
        pool: team.pool,
      })),
    });
    expect(
      knockoutContext.teams.every(
        (team) =>
          team.opponentAdjustedMargin === null &&
          team.opponentAdjustedRank === null,
      ),
    ).toBe(true);
  });

  it("rejects invalid rank bounds and malformed metric placements at decode", () => {
    expect(() =>
      Schema.decodeUnknownSync(TournamentContextRank)({
        rank: 0,
        total: 1,
        percentile: 101,
        tied: false,
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(TournamentContextRank)({
        rank: 2,
        total: 1,
        percentile: 100,
        tied: false,
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(TournamentContextRank)({
        rank: 1,
        total: 2,
        percentile: 50,
        tied: false,
      }),
    ).toThrow();
    const game = context.games.find((candidate) =>
      candidate.placements.some(
        (placement) => placement.metric === "close-game-share",
      ),
    );
    expect(game).toBeDefined();
    if (!game) return;
    const closePlacement = game.placements.find(
      (placement) => placement.metric === "close-game-share",
    );
    expect(closePlacement).toBeDefined();
    if (!closePlacement) return;
    expect(() =>
      Schema.decodeUnknownSync(TournamentGameContext)({
        gameId: game.gameId,
        eligible: game.eligible,
        placements: [
          {
            metric: closePlacement.metric,
            side: closePlacement.side,
            team: closePlacement.team,
            value: closePlacement.value,
            numerator: null,
            denominator: closePlacement.denominator,
            rank: closePlacement.rank,
          },
        ],
      }),
    ).toThrow();
    const shootingGame = context.games.find((candidate) =>
      candidate.placements.some(
        (placement) => placement.metric === "close-game-shooting",
      ),
    );
    expect(shootingGame).toBeDefined();
    if (!shootingGame) return;
    const shootingPlacement = shootingGame.placements.find(
      (placement) => placement.metric === "close-game-shooting",
    );
    expect(shootingPlacement).toBeDefined();
    if (!shootingPlacement) return;
    expect(() =>
      Schema.decodeUnknownSync(TournamentGameContext)({
        gameId: shootingGame.gameId,
        eligible: shootingGame.eligible,
        placements: [
          {
            metric: shootingPlacement.metric,
            side: shootingPlacement.side,
            team: shootingPlacement.team,
            value: 100,
            numerator: 6,
            denominator: 5,
            rank: shootingPlacement.rank,
          },
        ],
      }),
    ).toThrow();
  });

  it("ranks opponent-adjusted margins only within each pool", () => {
    for (const team of context.teams) {
      if (!team.opponentAdjustedRank) continue;
      const ratedPoolTeams = context.teams.filter(
        (candidate) =>
          candidate.pool === team.pool &&
          candidate.opponentAdjustedRank !== null,
      );
      expect(team.opponentAdjustedRank.total).toBe(ratedPoolTeams.length);
      expect(team.opponentAdjustmentGames).toBeGreaterThan(0);
    }
  });

  it("renders game placements without internal sample disclosure", () => {
    const game = context.games.find(
      (candidate) => candidate.eligible && candidate.placements.length > 0,
    );
    expect(game).toBeDefined();
    if (!game) return;
    const html = renderToStaticMarkup(
      <TournamentGameContextPanel context={game} />,
    );

    expect(html).toContain("Tournament context");
    expect(html).toContain(`of ${game.placements[0]?.rank.total}`);
    expect(html).not.toContain("official, reconciled games");
    expect(html).not.toContain("source refreshed");
  });
});
