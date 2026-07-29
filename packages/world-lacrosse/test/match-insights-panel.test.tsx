import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { championship } from "../src/championship-data";
import { MatchInsightsPanel } from "../src/components/match-insights-panel";
import { PlayByPlayTimeline } from "../src/components/play-by-play-timeline";
import { nearestScoreWormGoal } from "../src/components/score-worm-geometry";
import { ScoringTimeline } from "../src/components/scoring-timeline";
import { buildMatchInsights } from "../src/match-insights";

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
    expect(markup).toContain('class="score-worm"');
    expect(markup).toContain('role="img"');
    expect(markup).toContain('aria-label="Score margin over time"');
    expect(markup).not.toContain("Score worm for Wales against Germany");
    expect(markup).toContain(
      'aria-label="COOMBES-ROBERTS Sophy goal for Wales, Q1 12:11. Score WAL 1, GER 0. Go-ahead goal."',
    );
    expect(markup).toContain(
      'aria-label="LLOYD ROUT Ros goal for Wales, Q1 10:11. Score WAL 2, GER 1. Assist by WILSON Alexa. Go-ahead goal."',
    );
    expect(markup).toContain('data-game-winner="true"');
    expect(markup.match(/class="score-worm-goal-trigger"/gu)).toHaveLength(
      insights.goals.length,
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

  it("resolves dense hover targets to the nearest goal marker", () => {
    const points = [
      { sequence: 22, x: 100, y: 80 },
      { sequence: 24, x: 103.53, y: 80 },
    ];

    expect(nearestScoreWormGoal(points, 100, 80, 1, 1)).toBe(22);
    expect(nearestScoreWormGoal(points, 103.53, 80, 1, 1)).toBe(24);
    expect(nearestScoreWormGoal(points, 150, 80, 1, 1)).toBeNull();
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
