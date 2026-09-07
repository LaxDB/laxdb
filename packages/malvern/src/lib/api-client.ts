/**
 * Effect HTTP API client for the api worker.
 *
 * Server functions call the api worker with the generated Effect client.
 * Local dev uses the stable api dev port; deployed workers use the API service
 * binding. The apiAuth middleware captures the incoming request cookie and
 * runApi attaches it to the outgoing API request.
 */
import { makeApiClientLayer, type ApiClient } from "@laxdb/api/client";
import { createMiddleware } from "@tanstack/react-start";
import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { apiUrl, fetchApi } from "./api-fetch";

const attachCookie = (request: Request, cookie: string | undefined) => {
  if (cookie !== undefined) request.headers.set("cookie", cookie);
  return request;
};

const boundApiFetch =
  (cookie: string | undefined): typeof fetch =>
  (input, init) =>
    fetchApi(attachCookie(new Request(input, init), cookie));

export const apiAuth = createMiddleware().server(({ request, next }) =>
  next({ context: { apiCookie: request.headers.get("cookie") ?? undefined } }),
);

const clientLayer = (cookie: string | undefined) =>
  makeApiClientLayer(apiUrl).pipe(
    Layer.provide(
      FetchHttpClient.layer.pipe(
        Layer.provide(
          Layer.succeed(FetchHttpClient.Fetch, boundApiFetch(cookie)),
        ),
      ),
    ),
  );

export async function runApi<A, E>(
  cookie: string | undefined,
  effect: Effect.Effect<A, E, ApiClient>,
): Promise<A> {
  const result = await Effect.runPromise(
    effect.pipe(
      // oxlint-disable-next-line effecttsgo/strict-effect-provide -- runApi executes the fully provided effect at this Promise boundary.
      Effect.provide(clientLayer(cookie)),
      Effect.tapError((error) =>
        Effect.sync(() => {
          console.log("[runApi] failed", error);
        }),
      ),
    ),
  );
  return structuredClone(result);
}
