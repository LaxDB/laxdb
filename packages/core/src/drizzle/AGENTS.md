# Drizzle Database Layer

> **When to read:** DB connection issues, Cloudflare D1 bindings, custom Drizzle types.

Database connection and Drizzle ORM setup for Effect-TS.

## FILES

| File | Purpose |
|------|---------|
| `drizzle.service.ts` | Native Effect Drizzle service, layer constructor, error-mapping query helper |
| `drizzle.type.ts` | Shared SQLite column helpers (ids, timestamps) |
| `schema.ts` | Single schema module used by Alchemy and drizzle-kit |

## CONNECTION STRATEGY

```
1. The API layer passes its D1 binding to `alchemy/Drizzle/D1`
2. Alchemy builds and scopes the Effect-native Drizzle client for each execution
3. `DrizzleService` exposes the native `EffectSQLiteD1Database` to repositories
4. Tests use the same Effect Drizzle driver with an in-memory Miniflare D1 database
```

## INVARIANTS

1. **Single DatabaseLive layer**: All services depend on this - never create parallel connections
2. **Native query Effects**: Drizzle builders are Effects; `query` only maps driver errors to `SqlError`
3. **Cloudflare D1 is SQLite**: use `drizzle-orm/sqlite-core` schemas and SQLite-compatible SQL
4. **No connection URLs or pools**: D1 is a Worker binding, not a TCP database

## CUSTOM TYPES

```typescript
// drizzle.type.ts
export const timestamp = (name: string) =>
  integer(name, { mode: "timestamp_ms" });
```

**Why integer timestamps?** D1 stores SQLite values; Drizzle maps `timestamp_ms` integers to `Date` objects.

## USAGE IN REPOS

```typescript
export class MyRepo extends Effect.Service<MyRepo>()("MyRepo", {
  effect: Effect.gen(function* () {
    const db = yield* DrizzleService;
    return {
      list: () => query(db.select().from(myTable)),
    };
  }),
  dependencies: [DrizzleService.Default],
}) {}
```

## ANTI-PATTERNS

- **Creating direct DB handles**: Use `alchemy/Drizzle/D1` at Worker boundaries and `DrizzleService` inside services
- **Connection strings or pools**: D1 is bound through Cloudflare, no `pg` pool
- **Non-SQLite syntax**: D1 uses SQLite syntax
