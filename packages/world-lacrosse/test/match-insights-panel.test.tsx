import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { championship } from "../src/championship-data";
import { MatchInsightsPanel } from "../src/components/match-insights-panel";
import { PlayByPlayTimeline } from "../src/components/play-by-play-timeline";
import { ScoringTimeline } from "../src/components/scoring-timeline";
import { buildMatchInsights } from "../src/match-insights";

describe("MatchInsightsPanel", () => {
  it("renders verified game flow in a readable, server-safe view", () => {
    const game = championship.games.find((source) => source.id === "110");
    expect(game).toBeDefined();
    if (!game) return;

    const markup = renderToStaticMarkup(
      <MatchInsightsPanel insights={buildMatchInsights(game)} />,
    );

    expect(markup).not.toContain("Verified final");
    expect(markup).toContain("Lead changes");
    expect(markup).toContain("Score worm");
    expect(markup).toContain('class="score-worm"');
    expect(markup).toContain('role="img"');
    expect(markup).not.toContain("NaN");
    expect(markup).not.toContain("Period scoring");
    expect(markup).toContain("Time leading, trailing and tied");
    expect(markup).toContain("Runs, droughts and answers");
    expect(markup).toContain("Fastest three-goal burst");
    expect(markup).toContain("Final five minutes of regulation");
    expect(markup).toContain("Scoring profile");
    expect(markup).toContain("Top scorer-assister combination");
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
