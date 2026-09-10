import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";

import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { providers as drizzleProviders } from "alchemy/Drizzle/Providers";
import * as GitHub from "alchemy/GitHub";
import * as Output from "alchemy/Output";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

import { database } from "./packages/api/src/database.ts";
import { makeApiWorker } from "./packages/api/src/index.ts";
import { tournamentRefreshCrons } from "./packages/world-lacrosse/src/lib/tournament-mode.ts";

export { database };

const config = {
  stack: "laxdb",
  stages: {
    prod: "prod",
    dev: "dev",
  },
  domains: {
    production: "laxdb.io",
    development: "dev.laxdb.io",
  },
};

const baseDomainForStage = (stage: string) =>
  stage === config.stages.prod
    ? config.domains.production
    : stage === config.stages.dev
      ? config.domains.development
      : `${stage}.${config.domains.development}`;

export const kv = Cloudflare.KV.Namespace("kv");
export const worldLacrosseLiveScores = Cloudflare.KV.Namespace(
  "world-lacrosse-live-scores",
);
export const storage = Cloudflare.R2.Bucket("storage").pipe(
  Alchemy.RemovalPolicy.retain(
    Alchemy.Stage.pipe(Effect.map((stage) => stage === "prod")),
  ),
);

const stackSecrets = Config.all({
  betterAuthUrl: Config.string("BETTER_AUTH_URL").pipe(Config.withDefault("")),
  emailSender: Config.string("EMAIL_SENDER").pipe(Config.withDefault("")),
  googleClientId: Config.string("GOOGLE_CLIENT_ID").pipe(
    Config.withDefault(""),
  ),
  googleClientSecret: Config.redacted("GOOGLE_CLIENT_SECRET").pipe(
    Config.withDefault(Redacted.make("")),
  ),
  resendApiKey: Config.redacted("RESEND_API_KEY").pipe(
    Config.withDefault(Redacted.make("")),
  ),
  trustedOrigins: Config.string("TRUSTED_ORIGINS").pipe(Config.withDefault("")),
});

export default Alchemy.Stack(
  config.stack,
  {
    providers: Cloudflare.providers().pipe(
      Layer.provideMerge(drizzleProviders()),
      Layer.provideMerge(GitHub.providers()),
    ),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const stage = yield* Alchemy.Stage;
    const db = yield* database;
    const kvNamespace = yield* kv;
    const liveScoresKv = yield* worldLacrosseLiveScores;
    const bucket = yield* storage;

    const baseDomain = baseDomainForStage(stage);
    const isLocal = (yield* Alchemy.AlchemyContext).dev;
    // Cookies ignore ports. Share one namespace per physical checkout, not app.
    const authCookiePrefix = isLocal
      ? `laxdb-dev-${createHash("sha256")
          .update(realpathSync(import.meta.dirname))
          .digest("hex")
          .slice(0, 16)}`
      : "";
    const malvernOrigin = isLocal
      ? "http://localhost:1438"
      : `https://malvern.${baseDomain}`;
    const secrets = yield* stackSecrets;
    const trustedOrigins =
      secrets.trustedOrigins === ""
        ? (isLocal
            ? [malvernOrigin, "http://localhost:1437"]
            : [malvernOrigin]
          ).join(",")
        : secrets.trustedOrigins;

    const api = yield* makeApiWorker(
      {
        DB: db,
        AUTH_COOKIE_PREFIX: authCookiePrefix,
        BETTER_AUTH_URL:
          secrets.betterAuthUrl === "" ? malvernOrigin : secrets.betterAuthUrl,
        EMAIL_SENDER: secrets.emailSender,
        IS_LOCAL: isLocal ? "true" : "",
        GOOGLE_CLIENT_ID: secrets.googleClientId,
        GOOGLE_CLIENT_SECRET: secrets.googleClientSecret,
        RESEND_API_KEY: isLocal ? Redacted.make("") : secrets.resendApiKey,
        TRUSTED_ORIGINS: trustedOrigins,
        STORAGE: bucket,
      },
      [
        { pattern: `malvern.${baseDomain}/api/auth/*` },
        { pattern: `malvern.${baseDomain}/api/report-images/*` },
      ],
    );

    const marketing = yield* Cloudflare.Website.Vite("marketing", {
      rootDir: "./packages/marketing",
      domain: baseDomain,
      compatibility: { flags: ["nodejs_compat"] },
    });

    const rulesWiki = yield* Cloudflare.Website.Vite("rules-wiki", {
      rootDir: "./packages/rules-wiki",
      domain: `rules.${baseDomain}`,
    });

    const practicePlanner = yield* Cloudflare.Website.Vite("practice-planner", {
      rootDir: "./packages/practice-planner",
      domain: `planner.${baseDomain}`,
      compatibility: { flags: ["nodejs_compat"] },
      env: {
        API: api,
      },
    });

    const malvern = yield* Cloudflare.Website.Vite("malvern", {
      rootDir: "./packages/malvern",
      workersDev: false,
      domain: `malvern.${baseDomain}`,
      compatibility: { flags: ["nodejs_compat"] },
      dev: {
        port: 1438,
        strictPort: true,
      },
      env: {
        API: api,
      },
    });

    const worldLacrosseLive = yield* Cloudflare.Worker("world-lacrosse-live", {
      main: "./packages/world-lacrosse/src/live-scores-worker.ts",
      domain: `live.world.${baseDomain}`,
      crons: tournamentRefreshCrons(stage, config.stages.prod),
      compatibility: { flags: ["nodejs_compat"] },
      env: {
        SCORES: liveScoresKv,
      },
    });

    const worldLacrosse = yield* Cloudflare.Website.Vite("world-lacrosse", {
      rootDir: "./packages/world-lacrosse",
      domain: `world.${baseDomain}`,
      compatibility: { flags: ["nodejs_compat"] },
    });

    if (process.env.GITHUB_ACTIONS === "true" && process.env.PULL_REQUEST) {
      yield* GitHub.Comment("preview-comment", {
        owner: "LaxDB",
        repository: "laxdb",
        issueNumber: Number(process.env.PULL_REQUEST),
        body: Output.interpolate`
         ## 🚀 Preview Deployed

         Your changes have been deployed to a preview environment:

         **🌐 Marketing:** ${marketing.url}
         **🥍 Practice Planner:** ${practicePlanner.url}
         **🦅 Malvern:** ${malvern.url}
         **🌍 World Lacrosse:** ${worldLacrosse.url}
         **Women’s Rules Wiki:** ${rulesWiki.url}

         Built from commit ${process.env.GITHUB_SHA?.slice(0, 7) ?? "unknown"}

         ---
         <sub>🤖 This comment updates automatically with each push.</sub>`,
      });
    }

    return {
      domain: baseDomain,
      marketing: marketing.url,
      practicePlanner: practicePlanner.url,
      malvern: malvern.url,
      rulesWiki: rulesWiki.url,
      worldLacrosse: worldLacrosse.url,
      worldLacrosseLive: worldLacrosseLive.url,
      api: api.url,
      db: db.databaseId,
      kv: kvNamespace.namespaceId,
      worldLacrosseLiveKv: liveScoresKv.namespaceId,
      r2: bucket.bucketName,
      stage,
    };
  }),
);
