import { describe, expect, it } from "vitest";

import { championship } from "../src/championship-data";
import {
  OFFICIAL_GAME_RECHECK_MS,
  scheduleFingerprint,
  shouldRefreshGame,
  shouldRefreshGameForSync,
  shouldRefreshPlayerForSync,
  shouldSkipPlayerRefresh,
} from "../src/sync";
import { tournament } from "../src/tournament-data";

describe("World Lacrosse incremental sync", () => {
  it("periodically rechecks official games for source corrections", () => {
    const scheduled = tournament.schedule.find(
      (game) => game.status === "OFFICIAL",
    );
    const current = championship.games.find(
      (game) => game.id === scheduled?.id,
    );
    expect(scheduled).toBeDefined();
    expect(current).toBeDefined();
    if (!scheduled || !current) return;

    const now = Date.now();
    const refreshedAt = new Date(now).toISOString();
    expect(
      shouldRefreshGame(
        scheduled,
        current,
        refreshedAt,
        scheduleFingerprint(scheduled),
        now,
      ),
    ).toBe(false);
    expect(
      shouldRefreshGame(
        scheduled,
        current,
        refreshedAt,
        scheduleFingerprint(scheduled),
        now + OFFICIAL_GAME_RECHECK_MS,
      ),
    ).toBe(true);
  });

  it("does not let an explicit false force flag suppress incremental refreshes", () => {
    const scheduled = tournament.schedule.find(
      (game) => game.status === "UPCOMING",
    );
    const current = championship.games.find(
      (game) => game.id === scheduled?.id,
    );
    expect(scheduled).toBeDefined();
    expect(current).toBeDefined();
    if (!scheduled || !current) return;

    expect(
      shouldRefreshGameForSync(
        false,
        scheduled,
        current,
        new Date().toISOString(),
        "outdated schedule fingerprint",
        Date.now(),
      ),
    ).toBe(true);
    expect(shouldRefreshPlayerForSync(false, false, false)).toBe(true);
    expect(shouldRefreshPlayerForSync(false, true, true)).toBe(true);
    expect(shouldRefreshPlayerForSync(false, true, false)).toBe(false);
    expect(shouldRefreshPlayerForSync(true, true, false)).toBe(true);
    expect(shouldSkipPlayerRefresh(true, false, true)).toBe(true);
    expect(shouldSkipPlayerRefresh(true, true, true)).toBe(false);
    expect(shouldSkipPlayerRefresh(true, false, false)).toBe(false);
  });

  it("refreshes upcoming games only when their schedule record changes", () => {
    const scheduled = tournament.schedule.find(
      (game) => game.status === "UPCOMING",
    );
    const current = championship.games.find(
      (game) => game.id === scheduled?.id,
    );
    expect(scheduled).toBeDefined();
    expect(current).toBeDefined();
    if (!scheduled || !current) return;

    expect(
      shouldRefreshGame(
        scheduled,
        current,
        new Date().toISOString(),
        scheduleFingerprint(scheduled),
        Date.now(),
      ),
    ).toBe(false);
    expect(
      shouldRefreshGame(
        scheduled,
        current,
        new Date().toISOString(),
        "outdated schedule fingerprint",
        Date.now(),
      ),
    ).toBe(true);
  });
});
