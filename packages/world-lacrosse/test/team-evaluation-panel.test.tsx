import { readFileSync } from "node:fs";

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { readonly children: ReactNode }) => (
    <a href="/">{children}</a>
  ),
}));

import { TeamEvaluationPlayerPanel } from "../src/components/team-evaluation-player-panel";
import { TeamEvaluationTeamPanel } from "../src/components/team-evaluation-team-panel";
import { championship } from "../src/lib/championship-data";
import { staticTournamentMetadata } from "../src/lib/static-tournament-data";
import { buildTeamEvaluation } from "../src/lib/team-evaluation";
import { tournament } from "../src/lib/tournament-data";

const report = buildTeamEvaluation(
  "25",
  {
    updatedAt: championship.scrapedAt,
    schedule: tournament.schedule,
    games: championship.games,
  },
  tournament.teams,
  staticTournamentMetadata.playerProfiles,
);
if (!report) throw new Error("expected evaluation report");

describe("team evaluation presentation", () => {
  it("renders all team sections with evidence and a neutral difference", () => {
    const membershipReport = buildTeamEvaluation(
      "25",
      {
        updatedAt: championship.scrapedAt,
        schedule: tournament.schedule,
        games: championship.games,
      },
      tournament.teams,
      staticTournamentMetadata.playerProfiles,
      ["76", "69"],
      ["69"],
    );
    if (!membershipReport) throw new Error("expected membership report");
    const markup = renderToStaticMarkup(
      <TeamEvaluationTeamPanel report={membershipReport} />,
    );
    for (const heading of [
      "Scoring output",
      "Periods and halves",
      "Shooting and goalkeeping",
      "Draws and events",
      "Game state and flow",
      "Situational scoring",
      "Overtime",
      "Discipline",
    ])
      expect(markup).toContain(heading);
    expect(markup).toContain("A − B");
    expect(markup).toContain("No eligible evidence");
    expect(markup).toContain("A+B");
    expect(markup).toContain("Not selected");
    expect(markup.toLowerCase()).not.toContain("advantage");
    expect(markup.toLowerCase()).not.toContain("better player");
  });

  it("separates field players and goalkeepers and marks a selected player", () => {
    const markup = renderToStaticMarkup(
      <TeamEvaluationPlayerPanel
        report={report}
        metric="points"
        segment="full-game"
        selectedPlayerId="1146"
        onMetricChange={() => {}}
        onSegmentChange={() => {}}
      />,
    );
    expect(markup).toContain("Field players");
    expect(markup).toContain("Goalkeepers");
    expect(markup).toContain('data-selected=""');
    expect(markup).toContain("(selected player)");
    expect(markup).toContain("Roster / activity A");
    expect(markup).toContain("Roster / activity B");
    expect(markup).toContain("across 3 eligible games");
    expect(markup).toContain(
      "Rank 1 for turnovers or cards means most recorded, not favorable or better",
    );
    expect(markup).toContain("not quality rankings");
    expect(markup).toContain("Full teammate stat matrix");
    expect(markup).toContain("Quarter and half scoring matrix");
    expect(markup).toContain(
      "Roster-listed games do not prove field-player participation",
    );
  });

  it("renders every zero-game segment metric as unavailable", () => {
    const empty = buildTeamEvaluation(
      "25",
      {
        updatedAt: championship.scrapedAt,
        schedule: tournament.schedule,
        games: championship.games,
      },
      tournament.teams,
      staticTournamentMetadata.playerProfiles,
      [],
      [],
    );
    if (!empty) throw new Error("expected empty evaluation report");
    const markup = renderToStaticMarkup(
      <TeamEvaluationPlayerPanel
        report={empty}
        metric="recorded-assists"
        segment="overtime"
        selectedPlayerId={undefined}
        onMetricChange={() => {}}
        onSegmentChange={() => {}}
      />,
    );
    expect(markup).toContain("No eligible segment evidence");
    expect(markup).not.toContain("0 A*");
  });

  it("keeps evaluation CSS tokens wrapped and uses the established display font", () => {
    const styles = readFileSync(
      new URL("../src/styles.css", import.meta.url),
      "utf8",
    );
    const evaluationStyles = styles.slice(0, styles.indexOf("body {"));
    expect(evaluationStyles).not.toMatch(/(?<!oklch\()var\(--/u);
    expect(evaluationStyles).not.toContain("--font-display");
    expect(evaluationStyles).toContain(
      'font-family: "Newsreader", Georgia, serif',
    );
  });

  it("keeps the route provider boundary and contextual deep links", () => {
    const route = readFileSync(
      new URL("../src/routes/evaluate/$teamId.tsx", import.meta.url),
      "utf8",
    );
    const teamPage = readFileSync(
      new URL("../src/routes/teams/$teamId.tsx", import.meta.url),
      "utf8",
    );
    const playerPage = readFileSync(
      new URL("../src/routes/players/$playerId.tsx", import.meta.url),
      "utf8",
    );
    const evaluationPlayers = readFileSync(
      new URL(
        "../src/components/team-evaluation-player-panel.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const evaluationControls = readFileSync(
      new URL(
        "../src/components/team-evaluation-controls.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    expect(route).toContain("<TournamentDataBoundary>");
    expect(teamPage).toContain("Open evaluation lab");
    expect(teamPage).toContain("search={{ player: playerId }}");
    expect(playerPage).toContain("Evaluate splits");
    expect(playerPage).toContain("search={{ player: player.id }}");
    expect(evaluationPlayers).not.toContain("aria-current");
    expect(evaluationPlayers).toContain("(selected player)");
    expect(evaluationControls).toContain(
      "Include game ${game.gameId}, ${game.date} versus ${game.opponent}",
    );
  });
});
