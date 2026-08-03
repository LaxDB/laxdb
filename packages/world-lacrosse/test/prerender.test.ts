import { describe, expect, it } from "vitest";

import { tournamentStartOptions } from "../vite/tournament-start-options";

const expectedGames = 44;
const expectedPlayers = 349;
const expectedTeams = 16;
const expectedOrderedTeamComparisons = expectedTeams * (expectedTeams - 1);
const expectedRedirectPages = 1;
const expectedConfiguredPages =
  expectedRedirectPages +
  expectedGames +
  expectedPlayers +
  expectedTeams +
  expectedTeams +
  expectedOrderedTeamComparisons;

describe("tournament rendering mode", () => {
  it("uses CSR without loading archive pages in live mode", async () => {
    const options = await tournamentStartOptions("live");

    expect(options).toEqual({ spa: { enabled: true } });
  });

  it("derives every dynamic archive page from the typed snapshot", async () => {
    const options = await tournamentStartOptions("archived");
    const paths = options.pages?.map((page) => page.path) ?? [];

    expect(options.spa).toEqual({ enabled: false });
    expect(options.prerender?.enabled).toBe(true);
    expect(paths).toHaveLength(expectedConfiguredPages);
    expect(new Set(paths).size).toBe(expectedConfiguredPages);
    expect(paths).toContain("/teams");
    expect(paths).toContain("/games/63");
    expect(paths).toContain("/players/1323");
    expect(paths).toContain("/teams/21");
    expect(paths).toContain("/evaluate/21");
    expect(paths).toContain("/compare/21/22");
    expect(paths).toContain("/compare/22/21");
  });
});
