import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Cause, Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

import { makeAsyncQuery } from "./atom-query";
import { isActiveGameStatus } from "./game-status";
import { validateLiveScheduleCandidate } from "./live-snapshot-validation";
import { LiveSchedule } from "./schema";

const decodeLiveSchedule = Schema.decodeUnknownSync(LiveSchedule);

export const liveScheduleQueryKey = [
  "world-lacrosse",
  "live-schedule",
] as const;

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

export const liveScheduleQueryOptions = (
  enabled: boolean,
  previous: () => LiveSchedule | undefined,
) =>
  queryOptions({
    queryKey: liveScheduleQueryKey,
    queryFn: ({ signal }) => fetchLiveSchedule(previous(), signal),
    enabled,
    gcTime: Infinity,
    refetchInterval: enabled
      ? (query) =>
          query.state.data?.schedule.some((game) =>
            isActiveGameStatus(game.status),
          )
            ? 30_000
            : 60_000
      : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: enabled,
    retry: enabled ? 1 : false,
    staleTime: 15_000,
  });

export const useLiveSchedule = (enabled: boolean) => {
  const queryClient = useQueryClient();
  return useQuery(
    liveScheduleQueryOptions(enabled, () =>
      queryClient.getQueryData<LiveSchedule>(liveScheduleQueryKey),
    ),
  );
};

const liveScheduleEffectAtom = makeAsyncQuery<LiveSchedule>({
  load: ({ previous, signal }) => fetchLiveSchedule(previous, signal),
  staleTime: "15 seconds",
  retries: 1,
  revalidateOnFocus: true,
  keepAlive: true,
  pollInterval: (schedule) =>
    schedule.schedule.some((game) => isActiveGameStatus(game.status))
      ? "30 seconds"
      : "1 minute",
});

const disabledLiveScheduleResult: AsyncResult.AsyncResult<
  LiveSchedule,
  Cause.UnknownError
> = AsyncResult.initial();
const disabledLiveScheduleEffectAtom = Atom.make(disabledLiveScheduleResult);

export const useEffectAtomLiveSchedule = (
  enabled: boolean,
): readonly [
  AsyncResult.AsyncResult<LiveSchedule, Cause.UnknownError>,
  () => void,
] => {
  const atom = enabled
    ? liveScheduleEffectAtom
    : disabledLiveScheduleEffectAtom;
  return [useAtomValue(atom), useAtomRefresh(atom)];
};
