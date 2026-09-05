import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { WLAClient } from "./wla.client";

// Integration tests hit real external APIs (Pointstreak via WLA website)
// Longer timeouts needed for network latency
const TEAM_TIMEOUT = 15_000;

// WLA uses calendar year as season ID (e.g., 2024 for 2024 season)
const TEST_SEASON_ID = 2024; // 2024 season - stable data

describe("WLAClient", () => {
  it(
    "getTeams fetches teams for season 2024",
    async () => {
      const program = Effect.gen(function* () {
        const wla = yield* WLAClient;
        return yield* wla.getTeams({ seasonId: TEST_SEASON_ID });
      });

      const teams = await Effect.runPromise(
        program.pipe(Effect.provide(WLAClient.layer)),
      );

      // WLA has 7 known teams in recent seasons
      expect(teams.length).toBeGreaterThanOrEqual(7);
      expect(teams[0]).toHaveProperty("id");
      expect(teams[0]).toHaveProperty("code");
      expect(teams[0]).toHaveProperty("name");
    },
    TEAM_TIMEOUT,
  );
});
