import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { championship } from "../src/lib/championship-data";
import {
  buildMatchInsights,
  buildMatchInsightsDataset,
} from "../src/lib/match-insights";
import { MatchInsights } from "../src/lib/match-insights-schema";
import {
  GameDetails,
  GameId,
  PeriodScore,
  Play,
  PlayParticipant,
  Team,
} from "../src/lib/schema";

interface GoalFixture {
  readonly side: "home" | "away";
  readonly clock: string;
  readonly result: string;
  readonly scorer: string;
  readonly scorerId: string;
  readonly assist?: { readonly name: string; readonly id: string };
  readonly freePosition?: boolean;
}

const team = (name: string, code: string, score: number | null) =>
  Team.make({
    id: code,
    code,
    name,
    flagUrl: null,
    score,
  });

const structuralPlay = (action: string, clock: string, period = "Quarter 1") =>
  Play.make({
    period,
    home: "",
    time: clock,
    result: "",
    action,
    away: "",
    participants: [],
  });

const playWithClock = (play: Play, time: string) =>
  Play.make({
    period: play.period,
    home: play.home,
    time,
    result: play.result,
    action: play.action,
    away: play.away,
    participants: play.participants,
  });

const playInPeriod = (play: Play, period: string) =>
  Play.make({
    period,
    home: play.home,
    time: play.time,
    result: play.result,
    action: play.action,
    away: play.away,
    participants: play.participants,
  });

const goalPlay = ({
  side,
  clock,
  result,
  scorer,
  scorerId,
  assist,
  freePosition = false,
}: GoalFixture) => {
  const teamName = side === "home" ? "Home" : "Away";
  const participants = [
    PlayParticipant.make({
      id: scorerId,
      number: "1",
      name: scorer,
      role: assist ? "Score" : null,
      team: teamName,
    }),
    ...(assist
      ? [
          PlayParticipant.make({
            id: assist.id,
            number: "2",
            name: assist.name,
            role: "Assist",
            team: teamName,
          }),
        ]
      : []),
  ];
  const actor = assist ? `${scorer} (Score) ${assist.name} (Assist)` : scorer;
  return Play.make({
    period: "Quarter 1",
    home: side === "home" ? actor : "",
    time: clock,
    result,
    action: freePosition ? "Free Position Goal" : "Goal",
    away: side === "away" ? actor : "",
    participants,
  });
};

const completeRegulation = (quarterOne: readonly Play[]): readonly Play[] => [
  structuralPlay("START Game", "15:00"),
  ...quarterOne,
  structuralPlay("END Period", "0:00"),
  structuralPlay("START Period", "15:00", "Quarter 2"),
  structuralPlay("END Period", "0:00", "Quarter 2"),
  structuralPlay("START Period", "15:00", "Quarter 3"),
  structuralPlay("END Period", "0:00", "Quarter 3"),
  structuralPlay("START Period", "15:00", "Quarter 4"),
  structuralPlay("END Game", "0:00", "Quarter 4"),
];

const periodKey = (period: string): string =>
  period.replace(/^Quarter\s+(\d+)$/u, "Q$1");

const periodScoresFrom = (
  plays: readonly Play[],
  homeScore: number | null,
  awayScore: number | null,
): readonly PeriodScore[] => {
  if (homeScore === null || awayScore === null) return [];
  const home: Record<string, string> = {};
  const away: Record<string, string> = {};
  for (const period of new Set(plays.map((play) => play.period))) {
    const goals = plays.filter(
      (play) =>
        play.period === period &&
        (play.action === "Goal" || play.action === "Free Position Goal"),
    );
    home[periodKey(period)] = String(
      goals.filter((play) => play.home.length > 0).length,
    );
    away[periodKey(period)] = String(
      goals.filter((play) => play.away.length > 0).length,
    );
  }
  home.SCORE = String(homeScore);
  away.SCORE = String(awayScore);
  return [
    PeriodScore.make({ team: "Home", scores: home }),
    PeriodScore.make({ team: "Away", scores: away }),
  ];
};

const game = ({
  status,
  homeScore,
  awayScore,
  plays,
  periodScores = periodScoresFrom(plays, homeScore, awayScore),
}: {
  readonly status: string;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  readonly plays: readonly Play[];
  readonly periodScores?: readonly PeriodScore[];
}) =>
  GameDetails.make({
    id: GameId.make("fixture-game"),
    url: "https://example.test/game/fixture-game",
    competition: "Test Championship",
    phase: "Pool A",
    date: "July 28, 2026",
    time: "18:30",
    venue: "Test Field",
    status,
    home: team("Home", "HOM", homeScore),
    away: team("Away", "AWY", awayScore),
    periodScores,
    teamStats: [],
    plays,
    derivedPlayerStats: [],
    rosters: [],
    officials: [],
  });

const comebackFixture = game({
  status: "OFFICIAL",
  homeScore: 3,
  awayScore: 2,
  plays: completeRegulation([
    goalPlay({
      side: "home",
      clock: "14:00",
      result: "1-0",
      scorer: "Alice",
      scorerId: "home-alice",
    }),
    goalPlay({
      side: "away",
      clock: "13:00",
      result: "1-1",
      scorer: "Cara",
      scorerId: "away-cara",
    }),
    goalPlay({
      side: "away",
      clock: "12:00",
      result: "1-2",
      scorer: "Cara",
      scorerId: "away-cara",
      assist: { name: "Dani", id: "away-dani" },
    }),
    goalPlay({
      side: "home",
      clock: "11:00",
      result: "2-2",
      scorer: "Bea",
      scorerId: "home-bea",
      freePosition: true,
    }),
    goalPlay({
      side: "home",
      clock: "10:00",
      result: "3-2",
      scorer: "Alice",
      scorerId: "home-alice",
    }),
  ]),
});

describe("match insights", () => {
  it("round-trips derived output through its runtime schema", () => {
    const insights = buildMatchInsights(comebackFixture);
    const encoded = Schema.encodeSync(MatchInsights)(insights);
    const decoded = Schema.decodeUnknownSync(MatchInsights)(encoded);

    expect(decoded).toEqual(insights);
  });

  it("is deterministic and does not mutate its source game", () => {
    const before = JSON.stringify(comebackFixture);
    const first = buildMatchInsights(comebackFixture);
    const second = buildMatchInsights(comebackFixture);

    expect(second).toEqual(first);
    expect(JSON.stringify(comebackFixture)).toBe(before);
  });

  it("derives a reconciled scoring narrative without subjective labels", () => {
    const insights = buildMatchInsights(comebackFixture);

    expect(insights.quality).toMatchObject({
      completeness: "final-reconciled",
      scoreConsistency: "consistent",
      parsedGoalCount: 5,
      ignoredGoalCount: 0,
      anomalies: [],
    });
    expect(insights.score).toMatchObject({ home: 3, away: 2 });
    expect(insights.winner).toBe("home");
    expect(insights.leadChanges).toBe(2);
    expect(insights.timesTied).toBe(2);
    expect(insights.winnerLargestDeficit).toBe(1);
    expect(insights.gameWinningGoalSequence).toBe(5);
    expect(insights.goals.map((goal) => goal.gameWinner)).toEqual([
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(insights.largestLeads).toMatchObject([
      { side: "home", goals: 1, goalSequence: 1 },
      { side: "away", goals: 1, goalSequence: 3 },
    ]);
    expect(insights.largestDeficits).toMatchObject([
      {
        side: "home",
        team: "Home",
        goals: 1,
        goalSequence: 3,
        score: { home: 1, away: 2 },
      },
      {
        side: "away",
        team: "Away",
        goals: 1,
        goalSequence: 1,
        score: { home: 1, away: 0 },
      },
    ]);
    expect(insights.scoringRuns.map((run) => [run.side, run.goals])).toEqual([
      ["home", 1],
      ["away", 2],
      ["home", 2],
    ]);
    expect(insights.gameStateTime).toMatchObject({
      complete: true,
      observedSeconds: 3600,
      homeLeadingSeconds: 3360,
      tiedSeconds: 180,
      awayLeadingSeconds: 60,
      oneGoalMarginSeconds: 3420,
      twoGoalMarginSeconds: 0,
      threePlusMarginSeconds: 0,
    });
    expect(insights.teamShapes).toMatchObject([
      {
        side: "home",
        longestRunGoals: 2,
        longestDroughtSeconds: 3300,
        longestDroughtGoalsConceded: 0,
        responseGoals: 1,
        responseOpportunities: 2,
        fastestResponseSeconds: 60,
        averageResponseSeconds: 60,
      },
      {
        side: "away",
        longestRunGoals: 2,
        longestDroughtSeconds: 3420,
        longestDroughtGoalsConceded: 2,
        responseGoals: 1,
        responseOpportunities: 3,
        fastestResponseSeconds: 60,
        averageResponseSeconds: 60,
      },
    ]);
    expect(insights.scoringSegments).toMatchObject([
      { segment: "first-half", homeGoals: 3, awayGoals: 2 },
      { segment: "second-half", homeGoals: 0, awayGoals: 0 },
    ]);
    expect(insights.fastestScoringBursts).toMatchObject([
      { side: "home", goals: 2, durationSeconds: 60 },
      { side: "away", goals: 2, durationSeconds: 60 },
    ]);
    expect(insights.closing).toMatchObject([
      {
        side: "home",
        fourthQuarterGoals: 0,
        finalFiveMinuteGoals: 0,
        goalsWhileTied: 2,
        goalsWhileTrailing: 1,
        equalizingGoals: 1,
        goAheadGoals: 2,
      },
      {
        side: "away",
        fourthQuarterGoals: 0,
        finalFiveMinuteGoals: 0,
        goalsWhileTied: 1,
        goalsWhileTrailing: 1,
        equalizingGoals: 1,
        goAheadGoals: 1,
      },
    ]);
    expect(insights.scoringProfiles).toMatchObject([
      {
        side: "home",
        uniqueRecordedScorers: 2,
        topScorerGoals: 2,
        recordedAssistedGoals: 0,
        freePositionGoals: 1,
        freePositionAttempts: 1,
      },
      {
        side: "away",
        uniqueRecordedScorers: 1,
        topScorerGoals: 2,
        recordedAssistedGoals: 1,
        freePositionGoals: 0,
        freePositionAttempts: 0,
      },
    ]);
    expect(insights.scoringCombinations).toMatchObject([
      {
        side: "away",
        scorer: { name: "Cara" },
        recordedAssist: { name: "Dani" },
        goals: 1,
      },
    ]);
    expect(
      insights.shotSplits.filter((split) => split.segment === "first-half"),
    ).toMatchObject([
      {
        side: "home",
        segment: "first-half",
        attributionComplete: true,
        shots: 3,
        shotsOnGoal: 3,
        goals: 3,
      },
      {
        side: "away",
        segment: "first-half",
        attributionComplete: true,
        shots: 2,
        shotsOnGoal: 2,
        goals: 2,
      },
    ]);
    expect(insights.eventProfiles).toMatchObject([
      {
        side: "home",
        closeGameShots: 3,
        closeGameGoals: 3,
        longestSaveRun: 0,
      },
      {
        side: "away",
        closeGameShots: 2,
        closeGameGoals: 2,
        longestSaveRun: 0,
      },
    ]);
    expect(insights.periods[0]).toMatchObject({
      period: "Quarter 1",
      homeGoals: 3,
      awayGoals: 2,
      winner: "home",
      score: { home: 3, away: 2 },
    });
    expect(
      insights.periods
        .slice(1)
        .map((period) => [period.period, period.homeGoals, period.awayGoals]),
    ).toEqual([
      ["Quarter 2", 0, 0],
      ["Quarter 3", 0, 0],
      ["Quarter 4", 0, 0],
    ]);
  });

  it("separates recorded assists from goals with no assist in the feed", () => {
    const insights = buildMatchInsights(comebackFixture);
    const alice = insights.scoringContributors.find(
      (contributor) => contributor.id === "home-alice",
    );
    const cara = insights.scoringContributors.find(
      (contributor) => contributor.id === "away-cara",
    );
    const dani = insights.scoringContributors.find(
      (contributor) => contributor.id === "away-dani",
    );

    expect(alice).toMatchObject({
      goals: 2,
      recordedAssists: 0,
      points: 2,
      goalsWithoutRecordedAssist: 2,
      goalInvolvements: 2,
      equalizingGoals: 0,
      goAheadGoals: 2,
      responseGoals: 0,
    });
    expect(alice?.goalInvolvementShare).toBeCloseTo(2 / 3);
    expect(cara).toMatchObject({
      goals: 2,
      recordedAssists: 0,
      points: 2,
      goalsWithoutRecordedAssist: 1,
      goalInvolvements: 2,
      goalInvolvementShare: 1,
      equalizingGoals: 1,
      goAheadGoals: 1,
      responseGoals: 1,
    });
    expect(dani).toMatchObject({
      goals: 0,
      recordedAssists: 1,
      points: 1,
      goalInvolvements: 1,
      goalInvolvementShare: 0.5,
    });
    expect(
      insights.scoringContributors.find(
        (contributor) => contributor.id === "home-bea",
      ),
    ).toMatchObject({ freePositionGoals: 1 });
  });

  it("does not invent a scorer from an assist-only source row", () => {
    const assist = PlayParticipant.make({
      id: "home-dani",
      number: "2",
      name: "Dani",
      role: "Assist",
      team: "Home",
    });
    const insights = buildMatchInsights(
      game({
        status: "LIVE",
        homeScore: 1,
        awayScore: 0,
        plays: [
          structuralPlay("START Game", "15:00"),
          Play.make({
            period: "Quarter 1",
            home: "Dani (Assist)",
            time: "14:00",
            result: "1-0",
            action: "Goal",
            away: "",
            participants: [assist],
          }),
        ],
      }),
    );

    expect(insights.goals[0]).toMatchObject({
      scorer: null,
      recordedAssist: { id: "home-dani" },
    });
    expect(insights.quality.anomalies.map((anomaly) => anomaly.code)).toEqual([
      "actorless-goal",
    ]);
    expect(insights.scoringContributors).toMatchObject([
      { id: "home-dani", goals: 0, recordedAssists: 1, points: 1 },
    ]);
  });

  it("withholds final conclusions for upcoming and live games", () => {
    const upcoming = buildMatchInsights(
      game({
        status: "UPCOMING",
        homeScore: null,
        awayScore: null,
        plays: [],
      }),
    );
    const live = buildMatchInsights(
      game({
        status: "LIVE",
        homeScore: 1,
        awayScore: 0,
        plays: [
          structuralPlay("START Game", "15:00"),
          goalPlay({
            side: "home",
            clock: "14:00",
            result: "1-0",
            scorer: "Alice",
            scorerId: "home-alice",
          }),
        ],
      }),
    );

    expect(upcoming.quality.completeness).toBe("upcoming");
    expect(upcoming.quality.scoreConsistency).toBe("not-checkable");
    expect(upcoming.winner).toBeNull();
    expect(live.quality.completeness).toBe("live");
    expect(live.leader).toBe("home");
    expect(live.winner).toBeNull();
    expect(live.gameWinningGoalSequence).toBeNull();
  });

  it("treats an unofficial result as ended but still provisional", () => {
    const insights = buildMatchInsights(
      game({
        status: "UNOFFICIAL",
        homeScore: 1,
        awayScore: 0,
        plays: completeRegulation([
          goalPlay({
            side: "home",
            clock: "14:00",
            result: "1-0",
            scorer: "Alice",
            scorerId: "home-alice",
          }),
        ]),
      }),
    );

    expect(insights.quality).toMatchObject({
      completeness: "provisional-final",
      scoreConsistency: "consistent",
      periodScoreConsistency: "consistent",
    });
    expect(insights.leader).toBe("home");
    expect(insights.winner).toBeNull();
    expect(insights.gameWinningGoalSequence).toBeNull();
    expect(insights.winnerLargestDeficit).toBeNull();
  });

  it("keeps valid scoring but withholds time insights for an invalid goal clock", () => {
    const insights = buildMatchInsights(
      game({
        status: "LIVE",
        homeScore: 1,
        awayScore: 0,
        plays: [
          structuralPlay("START Game", "15:00"),
          goalPlay({
            side: "home",
            clock: "16:00",
            result: "1-0",
            scorer: "Alice",
            scorerId: "home-alice",
          }),
        ],
      }),
    );

    expect(insights.score).toMatchObject({ home: 1, away: 0 });
    expect(insights.quality).toMatchObject({
      scoreFlowValid: true,
      goalClockFlowValid: false,
    });
    expect(insights.quality.anomalies).toContainEqual(
      expect.objectContaining({
        code: "period-clock-out-of-range",
        clock: "16:00",
      }),
    );
    expect(insights.gameStateTime).toBeNull();
    expect(insights.teamShapes).toMatchObject([
      { side: "home", longestDroughtSeconds: null },
      { side: "away", longestDroughtSeconds: null },
    ]);
  });

  it("counts same-clock opponent goals inside a drought by source sequence", () => {
    const insights = buildMatchInsights(
      game({
        status: "LIVE",
        homeScore: 2,
        awayScore: 1,
        plays: [
          structuralPlay("START Game", "15:00"),
          goalPlay({
            side: "home",
            clock: "14:30",
            result: "1-0",
            scorer: "Alice",
            scorerId: "home-alice",
          }),
          goalPlay({
            side: "away",
            clock: "13:00",
            result: "1-1",
            scorer: "Cara",
            scorerId: "away-cara",
          }),
          goalPlay({
            side: "home",
            clock: "13:00",
            result: "2-1",
            scorer: "Alice",
            scorerId: "home-alice",
          }),
        ],
      }),
    );

    expect(
      insights.teamShapes.find((shape) => shape.side === "home"),
    ).toMatchObject({
      longestDroughtSeconds: 90,
      longestDroughtGoalsConceded: 1,
    });
  });

  it("marks shot splits partial when event cells and participants conflict", () => {
    const conflictingShot = Play.make({
      period: "Quarter 1",
      home: "Alice",
      time: "14:00",
      result: "",
      action: "Shot saved",
      away: "",
      participants: [
        PlayParticipant.make({
          id: "away-cara",
          number: "1",
          name: "Cara",
          role: null,
          team: "Away",
        }),
      ],
    });
    const insights = buildMatchInsights(
      game({
        status: "LIVE",
        homeScore: 0,
        awayScore: 0,
        plays: [structuralPlay("START Game", "15:00"), conflictingShot],
      }),
    );

    expect(insights.quality.unattributedShotEvents).toBe(1);
    expect(insights.quality.anomalies).toContainEqual(
      expect.objectContaining({
        code: "unattributed-shot-event",
        sourceIndex: 1,
      }),
    );
    expect(
      insights.shotSplits.every((split) => !split.attributionComplete),
    ).toBe(true);
  });

  it("withholds final-five scoring when a team's Quarter 4 goal clock is invalid", () => {
    const invalidGoal = playInPeriod(
      goalPlay({
        side: "home",
        clock: "16:00",
        result: "1-0",
        scorer: "Alice",
        scorerId: "home-alice",
      }),
      "Quarter 4",
    );
    const insights = buildMatchInsights(
      game({
        status: "LIVE",
        homeScore: 1,
        awayScore: 0,
        plays: [
          structuralPlay("START Game", "15:00"),
          structuralPlay("END Period", "0:00"),
          structuralPlay("START Period", "15:00", "Quarter 2"),
          structuralPlay("END Period", "0:00", "Quarter 2"),
          structuralPlay("START Period", "15:00", "Quarter 3"),
          structuralPlay("END Period", "0:00", "Quarter 3"),
          structuralPlay("START Period", "15:00", "Quarter 4"),
          invalidGoal,
        ],
      }),
    );

    expect(insights.closing).toMatchObject([
      { side: "home", fourthQuarterGoals: 1, finalFiveMinuteGoals: null },
      { side: "away", fourthQuarterGoals: 0, finalFiveMinuteGoals: 0 },
    ]);
  });

  it("withholds time-based insights when observed periods are not contiguous", () => {
    const quarterThreeGoal = playInPeriod(
      goalPlay({
        side: "home",
        clock: "14:00",
        result: "2-0",
        scorer: "Alice",
        scorerId: "home-alice",
      }),
      "Quarter 3",
    );
    const insights = buildMatchInsights(
      game({
        status: "LIVE",
        homeScore: 2,
        awayScore: 0,
        plays: [
          structuralPlay("START Game", "15:00"),
          goalPlay({
            side: "home",
            clock: "14:00",
            result: "1-0",
            scorer: "Alice",
            scorerId: "home-alice",
          }),
          structuralPlay("END Period", "0:00"),
          structuralPlay("START Period", "15:00", "Quarter 3"),
          quarterThreeGoal,
        ],
      }),
    );

    expect(insights.quality.goalClockFlowValid).toBe(false);
    expect(insights.quality.anomalies).toContainEqual(
      expect.objectContaining({ code: "period-sequence-invalid" }),
    );
    expect(insights.gameStateTime).toBeNull();
    expect(insights.fastestScoringBursts).toEqual([]);
    expect(
      insights.scoringRuns.every((run) => run.durationSeconds === null),
    ).toBe(true);
  });

  it("stops score-flow derivation at an invalid transition", () => {
    const insights = buildMatchInsights(
      game({
        status: "LIVE",
        homeScore: 2,
        awayScore: 2,
        plays: [
          structuralPlay("START Game", "15:00"),
          goalPlay({
            side: "home",
            clock: "14:00",
            result: "1-0",
            scorer: "Alice",
            scorerId: "home-alice",
          }),
          goalPlay({
            side: "away",
            clock: "13:00",
            result: "1-2",
            scorer: "Cara",
            scorerId: "away-cara",
            freePosition: true,
          }),
          goalPlay({
            side: "home",
            clock: "12:00",
            result: "2-2",
            scorer: "Bea",
            scorerId: "home-bea",
            freePosition: true,
          }),
        ],
      }),
    );

    expect(insights.quality).toMatchObject({
      completeness: "live",
      scoreConsistency: "inconsistent",
      scoreFlowValid: false,
      parsedGoalCount: 1,
      ignoredGoalCount: 2,
    });
    expect(insights.quality.anomalies.map((anomaly) => anomaly.code)).toEqual([
      "invalid-score-transition",
    ]);
    expect(insights.score).toMatchObject({ home: 1, away: 0 });
    expect(insights.leader).toBeNull();
    expect(insights.leadChanges).toBe(0);
    expect(insights.timesTied).toBe(0);
    expect(insights.periods[0]).toMatchObject({
      homeGoals: 1,
      awayGoals: 0,
      score: { home: 1, away: 0 },
    });
    expect(insights.scoringRuns.map((run) => [run.side, run.goals])).toEqual([
      ["home", 1],
    ]);
    expect(insights.scoringProfiles).toMatchObject([
      { side: "home", freePositionAttempts: 0 },
      { side: "away", freePositionAttempts: 0 },
    ]);
  });

  it("reports incomplete source evidence instead of repairing it silently", () => {
    const insights = buildMatchInsights(
      game({
        status: "OFFICIAL",
        homeScore: 2,
        awayScore: 0,
        plays: [
          structuralPlay("START Game", "15:00"),
          goalPlay({
            side: "home",
            clock: "14:00",
            result: "1-0",
            scorer: "Alice",
            scorerId: "home-alice",
          }),
          goalPlay({
            side: "home",
            clock: "13:00",
            result: "not-a-score",
            scorer: "Alice",
            scorerId: "home-alice",
          }),
          goalPlay({
            side: "home",
            clock: "12:00",
            result: "2-0",
            scorer: "Alice",
            scorerId: "home-alice",
          }),
        ],
      }),
    );

    expect(insights.quality).toMatchObject({
      completeness: "final-unreconciled",
      scoreConsistency: "inconsistent",
      periodScoreConsistency: "inconsistent",
      scoreFlowValid: false,
      parsedGoalCount: 1,
      ignoredGoalCount: 2,
    });
    expect(insights.quality.anomalies.map((anomaly) => anomaly.code)).toEqual([
      "malformed-score",
      "missing-end-game",
      "final-score-mismatch",
      "period-score-mismatch",
    ]);
    expect(insights.winner).toBeNull();
  });

  it("does not complete a regulation final before Quarter 4 reaches zero", () => {
    const complete = completeRegulation([
      goalPlay({
        side: "home",
        clock: "14:00",
        result: "1-0",
        scorer: "Alice",
        scorerId: "home-alice",
      }),
    ]);
    const plays = [
      ...complete.slice(0, -1),
      structuralPlay("END Game", "10:00", "Quarter 4"),
    ];
    const insights = buildMatchInsights(
      game({
        status: "OFFICIAL",
        homeScore: 1,
        awayScore: 0,
        plays,
      }),
    );

    expect(insights.quality).toMatchObject({
      completeness: "final-unreconciled",
      scoreConsistency: "consistent",
      periodScoreConsistency: "consistent",
      terminalClockValid: false,
    });
    expect(insights.quality.anomalies).toContainEqual(
      expect.objectContaining({
        code: "terminal-clock-mismatch",
        period: "Quarter 4",
        clock: "10:00",
      }),
    );
    expect(insights.winner).toBeNull();
    expect(insights.gameStateTime).toBeNull();
    expect(insights.teamShapes).toMatchObject([
      { side: "home", longestDroughtSeconds: null },
      { side: "away", longestDroughtSeconds: null },
    ]);
  });

  it("does not reconcile a final feed with truncated period coverage", () => {
    const insights = buildMatchInsights(
      game({
        status: "OFFICIAL",
        homeScore: 1,
        awayScore: 0,
        plays: [
          structuralPlay("START Game", "15:00"),
          goalPlay({
            side: "home",
            clock: "14:00",
            result: "1-0",
            scorer: "Alice",
            scorerId: "home-alice",
          }),
          structuralPlay("END Game", "0:00"),
        ],
        periodScores: [
          PeriodScore.make({
            team: "Home",
            scores: { Q1: "1", Q2: "0", Q3: "0", Q4: "0", SCORE: "1" },
          }),
          PeriodScore.make({
            team: "Away",
            scores: { Q1: "0", Q2: "0", Q3: "0", Q4: "0", SCORE: "0" },
          }),
        ],
      }),
    );

    expect(insights.quality).toMatchObject({
      completeness: "final-unreconciled",
      scoreConsistency: "consistent",
      periodScoreConsistency: "inconsistent",
      scoreFlowValid: true,
    });
    expect(insights.quality.anomalies.map((anomaly) => anomaly.code)).toEqual([
      "terminal-clock-mismatch",
      "period-score-mismatch",
    ]);
    expect(insights.winner).toBeNull();
  });

  it("keeps the final snapshot reconciled or explicitly fail-closed", () => {
    const dataset = buildMatchInsightsDataset(championship.games);
    const officialGames = dataset.games.filter(
      (insights) => insights.status.toUpperCase() === "OFFICIAL",
    );
    const unreconciledIds = officialGames
      .filter(
        (insights) => insights.quality.completeness === "final-unreconciled",
      )
      .map((insights) => insights.gameId)
      .toSorted((left, right) => Number(left) - Number(right));

    expect(officialGames).toHaveLength(44);
    expect(unreconciledIds).toEqual(["89", "103", "104", "118"]);
    for (const insights of officialGames) {
      const reconciled = insights.quality.completeness === "final-reconciled";
      if (reconciled) {
        expect(insights.quality.scoreConsistency, insights.gameId).toBe(
          "consistent",
        );
        expect(insights.quality.periodScoreConsistency, insights.gameId).toBe(
          "consistent",
        );
        expect(insights.quality.parsedGoalCount, insights.gameId).toBe(
          insights.score.home + insights.score.away,
        );
        expect(insights.gameStateTime, insights.gameId).not.toBeNull();
      } else {
        expect(insights.winner, insights.gameId).toBeNull();
        expect(
          insights.quality.anomalies.length,
          insights.gameId,
        ).toBeGreaterThan(0);
      }
      expect(insights.quality.scoreFlowValid, insights.gameId).toBe(true);
      expect(insights.quality.ignoredGoalCount, insights.gameId).toBe(0);
      expect(insights.quality.goalClockFlowValid, insights.gameId).toBe(true);
      if (insights.gameStateTime) {
        expect(
          insights.gameStateTime.homeLeadingSeconds +
            insights.gameStateTime.tiedSeconds +
            insights.gameStateTime.awayLeadingSeconds,
          insights.gameId,
        ).toBe(insights.gameStateTime.observedSeconds);
        expect(
          insights.gameStateTime.tiedSeconds +
            insights.gameStateTime.oneGoalMarginSeconds +
            insights.gameStateTime.twoGoalMarginSeconds +
            insights.gameStateTime.threePlusMarginSeconds,
          insights.gameId,
        ).toBe(insights.gameStateTime.observedSeconds);
      }
      expect(
        insights.scoringProfiles.reduce(
          (total, profile) => total + profile.goals,
          0,
        ),
        insights.gameId,
      ).toBe(insights.quality.parsedGoalCount);
      expect(insights.teamPerformance, insights.gameId).toHaveLength(2);
      for (const performance of insights.teamPerformance) {
        const splits = insights.shotSplits.filter(
          (split) => split.side === performance.side,
        );
        if (splits.every((split) => split.attributionComplete)) {
          expect(
            splits.reduce((total, split) => total + split.shots, 0),
            `${insights.gameId}:${performance.team}:shots`,
          ).toBe(performance.shots);
          expect(
            splits.reduce((total, split) => total + split.shotsOnGoal, 0),
            `${insights.gameId}:${performance.team}:shots-on-goal`,
          ).toBe(performance.shotsOnGoal);
        }
      }
      expect(
        insights.scoringRuns.every(
          (run) => run.durationSeconds === null || run.durationSeconds >= 0,
        ),
        insights.gameId,
      ).toBe(true);
      expect(insights.discipline, insights.gameId).toHaveLength(2);
    }
  });

  it("does not reconcile overtime when the winning goal and terminal clocks are malformed", () => {
    const overtime = championship.games.find((source) => source.id === "110");
    expect(overtime).toBeDefined();
    if (!overtime) return;
    const plays = overtime.plays.map((play, index) =>
      index >= overtime.plays.length - 2 ? playWithClock(play, "bad") : play,
    );
    const insights = buildMatchInsights({
      id: overtime.id,
      status: overtime.status,
      home: overtime.home,
      away: overtime.away,
      periodScores: overtime.periodScores,
      teamStats: overtime.teamStats,
      plays,
    });

    expect(insights.quality).toMatchObject({
      completeness: "final-unreconciled",
      scoreFlowValid: true,
      goalClockFlowValid: false,
      terminalClockValid: false,
    });
    expect(insights.quality.anomalies).toContainEqual(
      expect.objectContaining({
        code: "terminal-clock-mismatch",
        period: "OT1",
        clock: "bad",
      }),
    );
    expect(insights.winner).toBeNull();
    expect(insights.gameStateTime).toBeNull();
  });

  it("marks overtime event counts partial when a tracked event has no team", () => {
    const overtime = championship.games.find((source) => source.id === "110");
    expect(overtime).toBeDefined();
    if (!overtime) return;
    const plays = overtime.plays.map((play) =>
      play.period === "OT1" && play.action === "Draw Control won"
        ? Play.make({
            period: play.period,
            home: "",
            time: play.time,
            result: play.result,
            action: play.action,
            away: "",
            participants: [],
          })
        : play,
    );
    const insights = buildMatchInsights({
      id: overtime.id,
      status: overtime.status,
      home: overtime.home,
      away: overtime.away,
      periodScores: overtime.periodScores,
      teamStats: overtime.teamStats,
      plays,
    });

    expect(insights.quality.unattributedOvertimeEvents).toBe(1);
    expect(insights.quality.anomalies).toContainEqual(
      expect.objectContaining({
        code: "unattributed-overtime-event",
        period: "OT1",
      }),
    );
    expect(
      insights.eventProfiles.every(
        (profile) => !profile.overtimeAttributionComplete,
      ),
    ).toBe(true);
  });

  it("preserves overtime source order with corrected source clocks", () => {
    const overtime = championship.games.find((source) => source.id === "110");
    expect(overtime).toBeDefined();
    if (!overtime) return;

    const insights = buildMatchInsights(overtime);
    expect(insights).toMatchObject({
      score: { home: 11, away: 10 },
      winner: "home",
      leadChanges: 2,
      timesTied: 5,
      winnerLargestDeficit: 2,
      wentToOvertime: true,
      largestDeficits: [
        { side: "home", goals: 2 },
        { side: "away", goals: 2 },
      ],
    });
    expect(insights.quality).toMatchObject({
      completeness: "final-reconciled",
      periodStartsValid: true,
      periodEndsValid: true,
      terminalClockValid: true,
      goalClockFlowValid: true,
    });
    expect(insights.quality.anomalies).not.toContainEqual(
      expect.objectContaining({ code: "period-start-clock-mismatch" }),
    );
    expect(insights.quality.anomalies).not.toContainEqual(
      expect.objectContaining({ code: "non-monotonic-clock" }),
    );
    expect(insights.gameStateTime).toMatchObject({
      complete: true,
      observedSeconds: 3710,
      tiedSeconds: 784,
      oneGoalMarginSeconds: 1657,
      twoGoalMarginSeconds: 1269,
      threePlusMarginSeconds: 0,
      endpointPeriod: "OT1",
      endpointClock: "2:10",
    });
    expect(insights.teamShapes).toMatchObject([
      {
        side: "home",
        longestDroughtSeconds: 938,
        longestDroughtGoalsConceded: 2,
        fastestResponseSeconds: 46,
      },
      {
        side: "away",
        longestDroughtSeconds: 1133,
        longestDroughtGoalsConceded: 4,
        fastestResponseSeconds: 74,
      },
    ]);
    expect(insights.fastestScoringBursts).toContainEqual(
      expect.objectContaining({
        side: "home",
        goals: 2,
        durationSeconds: 44,
      }),
    );
    expect(insights.quality.unattributedShotEvents).toBe(1);
    expect(
      insights.shotSplits.filter((split) => split.segment === "overtime"),
    ).toMatchObject([
      {
        side: "home",
        attributionComplete: true,
        shots: 2,
        shotsOnGoal: 2,
        goals: 1,
        saves: 0,
      },
      {
        side: "away",
        attributionComplete: true,
        shots: 0,
        shotsOnGoal: 0,
        goals: 0,
        saves: 1,
      },
    ]);
    expect(insights.teamPerformance).toMatchObject([
      {
        side: "home",
        shots: 22,
        shotsOnGoal: 20,
        drawControls: 14,
        groundBalls: 8,
        turnovers: 13,
      },
      {
        side: "away",
        shots: 22,
        shotsOnGoal: 17,
        drawControls: 11,
        groundBalls: 6,
        turnovers: 12,
      },
    ]);
    expect(insights.discipline).toMatchObject([
      { side: "home", cardEvents: 1, recordedPenaltyMinutes: 2 },
      { side: "away", cardEvents: 3, recordedPenaltyMinutes: 6 },
    ]);

    const provisional = buildMatchInsights({
      id: overtime.id,
      status: "UNOFFICIAL",
      home: overtime.home,
      away: overtime.away,
      periodScores: overtime.periodScores,
      teamStats: overtime.teamStats,
      plays: overtime.plays,
    });
    expect(provisional.winner).toBeNull();
    expect(
      provisional.teamShapes.find((shape) => shape.side === "away"),
    ).toMatchObject({ responseOpportunities: 10 });

    expect(insights.goals.at(-1)).toMatchObject({
      period: "OT1",
      clock: "2:10",
      gameWinner: true,
    });
  });
});
