import { BunServices } from "@effect/platform-bun";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Layer } from "effect";
import { FileSystem } from "effect/FileSystem";
import { type PlatformError, systemError } from "effect/PlatformError";

import { GraphQLError } from "../api-client/graphql.service";
import {
  HttpError,
  NetworkError,
  ParseError,
  RateLimitError,
  TimeoutError,
} from "../error";
import { expectErrorInstance, getFailureError } from "../test-helpers";

import { isCriticalError, saveJson } from "./util";

describe("saveJson", () => {
  const createTestLayer = (overrides: {
    makeDirectory?: (
      path: string,
      options?: { recursive?: boolean },
    ) => Effect.Effect<void, PlatformError>;
    writeFileString?: (
      path: string,
      data: string,
    ) => Effect.Effect<void, PlatformError>;
  }) => {
    const baseMock = {
      makeDirectory: () => Effect.void,
      writeFileString: () => Effect.void,
    };

    const MockFS = Layer.succeed(
      FileSystem,
      // oxlint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test double only overrides the FileSystem methods used by saveJson
      {
        ...baseMock,
        ...overrides,
      } as unknown as FileSystem,
    );

    return Layer.provideMerge(MockFS, BunServices.layer);
  };

  it("creates directory and writes file successfully", async () => {
    let dirCreated = false;
    let writtenPath = "";
    let writtenContent = "";

    const TestLayer = createTestLayer({
      makeDirectory: () => {
        dirCreated = true;
        return Effect.void;
      },
      writeFileString: (path: string, content: string) => {
        writtenPath = path;
        writtenContent = content;
        return Effect.void;
      },
    });

    const result = await Effect.runPromiseExit(
      saveJson("/tmp/test/data.json", { foo: "bar" }).pipe(
        Effect.provide(TestLayer),
      ),
    );

    expect(Exit.isSuccess(result)).toBe(true);
    expect(dirCreated).toBe(true);
    expect(writtenPath).toBe("/tmp/test/data.json");
    expect(JSON.parse(writtenContent)).toEqual({ foo: "bar" });
  });

  it("fails with descriptive error when write fails", async () => {
    const TestLayer = createTestLayer({
      writeFileString: () =>
        Effect.fail(
          systemError({
            _tag: "InvalidData",
            module: "FileSystem",
            method: "writeFileString",
            description: "Disk full",
            pathOrDescriptor: "/tmp/test.json",
          }),
        ),
    });

    const result = await Effect.runPromiseExit(
      saveJson("/tmp/test.json", { foo: "bar" }).pipe(
        Effect.provide(TestLayer),
      ),
    );

    const error = expectErrorInstance(getFailureError(result), Error);
    expect(error.message).toContain("Failed to write");
  });
});

describe("isCriticalError", () => {
  it("classifies transport, HTTP, parse, and GraphQL errors", () => {
    const errors = [
      new NetworkError({
        message: "DNS resolution failed",
        url: "http://example.com",
      }),
      new TimeoutError({
        message: "Request timed out",
        url: "http://example.com",
        timeoutMs: 5000,
      }),
      new RateLimitError({
        message: "Rate limit exceeded",
        url: "http://example.com",
        retryAfterMs: 60000,
      }),
      new HttpError({
        message: "Internal Server Error",
        url: "http://example.com",
        statusCode: 500,
      }),
      new HttpError({
        message: "Bad Request",
        url: "http://example.com",
        statusCode: 400,
      }),
      new HttpError({
        message: "Unknown error",
        url: "http://example.com",
      }),
      new ParseError({
        message: "Schema validation failed",
        url: "http://example.com",
      }),
      new GraphQLError({
        message: "GraphQL query failed",
        errors: [{ message: "Field 'name' not found" }],
      }),
    ];

    expect(errors.map(isCriticalError)).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });
});
