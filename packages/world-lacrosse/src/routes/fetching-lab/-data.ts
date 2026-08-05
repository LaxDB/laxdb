import { Duration, Effect, Option, Schedule, Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

import { FetchError } from "../../lib/error";
import { isActiveGameStatus } from "../../lib/game-status";
import { validateLiveScheduleCandidate } from "../../lib/live-snapshot-validation";
import { LiveSchedule } from "../../lib/schema";

const previousValue = <A>(
  result: Option.Option<AsyncResult.AsyncResult<A, unknown>>,
): A | undefined =>
  Option.getOrUndefined(Option.flatMap(result, AsyncResult.value));

const withPolling = <A, E>(
  interval: (value: A | undefined) => Duration.Input,
): ((
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) => Atom.Atom<AsyncResult.AsyncResult<A, E>>) =>
  Atom.transform((get, atom) => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (result: AsyncResult.AsyncResult<A, E>): void => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      if (
        result.waiting ||
        AsyncResult.isInitial(result) ||
        typeof document === "undefined"
      )
        return;

      const value = Option.getOrUndefined(AsyncResult.value(result));
      timer = setTimeout(
        () => {
          if (document.visibilityState === "visible") get.refresh(atom);
        },
        Duration.toMillis(Duration.fromInputUnsafe(interval(value))),
      );
    };

    const current = get.once(atom);
    schedule(current);
    get.subscribe(atom, (result) => {
      schedule(result);
      get.setSelf(result);
    });
    get.addFinalizer(() => {
      if (timer !== undefined) clearTimeout(timer);
    });
    return current;
  });

const productionEndpoint = "https://live.world.laxdb.io/schedule";
const decodeLiveSchedule = Schema.decodeUnknownSync(LiveSchedule);

const endpoint = (): string =>
  import.meta.env.VITE_LIVE_SCORES_URL ?? productionEndpoint;

export const fetchLiveSchedule = async (
  previous?: Readonly<LiveSchedule>,
  signal?: AbortSignal,
): Promise<LiveSchedule> => {
  const response = await fetch(endpoint(), {
    cache: "no-store",
    signal: signal ?? null,
  });
  if (!response.ok)
    throw new Error(`Live scores returned HTTP ${response.status}`);
  return validateLiveScheduleCandidate(
    decodeLiveSchedule(await response.json()),
    previous,
  );
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
    Effect.timeoutOrElse({
      duration: "5 seconds",
      orElse: () =>
        FetchError.make({
          url: endpoint(),
          message: "Live schedule request timed out",
        }),
    }),
    Effect.retry(
      Schedule.max([Schedule.spaced("1 second"), Schedule.recurs(1)]),
    ),
  );

const requestAtom = Atom.make((get: Atom.AtomContext) =>
  fetchLiveScheduleEffect(
    previousValue(get.self<AsyncResult.AsyncResult<LiveSchedule, unknown>>()),
  ),
).pipe(Atom.keepAlive);

export const scheduleAtom = requestAtom.pipe(
  Atom.swr({
    staleTime: "15 seconds",
    revalidateOnMount: true,
    revalidateOnFocus: true,
    focusSignal:
      typeof document === "undefined" ? undefined : Atom.windowFocusSignal,
  }),
  withPolling((schedule) =>
    schedule?.schedule.some((game) => isActiveGameStatus(game.status))
      ? "30 seconds"
      : "1 minute",
  ),
);
