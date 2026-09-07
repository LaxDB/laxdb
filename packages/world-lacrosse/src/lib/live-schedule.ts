import { makeAsyncQuery } from "@laxdb/frontend/reactivity/atom-query";
import { Effect, Schedule, Schema } from "effect";

import { FetchError } from "./error";
import { isActiveGameStatus } from "./game-status";
import { validateLiveScheduleCandidate } from "./live-snapshot-validation";
import { LiveSchedule } from "./schema";

const decodeLiveSchedule = Schema.decodeUnknownSync(LiveSchedule);

const productionEndpoint = "https://live.world.laxdb.io/schedule";
const requestTimeoutMs = 5_000;

const endpoint = (): string =>
  import.meta.env.VITE_LIVE_SCORES_URL ?? productionEndpoint;

export const fetchLiveSchedule = async (
  previous?: Readonly<LiveSchedule>,
  querySignal?: AbortSignal,
): Promise<LiveSchedule> => {
  const controller = new AbortController();
  const cancelRequest = (): void => {
    controller.abort();
  };
  if (querySignal?.aborted) cancelRequest();
  else querySignal?.addEventListener("abort", cancelRequest, { once: true });
  const timeout = setTimeout(cancelRequest, requestTimeoutMs);
  try {
    const response = await fetch(endpoint(), {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Live scores returned HTTP ${response.status}`);
    }
    return validateLiveScheduleCandidate(
      decodeLiveSchedule(await response.json()),
      previous,
    );
  } finally {
    clearTimeout(timeout);
    querySignal?.removeEventListener("abort", cancelRequest);
  }
};

const fetchLiveScheduleEffect = (previous: LiveSchedule | undefined) =>
  Effect.tryPromise({
    try: (signal) => fetchLiveSchedule(previous, signal),
    catch: (cause) =>
      FetchError.make({
        url: endpoint(),
        message:
          cause instanceof Error
            ? cause.message
            : "Failed to fetch the live schedule",
        cause,
      }),
  }).pipe(
    Effect.retry(
      Schedule.max([Schedule.spaced("1 second"), Schedule.recurs(1)]),
    ),
  );

export const liveScheduleAtom = makeAsyncQuery({
  load: fetchLiveScheduleEffect,
  staleTime: "15 seconds",
  idleTTL: "Infinity",
  pollInterval: (schedule) =>
    schedule?.schedule.some((game) => isActiveGameStatus(game.status))
      ? "30 seconds"
      : "1 minute",
});
