import { expect, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";

import { TestDatabaseLive, truncateAll } from "../test/db";
import { validCreatePlay } from "../test/fixtures";

import { PlayRepo } from "./play.repo";
import { PlayService } from "./play.service";

const ServiceLayer = Layer.effect(PlayService, PlayService.make).pipe(
  Layer.provide(Layer.effect(PlayRepo, PlayRepo.make)),
  Layer.provide(TestDatabaseLive),
);
const TestLayer = Layer.mergeAll(ServiceLayer, TestDatabaseLive);

layer(TestLayer)("PlayService integration", (it) => {
  it.effect("manages a default Play lifecycle and rejects empty names", () =>
    Effect.gen(function* () {
      yield* truncateAll;
      const svc = yield* PlayService;

      const play = yield* svc.create(validCreatePlay());

      expect(play.publicId).toHaveLength(12);
      expect(play.name).toBe("Test Play");
      expect(play.category).toBe("offense");
      expect(play.formation).toBeNull();
      expect(play.description).toBeNull();
      expect(play.personnelNotes).toBeNull();
      expect(play.tags).toEqual([]);
      expect(play.diagramUrl).toBeNull();
      expect(play.videoUrl).toBeNull();
      expect(play.createdAt).toBeInstanceOf(Date);

      const found = yield* svc.get({ publicId: play.publicId });
      expect(found.publicId).toBe(play.publicId);
      expect(found.name).toBe(play.name);

      const deleted = yield* svc.delete({ publicId: play.publicId });
      const afterDelete = yield* svc
        .get({ publicId: play.publicId })
        .pipe(Effect.exit);
      expect(deleted.publicId).toBe(play.publicId);
      expect(afterDelete._tag).toBe("Failure");
      if (afterDelete._tag === "Failure") {
        expect(afterDelete.cause.toString()).toContain("NotFoundError");
      }

      const invalidName = yield* svc
        .create(validCreatePlay({ name: "" }))
        .pipe(Effect.exit);
      expect(invalidName._tag).toBe("Failure");
    }),
  );

  it.effect("creates, updates, and lists fully populated plays", () =>
    Effect.gen(function* () {
      yield* truncateAll;
      const svc = yield* PlayService;

      const play = yield* svc.create(
        validCreatePlay({
          name: "Play A",
          category: "emo",
          formation: "2-3-1",
          description: "Dodge from X and skip through the backside.",
          personnelNotes: "Lefty shooter at wing.",
          tags: ["extra-man", "late-clock"],
          diagramUrl: "https://example.com/diagram.png",
          videoUrl: "https://example.com/video.mp4",
        }),
      );

      expect(play.name).toBe("Play A");
      expect(play.category).toBe("emo");
      expect(play.formation).toBe("2-3-1");
      expect(play.description).toContain("Dodge from X");
      expect(play.personnelNotes).toBe("Lefty shooter at wing.");
      expect(play.tags).toEqual(["extra-man", "late-clock"]);
      expect(play.diagramUrl).toBe("https://example.com/diagram.png");
      expect(play.videoUrl).toBe("https://example.com/video.mp4");

      const updated = yield* svc.update({
        publicId: play.publicId,
        name: "Updated",
        category: "transition",
        tags: ["fast-break"],
      });
      expect(updated.name).toBe("Updated");
      expect(updated.category).toBe("transition");
      expect(updated.formation).toBe("2-3-1");
      expect(updated.tags).toEqual(["fast-break"]);

      yield* svc.create(validCreatePlay({ name: "Play B", category: "ride" }));
      const plays = yield* svc.list;
      expect(plays).toHaveLength(2);
      expect(plays.map((listed) => listed.name)).toEqual(["Updated", "Play B"]);
    }),
  );
});
