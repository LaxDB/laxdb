import type { D1Database } from "@cloudflare/workers-types";
import { magicLink, organization } from "better-auth/plugins";
import { asc, count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { members, organizations } from "./auth.sql.ts";

export type AuthConfig = {
  db?: D1Database | undefined;
  baseURL: string;
  trustedOrigins?: string[] | undefined;
  useSecureCookies?: boolean | undefined;
  google: {
    clientId: string;
    clientSecret: string;
  };
  sendMagicLink: (args: {
    email: string;
    url: string;
    token: string;
  }) => Promise<void> | void;
  sendInvitationEmail: (args: {
    email: string;
    inviteLink: string;
    inviterName: string;
    organizationName: string;
  }) => Promise<void> | void;
};

/**
 * Better Auth options shared by the Alchemy runtime and local test harnesses.
 * Alchemy supplies the database and signing secret in deployed workers.
 */
export const createAuthOptions = (config: AuthConfig) => {
  const db = config.db === undefined ? undefined : drizzle(config.db);
  const requireDb = () => {
    if (db === undefined) {
      throw new Error("Better Auth database binding is unavailable");
    }
    return db;
  };

  const magicLinkPlugin = magicLink({
    expiresIn: 60 * 15,
    sendMagicLink: async ({ email, url, token }) => {
      await config.sendMagicLink({ email, url, token });
    },
  });
  const organizationPlugin = organization({
    schema: {
      session: {
        fields: {
          activeOrganizationId: "active_organization_id",
        },
      },
      organization: {
        fields: {
          createdAt: "created_at",
        },
      },
      member: {
        fields: {
          organizationId: "organization_id",
          userId: "user_id",
          createdAt: "created_at",
        },
      },
      invitation: {
        fields: {
          organizationId: "organization_id",
          expiresAt: "expires_at",
          createdAt: "created_at",
          inviterId: "inviter_id",
        },
      },
    },
    allowUserToCreateOrganization: async () => {
      const [row] = await requireDb()
        .select({ value: count() })
        .from(organizations);
      return (row?.value ?? 0) === 0;
    },
    sendInvitationEmail: async (data) => {
      const inviteLink = `${config.baseURL.replace(/\/api\/auth$/u, "")}/accept-invitation/${data.id}`;
      await config.sendInvitationEmail({
        email: data.email,
        inviteLink,
        inviterName: data.inviter.user.name,
        organizationName: data.organization.name,
      });
    },
  });
  const plugins: [typeof magicLinkPlugin, typeof organizationPlugin] = [
    magicLinkPlugin,
    organizationPlugin,
  ];

  return {
    baseURL: config.baseURL,
    trustedOrigins: config.trustedOrigins,
    advanced: {
      useSecureCookies: config.useSecureCookies ?? true,
    },
    emailAndPassword: { enabled: false },
    user: {
      fields: {
        emailVerified: "email_verified",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    session: {
      fields: {
        expiresAt: "expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
        ipAddress: "ip_address",
        userAgent: "user_agent",
        userId: "user_id",
      },
    },
    account: {
      fields: {
        accountId: "account_id",
        providerId: "provider_id",
        userId: "user_id",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        idToken: "id_token",
        accessTokenExpiresAt: "access_token_expires_at",
        refreshTokenExpiresAt: "refresh_token_expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    verification: {
      fields: {
        expiresAt: "expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    socialProviders: {
      google: config.google,
    },
    databaseHooks: {
      session: {
        create: {
          // New sessions start with no active organization, which would send
          // returning members back through onboarding. Activate their first
          // membership up front.
          before: async (session: { readonly userId: string }) => {
            const [membership] = await requireDb()
              .select({ organizationId: members.organizationId })
              .from(members)
              .where(eq(members.userId, session.userId))
              .orderBy(asc(members.createdAt))
              .limit(1);
            if (membership === undefined) return { data: session };
            return {
              data: {
                ...session,
                activeOrganizationId: membership.organizationId,
              },
            };
          },
        },
      },
    },
    plugins,
  };
};
