import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MatchInsightsPanel } from "../src/components/match-insights-panel";
import { PlayByPlayTimeline } from "../src/components/play-by-play-timeline";
import {
  buildScoreWormChartModel,
  scoreWormGoalDescription,
  shouldExtendScoreWormToEnd,
} from "../src/components/score-worm";
import { ScoringTimeline } from "../src/components/scoring-timeline";
import { championship } from "../src/lib/championship-data";
import { buildMatchInsights } from "../src/lib/match-insights";

describe("MatchInsightsPanel", () => {
  it("renders verified game flow in a readable, server-safe view", () => {
    const game = championship.games.find((source) => source.id === "110");
    expect(game).toBeDefined();
    if (!game) return;

    const insights = buildMatchInsights(game);
    const markup = renderToStaticMarkup(
      <MatchInsightsPanel insights={insights} />,
    );

    expect(markup).not.toContain("Verified final");
    expect(markup).toContain("Lead changes");
    expect(markup).toContain("Score worm");
    expect(markup).toContain('class="ts-chart-host score-worm"');
    expect(markup).toContain('role="img"');
    expect(markup).toContain('aria-roledescription="chart"');
    expect(markup).toContain('aria-label="Score margin over time"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('data-ts-key="home-lead-area"');
    expect(markup).toContain('data-ts-key="away-lead-area"');
    expect(markup).toContain('data-ts-key="winning-goal-rings"');
    const goalLayer = markup.match(
      /<g data-ts-key="goals" class="ts-chart__dot" aria-hidden="true">([\s\S]*?)<\/g>/u,
    )?.[1];
    expect(goalLayer?.match(/<circle/gu)).toHaveLength(insights.goals.length);
    const homeMarginPath = markup.match(
      /data-ts-key="home-margin:[^"]*"[\s\S]*?<path[^>]+d="([^"]+)"/u,
    )?.[1];
    expect(homeMarginPath).toBeDefined();
    const homeMarginCoordinates = [
      ...(homeMarginPath?.matchAll(/[ML](-?[0-9.]+),(-?[0-9.]+)/gu) ?? []),
    ].flatMap((match) => {
      const x = match[1];
      const y = match[2];
      return x === undefined || y === undefined
        ? []
        : [{ x: Number(x), y: Number(y) }];
    });
    expect(
      homeMarginCoordinates.some((point, index) => {
        const previous = homeMarginCoordinates[index - 1];
        return (
          previous !== undefined &&
          Math.abs(point.x - previous.x) < 0.01 &&
          Math.abs(point.y - previous.y) > 1
        );
      }),
    ).toBe(true);
    expect(markup).not.toContain("Score worm for Wales against Germany");
    const openingGoal = insights.goals.find(
      (goal) => goal.scorer?.name === "COOMBES-ROBERTS Sophy",
    );
    const assistedGoal = insights.goals.find(
      (goal) => goal.scorer?.name === "LLOYD ROUT Ros",
    );
    expect(openingGoal).toBeDefined();
    expect(assistedGoal).toBeDefined();
    if (openingGoal === undefined || assistedGoal === undefined) return;
    expect(scoreWormGoalDescription(openingGoal, insights)).toBe(
      "COOMBES-ROBERTS Sophy goal for Wales, Q1 12:11. Score WAL 1, GER 0. Go-ahead goal.",
    );
    expect(scoreWormGoalDescription(assistedGoal, insights)).toBe(
      "LLOYD ROUT Ros goal for Wales, Q1 10:11. Score WAL 2, GER 1. Assist by WILSON Alexa. Go-ahead goal.",
    );
    expect(markup).toContain(
      "Tap or hover the chart, or focus it and use the arrow keys, for goal details.",
    );
    expect(markup).not.toContain("NaN");
    expect(markup).not.toContain("Period scoring");
    expect(markup).toContain("Time leading, trailing and tied");
    expect(markup).toContain("Runs, droughts and answers");
    expect(markup).toContain("Fastest three-goal burst");
    expect(markup).toContain("Final five minutes of regulation");
    expect(markup).toContain("Scoring profile");
    expect(markup).toContain("Top scorer-assister combination");
    expect(markup.match(/class="insight-wide-section"/gu)).toHaveLength(3);
    expect(markup).toContain("Shot and goalkeeper splits");
    expect(markup).toContain("Overtime detail");
    expect(markup).toContain("Performance edges");
    expect(markup).toContain('class="insight-comparison"');
    expect(markup).toContain('scope="col"');
    expect(markup).toContain('scope="row"');
    expect(markup).toContain("Largest deficits");
    expect(markup).toContain("Wales");
    expect(markup).toContain("Germany");
    expect(markup).not.toContain("Source data notes");
    expect(markup).not.toContain("non-monotonic");
    expect(markup).not.toContain("Score timeline");
  });

  it("prepares complete and in-progress score-worm series", () => {
    const game = championship.games.find((source) => source.id === "63");
    expect(game).toBeDefined();
    if (!game) return;

    const insights = buildMatchInsights(game);
    const finalModel = buildScoreWormChartModel(insights);
    expect(finalModel).not.toBeNull();
    if (finalModel === null) return;

    expect(finalModel.goalRows).toHaveLength(insights.goals.length);
    expect(finalModel.rows[0]).toMatchObject({
      id: "start",
      elapsedSeconds: 0,
      margin: 0,
      goal: null,
    });
    expect(finalModel.rows.at(-1)).toMatchObject({
      id: "end",
      elapsedSeconds: finalModel.chartDuration,
      margin: insights.score.home - insights.score.away,
      goal: null,
    });
    expect(finalModel.goalRows.at(-1)?.elapsedSeconds).toBeLessThan(
      finalModel.chartDuration,
    );
    expect(finalModel.periodRules).toHaveLength(
      finalModel.displayPeriods.length - 1,
    );

    expect(shouldExtendScoreWormToEnd("final-reconciled", true)).toBe(true);
    expect(shouldExtendScoreWormToEnd("live", true)).toBe(false);
    expect(shouldExtendScoreWormToEnd("final-reconciled", false)).toBe(false);
  });

  it("renders the full event log without internal source diagnostics", () => {
    const game = championship.games.find((source) => source.id === "110");
    expect(game).toBeDefined();
    if (!game) return;

    const markup = renderToStaticMarkup(
      <PlayByPlayTimeline
        plays={game.plays}
        homeName={game.home.name}
        awayName={game.away.name}
      />,
    );

    expect(markup).toContain("END Game");
    expect(markup).not.toContain("Source data notes");
    expect(markup).not.toContain("source row");
    expect(markup).not.toContain("play-source-marker");
  });

  it("renders the verified goal log separately from summary insights", () => {
    const game = championship.games.find((source) => source.id === "110");
    expect(game).toBeDefined();
    if (!game) return;

    const markup = renderToStaticMarkup(
      <ScoringTimeline insights={buildMatchInsights(game)} />,
    );

    expect(markup).toContain("Time / score");
    expect(markup).toContain("Winning goal");
    expect(markup).toContain("11—10");
  });
});
