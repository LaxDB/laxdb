import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "@effect/vitest";
import { Effect, Schema } from "effect";

import { ParseError } from "../error";
import { expectErrorInstance, getFailureError } from "../test-helpers";

import { GraphQLError, makeGraphQLClient } from "./graphql.service";

const TestDataSchema = Schema.Struct({
  user: Schema.Struct({
    id: Schema.Number,
    name: Schema.String,
  }),
});

const mockFetch = vi.fn<typeof fetch>();

describe("makeGraphQLClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const createClient = (overrides?: {
    authHeader?: string;
    maxRetries?: number;
    retryDelayMs?: number;
    timeoutMs?: number;
  }) =>
    makeGraphQLClient({
      endpoint: "https://api.example.com/graphql",
      authHeader: overrides?.authHeader,
      maxRetries: overrides?.maxRetries,
      retryDelayMs: overrides?.retryDelayMs,
      timeoutMs: overrides?.timeoutMs,
    });

  const TEST_QUERY = `query GetUser($id: ID!) { user(id: $id) { id name } }`;

  describe("successful requests", () => {
    it("executes query with schema validation", async () => {
      const responseData = { data: { user: { id: 1, name: "Test User" } } };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(responseData), { status: 200 }),
      );

      const client = createClient();
      const result = await Effect.runPromise(
        client.query(TEST_QUERY, TestDataSchema, { id: "1" }),
      );

      expect(result).toEqual({ user: { id: 1, name: "Test User" } });
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/graphql",
        expect.objectContaining({
          method: "POST",
          // oxlint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Vitest asymmetric matcher for request headers
          headers: expect.objectContaining({
            "content-type": "application/json",
          }),
          body: JSON.stringify({
            query: TEST_QUERY,
            variables: { id: "1" },
            operationName: undefined,
          }),
        }),
      );
    });

    it("includes configured auth and operation name", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { user: { id: 1, name: "Test" } } }),
          { status: 200 },
        ),
      );

      const client = createClient({ authHeader: "Bearer token123" });
      await Effect.runPromise(
        client.query(TEST_QUERY, TestDataSchema, { id: "1" }, "GetUser"),
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          // oxlint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Vitest asymmetric matcher for auth headers
          headers: expect.objectContaining({
            authorization: "Bearer token123",
          }),
          // oxlint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Vitest asymmetric matcher for serialized request body
          body: expect.stringContaining('"operationName":"GetUser"'),
        }),
      );
    });
  });

  describe("error handling", () => {
    it("maps invalid schemas and GraphQL failure responses", async () => {
      const client = createClient();
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { wrong: "shape" } }), {
          status: 200,
        }),
      );
      const parseResult = await Effect.runPromiseExit(
        client.query(TEST_QUERY, TestDataSchema, { id: "1" }),
      );
      const parseError = expectErrorInstance(
        getFailureError(parseResult),
        ParseError,
      );
      expect(parseError.message).toContain("Schema validation failed");

      const responseWithErrors = {
        data: null,
        errors: [
          { message: "User not found", path: ["user"] },
          { message: "Access denied", path: ["user", "email"] },
        ],
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(responseWithErrors), { status: 200 }),
      );
      const errorsResult = await Effect.runPromiseExit(
        client.query(TEST_QUERY, TestDataSchema, { id: "999" }),
      );
      const errors = expectErrorInstance(
        getFailureError(errorsResult),
        GraphQLError,
      );
      expect(errors.message).toContain("User not found");
      expect(errors.message).toContain("Access denied");
      expect(errors.errors).toHaveLength(2);
      expect(errors.errors[0]?.path).toEqual(["user"]);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: null }), { status: 200 }),
      );
      const nullResult = await Effect.runPromiseExit(
        client.query(TEST_QUERY, TestDataSchema, { id: "1" }),
      );
      const nullError = expectErrorInstance(
        getFailureError(nullResult),
        GraphQLError,
      );
      expect(nullError.message).toContain("null data");
      expect(nullError.errors).toHaveLength(0);
    });
  });

  describe("retry behavior", () => {
    it("retries when rate limit clears", async () => {
      mockFetch
        .mockResolvedValueOnce(
          new Response("Too Many Requests", { status: 429 }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ data: { user: { id: 1, name: "Success" } } }),
            {
              status: 200,
            },
          ),
        );

      const client = createClient({ retryDelayMs: 10 });
      const result = await Effect.runPromise(
        client.query(TEST_QUERY, TestDataSchema, { id: "1" }),
      );

      expect(result).toEqual({ user: { id: 1, name: "Success" } });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
