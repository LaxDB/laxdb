import { type Cause, Duration, Effect, Option, Schedule } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

interface AsyncQueryOptions<A> {
  readonly load: (options: {
    readonly previous: A | undefined;
    readonly signal: AbortSignal;
  }) => PromiseLike<A>;
  readonly staleTime: Duration.Input;
  readonly retries?: number;
  readonly pollInterval?: ((value: A) => Duration.Input) | undefined;
  readonly revalidateOnFocus?: boolean | "always" | undefined;
  readonly keepAlive?: boolean | undefined;
}

const previousValue = <A>(
  result: Option.Option<AsyncResult.AsyncResult<A, unknown>>,
): A | undefined =>
  Option.getOrUndefined(Option.flatMap(result, AsyncResult.value));

const withPolling = <A, E>(
  interval: (value: A) => Duration.Input,
): ((
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) => Atom.Atom<AsyncResult.AsyncResult<A, E>>) =>
  Atom.transform((get, atom) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (result: AsyncResult.AsyncResult<A, E>): void => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      if (result.waiting || typeof document === "undefined") return;
      const value = Option.getOrUndefined(AsyncResult.value(result));
      if (value === undefined) return;
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

export const makeAsyncQuery = <A>(
  options: AsyncQueryOptions<A>,
): Atom.Atom<AsyncResult.AsyncResult<A, Cause.UnknownError>> => {
  const source = Atom.make((get: Atom.AtomContext) => {
    const request = Effect.tryPromise((signal) =>
      options.load({
        previous: previousValue(
          get.self<AsyncResult.AsyncResult<A, unknown>>(),
        ),
        signal,
      }),
    );
    return options.retries === undefined
      ? request
      : request.pipe(Effect.retry(Schedule.recurs(options.retries)));
  });
  const cached = source.pipe(
    Atom.swr({
      staleTime: options.staleTime,
      revalidateOnMount: true,
      revalidateOnFocus: options.revalidateOnFocus,
      focusSignal:
        typeof document === "undefined" ? undefined : Atom.windowFocusSignal,
    }),
  );
  const retained = options.keepAlive ? cached.pipe(Atom.keepAlive) : cached;
  return options.pollInterval === undefined
    ? retained
    : retained.pipe(withPolling(options.pollInterval));
};
