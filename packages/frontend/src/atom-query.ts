import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Duration, Effect, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";

/** Wait for a refresh; query consumers display any refresh error. */
export const waitForQuery = <A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) =>
  Effect.runPromiseExit(
    AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }),
  );

export class RequestError extends Schema.TaggedErrorClass<RequestError>()(
  "RequestError",
  { message: Schema.String, cause: Schema.Defect() },
) {}

export const fromPromise = <A>(run: (signal: AbortSignal) => PromiseLike<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) =>
      new RequestError({
        message: cause instanceof Error ? cause.message : "Request failed",
        cause,
      }),
  });

interface EffectQueryOptions<A, E> {
  readonly load: (previous: A | undefined) => Effect.Effect<A, E>;
  readonly refreshSignal?: Atom.Atom<unknown>;
  readonly serialization?:
    | {
        readonly key: string;
        readonly schema: Schema.ConstraintCodec<
          AsyncResult.AsyncResult<A, E>,
          unknown
        >;
      }
    | undefined;
  readonly staleTime?: Duration.Input | undefined;
  readonly idleTTL?: Duration.Input | undefined;
  readonly pollInterval?:
    | ((value: A | undefined) => Duration.Input)
    | undefined;
}

export const makeAsyncQuery = <A>(
  options: Omit<
    EffectQueryOptions<A, RequestError>,
    "load" | "serialization"
  > & {
    readonly load: (signal: AbortSignal) => PromiseLike<A>;
    readonly serialization?: {
      readonly key: string;
      readonly schema: Schema.ConstraintCodec<A, unknown>;
    };
  },
): Atom.Atom<AsyncResult.AsyncResult<A, RequestError>> =>
  makeEffectQuery({
    ...options,
    load: () => fromPromise(options.load),
    serialization:
      options.serialization === undefined
        ? undefined
        : {
            key: options.serialization.key,
            schema: AsyncResult.Schema({
              success: options.serialization.schema,
              error: RequestError,
            }),
          },
  });

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

/** Use Effect loaders when queries need typed failures, retries, or previous data. */
export const makeEffectQuery = <A, E>(
  options: EffectQueryOptions<A, E>,
): Atom.Atom<AsyncResult.AsyncResult<A, E>> => {
  const source = Atom.make((get: Atom.AtomContext) =>
    options.load(
      previousValue(get.self<AsyncResult.AsyncResult<A, unknown>>()),
    ),
  );
  // Hydrate the source, not its SWR wrapper, so the first read uses seeded data.
  const hydratable =
    options.serialization === undefined
      ? source
      : source.pipe(Atom.serializable(options.serialization));
  const refreshable =
    options.refreshSignal === undefined
      ? hydratable
      : hydratable.pipe(Atom.makeRefreshOnSignal(options.refreshSignal));
  // Cache the data; recreate the SWR wrapper on remount to check staleness.
  const cached = refreshable.pipe(
    Atom.setIdleTTL(options.idleTTL ?? "5 minutes"),
    Atom.swr({
      staleTime: options.staleTime ?? 0,
      revalidateOnMount: true,
      revalidateOnFocus: true,
      focusSignal:
        typeof document === "undefined" ? undefined : Atom.windowFocusSignal,
    }),
  );
  const query =
    options.pollInterval === undefined
      ? cached
      : cached.pipe(withPolling(options.pollInterval));
  return query.pipe(Atom.setIdleTTL(0));
};

export interface AsyncQueryState<A, E> {
  readonly data: A | undefined;
  readonly error: E | undefined;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly refresh: () => void;
}

const disabledQuery = Atom.make(AsyncResult.initial());

export const useAsyncQuery = <A, E>(
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>> | undefined,
): AsyncQueryState<A, E> => {
  const result = useAtomValue(atom ?? disabledQuery);
  const refresh = useAtomRefresh(atom ?? disabledQuery);
  const data = Option.getOrUndefined(AsyncResult.value(result));

  return {
    data,
    error: Option.getOrUndefined(AsyncResult.error(result)),
    isLoading:
      atom !== undefined &&
      data === undefined &&
      (result.waiting || AsyncResult.isInitial(result)),
    isFetching: atom !== undefined && result.waiting,
    refresh,
  };
};
