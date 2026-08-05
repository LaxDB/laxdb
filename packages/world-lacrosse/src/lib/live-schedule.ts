import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect, Option, Schedule, Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useEffect } from "react";

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

export interface LiveScheduleState {
  readonly data: LiveSchedule | undefined;
  readonly isPending: boolean;
  readonly isFetching: boolean;
  readonly isError: boolean;
  readonly refetch: () => void;
}

export const useLiveSchedule = (enabled: boolean): LiveScheduleState => {
  const queryClient = useQueryClient();
  const query = useQuery(
    liveScheduleQueryOptions(enabled, () =>
      queryClient.getQueryData<LiveSchedule>(liveScheduleQueryKey),
    ),
  );
  return {
    data: query.data,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
};

const previousSchedule = (
  result: Option.Option<AsyncResult.AsyncResult<LiveSchedule, unknown>>,
): LiveSchedule | undefined =>
  Option.getOrUndefined(Option.flatMap(result, AsyncResult.value));

const liveScheduleEffectAtom = Atom.make((get) =>
  Effect.tryPromise((signal) =>
    fetchLiveSchedule(
      previousSchedule(
        get.self<AsyncResult.AsyncResult<LiveSchedule, unknown>>(),
      ),
      signal,
    ),
  ).pipe(Effect.retry(Schedule.recurs(1))),
).pipe(
  Atom.swr({
    staleTime: "15 seconds",
    revalidateOnMount: true,
    revalidateOnFocus: true,
    focusSignal: Atom.windowFocusSignal,
  }),
  Atom.keepAlive,
);

const disabledLiveScheduleEffectAtom = Atom.make(
  AsyncResult.initial<LiveSchedule>(),
);

export const useEffectAtomLiveSchedule = (
  enabled: boolean,
): LiveScheduleState => {
  const atom = enabled
    ? liveScheduleEffectAtom
    : disabledLiveScheduleEffectAtom;
  const result = useAtomValue(atom);
  const refresh = useAtomRefresh(atom);
  const data = Option.getOrUndefined(AsyncResult.value(result));
  const refreshInterval = data?.schedule.some((game) =>
    isActiveGameStatus(game.status),
  )
    ? 30_000
    : 60_000;

  useEffect(() => {
    if (
      !enabled ||
      data === undefined ||
      document.visibilityState !== "visible"
    )
      return;
    const timer = window.setTimeout(refresh, refreshInterval);
    return () => {
      window.clearTimeout(timer);
    };
  }, [data, enabled, refresh, refreshInterval]);

  return {
    data,
    isPending: result._tag === "Initial",
    isFetching: result.waiting,
    isError: result._tag === "Failure",
    refetch: refresh,
  };
};
