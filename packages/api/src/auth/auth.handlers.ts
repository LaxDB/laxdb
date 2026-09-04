import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { LaxdbApi } from "../definition";

import { currentSession } from "./auth";
import { AuthService } from "./auth.service";

export const AuthHandlers = HttpApiBuilder.group(LaxdbApi, "Auth", (handlers) =>
  Effect.gen(function* () {
    const authService = yield* AuthService;
    return handlers.handle("me", () => currentSession(authService));
  }),
);
