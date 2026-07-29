# @laxdb/world-lacrosse

Standalone Effect package and tournament UI for the 2026 World Lacrosse Women's Championship. It mirrors the source tournament data and adds searchable comparison tables and game-level analysis.

The sync pipeline captures:

- the complete schedule and every game-detail page
- live scores, period scores, team statistics, play-by-play, rosters, and officials
- every player profile, tournament total, and game log
- teams, team records, team statistics, staff, and contributions
- standings and tournament leaderboards
- tournament format and progression
- schema-backed match insights and verified tournament context with explicit ranking samples
- a derived completed-game dataset for advanced analysis

## UI

```sh
bun run --cwd packages/world-lacrosse dev
```

Open `http://localhost:3010`. Routes include `/schedule`, `/teams`, `/standings`, `/statistics`, `/analysis`, `/format`, `/games/:gameId`, `/players/:playerId`, and `/teams/:teamId`. Team routes combine the current match ledger, pool position, reconciled performance rates, game-state and scoring profiles, recorded player leaders, squad metadata, and staff. Upcoming fixtures replace empty match analysis with a descriptive comparison of both teams' official, reconciled prior games.

## Product roadmap

Background feature work is tracked in [`ROADMAP.md`](ROADMAP.md). The active workstream is the typed match-insights and tournament-context engine; its definitions, quality states, ranking models, and limitations are documented in [`docs/MATCH_INSIGHTS.md`](docs/MATCH_INSIGHTS.md).

## Sync once

```sh
bun run --cwd packages/world-lacrosse sync
```

The incremental sync refreshes active or changed game pages immediately. During live play, derived player totals update directly from the refreshed play-by-play, without re-requesting every player profile. The heavier source player profiles and tournament-wide pages refresh when a game becomes official; missing profiles are also filled automatically. While idle, tournament tables and team pages receive a two-hour correction check, and official games are rechecked every twelve hours. The complete generation—championship, tournament, analysis, and manifest—is atomically replaced as `src/generated/dataset.json`, so builds cannot observe a mixed generation.

For a publication-time game/tournament refresh without waiting for hundreds of player-profile requests:

```sh
bun src/cli.ts sync --skip-players
```

This flag is available only for an incremental sync with an existing dataset; force and first-time syncs always build a complete player collection. Game-derived player leaderboards still update. Goalkeeper additions remain fail-closed until a later normal sync refreshes and reconciles their source player logs.

Force a complete rebuild of all 44 games and 349 player profiles:

```sh
bun run --cwd packages/world-lacrosse sync:force
```

Choose another generated-data directory:

```sh
bun src/cli.ts sync --output ./data/world-lacrosse
```

## Live scores

Production score updates are served by `src/live-scores-worker.ts`. Alchemy deploys it at `live.world.<base-domain>`, binds a dedicated KV namespace, and invokes it every minute. The worker fetches the source schedule once per minute while a game is live and every other minute otherwise, then writes the complete schedule snapshot atomically to KV. Tournament views, including individual game pages, poll that endpoint every 30 seconds during live play and every minute otherwise, while retaining the bundled dataset as an offline fallback.

Local UI development uses the production score feed by default, so it receives the same complete KV snapshot as `world.laxdb.io` without running another crawler. To test a local or preview Worker instead, set `VITE_LIVE_SCORES_URL` to its `/schedule` endpoint.

The homepage Matchday list keeps every game on the selected tournament date, regardless of status. Homepage and `/standings` pool tables are recomputed from this same refreshed schedule using the published pool tie-break sequence. `UNOFFICIAL` finals count provisionally and remain visibly labelled until the source confirms them.

All mutable UI aggregates consume one validated current-tournament snapshot. Team records and team totals, current player totals and logs, statistics tables, match insights, tournament context, and outcome analysis are derived from its schedule and reconciled game details rather than copied from separately refreshed standings, leaderboard, team, or player totals. A detail row is accepted only when its game ID, participants, status class, and score agree with the schedule in that snapshot. Missing or conflicting evidence is visibly withheld; the UI never combines a current status with older game details. Source-only biography, roster, staff, organization, flag, and format fields remain static metadata and are identified separately from game-derived totals.

The live worker backfills missing completed-game details even while games are active, rejects schedule snapshots that drop or duplicate known game IDs, and performs rolling correction checks of completed details while idle. Failed or conflicting detail refreshes do not overwrite coherent evidence. This path updates statuses, scores, standings, team/player statistics, and current analysis without rebuilding the Vite application or triggering a full player-profile crawl.

## Poll the full dataset locally

```sh
bun run --cwd packages/world-lacrosse sync:poll
```

The full-data poller is adaptive: it waits about 30 seconds when at least one game is live and about 120 seconds otherwise. A ±10% jitter avoids repeatedly landing on the source at an exact fixed boundary. Only the schedule and live game page are fetched on the fast path. Upcoming matchup metadata is compared using schedule fingerprints, and official games receive periodic correction checks.

World Lacrosse's `robots.txt` publishes `Crawl-delay: 10`, so all outbound requests share a package-wide single-request semaphore and are started at least ten seconds apart. Transient retries use the same ten-second exponential backoff, while ordinary 4xx responses are not retried. The identifying user agent links back to `world.laxdb.io`. With one live game, the fast path averages roughly three requests per minute; while idle it stays below one request per minute outside an occasional correction pass. Full 400+ page syncs happen only when explicitly forced or when initializing an empty dataset.

Configure the interval in seconds:

```sh
bun src/cli.ts poll --interval 120 --live-interval 30
```

## Replay stream research

Replay-stream discovery notes, captured HLS URLs, and the paused downloader prototype live in:

```text
tools/replay-downloader/
```

Downloaded video belongs in `downloads/replays/`. The entire package-local `downloads/` directory is gitignored to prevent large media files from being committed. See [`tools/replay-downloader/RESUME.md`](tools/replay-downloader/RESUME.md) before resuming this work; batch downloading is intentionally backlogged.

## Library

```ts
import { Effect } from "effect";
import { TournamentSync } from "@laxdb/world-lacrosse";

const program = Effect.gen(function* () {
  const sync = yield* TournamentSync;
  return yield* sync.syncOnce();
}).pipe(Effect.provide(TournamentSync.layer));
```

The lower-level `WorldLacrosseScraper` service remains available for individual schedule, game, player, team, standings, statistics, and format requests.
