"use client";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { AsyncResult, type Atom } from "effect/unstable/reactivity";

export interface AsyncQueryState<A, E> {
  readonly data: A | undefined;
  readonly error: E | undefined;
  readonly isLoading: boolean;
  readonly refresh: () => void;
}

export const useAsyncQuery = <A, E>(
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
): AsyncQueryState<A, E> => {
  const result = useAtomValue(atom);
  const refresh = useAtomRefresh(atom);
  const data = Option.getOrUndefined(AsyncResult.value(result));

  return {
    data,
    error: Option.getOrUndefined(AsyncResult.error(result)),
    isLoading:
      data === undefined && (result.waiting || AsyncResult.isInitial(result)),
    refresh,
  };
};
