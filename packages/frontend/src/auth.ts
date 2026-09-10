import { ApiClient } from "@laxdb/api/client";
import { Me } from "@laxdb/core/auth/auth.schema";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import {
  magicLinkClient,
  organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { Effect, Schema } from "effect";

import { runApi } from "./api";
import { makeAsyncQuery } from "./atom-query";

// Apps mount forwardApiRequest at /api/auth/* for same-origin auth requests.
export const authClient = createAuthClient({
  basePath: "/api/auth",
  fetchOptions: { throw: true },
  plugins: [magicLinkClient(), organizationClient()],
});

export const getMe = createServerFn({ method: "GET" }).handler(() => {
  setResponseHeader("Cache-Control", "private, no-store");
  return runApi(
    ApiClient.use((client) => client.Auth.me({ payload: {} })).pipe(
      // Transport and authorization failures must not look like a signed-out user.
      Effect.catchTag("AuthenticationError", () => Effect.succeed(null)),
    ),
  );
});

export const meAtom = makeAsyncQuery({
  load: (signal) => getMe({ signal }),
  staleTime: "5 minutes",
  serialization: {
    key: "laxdb/me",
    schema: Schema.NullOr(Me),
  },
});

export const organizationsAtom = makeAsyncQuery({
  load: async (signal) =>
    (await authClient.organization.list({ fetchOptions: { signal } })) ?? [],
});
