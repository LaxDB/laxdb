import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { championship } from "../src/championship-data";
import {
  selectCompletedTeamGames,
  TeamPeriodProfile,
} from "../src/components/team-analysis-panel";
import { buildTeamAnalysis } from "../src/team-analysis";
import { tournament } from "../src/tournament-data";

const teamPools = tournament.teams.map((team) => ({
  name: team.name,
  pool: team.pool,
}));

const analysisFor = (team: string) =>
  buildTeamAnalysis(
    team,
    {
      updatedAt: championship.scrapedAt,
      schedule: tournament.schedule,
      games: championship.games,
    },
    teamPools,
  );

describe("team analysis presentation", () => {
  it("retains overtime scoring in the period profile", () => {
    const analysis = analysisFor("Wales");
    const markup = renderToStaticMarkup(
      <TeamPeriodProfile analysis={analysis} />,
    );

    expect(analysis.scoring.periodGoals.OT1).toBe(1);
    expect(markup).toContain("OT1");
    expect(
      Object.values(analysis.scoring.periodGoals).reduce(
        (total, goals) => total + goals,
        0,
      ),
    ).toBe(analysis.scoring.goals);
  });

  it("counts only decisive result rows in the completed-results ledger", () => {
    const analysis = analysisFor("Australia");
    const completed = selectCompletedTeamGames(analysis);
    expect(completed).toHaveLength(analysis.completedGames);
    const first = completed[0];
    expect(first).toBeDefined();
    if (!first) return;
    const partial = {
      ...analysis,
      games: analysis.games.map((game) =>
        game.gameId === first.gameId ? { ...game, result: null } : game,
      ),
    };

    expect(selectCompletedTeamGames(partial)).toHaveLength(
      analysis.completedGames - 1,
    );
  });
});
