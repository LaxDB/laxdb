import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "@effect/vitest";
import { Effect, Schema } from "effect";

import { HttpError, NetworkError, ParseError, RateLimitError } from "../error";
import { expectErrorInstance, getFailureError } from "../test-helpers";

import { makeRestClient } from "./rest-client.service";

const TestResponse = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
});

const mockFetch = vi.fn<typeof fetch>();

describe("makeRestClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const createClient = (overrides?: { authHeader?: string }) =>
    makeRestClient({
      baseUrl: "https://api.example.com",
      authHeader: overrides?.authHeader,
    });

  describe("successful requests", () => {
    it("GET request with schema validation", async () => {
      const responseData = { id: 1, name: "Test" };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(responseData), { status: 200 }),
      );

      const client = createClient();
      const result = await Effect.runPromise(
        client.get("/users/1", TestResponse),
      );

      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/users/1",
        expect.objectContaining({
          method: "GET",
          // oxlint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Vitest asymmetric matcher for request headers
          headers: expect.objectContaining({
            "content-type": "application/json",
          }),
        }),
      );
    });

    it("POST request with body and configured auth", async () => {
      const responseData = { id: 2, name: "Created" };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(responseData), { status: 201 }),
      );

      const client = createClient({ authHeader: "Bearer token123" });
      const result = await Effect.runPromise(
        client.post("/users", { name: "Created" }, TestResponse),
      );

      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/users",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "Created" }),
          // oxlint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Vitest asymmetric matcher for auth headers
          headers: expect.objectContaining({
            authorization: "Bearer token123",
          }),
        }),
      );
    });
  });

  describe("retry behavior", () => {
    it("retries network and rate-limit errors when they clear", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Network failed"))
        .mockRejectedValueOnce(new Error("Network failed again"))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: 1, name: "Success" }), {
            status: 200,
          }),
        );

      const client = makeRestClient({
        baseUrl: "https://api.example.com",
        retryDelayMs: 10,
      });
      const networkResult = await Effect.runPromise(
        client.get("/users/1", TestResponse),
      );
      expect(networkResult).toEqual({ id: 1, name: "Success" });
      expect(mockFetch).toHaveBeenCalledTimes(3);

      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce(
          new Response("Too Many Requests", { status: 429 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: 1, name: "Success" }), {
            status: 200,
          }),
        );
      const rateLimitResult = await Effect.runPromise(
        client.get("/users/1", TestResponse),
      );
      expect(rateLimitResult).toEqual({ id: 1, name: "Success" });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("does not retry HTTP, schema, or JSON parse errors", async () => {
      const client = createClient();
      mockFetch.mockResolvedValueOnce(
        new Response("Bad Request", { status: 400, statusText: "Bad Request" }),
      );
      const httpResult = await Effect.runPromiseExit(
        client.get("/users/1", TestResponse),
      );
      const httpError = expectErrorInstance(
        getFailureError(httpResult),
        HttpError,
      );
      expect(httpError.message).toContain("HTTP 400");
      expect(httpError.statusCode).toBe(400);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ wrong: "shape" }), { status: 200 }),
      );
      const schemaResult = await Effect.runPromiseExit(
        client.get("/users/1", TestResponse),
      );
      const schemaError = expectErrorInstance(
        getFailureError(schemaResult),
        ParseError,
      );
      expect(schemaError.message).toContain("Schema validation failed");
      expect(mockFetch).toHaveBeenCalledTimes(2);

      mockFetch.mockResolvedValueOnce(
        new Response("not json", { status: 200 }),
      );
      const jsonResult = await Effect.runPromiseExit(
        client.get("/users/1", TestResponse),
      );
      const jsonError = expectErrorInstance(
        getFailureError(jsonResult),
        HttpError,
      );
      expect(jsonError.message).toContain("Failed to parse JSON");
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("config overrides", () => {
    it("respects maxRetries of 0 (no retries)", async () => {
      mockFetch.mockRejectedValue(new Error("Network failed"));

      const client = makeRestClient({
        baseUrl: "https://api.example.com",
        maxRetries: 0,
      });

      const result = await Effect.runPromiseExit(
        client.get("/users/1", TestResponse),
      );

      const error = expectErrorInstance(getFailureError(result), NetworkError);
      expect(error.message).toContain("Network error");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("retries with backoff on persistent rate limit", async () => {
      mockFetch.mockResolvedValue(
        new Response("Too Many Requests", {
          status: 429,
          headers: { "retry-after": "60" },
        }),
      );

      const client = makeRestClient({
        baseUrl: "https://api.example.com",
        maxRetries: 2,
        retryDelayMs: 10,
      });

      const result = await Effect.runPromiseExit(
        client.get("/users/1", TestResponse),
      );

      const error = expectErrorInstance(
        getFailureError(result),
        RateLimitError,
      );
      expect(error.retryAfterMs).toBe(60000);
      // 1 initial + 1 after sleep + 2 retries = 4 calls
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });
});
