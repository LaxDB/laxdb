import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

import { TestDatabaseLive, truncateAll } from "../test/db";
import { makeTestRunner } from "../test/effect";
import {
  validAddItem,
  validCreatePractice,
  validCreateReview,
} from "../test/fixtures";

import { PracticeRepo } from "./practice.repo";
import { PracticeService } from "./practice.service";

const ServiceLayer = Layer.effect(PracticeService, PracticeService.make).pipe(
  Layer.provide(Layer.effect(PracticeRepo, PracticeRepo.make)),
  Layer.provide(TestDatabaseLive),
);
const TestLayer = Layer.mergeAll(ServiceLayer, TestDatabaseLive);

const run = makeTestRunner(TestLayer);

describe("PracticeService integration", () => {
  // -----------------------------------------------------------------------
  // Practice CRUD
  // -----------------------------------------------------------------------

  it("creates, gets, updates, and deletes a practice", () =>
    run(
      Effect.gen(function* () {
        yield* truncateAll;
        const svc = yield* PracticeService;

        const practice = yield* svc.create(validCreatePractice());

        expect(practice.publicId).toHaveLength(12);
        expect(practice.name).toBe("Test Practice");
        expect(practice.status).toBe("draft");
        expect(practice.createdAt).toBeInstanceOf(Date);

        const found = yield* svc.get({ publicId: practice.publicId });
        expect(found.publicId).toBe(practice.publicId);

        const updated = yield* svc.update({
          publicId: practice.publicId,
          name: "Updated",
          status: "completed",
        });
        expect(updated.name).toBe("Updated");
        expect(updated.status).toBe("completed");

        yield* svc.delete({ publicId: practice.publicId });
        const list = yield* svc.list;
        expect(list).toHaveLength(0);
      }),
    ));

  it("creates a practice with all fields and lists practices", () =>
    run(
      Effect.gen(function* () {
        yield* truncateAll;
        const svc = yield* PracticeService;

        const practice = yield* svc.create(
          validCreatePractice({
            name: "Full Practice",
            description: "Desc",
            notes: "Notes",
            durationMinutes: 90,
            location: "Field A",
            status: "scheduled",
          }),
        );

        expect(practice.name).toBe("Full Practice");
        expect(practice.description).toBe("Desc");
        expect(practice.durationMinutes).toBe(90);
        expect(practice.location).toBe("Field A");
        expect(practice.status).toBe("scheduled");

        yield* svc.create(validCreatePractice({ name: "Other Practice" }));
        const practices = yield* svc.list;
        expect(practices).toHaveLength(2);
      }),
    ));

  it("manages an item lifecycle and persists its canvas state", () =>
    run(
      Effect.gen(function* () {
        yield* truncateAll;
        const svc = yield* PracticeService;

        const practice = yield* svc.create(validCreatePractice());
        const item = yield* svc.addItem(
          validAddItem(practice.publicId, {
            type: "warmup",
            label: "Jogging",
            durationMinutes: 5,
          }),
        );

        expect(item.publicId).toHaveLength(12);
        expect(item.practicePublicId).toBe(practice.publicId);
        expect(item.type).toBe("warmup");
        expect(item.label).toBe("Jogging");
        expect(item.durationMinutes).toBe(5);
        expect(item.priority).toBe("required");
        expect(item.groups).toEqual(["all"]);

        const updated = yield* svc.updateItem({
          publicId: item.publicId,
          label: "Updated",
          priority: "optional",
        });
        expect(updated.label).toBe("Updated");
        expect(updated.priority).toBe("optional");
        expect(updated.type).toBe(item.type);

        yield* svc.removeItem({ publicId: item.publicId });
        const items = yield* svc.listItems({
          practicePublicId: practice.publicId,
        });
        expect(items).toHaveLength(0);

        const positioned = yield* svc.addItem(
          validAddItem(practice.publicId, {
            type: "activity",
            variant: "split",
            positionX: 120,
            positionY: 240,
          }),
        );
        expect(positioned.variant).toBe("split");
        expect(positioned.positionX).toBe(120);
        expect(positioned.positionY).toBe(240);

        yield* svc.updateItem({
          publicId: positioned.publicId,
          variant: "default",
          positionX: 360,
          positionY: 480,
        });
        const persisted = yield* svc.listItems({
          practicePublicId: practice.publicId,
        });
        expect(persisted[0]?.variant).toBe("default");
        expect(persisted[0]?.positionX).toBe(360);
        expect(persisted[0]?.positionY).toBe(480);
      }),
    ));

  it("persists item ordering and practice edges", () =>
    run(
      Effect.gen(function* () {
        yield* truncateAll;
        const svc = yield* PracticeService;

        const practice = yield* svc.create(validCreatePractice());
        const cooldown = yield* svc.addItem(
          validAddItem(practice.publicId, {
            type: "cooldown",
            orderIndex: 2,
          }),
        );
        const warmup = yield* svc.addItem(
          validAddItem(practice.publicId, {
            type: "warmup",
            orderIndex: 0,
          }),
        );
        const drill = yield* svc.addItem(
          validAddItem(practice.publicId, {
            type: "drill",
            orderIndex: 1,
          }),
        );

        const items = yield* svc.listItems({
          practicePublicId: practice.publicId,
        });

        expect(items).toHaveLength(3);
        expect(items[0]?.type).toBe("warmup");
        expect(items[1]?.type).toBe("drill");
        expect(items[2]?.type).toBe("cooldown");

        const reordered = yield* svc.reorderItems({
          practicePublicId: practice.publicId,
          orderedIds: [cooldown.publicId, drill.publicId, warmup.publicId],
        });
        expect(reordered[0]?.publicId).toBe(cooldown.publicId);
        expect(reordered[1]?.publicId).toBe(drill.publicId);
        expect(reordered[2]?.publicId).toBe(warmup.publicId);

        const split = yield* svc.addItem(
          validAddItem(practice.publicId, {
            type: "activity",
            variant: "split",
            orderIndex: 3,
          }),
        );
        const replaced = yield* svc.replaceEdges({
          practicePublicId: practice.publicId,
          edges: [
            {
              sourcePublicId: warmup.publicId,
              targetPublicId: split.publicId,
              label: null,
            },
            {
              sourcePublicId: split.publicId,
              targetPublicId: drill.publicId,
              label: "Offense",
            },
          ],
        });
        expect(replaced).toHaveLength(2);

        const edges = yield* svc.listEdges({
          practicePublicId: practice.publicId,
        });
        expect(
          edges.map((edge) => ({
            sourcePublicId: edge.sourcePublicId,
            targetPublicId: edge.targetPublicId,
            label: edge.label,
          })),
        ).toEqual([
          {
            sourcePublicId: warmup.publicId,
            targetPublicId: split.publicId,
            label: null,
          },
          {
            sourcePublicId: split.publicId,
            targetPublicId: drill.publicId,
            label: "Offense",
          },
        ]);
      }),
    ));

  // -----------------------------------------------------------------------
  // Practice review
  // -----------------------------------------------------------------------

  it("manages a review lifecycle and nullable fields", () =>
    run(
      Effect.gen(function* () {
        yield* truncateAll;
        const svc = yield* PracticeService;

        const practice = yield* svc.create(validCreatePractice());
        const review = yield* svc.createReview(
          validCreateReview(practice.publicId, {
            wentWell: "Passing was sharp",
            needsImprovement: "Ground balls",
            notes: "Good energy",
          }),
        );

        expect(review.publicId).toHaveLength(12);
        expect(review.practicePublicId).toBe(practice.publicId);
        expect(review.wentWell).toBe("Passing was sharp");
        expect(review.needsImprovement).toBe("Ground balls");
        expect(review.notes).toBe("Good energy");

        const found = yield* svc.getReview({
          practicePublicId: practice.publicId,
        });
        expect(found.practicePublicId).toBe(practice.publicId);

        const updated = yield* svc.updateReview({
          practicePublicId: practice.publicId,
          wentWell: "Everything",
        });
        expect(updated.wentWell).toBe("Everything");

        const duplicateExit = yield* svc
          .createReview(validCreateReview(practice.publicId))
          .pipe(Effect.exit);
        expect(duplicateExit._tag).toBe("Failure");

        const emptyPractice = yield* svc.create(
          validCreatePractice({ name: "Empty Review Practice" }),
        );
        const emptyReview = yield* svc.createReview(
          validCreateReview(emptyPractice.publicId),
        );
        expect(emptyReview.wentWell).toBeNull();
        expect(emptyReview.needsImprovement).toBeNull();
        expect(emptyReview.notes).toBeNull();
      }),
    ));

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  it("rejects invalid practice and item enum values", () =>
    run(
      Effect.gen(function* () {
        yield* truncateAll;
        const svc = yield* PracticeService;

        const invalidStatus = yield* svc
          .create(
            // @ts-expect-error -- intentionally invalid enum
            validCreatePractice({ status: "invalid-status" }),
          )
          .pipe(Effect.exit);
        expect(invalidStatus._tag).toBe("Failure");

        const practice = yield* svc.create(validCreatePractice());

        const invalidType = yield* svc
          .addItem(
            // @ts-expect-error -- intentionally invalid enum
            validAddItem(practice.publicId, { type: "invalid-type" }),
          )
          .pipe(Effect.exit);
        const invalidPriority = yield* svc
          .addItem(
            // @ts-expect-error -- intentionally invalid enum
            validAddItem(practice.publicId, { priority: "invalid" }),
          )
          .pipe(Effect.exit);

        expect(invalidType._tag).toBe("Failure");
        expect(invalidPriority._tag).toBe("Failure");
      }),
    ));
});
