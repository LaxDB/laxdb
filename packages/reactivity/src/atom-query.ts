import { Duration, type Effect, Option } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

export interface AsyncQueryOptions<A, E> {
  readonly load: (previous: A | undefined) => Effect.Effect<A, E>;
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
  const cached = source.pipe(
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
  return query.pipe(Atom.setIdleTTL(idleTTL));
};
