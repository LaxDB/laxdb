import { expect, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";

import { TestDatabaseLive, truncateAll } from "../test/db";
import { validCreateDrill } from "../test/fixtures";

import { DrillRepo } from "./drill.repo";
import { DrillService } from "./drill.service";

const ServiceLayer = Layer.effect(DrillService, DrillService.make).pipe(
  Layer.provide(Layer.effect(DrillRepo, DrillRepo.make)),
  Layer.provide(TestDatabaseLive),
);
const TestLayer = Layer.mergeAll(ServiceLayer, TestDatabaseLive);

layer(TestLayer)("DrillService integration", (it) => {
  it.effect("creates, gets, and deletes a drill with defaults", () =>
    Effect.gen(function* () {
      yield* truncateAll;
      const svc = yield* DrillService;

      const drill = yield* svc.create(validCreateDrill());

      expect(drill.publicId).toHaveLength(12);
      expect(drill.name).toBe("Test Drill");
      expect(drill.difficulty).toBe("intermediate");
      expect(drill.category).toEqual([]);
      expect(drill.tags).toEqual([]);
      expect(drill.createdAt).toBeInstanceOf(Date);

      const found = yield* svc.get({ publicId: drill.publicId });
      expect(found.publicId).toBe(drill.publicId);
      expect(found.name).toBe(drill.name);

      const deleted = yield* svc.delete({ publicId: drill.publicId });
      expect(deleted.publicId).toBe(drill.publicId);
      const list = yield* svc.list;
      expect(list).toHaveLength(0);
    }),
  );

  it.effect("creates, updates, and lists fully populated Drills", () =>
    Effect.gen(function* () {
      yield* truncateAll;
      const svc = yield* DrillService;

      const drill = yield* svc.create(
        validCreateDrill({
          name: "Full Drill",
          subtitle: "A subtitle",
          description: "A description",
          difficulty: "advanced",
          category: ["shooting", "passing"],
          positionGroup: ["attack", "midfield"],
          intensity: "high",
          contact: true,
          competitive: false,
          playerCount: 10,
          durationMinutes: 15,
          fieldSpace: "half-field",
          equipment: ["balls", "cones"],
          tags: ["team", "speed"],
        }),
      );

      expect(drill.difficulty).toBe("advanced");
      expect(drill.category).toEqual(["shooting", "passing"]);
      expect(drill.positionGroup).toEqual(["attack", "midfield"]);
      expect(drill.intensity).toBe("high");
      expect(drill.contact).toBe(true);
      expect(drill.competitive).toBe(false);
      expect(drill.playerCount).toBe(10);
      expect(drill.durationMinutes).toBe(15);
      expect(drill.fieldSpace).toBe("half-field");
      expect(drill.equipment).toEqual(["balls", "cones"]);
      expect(drill.tags).toEqual(["team", "speed"]);

      const updated = yield* svc.update({
        publicId: drill.publicId,
        name: "Updated",
        difficulty: "beginner",
      });
      expect(updated.name).toBe("Updated");
      expect(updated.difficulty).toBe("beginner");
      expect(updated.subtitle).toBe("A subtitle");

      const withArrays = yield* svc.update({
        publicId: drill.publicId,
        category: ["defense", "ground-balls"],
        tags: ["new-tag"],
      });
      expect(withArrays.category).toEqual(["defense", "ground-balls"]);
      expect(withArrays.tags).toEqual(["new-tag"]);

      const withoutArrays = yield* svc.update({
        publicId: drill.publicId,
        category: [],
        tags: [],
      });
      expect(withoutArrays.category).toEqual([]);
      expect(withoutArrays.tags).toEqual([]);

      yield* svc.create(validCreateDrill({ name: "Drill B" }));
      const drills = yield* svc.list;
      expect(drills).toHaveLength(2);
    }),
  );

  it.effect("rejects invalid Drill enum values", () =>
    Effect.gen(function* () {
      const svc = yield* DrillService;

      const invalidDifficulty = yield* svc
        .create(
          // @ts-expect-error -- intentionally invalid enum
          validCreateDrill({ difficulty: "impossible" }),
        )
        .pipe(Effect.exit);
      const invalidIntensity = yield* svc
        .create(
          // @ts-expect-error -- intentionally invalid enum
          validCreateDrill({ intensity: "extreme" }),
        )
        .pipe(Effect.exit);
      const invalidCategory = yield* svc
        .create(
          // @ts-expect-error -- intentionally invalid enum
          validCreateDrill({ category: ["invalid-category"] }),
        )
        .pipe(Effect.exit);
      const invalidFieldSpace = yield* svc
        .create(
          // @ts-expect-error -- intentionally invalid enum
          validCreateDrill({ fieldSpace: "parking-lot" }),
        )
        .pipe(Effect.exit);

      expect(invalidDifficulty._tag).toBe("Failure");
      expect(invalidIntensity._tag).toBe("Failure");
      expect(invalidCategory._tag).toBe("Failure");
      expect(invalidFieldSpace._tag).toBe("Failure");
    }),
  );
});
