import { Schema } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { championship } from "../src/championship-data";
import { GamePreviewPanel } from "../src/components/game-preview-panel";
import { buildGamePreview } from "../src/game-preview";
import { GamePreview } from "../src/game-preview-schema";
import { ScheduledGame, Team } from "../src/schema";
import { tournament } from "../src/tournament-data";

const source = {
  updatedAt: championship.scrapedAt,
  schedule: tournament.schedule,
  games: championship.games,
};
const teamPools = tournament.teams.map((team) => ({
  name: team.name,
  pool: team.pool,
}));

const australiaIsrael = buildGamePreview("89", source, teamPools);

describe("game preview", () => {
  it("compares only eligible evidence recorded before the scheduled game", () => {
    expect(australiaIsrael).toBeDefined();
    if (!australiaIsrael) return;

    expect(australiaIsrael.home.name).toBe("Israel");
    expect(australiaIsrael.away.name).toBe("Australia");
    expect(australiaIsrael.home.eligibleGames).toBe(3);
    expect(australiaIsrael.away.eligibleGames).toBe(3);
    expect(australiaIsrael.away).toMatchObject({ wins: 2, losses: 1 });
    expect(
      australiaIsrael.away.benchmarks.find(
        (benchmark) => benchmark.metric === "goals-per-game",
      )?.rate,
    ).toMatchObject({ value: 15, numerator: 45, denominator: 3 });
    expect(
      australiaIsrael.home.recent.every((result) => result.gameId !== "89"),
    ).toBe(true);
    expect(
      australiaIsrael.away.recent.every((result) => result.gameId !== "89"),
    ).toBe(true);
  });

  it("round-trips through its runtime schema", () => {
    expect(australiaIsrael).toBeDefined();
    if (!australiaIsrael) return;
    const encoded = Schema.encodeSync(GamePreview)(australiaIsrael);
    expect(Schema.decodeUnknownSync(GamePreview)(encoded)).toEqual(
      australiaIsrael,
    );
  });

  it("withholds missing prior details from only the affected team sample", () => {
    const preview = buildGamePreview(
      "89",
      {
        ...source,
        games: championship.games.filter((game) => game.id !== "84"),
      },
      teamPools,
    );

    expect(preview?.home.eligibleGames).toBe(3);
    expect(preview?.away.eligibleGames).toBe(2);
    expect(
      preview?.away.benchmarks.every(
        (benchmark) => benchmark.sampleGames === 2,
      ),
    ).toBe(true);
  });

  it("does not create a preview after a game has begun, before both teams are known, or without evidence for both teams", () => {
    expect(buildGamePreview("84", source, teamPools)).toBeNull();
    expect(buildGamePreview("88", source, teamPools)).toBeNull();
    const target = tournament.schedule.find((game) => game.id === "89");
    expect(target).toBeDefined();
    if (!target) return;
    expect(
      buildGamePreview(
        target.id,
        { ...source, schedule: [target], games: [] },
        teamPools,
      ),
    ).toBeNull();
  });

  it("fails closed when an upcoming schedule row names the same team twice", () => {
    const target = tournament.schedule.find((game) => game.id === "89");
    expect(target).toBeDefined();
    if (!target) return;
    const sameTeam = ScheduledGame.make({
      id: target.id,
      url: target.url,
      date: target.date,
      time: target.time,
      phase: target.phase,
      venue: target.venue,
      status: target.status,
      period: target.period,
      home: target.home,
      away: Team.make({
        id: target.home.id,
        code: target.home.code,
        name: target.home.name,
        flagUrl: target.home.flagUrl,
        score: target.away.score,
      }),
    });
    expect(
      buildGamePreview(
        target.id,
        {
          ...source,
          schedule: tournament.schedule.map((game) =>
            game.id === target.id ? sameTeam : game,
          ),
        },
        teamPools,
      ),
    ).toBeNull();
  });

  it("renders records, evidence denominators, recent form, and no prediction", () => {
    expect(australiaIsrael).toBeDefined();
    if (!australiaIsrael) return;
    const markup = renderToStaticMarkup(
      <GamePreviewPanel preview={australiaIsrael} />,
    );

    expect(markup).toContain("Previous tournament form");
    expect(markup).toContain("Israel");
    expect(markup).toContain("Australia");
    expect(markup).toContain("45/3 · 3 games");
    expect(markup).toContain("How the teams have performed");
    expect(markup).not.toContain("Snapshot refreshed");
    expect(markup).not.toContain("official, reconciled");
    expect(markup).toContain("Latest first");
    expect(markup).not.toContain("favorite");
    expect(markup).not.toContain("win probability");
  });
});
