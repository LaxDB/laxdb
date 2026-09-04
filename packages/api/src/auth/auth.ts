import { BetterAuth } from "@alchemy.run/better-auth";
import type { D1Database } from "@cloudflare/workers-types";
import { createAuthOptions } from "@laxdb/core/auth/auth";
import type { Me } from "@laxdb/core/auth/auth.schema";
import {
  DEFAULT_EMAIL_SENDER,
  sendViaResend,
  type EmailConfig,
} from "@laxdb/core/email/email.service";
import { AuthenticationError, AuthorizationError } from "@laxdb/core/error";
import { Effect } from "effect";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";

import type { AuthService } from "./auth.service";

export type AuthEnv = {
  readonly DB: D1Database;
  readonly BETTER_AUTH_URL: string;
  readonly TRUSTED_ORIGINS?: string;
  readonly RESEND_API_KEY?: string;
  readonly EMAIL_SENDER?: string;
  readonly IS_LOCAL?: string;
  readonly GOOGLE_CLIENT_ID?: string;
  readonly GOOGLE_CLIENT_SECRET?: string;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

export const isAuthEnv = (value: unknown): value is AuthEnv =>
  isRecord(value) &&
  isRecord(value.DB) &&
  typeof value.DB.prepare === "function" &&
  typeof value.BETTER_AUTH_URL === "string" &&
  (value.TRUSTED_ORIGINS === undefined ||
    typeof value.TRUSTED_ORIGINS === "string");

/** Email config from the worker environment. */
export const emailConfigFromEnv = (env: unknown): EmailConfig => {
  const read = (key: string) => {
    if (!isRecord(env)) return;
    const value = env[key];
    return typeof value === "string" && value !== "" ? value : undefined;
  };
  return {
    apiKey: read("RESEND_API_KEY") ?? "",
    sender: read("EMAIL_SENDER") ?? DEFAULT_EMAIL_SENDER,
  };
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const deliverAuthEmail = async (
  env: Pick<AuthEnv, "EMAIL_SENDER" | "IS_LOCAL" | "RESEND_API_KEY">,
  input: {
    readonly to: string;
    readonly subject: string;
    readonly intro: string;
    readonly linkLabel: string;
    readonly link: string;
  },
) => {
  const config = emailConfigFromEnv(env);
  const isLocal = env.IS_LOCAL === "true";
  if (isLocal) {
    console.log(
      `[email:dev] to=${input.to} subject=${input.subject} link=${input.link}`,
    );
    return;
  }
  if (config.apiKey === "") {
    throw new Error("RESEND_API_KEY is required outside local development");
  }
  await sendViaResend(config, {
    to: [input.to],
    subject: input.subject,
    text: `${input.intro}\n\n${input.link}\n\nIf you weren't expecting this email, you can ignore it.`,
    html: [
      `<p>${escapeHtml(input.intro)}</p>`,
      `<p><a href="${escapeHtml(input.link)}">${escapeHtml(input.linkLabel)}</a></p>`,
      `<p style="color:#888;font-size:0.85em">If you weren't expecting this email, you can ignore it.</p>`,
    ].join("\n"),
  });
};

/**
 * Build Alchemy's Effect-native Better Auth service. Alchemy supplies the D1
 * adapter, signing secret, request scope, and deploy-time schema migration.
 */
export const makeAuth = (
  env: unknown,
  runtimeOptions: {
    readonly secret?: string;
    readonly migrate?: boolean;
  } = {},
) => {
  const runtimeEnv = isAuthEnv(env) ? env : undefined;
  const baseURL = runtimeEnv?.BETTER_AUTH_URL ?? "http://localhost";

  const requireRuntimeEnv = () => {
    if (runtimeEnv === undefined) {
      throw new Error("Better Auth worker environment is invalid");
    }
    return runtimeEnv;
  };

  return BetterAuth({
    id: "LaxdbAuth",
    migrate: runtimeOptions.migrate ?? true,
    ...(runtimeOptions.secret === undefined
      ? {}
      : { secret: runtimeOptions.secret }),
    ...createAuthOptions({
      db: runtimeEnv?.DB,
      baseURL,
      trustedOrigins: runtimeEnv?.TRUSTED_ORIGINS?.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
      useSecureCookies: !baseURL.startsWith("http://"),
      google: {
        clientId: runtimeEnv?.GOOGLE_CLIENT_ID ?? "",
        clientSecret: runtimeEnv?.GOOGLE_CLIENT_SECRET ?? "",
      },
      sendMagicLink: ({ email, url }) => {
        const env = requireRuntimeEnv();
        return deliverAuthEmail(env, {
          to: email,
          subject: "Sign in to Malvern Lacrosse",
          intro: "Use the link below to sign in. It expires in 15 minutes.",
          linkLabel: "Sign in",
          link: url,
        });
      },
      sendInvitationEmail: ({
        email,
        inviteLink,
        inviterName,
        organizationName,
      }) => {
        const env = requireRuntimeEnv();
        return deliverAuthEmail(env, {
          to: email,
          subject: `You're invited to ${organizationName}`,
          intro: `${inviterName} invited you to join ${organizationName} on Malvern Lacrosse.`,
          linkLabel: "Accept invitation",
          link: inviteLink,
        });
      },
    }),
  });
};

export type Auth = Effect.Success<ReturnType<typeof makeAuth>>;

type AuthServiceImpl = typeof AuthService.Service;

export const currentSession = (authService: AuthServiceImpl) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const headers = new Headers(request.headers);
    const session = yield* authService.resolveMe(headers);
    if (session === null) {
      return yield* new AuthenticationError({ message: "unauthorized" });
    }
    return session;
  });

const isAdmin = (session: Me) =>
  session.memberRole === "owner" || session.memberRole === "admin";

export const organizationId = (session: Me) =>
  session.activeOrganizationId === null
    ? Effect.fail(
        new AuthorizationError({ message: "active organization required" }),
      )
    : Effect.succeed(session.activeOrganizationId);

export const adminOrganizationId = (session: Me) =>
  isAdmin(session)
    ? organizationId(session)
    : Effect.fail(new AuthorizationError({ message: "admin role required" }));

export const withOrganization = <A, E, R>(
  authService: AuthServiceImpl,
  useOrganization: (orgId: string) => Effect.Effect<A, E, R>,
) =>
  currentSession(authService).pipe(
    Effect.flatMap((session) => organizationId(session)),
    Effect.flatMap(useOrganization),
  );

export const withAdminOrganization = <A, E, R>(
  authService: AuthServiceImpl,
  useOrganization: (orgId: string) => Effect.Effect<A, E, R>,
) =>
  currentSession(authService).pipe(
    Effect.flatMap((session) => adminOrganizationId(session)),
    Effect.flatMap(useOrganization),
  );

export type MemberSessionContext = {
  readonly organizationId: string;
  readonly userId: string;
  readonly userName: string;
  readonly activeMemberId: string;
  readonly memberRole: NonNullable<Me["memberRole"]>;
};

export const requireTeamManager = (
  session: MemberSessionContext,
  coachMemberId: string | null,
) =>
  session.memberRole === "owner" ||
  session.memberRole === "admin" ||
  coachMemberId === session.activeMemberId
    ? Effect.void
    : Effect.fail(
        new AuthorizationError({
          message: "admin role or assigned team coach required",
        }),
      );

export const currentMemberSession = (authService: AuthServiceImpl) =>
  Effect.gen(function* () {
    const session = yield* currentSession(authService);
    const orgId = yield* organizationId(session);
    if (session.activeMemberId === null || session.memberRole === null) {
      return yield* new AuthorizationError({
        message: "active organization membership required",
      });
    }
    return {
      organizationId: orgId,
      userId: session.userId,
      userName: session.userName,
      activeMemberId: session.activeMemberId,
      memberRole: session.memberRole,
    } satisfies MemberSessionContext;
  });

export const withMemberSession = <A, E, R>(
  authService: AuthServiceImpl,
  useSession: (context: MemberSessionContext) => Effect.Effect<A, E, R>,
) => currentMemberSession(authService).pipe(Effect.flatMap(useSession));

export const withAdminSession = <A, E, R>(
  authService: AuthServiceImpl,
  useSession: (context: {
    readonly organizationId: string;
    readonly userId: string;
  }) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const session = yield* currentSession(authService);
    const orgId = yield* adminOrganizationId(session);
    return yield* useSession({ organizationId: orgId, userId: session.userId });
  });
