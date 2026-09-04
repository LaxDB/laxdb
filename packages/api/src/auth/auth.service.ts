import {
  ActiveMember,
  AuthSessionResult,
  type Me,
} from "@laxdb/core/auth/auth.schema";
import type { RuntimeContext } from "alchemy";
import { Context, Effect, Layer, Option, Schema } from "effect";

import type { Auth } from "./auth";

const decodeSession = Schema.decodeUnknownOption(AuthSessionResult);
const decodeMember = Schema.decodeUnknownOption(ActiveMember);

const resolveMe = (auth: Auth, headers: Headers) =>
  Effect.gen(function* () {
    const rawSession = yield* auth.getSession(headers).pipe(Effect.option);

    if (Option.isNone(rawSession)) return null;

    const parsedSession = decodeSession(rawSession.value);
    if (Option.isNone(parsedSession)) return null;

    const { user, session } = parsedSession.value;

    const rawMember = session.activeOrganizationId
      ? yield* auth.api.getActiveMember({ headers }).pipe(Effect.option)
      : Option.none();

    const parsedMember = Option.flatMap(rawMember, decodeMember);
    const activeMember = Option.getOrNull(parsedMember);

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
