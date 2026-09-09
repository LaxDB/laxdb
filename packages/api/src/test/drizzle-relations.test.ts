import { organizations } from "@laxdb/core/auth/auth.sql";
import { clubTeams } from "@laxdb/core/club/club.sql";
import { DrizzleService, query } from "@laxdb/core/drizzle/drizzle.service";
import { fixtures } from "@laxdb/core/match/match.sql";
import { disposeTestDatabase, getTestD1Database } from "@laxdb/core/test/db";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { afterAll, expect, expectTypeOf, test } from "vitest";

import { DatabaseLive } from "../layers";

afterAll(disposeTestDatabase);

test("production database layer retains nested reads across request scopes", async () => {
  const binding = await getTestD1Database();
  // Construct outside the request scopes, as Worker service initialization does.
  const { db } = await Effect.runPromise(
    DrizzleService.pipe(
      // Do not return Alchemy's chain proxy directly to Promise resolution (it exposes `then`).
      Effect.map((db) => ({ db })),
      Effect.provide(DatabaseLive),
      Effect.provideService(Cloudflare.WorkerEnvironment, { DB: binding }),
    ),
  );
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        yield* query(
          db.insert(organizations).values({
            id: "relations-org",
            name: "Relations",
            slug: "relations",
          }),
        );
        yield* query(
          db.insert(clubTeams).values({
            id: "relations-team",
            organizationId: "relations-org",
            name: "Firsts",
          }),
        );
        yield* query(
          db.insert(fixtures).values({
            id: "relations-fixture",
            organizationId: "relations-org",
            teamId: "relations-team",
            gamedayFixtureId: "1",
            homeTeamName: "Firsts",
            awayTeamName: "Visitors",
          }),
        );
      }),
    ),
  );

  const read = query(
    db.query.fixtures.findMany({
      where: { organizationId: "relations-org" },
      with: { team: { where: { organizationId: "relations-org" } } },
    }),
  );
  const first = await Effect.runPromise(Effect.scoped(read));
  const second = await Effect.runPromise(Effect.scoped(read));
  expectTypeOf(first[0]?.team?.name).toEqualTypeOf<string | undefined>();
  expect(first[0]?.team?.name).toBe("Firsts");
  expect(second).toEqual(first);
});
