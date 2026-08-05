## MUST KNOW

- **Public Publishing**: you must consult `PUBLIC_PUBLISHING.md` before making any commits, pushes, merges. Not following this rule will cause major issues
- **Type safety is non-negotiable**: No `any`, no `!`, no `as Type`
- **Infisical for secrets**: `infisical run --env=dev --` prefix for local dev
- **CSS tokens live in `@laxdb/ui`**: `packages/ui/src/globals.css` is single source of truth for all runtime design tokens (colors, fonts, animations). Other packages import via `@import "@laxdb/ui/globals.css"`. Never duplicate tokens.
- **DESIGN.md guides visual intent**: read root `DESIGN.md` before visual UI changes. Keep it semantically aligned with `packages/ui/src/globals.css`; validate edits with `bun run design:lint`.
  **Data flow**: App routes and server functions call `packages/api`, which delegates to `packages/core` services. Services use repos for DB access. All Effect-based with typed errors.

## COMMON TASKS

| Task                  | Package | Pattern                                                                |
| --------------------- | ------- | ---------------------------------------------------------------------- |
| Add domain entity     | `core`  | schema.ts → {domain}.sql.ts → repo → service → contract                |
| Add API endpoint      | `api`   | core contract → {domain}.api.ts → {domain}.handlers.ts                 |
| Add UI component      | `ui`    | `bunx --bun shadcn@latest add <component>`                             |
| Modify DB schema      | `core`  | Edit sql.ts → `bun run db:generate` → deploy via Alchemy D1 migrations |
| Deploy infrastructure | root    | `bun run deploy` (runs alchemy.run.ts)                                 |

## ANTI-PATTERNS (BLOCKING)

| Pattern                    | Why Bad                | Do Instead        |
| -------------------------- | ---------------------- | ----------------- |
| `Effect.catchAll`          | Swallows typed errors  | `Effect.catchTag` |
| Direct DB in routes        | Bypasses service layer | service → repo    |
| `useState` for server data | Missing cache/sync     | TanStack Query    |

<!-- effect-solutions:start -->

## Effect Best Practices

**IMPORTANT:** Always consult effect-solutions before writing Effect code.

1. Run `effect-solutions list` to see available guides
2. Run `effect-solutions show <topic>...` for relevant patterns (supports multiple topics)
3. Inspect `node_modules/effect/src` for version-specific behavior and implementations

Topics: quick-start, project-setup, tsconfig, basics, services-and-layers, data-modeling, error-handling, config, testing, cli.

The installed `node_modules/effect/src` source is authoritative for the Effect version used by this repository. Treat effect-solutions as pattern guidance. Never guess at Effect patterns or rely on a separately cloned Effect repository.

<!-- effect-solutions:end -->

## CHILD INTENT NODES

- `packages/core/CLAUDE.md` - Domain logic, services, DB (CRITICAL - read first for backend work)
- `packages/api/CLAUDE.md` - HttpApi/generated client patterns
- `packages/ui/CLAUDE.md` - Base UI component APIs
- `packages/pipeline/CLAUDE.md` - Data ingestion, external APIs, scraping patterns
- `packages/cli/CLAUDE.md` - CLI tools for API interaction
- `packages/practice-planner/CLAUDE.md` - Visual practice planning canvas
