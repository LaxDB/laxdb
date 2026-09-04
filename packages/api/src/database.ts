import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Schema as DrizzleSchema } from "alchemy/Drizzle/Schema";
import * as Effect from "effect/Effect";

export const database = Effect.gen(function* () {
  const stage = yield* Alchemy.Stage;
  const schema = yield* DrizzleSchema("database-schema", {
    schema: "./packages/core/src/drizzle/schema.ts",
    out: "./packages/core/migrations",
    dialect: "sqlite",
  });
  const readReplicationMode: "auto" | "disabled" =
    stage === "prod" ? "auto" : "disabled";

  return yield* Cloudflare.D1.Database("database", {
    name: stage === "prod" ? "laxdb" : `laxdb-${stage}`,
    migrationsDir: schema.out,
    readReplication: { mode: readReplicationMode },
  });
});
