import type { BetterAuthApiError } from "@alchemy.run/better-auth";
import type { Me } from "@laxdb/core/auth/auth.schema";
import type { RuntimeContext } from "alchemy";
import { Context, Effect, Layer } from "effect";

import type { Auth } from "./auth";

const dieWithAuthError = (message: string, error: BetterAuthApiError) =>
  Effect.logError(message, error).pipe(Effect.andThen(Effect.die(error)));

const recoverSessionError = (error: BetterAuthApiError) =>
  error.statusCode === 401
    ? Effect.succeed(null)
    : dieWithAuthError("Better Auth failed to resolve the session", error);

const recoverActiveMemberError = (error: BetterAuthApiError) =>
  error.body?.code === "MEMBER_NOT_FOUND" ||
  error.body?.code === "NO_ACTIVE_ORGANIZATION"
    ? Effect.succeed(null)
    : dieWithAuthError(
        "Better Auth failed to resolve the active member",
        error,
      );

const resolveMe = (auth: Auth, headers: Headers) =>
  Effect.gen(function* () {
    const result = yield* auth
      .getSession(headers)
      .pipe(Effect.catchTag("BetterAuthApiError", recoverSessionError));

    if (result === null) return null;

    const { user, session } = result;
    const activeMember = session.activeOrganizationId
      ? yield* auth.api
          .getActiveMember({ headers })
          .pipe(Effect.catchTag("BetterAuthApiError", recoverActiveMemberError))
      : null;

    return {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      // Fail closed: an active organization is only trusted when Better Auth
      // confirms the user still has an active membership in it.
      activeOrganizationId:
        activeMember === null ? null : (session.activeOrganizationId ?? null),
      activeMemberId: activeMember?.id ?? null,
      memberRole: activeMember?.role ?? null,
    } satisfies Me;
  });

export type AuthServiceShape = {
  // Alchemy supplies RuntimeContext per request. Do not capture it while
  // constructing the worker layer.
  readonly resolveMe: (
    headers: Headers,
  ) => Effect.Effect<Me | null, never, RuntimeContext>;
};

export class AuthService extends Context.Service<
  AuthService,
  AuthServiceShape
>()("@laxdb/api/AuthService") {
  static readonly layer = (auth: Auth) =>
    Layer.succeed(this, {
      resolveMe: (headers) => resolveMe(auth, headers),
    });

  static readonly unauthenticatedLayer = Layer.succeed(this, {
    resolveMe: () => Effect.succeed(null),
  });
}
