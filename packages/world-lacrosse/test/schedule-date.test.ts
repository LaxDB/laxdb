import { describe, expect, it } from "vitest";

import { scheduleDateLabel } from "../src/schedule-date";

describe("schedule date", () => {
  it("uses the viewer's timezone at a UTC date boundary", () => {
    const instant = new Date("2026-07-27T14:30:00Z");

    expect(scheduleDateLabel(instant, "Australia/Melbourne")).toBe(
      "Tuesday, July 28",
    );
    expect(scheduleDateLabel(instant, "America/Los_Angeles")).toBe(
      "Monday, July 27",
    );
  });
});
