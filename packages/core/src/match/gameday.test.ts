import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import {
  extractArrayLiteral,
  GamedayClient,
  gamedayDate,
  gamedayScore,
  gamedayTeamsFromMatches,
  parseLadder,
  parseStatsRows,
} from "./gameday";

describe("GameDay parsing", () => {
  it("extractArrayLiteral survives ] characters inside string values", () => {
    const payload = `[{"DetailedResults":"<a href=\\"x[1]\\">Match [Centre]</a>","FixtureID":"2"}]`;
    const html = `var matches = ${payload};\nvar other = [1,2];`;
    expect(extractArrayLiteral(html, "var matches =")).toBe(payload);
    expect(
      JSON.parse(extractArrayLiteral(html, "var matches =") ?? ""),
    ).toHaveLength(1);
  });

  it("extractArrayLiteral returns null when the marker is missing", () => {
    expect(extractArrayLiteral("<html></html>", "var matches =")).toBeNull();
  });

  it("gamedayDate handles the spring DST transition", () => {
    // First Sunday of October 2026 is the 4th; AEDT starts 02:00 that day.
    expect(gamedayDate("2026-10-03 15:00:00")?.toISOString()).toBe(
      "2026-10-03T05:00:00.000Z",
    );
    expect(gamedayDate("2026-10-04 15:00:00")?.toISOString()).toBe(
      "2026-10-04T04:00:00.000Z",
    );
  });

  it("gamedayDate returns null for empty or invalid values", () => {
    expect(gamedayDate()).toBeNull();
    expect(gamedayDate("")).toBeNull();
    expect(gamedayDate("not a date")).toBeNull();
  });

  it("gamedayScore returns null for missing scores", () => {
    expect(gamedayScore("")).toBeNull();
    expect(gamedayScore()).toBeNull();
  });

  it("gamedayTeamsFromMatches extracts sorted unique teams", () => {
    expect(
      gamedayTeamsFromMatches([
        {
          FixtureID: "1",
          HomeID: "27270385",
          HomeNameFMT: "Malvern&nbsp;Lacrosse&amp;Co ",
          AwayID: "27270380",
          AwayNameFMT: "Altona Lacrosse Club",
        },
        {
          FixtureID: "2",
          HomeID: "27270380",
          HomeNameFMT: "Altona Lacrosse Club",
          AwayID: "27270385",
          AwayNameFMT: "Malvern&nbsp;Lacrosse&amp;Co ",
        },
      ]),
    ).toEqual([
      { teamId: "27270380", name: "Altona Lacrosse Club" },
      { teamId: "27270385", name: "Malvern Lacrosse&Co" },
    ]);
  });

  it("parseStatsRows maps games, assists, and goals by heading", () => {
    const html = `<table>
      <tr><th>Player Name</th><th>TSC</th><th>Team Name</th><th>TA</th><th>M</th></tr>
      <tr class="odd"><td><a href="?pID=204864530">Billy Skepper</a></td><td>9</td><td>Malvern/MCC</td><td>3</td><td>9</td></tr>
    </table>`;
    expect(parseStatsRows(html).get("204864530")).toEqual({
      fallbackName: "Billy Skepper",
      gamesPlayed: 9,
      totalAssists: 3,
      totalScore: 9,
    });
  });

  it("parseLadder maps values by heading instead of position", async () => {
    const html = `
      <div>Last Uploaded: Thu 23-Jul-2026 14:03:47</div>
      <table>
        <tr><th>TEAM</th><th>POS</th><th>PTS</th><th>P</th><th>W</th><th>L</th><th>D</th><th>B</th><th>FF</th><th>FG</th><th>For</th><th>Agst</th><th>GD</th><th>%</th></tr>
        <tr><td><a href="team_info.cgi?c=0-1064-96353-657126-27280729">Malvern/MCC</a></td><td>3</td><td>20</td><td>10</td><td>5</td><td>5</td><td>0</td><td>0</td><td>0</td><td>0</td><td>92</td><td>83</td><td>9</td><td>110.84</td></tr>
      </table>`;

    const ladder = await Effect.runPromise(parseLadder(html, "657126"));

    expect(ladder.sourceUploadedAt).toBe("Thu 23-Jul-2026 14:03:47");
    expect(ladder.rows).toEqual([
      expect.objectContaining({
        position: 3,
        teamId: "27280729",
        teamName: "Malvern/MCC",
        played: 10,
        wins: 5,
        losses: 5,
        goalsFor: 92,
        goalsAgainst: 83,
        goalDifference: 9,
        percentage: 110.84,
        premiershipPoints: 20,
      }),
    ]);
  });

  it("parseLadder fails when the required shape changes", async () => {
    const exit = await Effect.runPromiseExit(
      parseLadder("<table><tr><th>TEAM</th></tr></table>", "657126"),
    );
    expect(exit._tag).toBe("Failure");
  });

  it("fetchFixtures sweeps pools when the default has no fixtures", async () => {
    const noFixtures = `
      <a href="comp_info.cgi?c=0-1064-0-657119-0&amp;pool=1&amp;round=0&amp;a=FIXTURE">Regular season</a>
      <p class="no-fixtures">Sorry, there are no fixtures available.</p>
    `;
    const poolFixtures = `
      <script>var matches = [{"FixtureID":"fixture-1","CompID":"657119","HomeID":"home-1","AwayID":"away-1"}];</script>
    `;
    const requestUrl = (input: string | URL | Request) =>
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input: string | URL | Request) => {
        const url = requestUrl(input);
        return Promise.resolve(
          new Response(url.includes("pool=1") ? poolFixtures : noFixtures),
        );
      });

    const fixtures = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* GamedayClient;
        return yield* client.fetchFixtures("657119");
      }).pipe(Effect.provide(GamedayClient.layer)),
    );

    expect(fixtures.map((fixture) => fixture.FixtureID)).toEqual(["fixture-1"]);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        requestUrl(input).includes("pool=1"),
      ),
    ).toBe(true);
    fetchMock.mockRestore();
  });
});
