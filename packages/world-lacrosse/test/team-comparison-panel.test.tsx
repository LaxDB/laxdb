import { readFileSync } from "node:fs";

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    "aria-label": ariaLabel,
  }: {
    readonly children: ReactNode;
    readonly params: { readonly gameId: string };
    readonly "aria-label"?: string;
  }) => (
    <a aria-label={ariaLabel} href={`/games/${params.gameId}`}>
      {children}
    </a>
  ),
}));

import { championship } from "../src/championship-data";
import { TeamComparisonPanel } from "../src/components/team-comparison-panel";
import { initialTeamComparisonSelection } from "../src/pages/team-comparison-page";
import { buildTeamComparison } from "../src/team-comparison";
import { tournament } from "../src/tournament-data";

const source = {
  updatedAt: championship.scrapedAt,
  schedule: tournament.schedule,
  games: championship.games,
};

const comparisonFor = (left: string, right: string) => {
  const comparison = buildTeamComparison(left, right, source, tournament.teams);
  if (!comparison) throw new Error("expected comparison");
  return comparison;
};

describe("team comparison presentation", () => {
  it("renders a neutral accessible full comparison", () => {
    const markup = renderToStaticMarkup(
      <TeamComparisonPanel comparison={comparisonFor("25", "24")} />,
    );

    expect(markup).toContain("Australia");
    expect(markup).toContain("United States of America");
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
    expect(markup.match(/role="region"/gu)).toHaveLength(8);
    expect(markup.match(/tabindex="0"/gu)).toHaveLength(8);
    expect(markup).toContain("<caption");
    expect(markup).toContain('scope="row"');
    expect(markup).toContain("45 / 84 · 3 games");
    expect(markup).toContain("Unique recorded scorers");
    expect(markup).toContain("14 distinct · 3 games");
    expect(markup).toContain("paired with the longest drought");
    for (const prohibited of [
      "favorite",
      "advantage",
      "win probability",
      "better team",
      "caused the result",
    ])
      expect(markup.toLowerCase()).not.toContain(prohibited);
    expect(markup).not.toContain("Direct meetings");
  });

  it("shows a game link only when the selected teams met", () => {
    const markup = renderToStaticMarkup(
      <TeamComparisonPanel comparison={comparisonFor("25", "28")} />,
    );

    expect(markup).toContain("Direct meetings");
    expect(markup).toContain("Game details");
    expect(markup).toContain(
      'aria-label="Game details: Australia 9–7 Wales, Sunday, July 26, POOL B"',
    );
    expect(markup).toContain("AUS 9–7 WAL");
  });

  it("labels sampled metrics without qualifying observations as unavailable", () => {
    const markup = renderToStaticMarkup(
      <TeamComparisonPanel comparison={comparisonFor("23", "22")} />,
    );

    expect(markup).toContain("Fastest four-goal burst");
    expect(markup).toContain("No qualifying evidence · 2 games");
    expect(markup).not.toContain("0:00 from 0 qualifying observations");
  });

  it("keeps invalid route recovery in the comparison page", () => {
    const page = readFileSync(
      new URL("../src/pages/team-comparison-page.tsx", import.meta.url),
      "utf8",
    );
    const route = readFileSync(
      new URL(
        "../src/routes/compare/$leftTeamId/$rightTeamId.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    expect(page).toContain("Choose two different tournament teams.");
    expect(page).toContain("Swap selected teams");
    expect(page).toContain("disabled={team.id === selectedRight}");
    expect(route).toContain("key={`${leftTeamId}-${rightTeamId}`}");
    expect(route).toContain(
      'import { TournamentDataBoundary } from "../../../components/tournament-data-state"',
    );
    expect(route).toContain("<TournamentDataBoundary>");

    for (const [left, right] of [
      ["25", "25"],
      ["24", "24"],
      ["unknown", "25"],
      ["24", "unknown"],
      ["unknown", "unknown"],
    ] as const) {
      const selection = initialTeamComparisonSelection(left, right);
      expect(selection.leftTeamId).not.toBe(selection.rightTeamId);
      expect(
        tournament.teams.some((team) => team.id === selection.leftTeamId),
      ).toBe(true);
      expect(
        tournament.teams.some((team) => team.id === selection.rightTeamId),
      ).toBe(true);
    }
  });
});
