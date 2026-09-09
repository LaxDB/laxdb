"use client";

import { useAtom } from "@effect/atom-react";
import { Option } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useRef, useState } from "react";

import { fromPromise } from "./atom-query";

/** Each component owns its action state; repeated submissions do not cancel writes. */
export const useAsyncAction = <A, Input = void>(
  run: (input: Input) => Promise<A>,
) => {
  const currentRun = useRef(run);
  currentRun.current = run;
  const [action] = useState(() =>
    Atom.fn<Input>()((input) => fromPromise(() => currentRun.current(input)), {
      concurrent: true,
    }),
  );
  const [result, execute] = useAtom(action);
  return {
    execute,
    data: Option.getOrUndefined(AsyncResult.value(result)),
    error: Option.getOrUndefined(AsyncResult.error(result)),
    isPending: result.waiting,
    isIdle: AsyncResult.isInitial(result) && !result.waiting,
    isSuccess: AsyncResult.isSuccess(result) && !result.waiting,
  };
};
