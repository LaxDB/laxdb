import { describe, expect, it } from "vitest";

import { parseFollowedTeamIds } from "../src/lib/followed-teams";

describe("followed teams", () => {
  it("parses unique team IDs", () => {
    expect(parseFollowedTeamIds('["21","25","21"]')).toEqual(["21", "25"]);
  });

  it("fails closed for malformed storage values", () => {
    expect(parseFollowedTeamIds("not-json")).toEqual([]);
    expect(parseFollowedTeamIds('{"team":"21"}')).toEqual([]);
    expect(parseFollowedTeamIds('["21",42]')).toEqual(["21"]);
  });
});
