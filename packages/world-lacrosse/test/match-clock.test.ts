import { describe, expect, it } from "vitest";

import {
  buildMatchPeriodWindows,
  formatMatchClock,
  matchElapsedSeconds,
  matchPeriodDuration,
  parseMatchClock,
} from "../src/lib/match-clock";

describe("match clock", () => {
  it("uses official women's field period durations", () => {
    expect(matchPeriodDuration("Quarter 1")).toBe(900);
    expect(matchPeriodDuration("Quarter 4")).toBe(900);
    expect(matchPeriodDuration("OT1")).toBe(240);
    expect(matchPeriodDuration("Overtime 2")).toBe(240);
    expect(matchPeriodDuration("Extra period")).toBeNull();
  });

  it("parses and formats countdown clocks without guessing", () => {
    expect(parseMatchClock("15:00")).toBe(900);
    expect(parseMatchClock("4:00")).toBe(240);
    expect(parseMatchClock("3:52")).toBe(232);
    expect(parseMatchClock("2:60")).toBeNull();
    expect(parseMatchClock("bad")).toBeNull();
    expect(formatMatchClock(232)).toBe("3:52");
  });

  it("rejects missing, duplicated, or out-of-order period coverage", () => {
    expect(buildMatchPeriodWindows(["Quarter 1", "Quarter 3"])).toBeNull();
    expect(
      buildMatchPeriodWindows(["Quarter 1", "Quarter 2", "Quarter 2"]),
    ).toBeNull();
    expect(buildMatchPeriodWindows(["Quarter 2"])).toBeNull();
    expect(
      buildMatchPeriodWindows([
        "Quarter 1",
        "Quarter 2",
        "Quarter 3",
        "Quarter 4",
        "OT1",
        "OT2",
      ]),
    ).not.toBeNull();
  });

  it("converts valid period clocks to elapsed game-clock seconds", () => {
    const windows = buildMatchPeriodWindows([
      "Quarter 1",
      "Quarter 2",
      "Quarter 3",
      "Quarter 4",
      "OT1",
    ]);
    expect(windows).not.toBeNull();
    if (!windows) return;

    expect(matchElapsedSeconds(windows, "Quarter 1", "15:00")).toBe(0);
    expect(matchElapsedSeconds(windows, "Quarter 2", "15:00")).toBe(900);
    expect(matchElapsedSeconds(windows, "Quarter 4", "0:00")).toBe(3600);
    expect(matchElapsedSeconds(windows, "OT1", "3:52")).toBe(3608);
    expect(matchElapsedSeconds(windows, "OT1", "2:10")).toBe(3710);
    expect(matchElapsedSeconds(windows, "OT1", "4:01")).toBeNull();
  });
});
