import { describe, expect, it } from "vitest";

import { buildAnalysisData } from "../src/lib/analysis-data";
import {
  analysisMetrics,
  buildSignalResults,
  buildTeamFingerprints,
  fieldPercentile,
  filterGamesByLens,
  selectStrongestSignal,
  wilsonInterval,
  type AnalysisGame,
  type SignalResult,
} from "../src/lib/analysis-insights";
import { championship } from "../src/lib/championship-data";

const firstGame = buildAnalysisData(championship.games).games[0];
if (firstGame === undefined) throw new Error("Analysis fixture is required");

const fixtureGame = ({
  homeScore,
  awayScore,
  homeShots = 20,
  awayShots = 20,
  homeTurnovers = 10,
  awayTurnovers = 10,
  homeDrawControls = 10,
  awayDrawControls = 10,
}: {
  readonly homeScore: number;
  readonly awayScore: number;
  readonly homeShots?: number;
  readonly awayShots?: number;
  readonly homeTurnovers?: number;
  readonly awayTurnovers?: number;
  readonly homeDrawControls?: number;
  readonly awayDrawControls?: number;
}): AnalysisGame => ({
  ...firstGame,
  home: {
    ...firstGame.home,
    team: "Home",
    score: homeScore,
    goals: homeScore,
    shots: homeShots,
    turnovers: homeTurnovers,
    drawControls: homeDrawControls,
  },
  away: {
    ...firstGame.away,
    team: "Away",
    score: awayScore,
    goals: awayScore,
    shots: awayShots,
    turnovers: awayTurnovers,
    drawControls: awayDrawControls,
  },
});

const signal = (
  key: SignalResult["key"],
  rate: number,
  lower: number,
): SignalResult => {
  const definition = analysisMetrics.find((metric) => metric.key === key);
  if (definition === undefined) throw new Error("Metric fixture is required");
  return {
    ...definition,
    wins: 7,
    sample: 10,
    observedRate: rate,
    interval: { lower, upper: 90 },
  };
};

describe("analysis insights calculations", () => {
  it("computes two-sided 95% Wilson bounds", () => {
    const interval = wilsonInterval(5, 10);
    expect(interval?.lower).toBeCloseTo(23.7, 1);
    expect(interval?.upper).toBeCloseTo(76.3, 1);
    expect(wilsonInterval(0, 0)).toBeNull();
  });

  it("excludes metric ties and treats fewer turnovers as favorable", () => {
    const results = buildSignalResults(
      [
        fixtureGame({
          homeScore: 10,
          awayScore: 5,
          homeTurnovers: 5,
          awayTurnovers: 9,
        }),
      ],
      "all",
    );
    const tiedShots = results.find((result) => result.key === "shots");
    const turnovers = results.find((result) => result.key === "turnovers");

    expect(tiedShots).toMatchObject({ sample: 0, observedRate: null });
    expect(turnovers).toMatchObject({ wins: 1, sample: 1, observedRate: 100 });
  });

  it("filters tight and clear lenses and leaves empty samples unavailable", () => {
    const games = [
      fixtureGame({ homeScore: 10, awayScore: 8 }),
      fixtureGame({ homeScore: 10, awayScore: 6 }),
      fixtureGame({ homeScore: 10, awayScore: 4 }),
    ];
    expect(filterGamesByLens(games, "tight")).toHaveLength(1);
    expect(filterGamesByLens(games, "clear")).toHaveLength(1);
    expect(filterGamesByLens(games, "all")).toHaveLength(3);
    expect(
      buildSignalResults(
        [fixtureGame({ homeScore: 10, awayScore: 4 })],
        "tight",
      ).every(
        (result) => result.observedRate === null && result.interval === null,
      ),
    ).toBe(true);
  });

  it("recomputes team conversion, draw share, and per-game rates from totals", () => {
    const profiles = buildTeamFingerprints([
      fixtureGame({
        homeScore: 10,
        awayScore: 5,
        homeShots: 20,
        awayShots: 15,
        homeDrawControls: 12,
        awayDrawControls: 8,
        homeTurnovers: 6,
        awayTurnovers: 10,
      }),
      fixtureGame({
        homeScore: 5,
        awayScore: 10,
        homeShots: 30,
        awayShots: 25,
        homeDrawControls: 8,
        awayDrawControls: 12,
        homeTurnovers: 10,
        awayTurnovers: 8,
      }),
    ]);
    const home = profiles.find((profile) => profile.team === "Home");
    const value = (key: string) =>
      home?.metrics.find((metric) => metric.key === key)?.value;

    expect(home?.games).toBe(2);
    expect(value("attackOutput")).toBe(7.5);
    expect(value("goalPrevention")).toBe(7.5);
    expect(value("shotConversion")).toBe(30);
    expect(value("drawShare")).toBe(50);
    expect(value("ballSecurity")).toBe(8);
  });

  it("handles percentile direction explicitly", () => {
    expect(fieldPercentile(30, [10, 20, 30], true)).toBe(100);
    expect(fieldPercentile(10, [10, 20, 30], true)).toBe(0);
    expect(fieldPercentile(10, [10, 20, 30], false)).toBe(100);
    expect(fieldPercentile(30, [10, 20, 30], false)).toBe(0);
  });

  it("selects by Wilson lower bound, then rate, then definition order", () => {
    expect(
      selectStrongestSignal([
        signal("shots", 90, 45),
        signal("shotsOnGoal", 70, 50),
      ])?.key,
    ).toBe("shotsOnGoal");
    expect(
      selectStrongestSignal([
        signal("shots", 70, 50),
        signal("shotsOnGoal", 80, 50),
      ])?.key,
    ).toBe("shotsOnGoal");
    expect(
      selectStrongestSignal([
        signal("shots", 80, 50),
        signal("shotsOnGoal", 80, 50),
      ])?.key,
    ).toBe("shots");
  });
});
