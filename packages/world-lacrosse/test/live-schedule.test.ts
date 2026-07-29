import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchLiveSchedule,
  liveScheduleQueryKey,
  liveScheduleQueryOptions,
} from "../src/live-schedule";
import { LiveSchedule } from "../src/schema";
import { tournament } from "../src/tournament-data";

const current = LiveSchedule.make({
  updatedAt: "2026-07-29T06:10:00.000Z",
  nextRefreshAt: "2026-07-29T06:12:00.000Z",
  schedule: tournament.schedule,
  games: [],
});

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
  it("does not install bundled initial or placeholder data", () => {
    const options = liveScheduleQueryOptions(true, () => current);

    expect(options.initialData).toBeUndefined();
    expect(options.placeholderData).toBeUndefined();
    expect(options.enabled).toBe(true);
  });

  it("disables fetching and polling in archived mode", () => {
    const options = liveScheduleQueryOptions(false, () => current);

    expect(options.enabled).toBe(false);
    expect(options.refetchInterval).toBe(false);
    expect(options.retry).toBe(false);
  });

  it("aborts a hung authority request after five seconds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(pendingFetchUntilAbort));

    const request = fetchLiveSchedule();
    const aborted = expect(request).rejects.toThrow("Fetch aborted");
    await vi.advanceTimersByTimeAsync(5_000);

    await aborted;
  });

  it("retains the last accepted live generation after a refresh failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(current), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        ),
      ),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const accepted = await queryClient.fetchQuery({
      queryKey: liveScheduleQueryKey,
      queryFn: () => fetchLiveSchedule(),
      staleTime: 0,
    });
    expect(accepted.updatedAt).toBe(current.updatedAt);

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 503 }))),
    );
    await expect(
      queryClient.fetchQuery({
        queryKey: liveScheduleQueryKey,
        queryFn: () => fetchLiveSchedule(accepted),
        staleTime: 0,
      }),
    ).rejects.toThrow("HTTP 503");

    expect(queryClient.getQueryData<LiveSchedule>(liveScheduleQueryKey)).toBe(
      accepted,
    );
    queryClient.clear();
  });
});
