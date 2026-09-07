import { ApiClient } from "@laxdb/api/client";
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
  "API transport keeps cookies request-local (IS_LOCAL=%s)",
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

    const cookies = ["session=alice", "session=bob", undefined];
    // ponytail: serial binding mocks; use a Workers pool for concurrent binding tests.
    const results =
      isLocal === "true"
        ? await Promise.all(cookies.map((cookie) => runApi(cookie, getMe)))
        : await Array.fromAsync(cookies, (cookie) => runApi(cookie, getMe));
    expect(results.map((result) => result.userId)).toEqual([
      "session=alice",
      "session=bob",
      "anonymous",
    ]);
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
  await expect(runApi(undefined, getMe)).rejects.toMatchObject({
    reason: {
      cause: {
        message: "Cloudflare workers module is missing the API binding",
      },
    },
  });
  expect(network).not.toHaveBeenCalled();
});

test("routing forwards only the paths each app enables", async () => {
  vi.stubEnv("API_PORT", "15437");
  const { apiRoutes, apiProxy } = await import("../src/routing");
  const paths = ["/api/auth/", "/api/report-images/"];
  expect(apiRoutes("malvern.preview.dev.laxdb.io", paths)).toEqual([
    { pattern: "malvern.preview.dev.laxdb.io/api/auth/*" },
    { pattern: "malvern.preview.dev.laxdb.io/api/report-images/*" },
  ]);
  expect(apiProxy(paths)).toEqual({
    "/api/auth/": { target: "http://localhost:15437" },
    "/api/report-images/": { target: "http://localhost:15437" },
  });
  expect(apiRoutes("planner.laxdb.io", [])).toEqual([]);
  expect(apiProxy([])).toEqual({});
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
  expect(
    await runApi(
      undefined,
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
    undefined,
    Effect.succeed(new Result({ name: "Practice" })),
  );
  expect(result).toEqual({ name: "Practice" });
  expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
});
