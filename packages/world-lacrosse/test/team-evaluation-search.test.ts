import { describe, expect, it } from "vitest";

import {
  encodeEvaluationGameIds,
  parseEvaluationGameIds,
  parseTeamEvaluationSearch,
} from "../src/lib/team-evaluation-search";

describe("team evaluation search", () => {
  it("canonicalizes valid IDs, preserves unknowns, and distinguishes malformed from none", () => {
    expect(parseEvaluationGameIds("76,69,76, bad id,unknown,84")).toEqual([
      "76",
      "69",
      "unknown",
      "84",
    ]);
    expect(parseEvaluationGameIds("bad id,also bad")).toBeUndefined();
    expect(parseEvaluationGameIds("none")).toEqual([]);
    expect(parseEvaluationGameIds()).toBeUndefined();
    expect(parseEvaluationGameIds(110)).toEqual(["110"]);
    expect(encodeEvaluationGameIds([])).toBe("none");
    expect(
      parseTeamEvaluationSearch({
        a: "76,76, bad id,unknown",
        b: "none",
      }),
    ).toEqual({ a: "76,unknown", b: "none" });
    expect(parseTeamEvaluationSearch({ a: "bad id" })).toEqual({});
    expect(parseTeamEvaluationSearch({ a: 110, player: 1441 })).toEqual({
      a: "110",
      player: "1441",
    });
  });

  it("keeps closed metric and segment values only", () => {
    expect(
      parseTeamEvaluationSearch({
        a: "76,69",
        b: "84",
        player: "1146",
        metric: "points",
        segment: "quarter-4",
      }),
    ).toEqual({
      a: "76,69",
      b: "84",
      player: "1146",
      metric: "points",
      segment: "quarter-4",
    });
    expect(
      parseTeamEvaluationSearch({ metric: "grade", segment: "venue" }),
    ).toEqual({});
    expect(
      parseTeamEvaluationSearch({ metric: "shots", segment: "overtime" }),
    ).toEqual({ metric: "shots" });
    expect(
      parseTeamEvaluationSearch({ metric: "points", segment: "overtime" }),
    ).toEqual({ metric: "points", segment: "overtime" });
  });
});
