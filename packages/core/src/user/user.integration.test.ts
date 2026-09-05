import { expect, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";

import { users as userTable } from "../auth/auth.sql";
import { DrizzleService, query } from "../drizzle/drizzle.service";
import { TestDatabaseLive, truncateAll } from "../test/db";

import { UserRepo } from "./user.repo";
import { UserService } from "./user.service";

const ServiceLayer = Layer.effect(UserService, UserService.make).pipe(
  Layer.provide(Layer.effect(UserRepo, UserRepo.make)),
  Layer.provide(TestDatabaseLive),
);
const TestLayer = Layer.mergeAll(ServiceLayer, TestDatabaseLive);

/** Insert a test user directly (bypasses better-auth) */
const seedUser = (email: string, name = "Test User") =>
  Effect.gen(function* () {
    const db = yield* DrizzleService;
    yield* query(
      db.insert(userTable).values({
        id: `test-${email}`,
        name,
        email,
        emailVerified: false,
      }),
    );
  });

layer(TestLayer)("UserService integration", (it) => {
  it.effect("finds a user by email", () =>
    Effect.gen(function* () {
      yield* truncateAll;
      yield* seedUser("alice@test.com", "Alice");

      const svc = yield* UserService;
      const user = yield* svc.fromEmail({ email: "alice@test.com" });

      expect(user.email).toBe("alice@test.com");
      expect(user.name).toBe("Alice");
    }),
  );
});
