import { Effect } from "effect";
import { AsyncResult, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it } from "vitest";

import { makeAsyncQuery } from "./atom-query";

describe("makeAsyncQuery", () => {
  it("keeps unused queries for five minutes by default", () => {
    const atom = makeAsyncQuery({ load: () => Effect.succeed(1) });

    expect(atom.keepAlive).toBe(false);
    expect(atom.idleTTL).toBe(5 * 60 * 1_000);
  });

  it("allows each query to override the idle lifetime", () => {
    const disposable = makeAsyncQuery({
      load: () => Effect.succeed(1),
      idleTTL: 0,
    });
    const applicationOwned = makeAsyncQuery({
      load: () => Effect.succeed(1),
      idleTTL: "Infinity",
    });

    expect(disposable.keepAlive).toBe(false);
    expect(disposable.idleTTL).toBe(0);
    expect(applicationOwned.keepAlive).toBe(true);
    expect(applicationOwned.idleTTL).toBeUndefined();
  });

  it("uses stale-time overrides on remount", () => {
    let loads = 0;
    const atom = makeAsyncQuery({
      load: () => Effect.sync(() => ++loads),
      staleTime: "1 minute",
    });
    const registry = AtomRegistry.make();

    const unmount = registry.mount(atom);
    const first = registry.get(atom);
    expect(AsyncResult.getOrThrow(first)).toBe(1);
    unmount();

    const remount = registry.mount(atom);
    const second = registry.get(atom);
    expect(AsyncResult.getOrThrow(second)).toBe(1);
    expect(loads).toBe(1);
    remount();
    registry.dispose();
  });
});
