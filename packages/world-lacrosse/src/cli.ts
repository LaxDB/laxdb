import { BunRuntime } from "@effect/platform-bun";
import { Duration, Effect, Schema } from "effect";

import { Championship } from "./schema";
import { DEFAULT_SCHEDULE_URL, WorldLacrosseScraper } from "./scraper";
import {
  DEFAULT_SYNC_DIRECTORY,
  TournamentSync,
  type SyncOptions,
} from "./sync";

const args = process.argv.slice(2);
const command = args[0] ?? "sync";
const option = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const positiveNumber = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const syncOptions: SyncOptions = {
  outputDirectory: option("--output") ?? DEFAULT_SYNC_DIRECTORY,
  force: args.includes("--force"),
  skipPlayerRefresh: args.includes("--skip-players"),
};

const syncOnce = Effect.gen(function* () {
  const sync = yield* TournamentSync;
  yield* sync.syncOnce(syncOptions);
});

const poll = Effect.gen(function* () {
  const sync = yield* TournamentSync;
  const intervalSeconds = positiveNumber(option("--interval"), 120);
  const liveIntervalSeconds = positiveNumber(option("--live-interval"), 30);
  yield* Effect.log(
    `Polling every ${liveIntervalSeconds}s during live games and ${intervalSeconds}s otherwise. Press Ctrl-C to stop.`,
  );
  yield* Effect.gen(function* () {
    const result = yield* sync.syncOnce(syncOptions).pipe(
      Effect.catchTags({
        FetchError: (error) =>
          Effect.logError(error.message).pipe(Effect.as(null)),
        ScrapeError: (error) =>
          Effect.logError(error.message).pipe(Effect.as(null)),
        SyncStorageError: (error) =>
          Effect.logError(error.message).pipe(Effect.as(null)),
      }),
    );
    const nextInterval =
      result && result.counts.activeGames > 0
        ? liveIntervalSeconds
        : intervalSeconds;
    const jitteredInterval = yield* Effect.sync(() =>
      Math.max(1, Math.round(nextInterval * (0.9 + Math.random() * 0.2))),
    );
    yield* Effect.log(`Next sync in ${jitteredInterval} seconds`);
    yield* Effect.sleep(Duration.seconds(jitteredInterval));
  }).pipe(Effect.forever);
});

const legacyScrape = Effect.gen(function* () {
  const scraper = yield* WorldLacrosseScraper;
  const outputPath = option("--output") ?? "world-lacrosse-2026-womens.json";
  const championship = yield* scraper.scrape(DEFAULT_SCHEDULE_URL);
  const encoded = yield* Schema.encodeEffect(Championship)(championship);
  yield* Effect.tryPromise({
    try: () => Bun.write(outputPath, `${JSON.stringify(encoded, null, 2)}\n`),
    catch: (cause) =>
      new Error(`Could not write ${outputPath}: ${String(cause)}`),
  });
  yield* Effect.log(
    `Wrote ${championship.games.length} games to ${outputPath}`,
  );
});

const program =
  command === "poll"
    ? poll.pipe(Effect.provide(TournamentSync.layer))
    : command === "scrape"
      ? legacyScrape.pipe(Effect.provide(WorldLacrosseScraper.layer))
      : syncOnce.pipe(Effect.provide(TournamentSync.layer));

BunRuntime.runMain(program);
