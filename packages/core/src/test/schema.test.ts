import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import { DateFromString, EmailSchema, NanoidSchema } from "../schema";

describe("core schemas", () => {
  it("accepts valid nanoids and rejects invalid variants", () => {
    const decode = Schema.decodeUnknownSync(NanoidSchema);
    expect(decode("Ab_d-fGhIjKl")).toBe("Ab_d-fGhIjKl");
    for (const invalid of ["short", "AbCdEfGhIjKlX", "AbCdEf!hIjKl"]) {
      expect(() => decode(invalid)).toThrow();
    }
  });

  it("rejects emails without separators or domains", () => {
    for (const invalid of ["notanemail", "test@"]) {
      expect(() => Schema.decodeUnknownSync(EmailSchema)(invalid)).toThrow();
    }
  });

  it("transforms supported dates and rejects invalid inputs", () => {
    const decode = Schema.decodeUnknownSync(DateFromString);
    const encode = Schema.encodeUnknownSync(DateFromString);
    const fromString = decode("2026-03-12T23:03:56.780Z");
    expect(fromString).toBeInstanceOf(Date);
    expect(fromString.toISOString()).toBe("2026-03-12T23:03:56.780Z");
    expect(encode(fromString)).toBe("2026-03-12T23:03:56.780Z");

    const fromDatabase = decode(new Date("2026-03-12T23:03:56.780Z"));
    expect(fromDatabase).toBeInstanceOf(Date);
    expect(fromDatabase.toISOString()).toBe("2026-03-12T23:03:56.780Z");
    expect(() => decode(12345)).toThrow();
    expect(() => encode("not-a-date")).toThrow();
  });
});
