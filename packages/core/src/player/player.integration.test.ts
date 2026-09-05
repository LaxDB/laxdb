import { expect, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";

import { TestDatabaseLive, truncateAll } from "../test/db";
import { validCreatePlayer } from "../test/fixtures";

import { PlayerRepo } from "./player.repo";
import { PlayerService } from "./player.service";

const ServiceLayer = Layer.effect(PlayerService, PlayerService.make).pipe(
  Layer.provide(Layer.effect(PlayerRepo, PlayerRepo.make)),
  Layer.provide(TestDatabaseLive),
);
const TestLayer = Layer.mergeAll(ServiceLayer, TestDatabaseLive);

layer(TestLayer)("PlayerService integration", (it) => {
  it.effect("creates, gets, updates, deletes, and lists players", () =>
    Effect.gen(function* () {
      yield* truncateAll;
      const svc = yield* PlayerService;

      const player = yield* svc.create(
        validCreatePlayer({ name: "Alice", email: "alice@test.com" }),
      );

      expect(player.publicId).toHaveLength(12);
      expect(player.name).toBe("Alice");
      expect(player.email).toBe("alice@test.com");
      expect(player.createdAt).toBeInstanceOf(Date);

      const found = yield* svc.getByPublicId({ publicId: player.publicId });
      expect(found.publicId).toBe(player.publicId);
      expect(found.name).toBe(player.name);

      const renamed = yield* svc.update({
        publicId: player.publicId,
        name: "Updated Name",
      });
      expect(renamed.name).toBe("Updated Name");
      expect(renamed.email).toBe(player.email);

      const readdressed = yield* svc.update({
        publicId: player.publicId,
        email: "new@test.com",
      });
      expect(readdressed.email).toBe("new@test.com");
      expect(readdressed.name).toBe(renamed.name);

      const deleted = yield* svc.delete({ publicId: player.publicId });
      expect(deleted.publicId).toBe(player.publicId);
      const remaining = yield* svc.list;
      expect(remaining).toHaveLength(0);

      yield* svc.create(validCreatePlayer({ name: "A", email: "a@test.com" }));
      yield* svc.create(validCreatePlayer({ name: "B", email: "b@test.com" }));
      const players = yield* svc.list;
      expect(players).toHaveLength(2);
    }),
  );

  it.effect("rejects invalid Player names", () =>
    Effect.gen(function* () {
      yield* truncateAll;
      const svc = yield* PlayerService;

      const tooLong = yield* svc
        .create({ name: "A".repeat(101), email: "a@b.com" })
        .pipe(Effect.exit);
      expect(tooLong._tag).toBe("Failure");

      const created = yield* svc.create(validCreatePlayer());
      const empty = yield* svc
        .update({ publicId: created.publicId, name: "" })
        .pipe(Effect.exit);
      expect(empty._tag).toBe("Failure");
    }),
  );
});
