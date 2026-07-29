import { describe, expect, it } from "vitest";

import {
  activeGameStatusLabel,
  finalGameStatusLabel,
  isActiveGameStatus,
  isCompletedGame,
  isFinalGameStatus,
  isInProgressGameStatus,
  isUpcomingGameStatus,
} from "../src/game-status";

describe("game status", () => {
  it("treats live and break statuses as active", () => {
    expect(isActiveGameStatus("LIVE")).toBe(true);
    expect(isActiveGameStatus("RUNNING")).toBe(true);
    expect(isActiveGameStatus("BREAK")).toBe(true);
    expect(isActiveGameStatus("GETTING READY")).toBe(true);
  });

  it("distinguishes in-progress play from pregame activity", () => {
    expect(isInProgressGameStatus("LIVE")).toBe(true);
    expect(isInProgressGameStatus("RUNNING")).toBe(true);
    expect(isInProgressGameStatus("BREAK")).toBe(true);
    expect(isInProgressGameStatus("GETTING READY")).toBe(false);
  });

  it("does not poll upcoming or final games as active", () => {
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

  it("keeps unofficial finals visibly provisional", () => {
    expect(finalGameStatusLabel("UNOFFICIAL")).toBe("Unofficial final");
    expect(finalGameStatusLabel("OFFICIAL")).toBe("Final");
  });

  it("formats active period labels", () => {
    expect(activeGameStatusLabel("LIVE", "Q3")).toBe("Q3 · Live");
    expect(activeGameStatusLabel("BREAK", "Q2")).toBe("Q2 · Break");
    expect(activeGameStatusLabel("GETTING READY", null)).toBe("Getting ready");
    expect(activeGameStatusLabel("RUNNING", null)).toBe("Live");
    expect(activeGameStatusLabel("LIVE", null)).toBe("Live");
  });
});
