import { makeAsyncQuery } from "@laxdb/frontend/atom-query";
import {
  magicLinkClient,
  organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const organizationsAtom = makeAsyncQuery({
  load: async (signal) => {
    const result = await authClient.organization.list({
      fetchOptions: { signal },
    });
    if (result.error)
      throw new Error(result.error.message ?? "Failed to load teams");
    return result.data ?? [];
  },
});

export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [magicLinkClient(), organizationClient()],
});
