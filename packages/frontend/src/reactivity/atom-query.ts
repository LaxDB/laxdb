import { Duration, Effect, Option, type Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";

/** Wait for a refresh; query consumers display any refresh error. */
export const waitForQuery = <A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) =>
  Effect.runPromiseExit(
    AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }),
  );

export interface AsyncQueryOptions<A, E> {
  readonly load: (previous: A | undefined) => Effect.Effect<A, E>;
  readonly refreshSignal?: Atom.Atom<unknown>;
  readonly serialization?: {
    readonly key: string;
    readonly schema: Schema.ConstraintCodec<
      AsyncResult.AsyncResult<A, E>,
      unknown
    >;
  };
  readonly staleTime?: Duration.Input | undefined;
  readonly idleTTL?: Duration.Input | undefined;
  readonly pollInterval?:
    | ((value: A | undefined) => Duration.Input)
    | undefined;
  readonly revalidateOnMount?: boolean | undefined;
  readonly revalidateOnFocus?: boolean | "always" | undefined;
}

const asyncQueryDefaults = {
  staleTime: 0,
  idleTTL: "5 minutes",
  revalidateOnMount: true,
  revalidateOnFocus: true,
} as const satisfies Omit<AsyncQueryOptions<unknown, unknown>, "load">;

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

export const makeAsyncQuery = <A, E>(
  options: AsyncQueryOptions<A, E>,
): Atom.Atom<AsyncResult.AsyncResult<A, E>> => {
  const staleTime = options.staleTime ?? asyncQueryDefaults.staleTime;
  const idleTTL = options.idleTTL ?? asyncQueryDefaults.idleTTL;
  const revalidateOnMount =
    options.revalidateOnMount ?? asyncQueryDefaults.revalidateOnMount;
  const revalidateOnFocus =
    options.revalidateOnFocus ?? asyncQueryDefaults.revalidateOnFocus;
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
    Atom.setIdleTTL(idleTTL),
    Atom.swr({
      staleTime,
      revalidateOnMount,
      revalidateOnFocus,
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
