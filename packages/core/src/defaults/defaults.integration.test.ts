import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

import { TestDatabaseLive, truncateAll } from "../test/db";
import { makeTestRunner } from "../test/effect";

import { DefaultsRepo } from "./defaults.repo";
import { DefaultsService } from "./defaults.service";

const ServiceLayer = Layer.effect(DefaultsService, DefaultsService.make).pipe(
  Layer.provide(Layer.effect(DefaultsRepo, DefaultsRepo.make)),
  Layer.provide(TestDatabaseLive),
);
const TestLayer = Layer.mergeAll(ServiceLayer, TestDatabaseLive);

const run = makeTestRunner(TestLayer);

describe("DefaultsService integration", () => {
  it("starts empty and merges partial namespace updates", () =>
    run(
      Effect.gen(function* () {
        yield* truncateAll;
        const svc = yield* DefaultsService;

        const initial = yield* svc.getNamespace({
          scopeType: "global",
          scopeId: "global",
          namespace: "practice",
        });
        expect(initial).toEqual({});

        yield* svc.patchNamespace({
          scopeType: "global",
          scopeId: "global",
          namespace: "practice",
          values: {
            durationMinutes: 120,
            location: "Main Field",
          },
        });

        const values = yield* svc.patchNamespace({
          scopeType: "global",
          scopeId: "global",
          namespace: "practice",
          values: {
            location: "Indoor",
          },
        });

        expect(values).toEqual({
          durationMinutes: 120,
          location: "Indoor",
        });
      }),
    ));
});
