import { BunServices } from "@effect/platform-bun";
import { describe, expect, it } from "@effect/vitest";
import { Effect, type Scope } from "effect";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";

import {
  buildReport,
  crossReference,
  validateFileExists,
  validateJsonArray,
  validateRequiredFields,
  validateUniqueField,
} from "./validate.service";

const runScoped = <A, E>(effect: Effect.Effect<A, E, Scope.Scope>) =>
  Effect.runPromise(Effect.scoped(effect));

describe("validateJsonArray", () => {
  it("validates arrays and reports invalid or missing JSON data", async () => {
    const { valid, objectResult, smallResult, existence, missing } =
      await runScoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem;
          const path = yield* Path;
          const tempBase = yield* fs.makeTempDirectoryScoped();
          const tempDir = path.join(tempBase, "validate-test");
          yield* fs.makeDirectory(tempDir, { recursive: true });

          const validPath = path.join(tempDir, "valid.json");
          yield* fs.writeFileString(
            validPath,
            JSON.stringify([{ id: 1 }, { id: 2 }]),
          );
          const valid = yield* validateJsonArray<{ id: number }>(validPath);

          const objectPath = path.join(tempDir, "object.json");
          yield* fs.writeFileString(
            objectPath,
            JSON.stringify({ key: "value" }),
          );
          const objectValidation = yield* validateJsonArray(objectPath);

          const smallPath = path.join(tempDir, "small.json");
          yield* fs.writeFileString(smallPath, JSON.stringify([{ id: 1 }]));
          const smallValidation = yield* validateJsonArray(smallPath, 10);

          const missingPath = path.join(tempDir, "missing.json");
          const existence = yield* validateFileExists(missingPath);
          const missing = yield* validateJsonArray(missingPath);
          return {
            valid,
            objectResult: objectValidation.result,
            smallResult: smallValidation.result,
            existence,
            missing,
          };
        }).pipe(Effect.provide(BunServices.layer)),
      );

    expect(valid.result.recordCount).toBe(2);
    expect(valid.data).toHaveLength(2);
    expect(valid.result.checks.every((check) => check.passed)).toBe(true);

    const objectCheck = objectResult.checks.find(
      (check) => check.checkName === "json_parse",
    );
    expect(objectCheck?.passed).toBe(false);
    expect(objectCheck?.issues[0]?.code).toBe("NOT_ARRAY");

    const smallCheck = smallResult.checks.find(
      (check) => check.checkName === "json_parse",
    );
    expect(smallCheck?.passed).toBe(false);
    expect(smallCheck?.issues[0]?.code).toBe("INSUFFICIENT_RECORDS");

    expect(existence.exists).toBe(false);
    expect(existence.checks[0]?.passed).toBe(false);
    expect(existence.checks[0]?.issues[0]?.code).toBe("FILE_NOT_FOUND");
    expect(missing.result.exists).toBe(false);
    expect(missing.data).toHaveLength(0);
  });
});

describe("validateRequiredFields", () => {
  it("classifies all, most, and few missing values", async () => {
    const allData = [
      { id: "1", name: null },
      { id: "2", name: null },
    ];
    const allResult = await Effect.runPromise(
      validateRequiredFields(allData, ["id", "name"]),
    );
    expect(allResult.passed).toBe(false);
    expect(allResult.issues[0]?.code).toBe("FIELD_ALL_MISSING");

    const mostData = [
      { id: "1", name: "Alice" },
      { id: "2", name: null },
      { id: "3", name: null },
      { id: "4", name: null },
    ];
    const mostResult = await Effect.runPromise(
      validateRequiredFields(mostData, ["id", "name"]),
    );
    expect(mostResult.passed).toBe(true);
    const warning = mostResult.issues.find((issue) =>
      issue.message.includes("name"),
    );
    expect(warning?.severity).toBe("warning");
    expect(warning?.code).toBe("FIELD_MOSTLY_MISSING");

    const fewData = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
      { id: "3", name: "Carol" },
      { id: "4", name: null },
    ];
    const fewResult = await Effect.runPromise(
      validateRequiredFields(fewData, ["id", "name"]),
    );
    expect(fewResult.passed).toBe(true);
    const info = fewResult.issues.find((issue) =>
      issue.message.includes("name"),
    );
    expect(info?.severity).toBe("info");
    expect(info?.code).toBe("FIELD_SOME_MISSING");
  });
});

describe("validateUniqueField", () => {
  it("rejects duplicates and ignores null values", async () => {
    const duplicates = [
      { id: "1", name: "Alice" },
      { id: "1", name: "Bob" },
      { id: "2", name: "Carol" },
    ];
    const duplicateResult = await Effect.runPromise(
      validateUniqueField(duplicates, "id"),
    );
    expect(duplicateResult.passed).toBe(false);
    expect(duplicateResult.issues[0]?.code).toBe("DUPLICATE_VALUES");

    const nullable = [
      { id: null, name: "Alice" },
      { id: null, name: "Bob" },
      { id: "1", name: "Carol" },
    ];
    const nullableResult = await Effect.runPromise(
      validateUniqueField(nullable, "id"),
    );
    expect(nullableResult.passed).toBe(true);
  });
});

describe("crossReference", () => {
  it("reports missing and null source references", async () => {
    const source = [
      { foreignKey: "A" },
      { foreignKey: "B" },
      { foreignKey: "X" },
    ];
    const target = [{ id: "A" }, { id: "B" }];
    const result = await Effect.runPromise(
      crossReference(
        source,
        target,
        "foreignKey",
        "id",
        "source.json",
        "target.json",
      ),
    );
    expect(result.totalSourceRecords).toBe(3);
    expect(result.matchedRecords).toBe(2);
    expect(result.unmatchedRecords).toBe(1);
    expect(result.unmatchedSamples).toContain("X");

    const nullableResult = await Effect.runPromise(
      crossReference(
        [{ foreignKey: "A" }, { foreignKey: null }],
        [{ id: "A" }],
        "foreignKey",
        "id",
        "source.json",
        "target.json",
      ),
    );
    expect(nullableResult.matchedRecords).toBe(1);
    expect(nullableResult.unmatchedRecords).toBe(1);
  });
});

describe("buildReport", () => {
  it("summarizes invalid and warning-only reports", () => {
    const bad = [
      {
        filePath: "/test/file1.json",
        exists: true,
        sizeBytes: 1000,
        recordCount: 10,
        checks: [
          { checkName: "check1", passed: true, issues: [], durationMs: 5 },
          {
            checkName: "check2",
            passed: false,
            issues: [
              { severity: "error" as const, code: "ERR", message: "Error" },
            ],
            durationMs: 3,
          },
        ],
      },
    ];

    const badReport = buildReport("TestSource", bad, [], Date.now() - 100);

    expect(badReport.source).toBe("TestSource");
    expect(badReport.summary.totalChecks).toBe(2);
    expect(badReport.summary.passedChecks).toBe(1);
    expect(badReport.summary.failedChecks).toBe(1);
    expect(badReport.summary.errorCount).toBe(1);
    expect(badReport.overallValid).toBe(false);

    const good = [
      {
        filePath: "/test/file1.json",
        exists: true,
        sizeBytes: 1000,
        recordCount: 10,
        checks: [
          { checkName: "check1", passed: true, issues: [], durationMs: 5 },
          {
            checkName: "check2",
            passed: true,
            issues: [
              {
                severity: "warning" as const,
                code: "WARN",
                message: "Warning",
              },
            ],
            durationMs: 3,
          },
        ],
      },
    ];

    const goodReport = buildReport("TestSource", good, [], Date.now());

    expect(goodReport.overallValid).toBe(true);
    expect(goodReport.summary.warningCount).toBe(1);
    expect(goodReport.summary.errorCount).toBe(0);
  });
});
