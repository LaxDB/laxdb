import { Effect, Schema } from "effect";
import {
  AsyncResult,
  Atom,
  AtomRegistry,
  Hydration,
} from "effect/unstable/reactivity";
import { describe, expect, it, vi } from "vitest";

import { makeAsyncQuery } from "../src/reactivity/atom-query";
import { fromPromise } from "../src/reactivity/promise";

describe("makeAsyncQuery", () => {
  it("shares loader data with hydrated consumers without sharing server requests", async () => {
    let calls = 0;
    const query = makeAsyncQuery({
      load: () => fromPromise(() => Promise.resolve(++calls)),
      staleTime: "5 minutes",
      refreshSignal: Atom.make(0),
      serialization: {
        key: "test/me",
        schema: AsyncResult.Schema({
          success: Schema.Number,
          error: Schema.Error(),
        }),
      },
    }).pipe(Atom.optimistic);
    const server = AtomRegistry.make();
    const browser = AtomRegistry.make();
    const otherRequest = AtomRegistry.make();
    try {
      expect(
        await Effect.runPromise(AtomRegistry.getResult(server, query)),
      ).toBe(1);
      Hydration.hydrate(browser, Hydration.dehydrate(server));
      expect(
        await Effect.runPromise(AtomRegistry.getResult(browser, query)),
      ).toBe(1);
      expect(calls).toBe(1);
      expect(
        await Effect.runPromise(AtomRegistry.getResult(otherRequest, query)),
      ).toBe(2);
    } finally {
      server.dispose();
      browser.dispose();
      otherRequest.dispose();
    }
  });

  it("refreshes every mounted family member and retains data on failure", async () => {
    const changed = Atom.make(0).pipe(Atom.keepAlive);
    let version = 1;
    let fail = false;
    const error = new Error("Permission denied");
    const family = Atom.family((id: string) =>
      makeAsyncQuery({
        refreshSignal: changed,
        load: () =>
          fromPromise(() =>
            fail ? Promise.reject(error) : Promise.resolve(`${id}:${version}`),
          ),
      }),
    );
    const registry = AtomRegistry.make();
    const first = family("a");
    const second = family("b");
    const stopFirst = registry.mount(first);
    const stopSecond = registry.mount(second);
    try {
      await Effect.runPromise(AtomRegistry.getResult(registry, first));
      await Effect.runPromise(AtomRegistry.getResult(registry, second));
      version = 2;
      registry.update(changed, (value) => value + 1);
      expect(
        await Effect.runPromise(
          AtomRegistry.getResult(registry, first, { suspendOnWaiting: true }),
        ),
      ).toBe("a:2");
      expect(
        await Effect.runPromise(
          AtomRegistry.getResult(registry, second, { suspendOnWaiting: true }),
        ),
      ).toBe("b:2");
      fail = true;
      registry.update(changed, (value) => value + 1);
      await Effect.runPromiseExit(
        AtomRegistry.getResult(registry, first, { suspendOnWaiting: true }),
      );
      const result = registry.get(first);
      expect(AsyncResult.isFailure(result)).toBe(true);
      expect(AsyncResult.value(result)).toEqual(
        expect.objectContaining({ value: "a:2" }),
      );
      expect(AsyncResult.error(result)).toEqual(
        expect.objectContaining({ value: error }),
      );
    } finally {
      stopFirst();
      stopSecond();
      registry.dispose();
    }
  });

  it("rolls back a failed optimistic write and refreshes a successful write", async () => {
    let saved = "original";
    let pending = Promise.withResolvers<string>();
    const query = makeAsyncQuery({
      load: () => fromPromise(() => Promise.resolve(saved)),
    }).pipe(Atom.optimistic);
    const update = Atom.optimisticFn(query, {
      reducer: (current, value: string) =>
        AsyncResult.map(current, () => value),
      fn: Atom.fn<string>()(() => fromPromise(() => pending.promise)),
    });
    const registry = AtomRegistry.make();
    const stop = registry.mount(query);
    const stopUpdate = registry.mount(update);
    try {
      await Effect.runPromise(AtomRegistry.getResult(registry, query));
      registry.set(update, "draft");
      expect(AsyncResult.getOrThrow(registry.get(query))).toBe("draft");
      pending.reject(new Error("Write failed"));
      await Effect.runPromiseExit(
        AtomRegistry.getResult(registry, update, { suspendOnWaiting: true }),
      );
      expect(AsyncResult.getOrThrow(registry.get(query))).toBe("original");
      pending = Promise.withResolvers<string>();
      registry.set(update, "saved");
      saved = "saved";
      pending.resolve(saved);
      await Effect.runPromise(
        AtomRegistry.getResult(registry, update, { suspendOnWaiting: true }),
      );
      expect(
        await Effect.runPromise(
          AtomRegistry.getResult(registry, query, { suspendOnWaiting: true }),
        ),
      ).toBe("saved");
    } finally {
      stop();
      stopUpdate();
      registry.dispose();
    }
  });

  it("invalidates cached queries while no component is mounted", async () => {
    const changed = Atom.make(0).pipe(Atom.keepAlive);
    let version = 1;
    const query = makeAsyncQuery({
      load: () => fromPromise(() => Promise.resolve(version)),
      staleTime: "5 minutes",
      refreshSignal: changed,
    });
    const registry = AtomRegistry.make();
    try {
      expect(
        await Effect.runPromise(AtomRegistry.getResult(registry, query)),
      ).toBe(1);
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
      version = 2;
      registry.update(changed, (value) => value + 1);
      expect(
        await Effect.runPromise(
          AtomRegistry.getResult(registry, query, { suspendOnWaiting: true }),
        ),
      ).toBe(2);
    } finally {
      registry.dispose();
    }
  });

  it("keeps unused queries for five minutes by default", () => {
    const atom = makeAsyncQuery({ load: () => Effect.succeed(1) });

    expect(atom.initialValueTarget?.keepAlive).toBe(false);
    expect(atom.initialValueTarget?.idleTTL).toBe(5 * 60 * 1_000);
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

    expect(disposable.initialValueTarget?.keepAlive).toBe(false);
    expect(disposable.initialValueTarget?.idleTTL).toBe(0);
    expect(applicationOwned.initialValueTarget?.keepAlive).toBe(true);
    expect(applicationOwned.initialValueTarget?.idleTTL).toBeUndefined();
  });

  it("defers client-only queries and keeps them fresh for five minutes", async () => {
    let now = Date.now();
    const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
    let loads = 0;
    const atom = makeAsyncQuery({
      load: () => Effect.sync(() => ++loads),
      staleTime: "5 minutes",
    }).pipe(Atom.withServerValueInitial);
    const registry = AtomRegistry.make();
    try {
      expect(AsyncResult.isInitial(Atom.getServerValue(atom, registry))).toBe(
        true,
      );
      expect(loads).toBe(0);

      const unmount = registry.mount(atom);
      expect(AsyncResult.getOrThrow(registry.get(atom))).toBe(1);
      unmount();
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });

      now += 5 * 60 * 1_000 - 1;
      const remount = registry.mount(atom);
      expect(AsyncResult.getOrThrow(registry.get(atom))).toBe(1);
      expect(loads).toBe(1);
      remount();
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });

      now += 2;
      const staleMount = registry.mount(atom);
      expect(AsyncResult.getOrThrow(registry.get(atom))).toBe(2);
      expect(loads).toBe(2);
      staleMount();
    } finally {
      registry.dispose();
      clock.mockRestore();
    }
  });
});
