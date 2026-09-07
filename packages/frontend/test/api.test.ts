import { ApiClient } from "@laxdb/api/client";
import { requestHandler } from "@tanstack/react-start/server";
import { Effect, Schema } from "effect";
import { afterEach, expect, test, vi } from "vitest";

const getMe = Effect.gen(function* () {
  const client = yield* ApiClient;
  return yield* client.Auth.me({ payload: {} });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.doUnmock("cloudflare:workers");
  vi.resetModules();
});

test.each(["true", "false"])(
  "API transport reuses its client and keeps cookies request-local (IS_LOCAL=%s)",
  async (isLocal) => {
    vi.stubEnv("IS_LOCAL", isLocal);
    vi.stubEnv("API_PORT", "15437");
    const requests: Request[] = [];
    const receive = (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(request.clone());
      return Promise.resolve(
        Response.json({
          userId: request.headers.get("cookie") ?? "anonymous",
          userName: "Test User",
          userEmail: "test@example.com",
          activeOrganizationId: null,
          activeMemberId: null,
          memberRole: null,
        }),
      );
    };
    const network = vi.spyOn(globalThis, "fetch").mockImplementation(receive);
    const binding = { fetch: vi.fn(receive) };
    vi.doMock("cloudflare:workers", () => ({ env: { API: binding } }));
    const { runApi } = await import("../src/api");

    const clients = new Set<typeof ApiClient.Service>();
    const lookup = Effect.gen(function* () {
      clients.add(yield* ApiClient);
      return yield* getMe;
    });
    const handler = requestHandler(async () => {
      await Promise.resolve();
      return Response.json(await runApi(lookup));
    });
    const incoming = ["session=alice", "session=bob", undefined].map(
      (cookie) =>
        new Request("http://app.test/", {
          headers: cookie === undefined ? {} : { cookie },
        }),
    );
    // ponytail: serial binding mocks; use a Workers pool for concurrent binding tests.
    const responses =
      isLocal === "true"
        ? await Promise.all(
            incoming.map((request) => Promise.resolve(handler(request, {}))),
          )
        : await Array.fromAsync(incoming, (request) => handler(request, {}));
    const results: unknown[] = await Promise.all(
      responses.map((response) => response.json()),
    );
    expect(results).toMatchObject([
      { userId: "session=alice" },
      { userId: "session=bob" },
      { userId: "anonymous" },
    ]);
    expect(clients.size).toBe(1);
    expect(requests).toHaveLength(3);
    for (const request of requests) {
      expect(request.url).toBe(
        `${isLocal === "true" ? "http://localhost:15437" : "http://api"}/api/me`,
      );
      expect(request.method).toBe("POST");
      expect(await request.json()).toEqual({});
    }
    expect(network).toHaveBeenCalledTimes(isLocal === "true" ? 3 : 0);
    expect(binding.fetch).toHaveBeenCalledTimes(isLocal === "true" ? 0 : 3);
  },
);

test("missing service bindings fail without falling back to public HTTP", async () => {
  vi.stubEnv("IS_LOCAL", "false");
  vi.doMock("cloudflare:workers", () => ({ env: {} }));
  const network = vi.spyOn(globalThis, "fetch");
  const { runApi } = await import("../src/api");
  const handler = requestHandler(async () => {
    await expect(runApi(getMe)).rejects.toMatchObject({
      reason: {
        cause: {
          message: "Cloudflare workers module is missing the API binding",
        },
      },
    });
    return new Response();
  });
  expect((await handler(new Request("http://app.test/"), {})).status).toBe(200);
  expect(network).not.toHaveBeenCalled();
});

test("runApi requires a server request instead of silently dropping its cookie", async () => {
  const { runApi } = await import("../src/api");
  await expect(runApi(getMe)).rejects.toThrow("No StartEvent found");
});

test("runApi preserves typed API errors and returns plain data for TanStack", async () => {
  vi.stubEnv("IS_LOCAL", "true");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json(
      {
        _tag: "AuthenticationError",
        message: "Sign in required",
      },
      { status: 401 },
    ),
  );
  const { runApi } = await import("../src/api");
  const handler = requestHandler(async () => {
    expect(
      await runApi(
        getMe.pipe(
          Effect.catchTag("AuthenticationError", (error) =>
            Effect.succeed(error.message),
          ),
        ),
      ),
    ).toBe("Sign in required");

    class Result extends Schema.Class<Result>("Result")({
      name: Schema.String,
    }) {}
    const result = await runApi(
      Effect.succeed(new Result({ name: "Practice" })),
    );
    expect(result).toEqual({ name: "Practice" });
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    return new Response();
  });
  expect((await handler(new Request("http://app.test/"), {})).status).toBe(200);
});
