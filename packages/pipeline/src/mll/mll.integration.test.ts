import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { HttpError, TimeoutError } from "../error";

import { MLLClient } from "./mll.client";

// Integration tests hit real external APIs (statscrew.com)
// Longer timeouts needed for network latency
const TEAM_TIMEOUT = 15_000;
const PLAYER_TIMEOUT = 60_000; // Players require fetching each team's stats page

const runWaybackProgram = async <T, E>(
  program: Effect.Effect<T, E, MLLClient>,
) => {
  try {
    return await Effect.runPromise(
      program.pipe(Effect.provide(MLLClient.layer)),
    );
  } catch (error) {
    const isTransientWaybackFailure =
      error instanceof TimeoutError ||
      (error instanceof HttpError &&
        error.statusCode !== undefined &&
        error.statusCode >= 500);

    if (isTransientWaybackFailure) {
      console.warn(`Skipping strict Wayback assertion: ${error.message}`);
      return null;
    }

    throw error;
  }
};

describe("MLLClient", () => {
  it(
    "getTeams fetches teams for 2019",
    async () => {
      const program = Effect.gen(function* () {
        const mll = yield* MLLClient;
        return yield* mll.getTeams({ year: 2019 });
      });

      const teams = await Effect.runPromise(
        program.pipe(Effect.provide(MLLClient.layer)),
      );

      expect(teams.length).toBe(6);
      expect(teams[0]).toHaveProperty("id");
      expect(teams[0]).toHaveProperty("name");
    },
    TEAM_TIMEOUT,
  );

  it(
    "getPlayers returns expected properties",
    async () => {
      const program = Effect.gen(function* () {
        const mll = yield* MLLClient;
        return yield* mll.getPlayers({ year: 2006 });
      });

      const players = await Effect.runPromise(
        program.pipe(Effect.provide(MLLClient.layer)),
      );

      expect(players[0]).toBeDefined();
      expect(players[0]?.id).toBeTypeOf("string");
      expect(players[0]?.name).toBeTypeOf("string");
      expect(players[0]?.stats).toBeDefined();
      expect(players[0]?.stats?.games_played).toBeTypeOf("number");
      expect(players[0]?.stats?.goals).toBeTypeOf("number");
      expect(players[0]?.stats?.assists).toBeTypeOf("number");
      expect(players[0]?.stats?.points).toBeTypeOf("number");
    },
    PLAYER_TIMEOUT,
  );

  it(
    "getGoalies returns expected properties",
    async () => {
      const program = Effect.gen(function* () {
        const mll = yield* MLLClient;
        return yield* mll.getGoalies({ year: 2019 });
      });

      const goalies = await Effect.runPromise(
        program.pipe(Effect.provide(MLLClient.layer)),
      );

      expect(goalies[0]).toBeDefined();
      expect(goalies[0]?.id).toBeTypeOf("string");
      expect(goalies[0]?.name).toBeTypeOf("string");
      expect(goalies[0]?.stats).toBeDefined();
      expect(goalies[0]?.stats?.gaa).toSatisfy(
        (v: unknown) => v === null || typeof v === "number",
      );
      expect(goalies[0]?.stats?.save_pct).toSatisfy(
        (v: unknown) => v === null || typeof v === "number",
      );
    },
    PLAYER_TIMEOUT,
  );

  it(
    "getStandings returns expected properties",
    async () => {
      const program = Effect.gen(function* () {
        const mll = yield* MLLClient;
        return yield* mll.getStandings({ year: 2019 });
      });

      const standings = await Effect.runPromise(
        program.pipe(Effect.provide(MLLClient.layer)),
      );

      expect(standings[0]).toBeDefined();
      expect(standings[0]?.team_id).toBeTypeOf("string");
      expect(standings[0]?.wins).toBeTypeOf("number");
      expect(standings[0]?.losses).toBeTypeOf("number");
      expect(standings[0]?.games_played).toBeTypeOf("number");
      expect(standings[0]?.position).toBeTypeOf("number");
    },
    TEAM_TIMEOUT,
  );

  it(
    "getStatLeaders returns expected properties",
    async () => {
      const program = Effect.gen(function* () {
        const mll = yield* MLLClient;
        return yield* mll.getStatLeaders({ year: 2019 });
      });

      const leaders = await Effect.runPromise(
        program.pipe(Effect.provide(MLLClient.layer)),
      );

      expect(leaders[0]).toBeDefined();
      expect(leaders[0]?.player_id).toBeTypeOf("string");
      expect(leaders[0]?.player_name).toBeTypeOf("string");
      expect(leaders[0]?.stat_type).toBeTypeOf("string");
      expect(leaders[0]?.stat_value).toBeTypeOf("number");
      expect(leaders[0]?.rank).toBeTypeOf("number");
    },
    TEAM_TIMEOUT,
  );

  // Wayback Machine can be slow - need longer timeout
  const WAYBACK_TIMEOUT = 180_000;

  it(
    "getSchedule returns expected properties when available",
    async () => {
      const program = Effect.gen(function* () {
        const mll = yield* MLLClient;
        return yield* mll.getSchedule({ year: 2006 });
      });

      const games = await runWaybackProgram(program);
      if (games === null) {
        return;
      }

      // Log coverage for transparency
      console.log(`Coverage: ${games.length} games found for 2006`);

      if (games.length > 0) {
        const game = games[0];
        expect(game).toBeDefined();
        expect(game?.id).toBeTypeOf("string");
        expect(game?.home_team_id).toBeTypeOf("string");
        expect(game?.away_team_id).toBeTypeOf("string");
        // These may be null for archived data
        expect(game).toHaveProperty("home_score");
        expect(game).toHaveProperty("away_score");
        expect(game).toHaveProperty("date");
        expect(game).toHaveProperty("source_url");
      }
    },
    WAYBACK_TIMEOUT,
  );
});
