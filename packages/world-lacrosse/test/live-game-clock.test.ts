import { describe, expect, it } from "vitest";

import { latestLiveGameClock } from "../src/lib/live-game-clock";
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
  it("uses only corroborated clock evidence from live games", () => {
    const details = game("LIVE", [
      play("Quarter 3", "15:00", "START Period"),
      play("Quarter 3", "8:01", "Yellow Card (2 min) [DP]"),
    ]);

    expect(latestLiveGameClock(details)).toEqual({
      period: "Q3",
      clock: "8:01",
    });

    const malformed = game("LIVE", [
      play("Quarter 3", "8:01"),
      play("Quarter 3", "18:01"),
    ]);

    expect(latestLiveGameClock(malformed)).toBeNull();

    const finished = game("OFFICIAL", [play("Quarter 4", "0:00", "END Game")]);

    expect(latestLiveGameClock(finished)).toBeNull();
  });
});
