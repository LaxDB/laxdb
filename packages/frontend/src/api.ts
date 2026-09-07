/** Server-only API calls for TanStack Start apps. Cookies stay request-local. */
// oxlint-disable-next-line import/no-unassigned-import -- TanStack's marker prevents client imports.
import "@tanstack/react-start/server-only";

import { makeApiClientLayer, type ApiClient } from "@laxdb/api/client";
import { getRequestHeader } from "@tanstack/react-start/server";
import { Effect, Layer, ManagedRuntime } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { localApiUrl } from "./routing";

type ApiServiceBinding = {
  readonly fetch: (request: Request) => Promise<Response>;
};

type CloudflareWorkersModule = {
  readonly env: { readonly API: ApiServiceBinding };
};

const isCloudflareWorkersModule = (
  value: unknown,
): value is CloudflareWorkersModule => {
  if (typeof value !== "object" || value === null || !("env" in value)) {
    return false;
  }
  const env = value.env;
  return (
    typeof env === "object" &&
    env !== null &&
    "API" in env &&
    typeof env.API === "object" &&
    env.API !== null &&
    "fetch" in env.API &&
    typeof env.API.fetch === "function"
  );
};

const isLocal = process.env.IS_LOCAL === "true";
const apiUrl = isLocal ? localApiUrl : "http://api";

const loadApiBinding = async () => {
  // oxlint-disable-next-line no-useless-concat -- A static specifier makes Vite resolve this worker runtime module at build time.
  const workerModule = "cloudflare:" + "workers";
  const workers: unknown = await import(/* @vite-ignore */ workerModule);
  if (!isCloudflareWorkersModule(workers)) {
    throw new TypeError("Cloudflare workers module is missing the API binding");
  }
  return workers.env.API;
};

const attachCookie = (request: Request, cookie: string | undefined) => {
  if (cookie !== undefined) request.headers.set("cookie", cookie);
  return request;
};

const boundApiFetch = (cookie: string | undefined): typeof fetch =>
  Object.assign(
    async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      const request = attachCookie(new Request(input, init), cookie);
      if (isLocal) return fetch(request);

      const api = await loadApiBinding();
      return api.fetch(request);
    },
    // Preserve runtime fetch helpers, such as Bun's preconnect.
    fetch,
  );

// Cache client construction, not request cookies or API responses.
const runtime = ManagedRuntime.make(
  makeApiClientLayer(apiUrl).pipe(Layer.provide(FetchHttpClient.layer)),
);

export async function runApi<A, E>(
  effect: Effect.Effect<A, E, ApiClient>,
): Promise<A> {
  const cookie = getRequestHeader("cookie");
  const result = await runtime.runPromise(
    effect.pipe(
      Effect.provideService(FetchHttpClient.Fetch, boundApiFetch(cookie)),
    ),
  );
  return structuredClone(result);
}
