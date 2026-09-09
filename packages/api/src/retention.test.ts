import * as Alchemy from "alchemy";
import { Providers as CloudflareProviders } from "alchemy/Cloudflare";
import { Providers as DrizzleProviders } from "alchemy/Drizzle/Providers";
import * as Provider from "alchemy/Provider";
import * as Effect from "effect/Effect";
import { expect, it, vi } from "vitest";

import {
  database,
  kv,
  storage,
  worldLacrosseLiveScores,
} from "../../../alchemy.run.ts";

// Do not load the worker runtime. Only evaluate real resource declarations, not the stack or providers.
vi.mock("./index.ts", () => ({ makeApiWorker: vi.fn() }));

it.each(["prod", "dev", "pr-42"])(
  "retains only production data resources in %s",
  async (stage) => {
    const stack = Alchemy.Stack.of({
      name: "laxdb",
      stage,
      resources: {},
      bindings: {},
      actions: {},
    });
    const resources = await Effect.gen(function* () {
      const db = yield* database;
      const bucket = yield* storage;
      yield* kv;
      yield* worldLacrosseLiveScores;
      return { db, bucket };
    }).pipe(
      Effect.provideService(Alchemy.Stack, stack),
      Effect.provideService(Alchemy.Stage, stage),
      Effect.provideServiceEffect(CloudflareProviders, Provider.collection([])),
      Effect.provideServiceEffect(DrizzleProviders, Provider.collection([])),
      Effect.runPromise,
    );

    const policy = stage === "prod" ? "retain" : "destroy";
    expect(
      Object.values(stack.resources).map((resource) => [
        resource.LogicalId,
        resource.RemovalPolicy,
      ]),
    ).toEqual([
      ["database-schema", "destroy"],
      ["database", policy],
      ["storage", policy],
      ["kv", "destroy"],
      ["world-lacrosse-live-scores", "destroy"],
    ]);
    expect(resources.db.Props).toMatchObject({
      name: stage === "prod" ? "laxdb" : `laxdb-${stage}`,
      readReplication: { mode: stage === "prod" ? "auto" : "disabled" },
    });
    expect(resources.bucket.LogicalId).toBe("storage");
  },
);
