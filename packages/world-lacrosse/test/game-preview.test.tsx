import { Schema } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { championship } from "../src/championship-data";
import { GamePreviewPanel } from "../src/components/game-preview-panel";
import { buildGamePreview } from "../src/game-preview";
import { GamePreview } from "../src/game-preview-schema";
import { ScheduledGame, Team } from "../src/schema";
import { tournament } from "../src/tournament-data";

const finalTarget = tournament.schedule.find((game) => game.id === "89");
if (!finalTarget) throw new Error("expected game 89");
const scheduledTarget = ScheduledGame.make({
  id: finalTarget.id,
  url: finalTarget.url,
  date: finalTarget.date,
  time: finalTarget.time,
  phase: finalTarget.phase,
  venue: finalTarget.venue,
  status: "UPCOMING",
  period: null,
  home: Team.make({
    id: finalTarget.home.id,
    code: finalTarget.home.code,
    name: finalTarget.home.name,
    flagUrl: finalTarget.home.flagUrl,
    score: null,
  }),
  away: Team.make({
    id: finalTarget.away.id,
    code: finalTarget.away.code,
    name: finalTarget.away.name,
    flagUrl: finalTarget.away.flagUrl,
    score: null,
  }),
});
const source = {
  updatedAt: championship.scrapedAt,
  schedule: tournament.schedule.map((game) =>
    game.id === scheduledTarget.id ? scheduledTarget : game,
  ),
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
    const unknownOpponent = ScheduledGame.make({
      id: scheduledTarget.id,
      url: scheduledTarget.url,
      date: scheduledTarget.date,
      time: scheduledTarget.time,
      phase: scheduledTarget.phase,
      venue: scheduledTarget.venue,
      status: scheduledTarget.status,
      period: scheduledTarget.period,
      home: scheduledTarget.home,
      away: Team.make({
        id: "A2",
        code: "A2",
        name: "A2",
        flagUrl: null,
        score: null,
      }),
    });
    expect(
      buildGamePreview(
        scheduledTarget.id,
        {
          ...source,
          schedule: source.schedule.map((game) =>
            game.id === scheduledTarget.id ? unknownOpponent : game,
          ),
        },
        teamPools,
      ),
    ).toBeNull();
    expect(
      buildGamePreview(
        scheduledTarget.id,
        { ...source, schedule: [scheduledTarget], games: [] },
        teamPools,
      ),
    ).toBeNull();
  });

  it("fails closed when an upcoming schedule row names the same team twice", () => {
    const sameTeam = ScheduledGame.make({
      id: scheduledTarget.id,
      url: scheduledTarget.url,
      date: scheduledTarget.date,
      time: scheduledTarget.time,
      phase: scheduledTarget.phase,
      venue: scheduledTarget.venue,
      status: scheduledTarget.status,
      period: scheduledTarget.period,
      home: scheduledTarget.home,
      away: Team.make({
        id: scheduledTarget.home.id,
        code: scheduledTarget.home.code,
        name: scheduledTarget.home.name,
        flagUrl: scheduledTarget.home.flagUrl,
        score: scheduledTarget.away.score,
      }),
    });
    expect(
      buildGamePreview(
        scheduledTarget.id,
        {
          ...source,
          schedule: source.schedule.map((game) =>
            game.id === scheduledTarget.id ? sameTeam : game,
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
