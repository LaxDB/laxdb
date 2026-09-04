/**
 * Local walkthrough server: serves the full HTTP API + Better Auth routes
 * against the Miniflare test D1, for driving the malvern app end-to-end in a
 * browser. Run with:
 *
 *   bun src/test/walkthrough-server.ts
 *
 * Magic links are printed to stdout (log-only email mode without a key).
 */
import { Database } from "@alchemy.run/better-auth";
import { getTestD1Database } from "@laxdb/core/test/db";
import { RuntimeContext, type BaseRuntimeContext } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Context, DateTime, Effect, Layer } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { makeAuth } from "../auth/auth";
import { LaxdbApi } from "../definition";
import { HttpGroups, ServicesLive } from "../layers";

import { startNodeHttpTestServer } from "./http-test-server";

const APP_ORIGIN = process.env.APP_ORIGIN ?? "http://localhost:3005";
const db = await getTestD1Database();
const env = {
  DB: db,
  BETTER_AUTH_URL: APP_ORIGIN,
  TRUSTED_ORIGINS: APP_ORIGIN,
  IS_LOCAL: "true",
};

const LocalAuthDatabase = Layer.succeed(Database, {
  provider: "sqlite",
  runtime: Effect.succeed(db),
});

const auth = await Effect.runPromise(
  makeAuth(env, {
    secret: "walkthrough-local-secret-0123456789abcdef",
    migrate: false,
  }).pipe(Effect.provide(LocalAuthDatabase)),
);

const runtimeContext: BaseRuntimeContext = {
  Type: "NodeTestServer",
  id: "walkthrough",
  env,
  get: <T>() => Effect.succeed<T | undefined>(),
  set: (id) => Effect.succeed(id),
};
const requestContext = Context.make(RuntimeContext, runtimeContext);
const EnvLive = Layer.succeed(Cloudflare.WorkerEnvironment, env);

const HttpApiRouter = HttpApiBuilder.layer(LaxdbApi).pipe(
  Layer.provide(HttpGroups.pipe(Layer.provide(ServicesLive(auth)))),
  Layer.provide(EnvLive),
);

const AuthRoute = HttpRouter.use((router) =>
  router.add("*", "/api/auth/*", auth.fetch),
);

const HealthRoute = HttpRouter.use((router) =>
  router.add("GET", "/health", HttpServerResponse.text("OK")),
);

const AllRoutes = Layer.mergeAll(HttpApiRouter, AuthRoute, HealthRoute).pipe(
  Layer.provide(DateTime.layerCurrentZoneLocal),
);

export const walkthroughServer = await startNodeHttpTestServer(
  AllRoutes,
  requestContext,
);
console.log(`[walkthrough-api] listening at ${walkthroughServer.url}`);
