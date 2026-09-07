import { CloudflareD1 } from "@alchemy.run/better-auth/CloudflareD1";
import { ClubService } from "@laxdb/core/club/club.service";
import {
  AuthenticationError,
  AuthorizationError,
  DatabaseError,
  NotFoundError,
  ValidationError,
} from "@laxdb/core/error";
import { MatchService } from "@laxdb/core/match/match.service";
import * as Cloudflare from "alchemy/Cloudflare";
import { DateTime, Redacted } from "effect";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServer from "effect/unstable/http/HttpServer";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiScalar from "effect/unstable/httpapi/HttpApiScalar";

import {
  type Auth,
  currentMemberSession,
  makeAuth,
  requireTeamManager,
} from "./auth/auth";
import { AuthService } from "./auth/auth.service";
import { database } from "./database";
import { LaxdbApi } from "./definition";
import { HttpGroups, ServicesLive } from "./layers";
import { matchImagesBucket } from "./match/match-images";

type ServicesLayer = ReturnType<typeof ServicesLive>;

const makeHttpApiRouter = (services: ServicesLayer) =>
  HttpApiBuilder.layer(LaxdbApi).pipe(
    Layer.provide(HttpGroups.pipe(Layer.provide(services))),
  );

const DocsRoute = HttpApiScalar.layer(LaxdbApi);

const errorResponse = (error: unknown) => {
  if (error instanceof AuthenticationError) {
    return HttpServerResponse.text(error.message, { status: 401 });
  }
  if (error instanceof AuthorizationError) {
    return HttpServerResponse.text(error.message, { status: 403 });
  }
  if (error instanceof NotFoundError) {
    return HttpServerResponse.text(error.message, { status: 404 });
  }
  if (error instanceof ValidationError) {
    return HttpServerResponse.text(error.message ?? "Invalid request", {
      status: 400,
    });
  }
  if (error instanceof DatabaseError) {
    return HttpServerResponse.text(error.message, { status: 500 });
  }
  return HttpServerResponse.text("Internal server error", { status: 500 });
};

const makeAuthRoute = (auth: Auth) =>
  HttpRouter.use((router) => router.add("*", "/api/auth/*", auth.fetch));

const RootRoute = HttpRouter.use((router) =>
  router.add("GET", "/", HttpServerResponse.text("OK")),
);

const HealthRoute = HttpRouter.use((router) =>
  router.add("GET", "/health", HttpServerResponse.text("OK")),
);

const makeMatchImageRoute = (services: ServicesLayer) =>
  HttpRouter.use((router) =>
    router.add(
      "GET",
      "/api/report-images/:id",
      Effect.gen(function* () {
        const params = yield* HttpRouter.params;
        const id = params.id;
        if (id === undefined || id === "") {
          return yield* new ValidationError({
            domain: "MatchImage",
            message: "Image id is required",
          });
        }

        const authService = yield* AuthService;
        const clubService = yield* ClubService;
        const matchService = yield* MatchService;
        const session = yield* currentMemberSession(authService);
        const image = yield* matchService.getMatchImage({
          organizationId: session.organizationId,
          id,
        });
        const fixture = yield* matchService.getFixture({
          organizationId: session.organizationId,
          id: image.fixtureId,
        });
        const team = yield* clubService.getTeam({
          organizationId: session.organizationId,
          id: fixture.teamId,
        });
        yield* requireTeamManager(session, team.coachMemberId);
        const bucket = yield* matchImagesBucket;
        const object = yield* Effect.tryPromise({
          try: () => bucket.get(image.objectKey),
          catch: (cause) =>
            new DatabaseError({
              domain: "MatchImage",
              message: "Failed to read image from R2",
              cause,
            }),
        });
        if (object === null) {
          return yield* new NotFoundError({ domain: "MatchImage", id });
        }
        return HttpServerResponse.raw(
          new Response(object.body, {
            headers: {
              "cache-control": "private, max-age=300",
              "content-type": image.contentType,
              "x-content-type-options": "nosniff",
            },
          }),
        );
      }).pipe(
        // oxlint-disable-next-line effecttsgo/strict-effect-provide -- The HTTP route is a request execution boundary.
        Effect.provide(services),
        Effect.catchTags({
          AuthenticationError: (error) => Effect.succeed(errorResponse(error)),
          AuthorizationError: (error) => Effect.succeed(errorResponse(error)),
          ConstraintViolationError: (error) =>
            Effect.succeed(errorResponse(error)),
          DatabaseError: (error) => Effect.succeed(errorResponse(error)),
          NotFoundError: (error) => Effect.succeed(errorResponse(error)),
          ValidationError: (error) => Effect.succeed(errorResponse(error)),
        }),
      ),
    ),
  );

export const GAMEDAY_FIXTURE_SYNC_CRON = "15 19 * * *";

const makeRoutes = (auth: Auth, services: ServicesLayer) =>
  Layer.mergeAll(
    makeHttpApiRouter(services),
    DocsRoute,
    makeAuthRoute(auth),
    RootRoute,
    HealthRoute,
    makeMatchImageRoute(services),
  ).pipe(Layer.provide(DateTime.layerCurrentZoneLocal));

export const makeApiWorker = (
  env: Cloudflare.WorkerBindingProps = {},
  routes: Cloudflare.WorkerRouteConfig[] = [],
) =>
  Cloudflare.Worker(
    "api",
    {
      main: import.meta.filename,
      routes,
      dev: {
        port: 1437,
        strictPort: true,
      },
      env: {
        // Sourced from Infisical at deploy time (`infisical run -- bun run deploy`).
        // Empty values keep EmailService in log-only mode.
        RESEND_API_KEY: Redacted.make(process.env.RESEND_API_KEY ?? ""),
        EMAIL_SENDER: process.env.EMAIL_SENDER ?? "",
        ...env,
      },
    },
    Effect.gen(function* () {
      const workerEnv = yield* Cloudflare.WorkerEnvironment;
      const auth = yield* makeAuth(workerEnv);
      const services = ServicesLive(auth);

      yield* Cloudflare.cron(GAMEDAY_FIXTURE_SYNC_CRON, () =>
        Effect.gen(function* () {
          const matchService = yield* MatchService;
          yield* matchService.syncAllLinkedFixtures;
        }).pipe(
          // oxlint-disable-next-line effecttsgo/strict-effect-provide -- The cron callback is a scheduled execution boundary.
          Effect.provide(services),
        ),
      ).pipe(
        // oxlint-disable-next-line effecttsgo/strict-effect-provide -- The worker registers the fully provided cron source.
        Effect.provide(Cloudflare.CronEventSourceLive),
      );

      return {
        fetch: makeRoutes(auth, services).pipe(
          Layer.provide(HttpServer.layerServices),
          HttpRouter.toHttpEffect,
        ),
      };
    }).pipe(
      // oxlint-disable-next-line effecttsgo/strict-effect-provide -- The worker implementation is the application entry point.
      Effect.provide(CloudflareD1(database)),
    ),
  );

export default makeApiWorker();
