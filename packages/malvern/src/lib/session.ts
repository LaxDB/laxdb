import { ApiClient } from "@laxdb/api/client";
import { Me } from "@laxdb/core/auth/auth.schema";
import { runApi } from "@laxdb/frontend/api";
import { makeAsyncQuery } from "@laxdb/frontend/reactivity/atom-query";
import { fromPromise } from "@laxdb/frontend/reactivity/promise";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";

export type MeCtx = Me | null;

export const meAtom = makeAsyncQuery({
  load: () => fromPromise(() => getMe()),
  staleTime: "5 minutes",
  serialization: {
    key: "malvern/me",
    schema: AsyncResult.Schema({
      success: Schema.NullOr(Me),
      error: Schema.Error(),
    }),
  },
});

export const getMe = createServerFn({ method: "GET" }).handler(
  (): Promise<MeCtx> =>
    runApi(
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Auth.me({ payload: {} });
      }).pipe(
        // Only "not signed in" becomes null (→ login redirect). Transport or
        // authorization failures should surface loudly, not masquerade as a
        // logged-out user.
        Effect.catchTag("AuthenticationError", () => Effect.succeed(null)),
      ),
    ),
);
