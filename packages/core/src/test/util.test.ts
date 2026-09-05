import { describe, expect, it } from "@effect/vitest";

import { ConstraintViolationError, DatabaseError } from "../error";
import { parseSqlError } from "../util";

describe("parseSqlError", () => {
  it("maps SQLite constraints and unknown database errors", () => {
    const constraint = parseSqlError({
      cause: {
        message:
          "D1_ERROR: UNIQUE constraint failed: user.email: SQLITE_CONSTRAINT",
      },
      message: "SqlError",
    });
    expect(constraint).toBeInstanceOf(ConstraintViolationError);
    if (constraint instanceof ConstraintViolationError) {
      expect(constraint.constraint).toBe("user.email");
      expect(constraint.detail).toContain("UNIQUE constraint failed");
    }

    const database = parseSqlError({ cause: {}, message: "SqlError" });
    expect(database).toBeInstanceOf(DatabaseError);
    expect(database.message).toBe("Unknown database error");
  });
});
