import type { EffectSQLiteD1Database } from "drizzle-orm/effect-d1";
import { Array as Arr, Cause, Context, Data, Effect, Layer } from "effect";

import type { DatabaseRelations } from "./relations";

export type Database = EffectSQLiteD1Database<DatabaseRelations>;

// ---------------------------------------------------------------------------
// SqlError — application-facing error for Drizzle query failures
// ---------------------------------------------------------------------------

export class SqlError extends Data.TaggedError("SqlError")<{
  readonly cause: unknown;
  readonly message: string;
}> {}

const underlyingCause = (error: unknown, depth = 0): unknown => {
  if (depth >= 8) return error;
  if (Cause.isCause(error)) {
    return underlyingCause(Cause.squash(error), depth + 1);
  }
  if (typeof error !== "object" || error === null || !("cause" in error)) {
    return error;
  }
  const cause: unknown = Reflect.get(error, "cause");
  return cause === undefined ? error : underlyingCause(cause, depth + 1);
};

// ---------------------------------------------------------------------------
// Drizzle query helper — maps the native connector error into the app error
// ---------------------------------------------------------------------------

export const query = <T, E, R>(
  queryEffect: Effect.Effect<T, E, R>,
): Effect.Effect<T, SqlError, R> =>
  Effect.mapError(
    queryEffect,
    (error) =>
      new SqlError({
        cause: underlyingCause(error),
        message: "Query failed",
      }),
  );

/** Take first element from array as Effect — fails with NoSuchElementError */
export const headOrFail = <A>(arr: readonly A[]) =>
  Effect.fromOption(Arr.head(arr));

// ---------------------------------------------------------------------------
// DrizzleService — provides Alchemy's Effect-native D1 Drizzle database
// ---------------------------------------------------------------------------

export class DrizzleService extends Context.Service<DrizzleService, Database>()(
  "DrizzleService",
) {}

export const DatabaseLive = (database: Effect.Effect<Database>) =>
  Layer.effect(DrizzleService, database);
