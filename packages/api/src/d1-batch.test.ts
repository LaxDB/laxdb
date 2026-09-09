import { members, organizations, users } from "@laxdb/core/auth/auth.sql";
import {
  DatabaseLive,
  DrizzleService,
  batch,
  query,
  SqlError,
} from "@laxdb/core/drizzle/drizzle.service";
import { FineRepo } from "@laxdb/core/fine/fine.repo";
import { fineEvents, fines } from "@laxdb/core/fine/fine.sql";
import { PracticeRepo } from "@laxdb/core/practice/practice.repo";
import { PracticeService } from "@laxdb/core/practice/practice.service";
import { getTestD1Database, disposeTestDatabase } from "@laxdb/core/test/db";
import { validCreatePractice, validAddItem } from "@laxdb/core/test/fixtures";
import { D1 } from "alchemy/Drizzle/D1";
import { Effect, Layer } from "effect";
import { afterAll, expect, it } from "vitest";

afterAll(disposeTestDatabase);

it("batches nested Alchemy query chains lazily on the same request-scoped client", async () => {
  let resolutions = 0;
  const database = DatabaseLive(
    D1(
      Effect.sync(() => {
        resolutions += 1;
      }).pipe(Effect.andThen(Effect.promise(getTestD1Database))),
    ),
  );
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const context = yield* Layer.build(database);
        yield* Effect.gen(function* () {
          const db = yield* DrizzleService;
          const repo = yield* FineRepo.make;
          const writes = batch(db, [
            db.insert(users).values({
              id: "batch-user",
              name: "Batch",
              email: "batch@example.com",
              emailVerified: true,
            }),
            db
              .insert(organizations)
              .values({ id: "batch-org", name: "Batch", slug: "batch-org" }),
            db.insert(members).values({
              id: "batch-member",
              organizationId: "batch-org",
              userId: "batch-user",
              role: "member",
            }),
          ]);
          expect(resolutions).toBe(0);
          yield* writes;
          expect(resolutions).toBe(1);
          const fine = yield* repo.issue({
            organizationId: "batch-org",
            memberId: "batch-member",
            reason: "Batch",
            amountCents: 100,
          });
          const practiceService = yield* PracticeService.make.pipe(
            Effect.provide(PracticeRepo.layer),
          );
          const practice = yield* practiceService.create(validCreatePractice());
          const source = yield* practiceService.addItem(
            validAddItem(practice.publicId),
          );
          const target = yield* practiceService.addItem(
            validAddItem(practice.publicId),
          );
          const edges = yield* practiceService.replaceEdges({
            practicePublicId: practice.publicId,
            edges: [
              {
                sourcePublicId: source.publicId,
                targetPublicId: target.publicId,
                label: "Batch",
              },
            ],
          });
          expect(edges[0]?.publicId).toHaveLength(12);
          expect(edges[0]?.createdAt).toBeInstanceOf(Date);
          expect(
            yield* practiceService.listEdges({
              practicePublicId: practice.publicId,
            }),
          ).toEqual(edges);
          const paid = yield* repo.pay({
            organizationId: "batch-org",
            id: fine.id,
          });
          expect(paid.status).toBe("paid");
          expect(paid.paidAt).toBeInstanceOf(Date);
          expect(yield* query(db.select().from(fineEvents))).toHaveLength(2);
          const error = yield* batch(db, [
            db.update(fines).set({ amountCents: 200 }),
            db.insert(fineEvents).values({
              id: "bad-event",
              fineId: "missing",
              kind: "adjusted",
              amountCents: 200,
            }),
          ]).pipe(Effect.flip);
          expect(error).toBeInstanceOf(SqlError);
          expect(String(error.cause)).toContain("FOREIGN KEY");
          expect(
            (yield* repo.get({ organizationId: "batch-org", id: fine.id }))
              .amountCents,
          ).toBe(100);
          expect(resolutions).toBe(1);
        }).pipe(Effect.provideContext(context));
        // A new execution scope resolves the same lazy layer again, not an
        // isolate-lifetime D1 client captured while the layer was constructed.
        yield* Effect.scoped(
          Effect.gen(function* () {
            const db = yield* DrizzleService;
            yield* batch(db, [db.select().from(fines)]);
            expect(resolutions).toBe(2);
          }),
        ).pipe(Effect.provideContext(context));
      }),
    ),
  );
});
