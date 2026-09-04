import { readFile } from "node:fs/promises";

import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { Miniflare } from "miniflare";
import { expect, test } from "vitest";

import { getTestD1Database } from "../test/db";

import { createAuthOptions } from "./auth";

const splitStatements = (sql: string) =>
  sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement !== "");

const makeOptions = async () => {
  const db = await getTestD1Database();
  return {
    db,
    options: createAuthOptions({
      db,
      baseURL: "http://localhost",
      trustedOrigins: ["http://localhost"],
      google: { clientId: "", clientSecret: "" },
      sendMagicLink: () => Promise.resolve(),
      sendInvitationEmail: () => Promise.resolve(),
    }),
  };
};

test("the invitation migration upgrades a populated D1 database", async () => {
  const miniflare = new Miniflare({
    script: "",
    modules: true,
    d1Databases: { DB: "auth-migration-upgrade-test" },
  });

  try {
    const db = await miniflare.getD1Database("DB");
    const priorSchema = [
      "CREATE TABLE `user` (`id` text PRIMARY KEY)",
      "CREATE TABLE `organization` (`id` text PRIMARY KEY)",
      "CREATE TABLE `invitation` (`id` text PRIMARY KEY, `organization_id` text NOT NULL REFERENCES `organization`(`id`) ON DELETE cascade, `email` text NOT NULL, `role` text, `status` text DEFAULT 'pending' NOT NULL, `expires_at` integer NOT NULL, `inviter_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE cascade)",
      "CREATE INDEX `invitation_org_idx` ON `invitation` (`organization_id`)",
      "CREATE INDEX `invitation_email_idx` ON `invitation` (`email`)",
      "INSERT INTO `user` (`id`) VALUES ('user-1')",
      "INSERT INTO `organization` (`id`) VALUES ('organization-1')",
      "INSERT INTO `invitation` (`id`, `organization_id`, `email`, `role`, `status`, `expires_at`, `inviter_id`) VALUES ('invitation-1', 'organization-1', 'member@example.com', 'member', 'pending', 2000000000000, 'user-1')",
    ];

    for (const statement of priorSchema) {
      // oxlint-disable-next-line no-await-in-loop -- DDL must run in order
      await db.prepare(statement).run();
    }

    const migrationFile = new URL(
      "../../migrations/20260903112345_brief_blue_shield/migration.sql",
      import.meta.url,
    );
    const migration = await readFile(migrationFile, "utf8");
    for (const statement of splitStatements(migration)) {
      // oxlint-disable-next-line no-await-in-loop -- migration statements run in order
      await db.prepare(statement).run();
    }

    const invitation = await db
      .prepare(
        "SELECT `email`, `created_at` FROM `invitation` WHERE `id` = 'invitation-1'",
      )
      .first<{ email: string; created_at: number }>();
    const tableInfo = await db
      .prepare("PRAGMA table_info(`invitation`)")
      .all<{ name: string; notnull: number }>();
    const createdAtColumn = tableInfo.results.find(
      (column) => column.name === "created_at",
    );

    expect(invitation?.email).toBe("member@example.com");
    expect(invitation?.created_at).toBeGreaterThan(0);
    expect(createdAtColumn?.notnull).toBe(1);
  } finally {
    await miniflare.dispose();
  }
});

test("the D1 schema matches the Better Auth schema", async () => {
  const { db, options } = await makeOptions();
  const migrations = await getMigrations({
    ...options,
    database: db,
    secret: "migration-check",
    telemetry: { enabled: false },
  });

  expect(migrations.toBeCreated).toEqual([]);
  expect(migrations.toBeAdded).toEqual([]);
});

test("the native D1 adapter writes snake-case auth fields", async () => {
  const { db, options } = await makeOptions();
  await db.prepare("DELETE FROM verification").run();
  const auth = betterAuth({
    ...options,
    database: db,
    secret: "native-d1-adapter-check-0123456789",
  });

  const response = await auth.handler(
    new Request("http://localhost/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
      },
      body: JSON.stringify({ email: "native-d1@example.com" }),
    }),
  );
  const verification = await db
    .prepare("SELECT COUNT(*) AS total FROM verification")
    .first<{ total: number }>();

  expect(response.status).toBe(200);
  expect(verification?.total).toBe(1);
});
