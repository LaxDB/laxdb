import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  InsightsLabContent,
  roundedPercentile,
} from "../src/components/analysis-insights-content";
import { AnalysisViewNav } from "../src/components/analysis-view-nav";
import { buildAnalysisData } from "../src/lib/analysis-data";
import {
  analysisMetrics,
  analyzeOutcomeGames,
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
import { staticTournamentMetadata } from "../src/lib/static-tournament-data";
import { buildTournamentContext } from "../src/lib/tournament-context";

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

const context = buildTournamentContext(championship.games, {
  sourceUpdatedAt: championship.scrapedAt,
  players: championship.players,
  teamPools: staticTournamentMetadata.teams.map((team) => ({
    name: team.name,
    pool: team.pool,
  })),
});
const eligible = new Set(
  context.games.filter((game) => game.eligible).map((game) => game.gameId),
);
const completeGames = buildAnalysisData(championship.games).games.filter(
  (game) => eligible.has(game.id),
);

describe("analysis insights calculations", () => {
  it("preserves the overview outcome calculation and definition order", () => {
    const outcome = analyzeOutcomeGames(completeGames);
    expect(outcome.analysis.map((metric) => metric.key)).toEqual(
      analysisMetrics.map((metric) => metric.key),
    );
    expect(outcome.analysis).toHaveLength(9);
    expect(outcome.analysis.every((metric) => metric.advantageGames > 0)).toBe(
      true,
    );
    expect(outcome.majorityDrawSides.length).toBeGreaterThan(0);
  });

  it("computes two-sided 95% Wilson bounds", () => {
    const interval = wilsonInterval(5, 10);
    expect(interval?.lower).toBeCloseTo(23.7, 1);
    expect(interval?.upper).toBeCloseTo(76.3, 1);
    expect(wilsonInterval(0, 0)).toBeNull();
  });

  it("excludes metric ties and treats fewer turnovers as favorable", () => {
    const tiedShots = buildSignalResults(
      [fixtureGame({ homeScore: 10, awayScore: 5 })],
      "all",
    ).find((result) => result.key === "shots");
    const turnovers = buildSignalResults(
      [
        fixtureGame({
          homeScore: 10,
          awayScore: 5,
          homeTurnovers: 5,
          awayTurnovers: 9,
        }),
      ],
      "all",
    ).find((result) => result.key === "turnovers");

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

  it("uses outcome-neutral metric descriptions", () => {
    expect(analysisMetrics.map((metric) => metric.interpretation)).toEqual([
      "Counts total shooting attempts; read beside shot quality and conversion.",
      "Counts attempts recorded on target; read beside conversion and opponent save rate.",
      "Goals per recorded shot; read beside shot volume and game state.",
      "Share of recorded draw controls; possession after the draw determines its later value.",
      "Counts recorded loose-ball recoveries; read beside turnovers and possession outcomes.",
      "Counts credited defensive disruptions; read beside subsequent possession and scoring.",
      "Counts recorded possession losses; fewer is treated as favorable and should be read beside pace.",
      "Counts credited assists; read beside total scoring and unassisted goals.",
      "Saves per shot on goal faced; read beside shot quality and goals allowed.",
    ]);
  });

  it("formats percentile ordinals including teen exceptions", () => {
    expect([
      roundedPercentile(11),
      roundedPercentile(12),
      roundedPercentile(13),
      roundedPercentile(21),
      roundedPercentile(22),
      roundedPercentile(23),
    ]).toEqual([
      "11th percentile",
      "12th percentile",
      "13th percentile",
      "21st percentile",
      "22nd percentile",
      "23rd percentile",
    ]);
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

describe("Insights Lab presentation", () => {
  it("uses route links with one visible current analysis view", () => {
    const overview = renderToStaticMarkup(
      <AnalysisViewNav active="overview" />,
    );
    const insights = renderToStaticMarkup(
      <AnalysisViewNav active="insights" />,
    );

    expect(overview).toContain('href="/analysis"');
    expect(overview).toContain('href="/analysis/insights"');
    expect(overview).toContain('aria-current="page"');
    expect(overview).not.toContain('role="tab"');
    expect(insights).toContain('class="is-active" aria-current="page"');
  });

  it("publishes chart descriptions, exact values, grouped controls, and methods without hover", () => {
    const markup = renderToStaticMarkup(
      <InsightsLabContent
        games={completeGames}
        tournamentEligibleGames={context.sample.eligibleGames}
        excludedFromCompleteCase={
          context.sample.eligibleGames - completeGames.length
        }
        snapshotStatus="archive"
        completedGames={completeGames.length}
        detailedGames={completeGames.length}
        missingOrConflictedGames={0}
        sourceUpdatedAt={championship.scrapedAt}
        teams={context.teams}
      />,
    );
    const strongest = selectStrongestSignal(
      buildSignalResults(completeGames, "all"),
    );
    if (strongest?.observedRate === null || strongest === null)
      throw new Error("A strongest signal is required");

    expect(markup).toContain('role="group" aria-label="Game lens"');
    expect(markup).toContain(
      'class="insights-signals" role="group" aria-label="Outcome signal estimates"',
    );
    expect(markup).toContain('class="insights-fingerprint-lines" role="group"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain("Tight ≤ 3");
    expect(markup).toContain(`${strongest.observedRate.toFixed(1)}%`);
    expect(markup).toContain(
      `${strongest.wins} wins / ${strongest.sample} decisive`,
    );
    expect(markup).toContain('role="img"');
    expect(markup).toContain("Exact values follow in the team ledger");
    expect(markup).toContain('aria-label="Team field ledger"');
    expect(markup).toContain("<h2>Methods &amp; limitations</h2>");
    expect(markup).toContain("not a causal claim or prediction");
    expect(markup).toContain("best-supported observed association");
    expect(markup).toContain(
      "selected first by highest 95% Wilson lower bound, then observed rate, then definition order",
    );
    expect(markup).toContain(
      "Shooting and save percentages are mathematically coupled",
    );
    expect(markup).toContain(`${completeGames.length} complete-case`);
    expect(markup).toContain(`${context.sample.eligibleGames} games with`);
    expect(markup).toContain("Completed detail coverage</dt><dd>");
    expect(markup).not.toContain("Snapshot status");
    expect(markup).not.toContain("Archived");
    expect(markup).not.toContain("title=");
  });

  it("discloses degraded snapshot coverage and incomplete upstream evidence", () => {
    const markup = renderToStaticMarkup(
      <InsightsLabContent
        games={completeGames}
        tournamentEligibleGames={context.sample.eligibleGames}
        excludedFromCompleteCase={1}
        snapshotStatus="degraded"
        completedGames={44}
        detailedGames={42}
        missingOrConflictedGames={2}
        sourceUpdatedAt={championship.scrapedAt}
        teams={context.teams}
      />,
    );

    expect(markup).toContain("Snapshot status</dt><dd>Degraded live");
    expect(markup).toContain("Completed detail coverage</dt><dd>42 of 44");
    expect(markup).toContain("Missing / conflicted details</dt><dd>2");
    expect(markup).toContain("Evidence uses a degraded live snapshot");
    expect(markup).toContain(
      "refresh is delayed, failed, incomplete, or conflicted",
    );
    expect(markup).toContain(
      "may not represent the complete tournament sample",
    );
  });

  it("renders an unavailable team field for empty input without invalid numbers", () => {
    const markup = renderToStaticMarkup(
      <InsightsLabContent
        games={[]}
        tournamentEligibleGames={0}
        excludedFromCompleteCase={0}
        snapshotStatus="fresh"
        completedGames={0}
        detailedGames={0}
        missingOrConflictedGames={0}
        sourceUpdatedAt={championship.scrapedAt}
        teams={[]}
      />,
    );

    expect(markup).toContain("Team field unavailable");
    expect(markup).toContain("Medians and field positions are not calculated");
    expect(markup).toContain('id="fingerprint"');
    expect(markup).toContain("Team fingerprint unavailable");
    expect(markup).not.toContain("Field medians:");
    expect(markup).not.toMatch(/NaN|Infinity/);
  });

  it("names fingerprint ties and highlights every top-tied bar", () => {
    const tiedGames = [
      fixtureGame({
        homeScore: 10,
        awayScore: 5,
        homeShots: 20,
        awayShots: 15,
        homeTurnovers: 6,
        awayTurnovers: 10,
        homeDrawControls: 12,
        awayDrawControls: 8,
      }),
      fixtureGame({
        homeScore: 5,
        awayScore: 10,
        homeShots: 15,
        awayShots: 20,
        homeTurnovers: 10,
        awayTurnovers: 6,
        homeDrawControls: 8,
        awayDrawControls: 12,
      }),
    ];
    const markup = renderToStaticMarkup(
      <InsightsLabContent
        games={tiedGames}
        tournamentEligibleGames={2}
        excludedFromCompleteCase={0}
        snapshotStatus="fresh"
        completedGames={2}
        detailedGames={2}
        missingOrConflictedGames={0}
        sourceUpdatedAt={championship.scrapedAt}
        teams={[]}
      />,
    );

    expect(markup).toContain("share the top percentile position");
    expect(markup).toContain("share the bottom percentile position");
    expect(markup.match(/class="is-strongest"/g)).toHaveLength(5);
  });
});
