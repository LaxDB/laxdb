import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { NLLClient } from "./nll.client";

describe("NLLClient", () => {
  it("getTeams returns expected properties", async () => {
    const program = Effect.gen(function* () {
      const nll = yield* NLLClient;
      return yield* nll.getTeams({ seasonId: 225 });
    });

    const teams = await Effect.runPromise(
      program.pipe(Effect.provide(NLLClient.layer)),
    );

    expect(teams[0]).toBeDefined();
    expect(teams[0]?.id).toBeTypeOf("string");
    expect(teams[0]?.code).toBeTypeOf("string");
  });

  it("getPlayers returns expected properties", async () => {
    const program = Effect.gen(function* () {
      const nll = yield* NLLClient;
      return yield* nll.getPlayers({ seasonId: 225 });
    });

    const players = await Effect.runPromise(
      program.pipe(Effect.provide(NLLClient.layer)),
    );

    expect(players[0]).toBeDefined();
    expect(players[0]?.personId).toBeTypeOf("string");
    expect(players[0]?.firstname).toBeTypeOf("string");
  }, 60000);

  it("getStandings returns expected properties", async () => {
    const program = Effect.gen(function* () {
      const nll = yield* NLLClient;
      return yield* nll.getStandings({ seasonId: 225 });
    });

    const standings = await Effect.runPromise(
      program.pipe(Effect.provide(NLLClient.layer)),
    );

    expect(standings[0]).toBeDefined();
    expect(standings[0]?.team_id).toBeTypeOf("string");
    expect(standings[0]?.wins).toBeTypeOf("number");
    expect(standings[0]?.losses).toBeTypeOf("number");
  });

  it("getSchedule returns expected properties", async () => {
    const program = Effect.gen(function* () {
      const nll = yield* NLLClient;
      return yield* nll.getSchedule({ seasonId: 225 });
    });

    const schedule = await Effect.runPromise(
      program.pipe(Effect.provide(NLLClient.layer)),
    );

    expect(schedule[0]).toBeDefined();
    expect(schedule[0]?.id).toBeTypeOf("string");
    expect(schedule[0]?.squads).toHaveProperty("away");
    expect(schedule[0]?.squads).toHaveProperty("home");
  });
});
