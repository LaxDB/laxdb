import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchLiveSchedule } from "../src/lib/live-schedule";

/* oxlint-disable typescript/prefer-readonly-parameter-types -- RequestInit contains mutable browser API types. */
const pendingFetchUntilAbort = (
  ...parameters: readonly [unknown, Readonly<RequestInit>?]
): Promise<Response> =>
  new Promise<Response>((_resolve, reject) => {
    const signal = parameters[1]?.signal;
    if (!signal) {
      reject(new Error("Fetch signal is missing"));
      return;
    }
    signal.addEventListener(
      "abort",
      () => {
        reject(new Error("Fetch aborted"));
      },
      { once: true },
    );
  });
/* oxlint-enable typescript/prefer-readonly-parameter-types */

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("live schedule query", () => {
  it("aborts a hung authority request after five seconds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(pendingFetchUntilAbort));

    const request = fetchLiveSchedule();
    const aborted = expect(request).rejects.toThrow("Fetch aborted");
    await vi.advanceTimersByTimeAsync(5_000);

    await aborted;
  });
});
