import { describe, expect, it } from "vitest";

import {
  activeGameStatusWithClock,
  latestLiveGameClock,
} from "../src/lib/live-game-clock";
import { Play } from "../src/lib/schema";

const play = (period: string, time: string, action = "Turnover") =>
  Play.make({
    period,
    home: "",
    time,
    result: "",
    action,
    away: "",
    participants: [],
  });

const game = (status: string, plays: readonly Play[]) => ({ status, plays });

describe("live game clock", () => {
  it("uses the latest feed event as the current live clock", () => {
    const details = game("LIVE", [
      play("Quarter 3", "15:00", "START Period"),
      play("Quarter 3", "8:01", "Yellow Card (2 min) [DP]"),
    ]);

    expect(latestLiveGameClock(details)).toEqual({
      period: "Q3",
      clock: "8:01",
    });
    expect(activeGameStatusWithClock("LIVE", "Q3", details)).toBe(
      "Q3 · 8:01 · Live",
    );
  });

  it("preserves break state while showing the last period clock", () => {
    const details = game("BREAK", [play("Quarter 2", "0:00", "END Period")]);

    expect(activeGameStatusWithClock("BREAK", "Q2", details)).toBe(
      "Q2 · 0:00 · Break",
    );
  });

  it("supports overtime countdown clocks", () => {
    const details = game("RUNNING", [play("OT1", "2:10", "Goal")]);

    expect(activeGameStatusWithClock("RUNNING", "OT1", details)).toBe(
      "OT1 · 2:10 · Live",
    );
  });

  it("falls back instead of presenting uncorroborated event evidence", () => {
    const malformed = game("LIVE", [
      play("Quarter 3", "8:01"),
      play("Quarter 3", "18:01"),
    ]);
    const validEvent = game("LIVE", [play("Quarter 3", "8:01")]);

    expect(latestLiveGameClock(malformed)).toBeNull();
    expect(activeGameStatusWithClock("LIVE", "Q3", malformed)).toBe(
      "Q3 · Live",
    );
    expect(activeGameStatusWithClock("LIVE", "Q2", validEvent)).toBe(
      "Q2 · Live",
    );
    expect(activeGameStatusWithClock("LIVE", null, validEvent)).toBe("Live");
  });

  it("does not infer clocks before the game starts or after it finishes", () => {
    const gettingReady = game("GETTING READY", []);
    const finished = game("OFFICIAL", [play("Quarter 4", "0:00", "END Game")]);

    expect(latestLiveGameClock(gettingReady)).toBeNull();
    expect(latestLiveGameClock(finished)).toBeNull();
    expect(activeGameStatusWithClock("GETTING READY", null, gettingReady)).toBe(
      "Getting ready",
    );
  });
});
