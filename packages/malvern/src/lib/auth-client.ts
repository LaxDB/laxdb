import { makeAsyncQuery } from "@laxdb/reactivity/atom-query";
import { fromPromise } from "@laxdb/reactivity/promise";
import {
  magicLinkClient,
  organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const organizationsAtom = makeAsyncQuery({
  load: () =>
    fromPromise(async () => {
      const result = await authClient.organization.list();
      if (result.error)
        throw new Error(result.error.message ?? "Failed to load teams");
      return result.data ?? [];
    }),
});

export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [magicLinkClient(), organizationClient()],
});
