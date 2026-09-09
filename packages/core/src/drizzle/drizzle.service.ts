import type { D1Client } from "@effect/sql-d1/D1Client";
import type { EffectSQLiteD1Database } from "drizzle-orm/effect-d1";
import { Array as Arr, Cause, Context, Data, Effect, Layer } from "effect";

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

/** Decode raw batch columns before applying the domain's existing output schema. */
export const mapBatchRow = (
  columns: Readonly<
    Record<
      string,
      {
        readonly name: string;
        readonly mapFromDriverValue: (value: unknown) => unknown;
      }
    >
  >,
  row: Readonly<Record<string, unknown>>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(columns).map(([key, column]) => {
      const value = row[column.name];
      return [key, value === null ? null : column.mapFromDriverValue(value)];
    }),
  );

/** Take first element from array as Effect — fails with NoSuchElementError */
export const headOrFail = <A>(arr: readonly A[]) =>
  Effect.fromOption(Arr.head(arr));

// ---------------------------------------------------------------------------
// DrizzleService — provides Alchemy's Effect-native D1 Drizzle database
// ---------------------------------------------------------------------------

type Database = EffectSQLiteD1Database & { readonly $client: D1Client };

export class DrizzleService extends Context.Service<DrizzleService, Database>()(
  "DrizzleService",
) {}

export const DatabaseLive = (database: Effect.Effect<Database>) =>
  Layer.effect(DrizzleService, database);

/** Compile Drizzle writes without executing them, then commit one native D1 batch.
 * Keep nested chains on the same database so Alchemy resolves them per request.
 * Results are raw D1 rows, not Drizzle-decoded rows.
 */
export const batch = (
  db: Database,
  statements: readonly { toSQL(): { sql: string; params: unknown[] } }[],
) =>
  Effect.suspend(() =>
    query(
      db.$client.batch(
        statements.map((statement) => {
          const compiled = statement.toSQL();
          return db.$client.unsafe<Record<string, unknown>>(
            compiled.sql,
            compiled.params,
          );
        }),
      ),
    ),
  );
