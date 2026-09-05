import { describe, expect, it } from "vitest";

import {
  isActiveGameStatus,
  isCompletedGame,
  isFinalGameStatus,
  isInProgressGameStatus,
  isUpcomingGameStatus,
} from "../src/lib/game-status";

describe("game status", () => {
  it("classifies active, in-progress, upcoming, and final statuses", () => {
    expect(isActiveGameStatus("LIVE")).toBe(true);
    expect(isActiveGameStatus("RUNNING")).toBe(true);
    expect(isActiveGameStatus("BREAK")).toBe(true);
    expect(isActiveGameStatus("GETTING READY")).toBe(true);

    expect(isInProgressGameStatus("LIVE")).toBe(true);
    expect(isInProgressGameStatus("RUNNING")).toBe(true);
    expect(isInProgressGameStatus("BREAK")).toBe(true);
    expect(isInProgressGameStatus("GETTING READY")).toBe(false);

    expect(isUpcomingGameStatus("SCHEDULED")).toBe(true);
    expect(isFinalGameStatus("UNOFFICIAL")).toBe(true);
    expect(isActiveGameStatus("UPCOMING")).toBe(false);
    expect(isActiveGameStatus("OFFICIAL")).toBe(false);
    expect(isActiveGameStatus("UNOFFICIAL")).toBe(false);
    expect(isActiveGameStatus("POSTPONED")).toBe(false);
    expect(isActiveGameStatus("unknown-status")).toBe(false);
  });

  it("requires a decisive score before treating a final status as completed", () => {
    const game = (home: number | null, away: number | null) => ({
      status: "OFFICIAL",
      home: { score: home },
      away: { score: away },
    });
    expect(isCompletedGame(game(10, 8))).toBe(true);
    expect(isCompletedGame(game(null, null))).toBe(false);
    expect(isCompletedGame(game(5, 5))).toBe(false);
  });
});
