"use client";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

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
