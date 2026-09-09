// oxlint-disable-next-line typescript/triple-slash-reference -- Include the ambient contract in consumers without importing runtime code.
/// <reference path="./env.d.ts" />
/** Server-only API calls for TanStack Start apps. Cookies stay request-local. */
// oxlint-disable-next-line import/no-unassigned-import -- TanStack's marker prevents client imports.
import "@tanstack/react-start/server-only";

import { makeApiClientLayer, type ApiClient } from "@laxdb/api/client";
import { getRequestHeader } from "@tanstack/react-start/server";
import { Effect, Layer, ManagedRuntime } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

export const forwardApiRequest = async (request: Request) => {
  const { env } = await import("cloudflare:workers");
  return env.API.fetch(request);
};

const boundApiFetch = (cookie: string | undefined): typeof fetch =>
  Object.assign(
    (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      const request = new Request(input, init);
      if (cookie !== undefined) request.headers.set("cookie", cookie);
      return forwardApiRequest(request);
    },
    // Preserve runtime fetch helpers, such as Bun's preconnect.
    fetch,
  );

// Cache client construction, not request cookies or API responses.
const runtime = ManagedRuntime.make(
  makeApiClientLayer("http://api").pipe(Layer.provide(FetchHttpClient.layer)),
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
