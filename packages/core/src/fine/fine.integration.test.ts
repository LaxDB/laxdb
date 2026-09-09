import { describe, expect, it } from "@effect/vitest";
import {
  DrizzleService,
  query,
  SqlError,
} from "@laxdb/core/drizzle/drizzle.service";
import { eq, sql } from "drizzle-orm";
import { Effect, Layer } from "effect";

import { members, organizations, users } from "../auth/auth.sql";
import { TestDatabaseLive, truncateAll } from "../test/db";
import { makeTestRunner } from "../test/effect";

import { FineRepo } from "./fine.repo";
import { FineService } from "./fine.service";
import { fineEvents, fines } from "./fine.sql";

const ServiceLayer = Layer.effect(FineService, FineService.make).pipe(
  Layer.provide(Layer.effect(FineRepo, FineRepo.make)),
  Layer.provide(TestDatabaseLive),
);
const TestLayer = Layer.mergeAll(ServiceLayer, TestDatabaseLive);

const run = makeTestRunner(TestLayer);

const ORG_ID = "org-fines";
const OTHER_ORG_ID = "org-other";
const USER_ID = "user-fines";
const OTHER_USER_ID = "user-other";
const MEMBER_ID = "member-fines";
const OTHER_MEMBER_ID = "member-other";

const seedFineMember = Effect.gen(function* () {
  const db = yield* DrizzleService;

  yield* query(
    db.insert(users).values([
      {
        id: USER_ID,
        name: "Fine Runner",
        email: "fine-runner@example.com",
        emailVerified: true,
      },
      {
        id: OTHER_USER_ID,
        name: "Other Runner",
        email: "other-runner@example.com",
        emailVerified: true,
      },
    ]),
  );
  yield* query(
    db.insert(organizations).values([
      { id: ORG_ID, name: "Fines Club", slug: "fines-club" },
      { id: OTHER_ORG_ID, name: "Other Club", slug: "other-club" },
    ]),
  );
  yield* query(
    db.insert(members).values([
      {
        id: MEMBER_ID,
        organizationId: ORG_ID,
        userId: USER_ID,
        role: "member",
      },
      {
        id: OTHER_MEMBER_ID,
        organizationId: OTHER_ORG_ID,
        userId: OTHER_USER_ID,
        role: "member",
      },
    ]),
  );
});

describe("FineService integration", () => {
  it("rolls back a new fine if its audit insert fails", () =>
    run(
      Effect.gen(function* () {
        yield* truncateAll;
        yield* seedFineMember;
        const db = yield* DrizzleService;
        const repo = yield* FineRepo.make;
        yield* query(
          db.run(sql`CREATE TRIGGER fail_fine_event BEFORE INSERT ON fine_events
        BEGIN SELECT RAISE(ABORT, 'forced audit failure'); END`),
        );
        const error = yield* repo
          .issue({
            organizationId: ORG_ID,
            memberId: MEMBER_ID,
            reason: "Rollback",
            amountCents: 200,
          })
          .pipe(
            Effect.flip,
            Effect.ensuring(
              query(db.run(sql`DROP TRIGGER fail_fine_event`)).pipe(
                Effect.orDie,
              ),
            ),
          );
        expect(error).toBeInstanceOf(SqlError);
        expect(String(error.cause)).toContain("forced audit failure");
        expect(yield* query(db.select().from(fines))).toEqual([]);
        expect(yield* query(db.select().from(fineEvents))).toEqual([]);
      }),
    ));

  it.each(["pay", "forgive", "adjust", "applyDoublings"])(
    "rolls back fine state and audit events when %s fails after its event insert",
    (action) =>
      run(
        Effect.gen(function* () {
          yield* truncateAll;
          yield* seedFineMember;
          const db = yield* DrizzleService;
          const svc = yield* FineService;
          const now = new Date("2026-05-15T00:00:00Z");
          const first = yield* svc.issue({
            organizationId: ORG_ID,
            memberId: MEMBER_ID,
            reason: "First",
            amountCents: 200,
            dueAt: new Date("2026-05-01T00:00:00Z"),
          });
          const second = yield* svc.issue({
            organizationId: ORG_ID,
            memberId: MEMBER_ID,
            reason: "Second",
            amountCents: 300,
            dueAt: first.dueAt,
          });
          const oldFines = yield* query(db.select().from(fines));
          const oldEvents = yield* query(db.select().from(fineEvents));
          yield* query(
            db.run(sql`CREATE TRIGGER fail_fine_update BEFORE UPDATE ON fines
        WHEN NEW.reason = 'Second' BEGIN SELECT RAISE(ABORT, 'forced fine failure'); END`),
          );
          const input = {
            organizationId: ORG_ID,
            id: second.id,
            actorUserId: USER_ID,
          };
          const mutation = Effect.gen(function* () {
            if (action === "pay") yield* svc.pay(input);
            else if (action === "forgive") yield* svc.forgive(input);
            else if (action === "adjust")
              yield* svc.adjust({ ...input, amountCents: 450 });
            else yield* svc.applyDoublings({ now });
          });
          const error = yield* mutation.pipe(
            Effect.flip,
            Effect.ensuring(
              query(db.run(sql`DROP TRIGGER fail_fine_update`)).pipe(
                Effect.orDie,
              ),
            ),
          );
          expect(error._tag).toBe("DatabaseError");
          expect(yield* query(db.select().from(fines))).toEqual(oldFines);
          expect(yield* query(db.select().from(fineEvents))).toEqual(oldEvents);
        }),
      ),
  );

  it.each(["pay", "forgive"])(
    "overlapping payments and %s create only one terminal event",
    (action) =>
      run(
        Effect.gen(function* () {
          yield* truncateAll;
          yield* seedFineMember;
          const svc = yield* FineService;
          const fine = yield* svc.issue({
            organizationId: ORG_ID,
            memberId: MEMBER_ID,
            reason: "Race",
            amountCents: 400,
          });
          const input = {
            organizationId: ORG_ID,
            id: fine.id,
            actorUserId: USER_ID,
          };
          yield* Effect.all(
            [
              svc.pay(input),
              action === "pay" ? svc.pay(input) : svc.forgive(input),
            ],
            { concurrency: "unbounded" },
          );
          const current = yield* svc.get(input);
          const events = yield* svc.listEvents(input);
          const terminal = events.filter(
            (event) => event.kind === "paid" || event.kind === "forgiven",
          );
          expect(terminal).toHaveLength(1);
          expect(terminal[0]?.kind).toBe(current.status);
          expect(terminal[0]?.deltaCents).toBe(-400);
          yield* svc.pay(input);
          yield* svc.forgive(input);
          expect(yield* svc.listEvents(input)).toEqual(events);
        }),
      ),
  );

  it("overlapping doublings count only actual transitions and use current amounts", () =>
    run(
      Effect.gen(function* () {
        yield* truncateAll;
        yield* seedFineMember;
        const svc = yield* FineService;
        const now = new Date("2026-05-15T00:00:00Z");
        const fine = yield* svc.issue({
          organizationId: ORG_ID,
          memberId: MEMBER_ID,
          reason: "Due",
          amountCents: 400,
          dueAt: new Date("2026-05-01T00:00:00Z"),
        });
        const input = { organizationId: ORG_ID, id: fine.id };
        const results = yield* Effect.all(
          [svc.applyDoublings({ now }), svc.applyDoublings({ now })],
          { concurrency: "unbounded" },
        );
        expect(
          results.reduce((total, result) => total + result.doubled, 0),
        ).toBe(1);
        const current = yield* svc.get(input);
        expect(current.amountCents).toBe(800);
        expect(current.dueAt).toEqual(new Date("2026-05-22T00:00:00Z"));
        expect(
          (yield* svc.listEvents(input)).filter(
            (event) => event.kind === "doubled",
          ),
        ).toHaveLength(1);
      }),
    ));

  it.each(["pay", "forgive", "adjust"])(
    "overlapping doubling and %s keep audit amounts consistent",
    (action) =>
      run(
        Effect.gen(function* () {
          yield* truncateAll;
          yield* seedFineMember;
          const svc = yield* FineService;
          const db = yield* DrizzleService;
          const now = new Date("2026-05-15T00:00:00Z");
          const fine = yield* svc.issue({
            organizationId: ORG_ID,
            memberId: MEMBER_ID,
            reason: "Race",
            amountCents: 400,
            dueAt: new Date("2026-05-01T00:00:00Z"),
          });
          const input = { organizationId: ORG_ID, id: fine.id };
          yield* Effect.all(
            [
              svc.applyDoublings({ now }),
              action === "pay"
                ? svc.pay(input)
                : action === "forgive"
                  ? svc.forgive(input)
                  : svc.adjust({ ...input, amountCents: 500 }),
            ],
            { concurrency: "unbounded" },
          );
          const current = yield* svc.get(input);
          const events = yield* query(
            db
              .select()
              .from(fineEvents)
              .where(eq(fineEvents.fineId, fine.id))
              .orderBy(sql`rowid`),
          );
          let amount = 0;
          let settled = false;
          for (const event of events) {
            if (event.kind === "paid" || event.kind === "forgiven") {
              expect(event.amountCents).toBe(amount);
              expect(event.deltaCents).toBe(-amount);
              settled = true;
            } else {
              expect(settled).toBe(false);
              expect(event.deltaCents).toBe(event.amountCents - amount);
              amount = event.amountCents;
            }
          }
          expect(current.amountCents).toBe(amount);
          expect(current.status).toBe(
            action === "adjust"
              ? "unpaid"
              : action === "pay"
                ? "paid"
                : "forgiven",
          );
        }),
      ),
  );

  it("overlapping adjustments compute deltas from the committed previous amount", () =>
    run(
      Effect.gen(function* () {
        yield* truncateAll;
        yield* seedFineMember;
        const svc = yield* FineService;
        const fine = yield* svc.issue({
          organizationId: ORG_ID,
          memberId: MEMBER_ID,
          reason: "Adjust",
          amountCents: 400,
        });
        const input = { organizationId: ORG_ID, id: fine.id };
        const adjusted = yield* Effect.all(
          [
            svc.adjust({ ...input, amountCents: 500 }),
            svc.adjust({ ...input, amountCents: 600 }),
          ],
          { concurrency: "unbounded" },
        );
        const current = yield* svc.get(input);
        const events = yield* svc.listEvents(input);
        expect(events).toHaveLength(3);
        expect(adjusted.map((row) => row.amountCents)).toEqual([500, 600]);
        expect(
          events.reduce((total, event) => total + event.deltaCents, 0),
        ).toBe(current.amountCents);
        const error = yield* svc
          .pay({ ...input, organizationId: OTHER_ORG_ID })
          .pipe(Effect.flip);
        expect(error._tag).toBe("NotFoundError");
        expect(yield* svc.listEvents(input)).toEqual(events);
      }),
    ));
  it("creates, updates, lists, and deletes fine templates within an organization", () =>
    run(
      Effect.gen(function* () {
        yield* truncateAll;
        yield* seedFineMember;
        const svc = yield* FineService;

        const template = yield* svc.createTemplate({
          organizationId: ORG_ID,
          label: "Late to practice",
          amountCents: 500,
        });
        const updated = yield* svc.updateTemplate({
          organizationId: ORG_ID,
          id: template.id,
          label: "Late arrival",
          amountCents: 750,
        });
        const templates = yield* svc.listTemplates({ organizationId: ORG_ID });
        const otherTemplates = yield* svc.listTemplates({
          organizationId: OTHER_ORG_ID,
        });

        expect(updated.label).toBe("Late arrival");
        expect(updated.amountCents).toBe(750);
        expect(templates.map((item) => item.id)).toEqual([template.id]);
        expect(otherTemplates).toHaveLength(0);

        const deleted = yield* svc.deleteTemplate({
          organizationId: ORG_ID,
          id: template.id,
        });
        const afterDelete = yield* svc.listTemplates({
          organizationId: ORG_ID,
        });

        expect(deleted.id).toBe(template.id);
        expect(afterDelete).toHaveLength(0);
      }),
    ));

  it("issues fines from templates and records the issued event", () =>
    run(
      Effect.gen(function* () {
        yield* truncateAll;
        yield* seedFineMember;
        const svc = yield* FineService;
        const template = yield* svc.createTemplate({
          organizationId: ORG_ID,
          label: "Forgot pennies",
          amountCents: 300,
        });

        const fine = yield* svc.issue({
          organizationId: ORG_ID,
          memberId: MEMBER_ID,
          issuedByUserId: USER_ID,
          templateId: template.id,
        });
        const events = yield* svc.listEvents({
          organizationId: ORG_ID,
          id: fine.id,
        });

        expect(fine.reason).toBe("Forgot pennies");
        expect(fine.amountCents).toBe(300);
        expect(fine.originalAmountCents).toBe(300);
        expect(fine.status).toBe("unpaid");
        expect(fine.templateId).toBe(template.id);
        expect(events).toHaveLength(1);
        expect(events[0]?.kind).toBe("issued");
        expect(events[0]?.deltaCents).toBe(300);
      }),
    ));

  it("issues manual fines and requires reason plus amount when no template is provided", () =>
    run(
      Effect.gen(function* () {
        yield* truncateAll;
        yield* seedFineMember;
        const svc = yield* FineService;

        const fine = yield* svc.issue({
          organizationId: ORG_ID,
          memberId: MEMBER_ID,
          reason: "Missed lift",
          amountCents: 1_000,
        });
        const exit = yield* svc
          .issue({
            organizationId: ORG_ID,
            memberId: MEMBER_ID,
            reason: "No amount",
          })
          .pipe(Effect.exit);

        expect(fine.reason).toBe("Missed lift");
        expect(fine.amountCents).toBe(1_000);
        expect(exit._tag).toBe("Failure");
        if (exit._tag === "Failure") {
          expect(exit.cause.toString()).toContain(
            "reason and amountCents required",
          );
        }
      }),
    ));

  it("pays, forgives, and adjusts fines with audit locality", () =>
    run(
      Effect.gen(function* () {
        yield* truncateAll;
        yield* seedFineMember;
        const svc = yield* FineService;
        const fine = yield* svc.issue({
          organizationId: ORG_ID,
          memberId: MEMBER_ID,
          reason: "Gear left out",
          amountCents: 400,
        });
        const secondFine = yield* svc.issue({
          organizationId: ORG_ID,
          memberId: MEMBER_ID,
          reason: "Missed cleanup",
          amountCents: 600,
        });

        const adjusted = yield* svc.adjust({
          organizationId: ORG_ID,
          id: fine.id,
          amountCents: 450,
          actorUserId: USER_ID,
          note: "Added processing fee",
        });
        const paid = yield* svc.pay({
          organizationId: ORG_ID,
          id: fine.id,
          actorUserId: USER_ID,
        });
        const forgiven = yield* svc.forgive({
          organizationId: ORG_ID,
          id: secondFine.id,
          actorUserId: USER_ID,
          note: "Coach override",
        });
        const events = yield* svc.listEvents({
          organizationId: ORG_ID,
          id: fine.id,
        });
        const audit = yield* svc.listAudit({
          organizationId: ORG_ID,
          limit: 10,
        });

        expect(adjusted.amountCents).toBe(450);
        expect(paid.status).toBe("paid");
        expect(paid.paidAt).toBeInstanceOf(Date);
        expect(forgiven.status).toBe("forgiven");
        expect(events.map((event) => event.kind)).toContain("adjusted");
        expect(events.map((event) => event.kind)).toContain("paid");
        expect(audit).toHaveLength(5);
        expect(
          audit.every((entry) => entry.fine.organizationId === ORG_ID),
        ).toBe(true);
      }),
    ));

  it("lists member fines and members only for the requested organization", () =>
    run(
      Effect.gen(function* () {
        yield* truncateAll;
        yield* seedFineMember;
        const svc = yield* FineService;

        yield* svc.issue({
          organizationId: ORG_ID,
          memberId: MEMBER_ID,
          reason: "Club fine",
          amountCents: 200,
        });
        yield* svc.issue({
          organizationId: OTHER_ORG_ID,
          memberId: OTHER_MEMBER_ID,
          reason: "Other club fine",
          amountCents: 300,
        });

        const membersForOrg = yield* svc.listMembers({
          organizationId: ORG_ID,
        });
        const memberFines = yield* svc.listForMember({
          organizationId: ORG_ID,
          memberId: MEMBER_ID,
        });
        const orgFines = yield* svc.list({ organizationId: ORG_ID });

        expect(membersForOrg.map((member) => member.id)).toEqual([MEMBER_ID]);
        expect(memberFines.map((fine) => fine.reason)).toEqual(["Club fine"]);
        expect(orgFines.map((fine) => fine.organizationId)).toEqual([ORG_ID]);
      }),
    ));

  it("doubles overdue unpaid fines and leaves paid fines unchanged", () =>
    run(
      Effect.gen(function* () {
        yield* truncateAll;
        yield* seedFineMember;
        const svc = yield* FineService;
        const now = new Date("2026-05-15T00:00:00.000Z");
        const overdue = new Date("2026-05-01T00:00:00.000Z");
        const future = new Date("2026-05-20T00:00:00.000Z");
        const unpaid = yield* svc.issue({
          organizationId: ORG_ID,
          memberId: MEMBER_ID,
          reason: "Overdue",
          amountCents: 250,
          dueAt: overdue,
        });
        const paid = yield* svc.issue({
          organizationId: ORG_ID,
          memberId: MEMBER_ID,
          reason: "Paid overdue",
          amountCents: 350,
          dueAt: overdue,
        });
        const notDue = yield* svc.issue({
          organizationId: ORG_ID,
          memberId: MEMBER_ID,
          reason: "Not due",
          amountCents: 450,
          dueAt: future,
        });
        yield* svc.pay({ organizationId: ORG_ID, id: paid.id });

        const result = yield* svc.applyDoublings({ now });
        const doubled = yield* svc.get({
          organizationId: ORG_ID,
          id: unpaid.id,
        });
        const stillPaid = yield* svc.get({
          organizationId: ORG_ID,
          id: paid.id,
        });
        const stillFuture = yield* svc.get({
          organizationId: ORG_ID,
          id: notDue.id,
        });
        const events = yield* svc.listEvents({
          organizationId: ORG_ID,
          id: unpaid.id,
        });

        expect(result.doubled).toBe(1);
        expect(doubled.amountCents).toBe(500);
        expect(stillPaid.amountCents).toBe(350);
        expect(stillFuture.amountCents).toBe(450);
        expect(events.map((event) => event.kind)).toContain("doubled");
      }),
    ));

  it("returns NotFoundError for fines outside the organization seam", () =>
    run(
      Effect.gen(function* () {
        yield* truncateAll;
        yield* seedFineMember;
        const svc = yield* FineService;
        const fine = yield* svc.issue({
          organizationId: ORG_ID,
          memberId: MEMBER_ID,
          reason: "Scoped fine",
          amountCents: 200,
        });

        const exit = yield* svc
          .get({ organizationId: OTHER_ORG_ID, id: fine.id })
          .pipe(Effect.exit);

        expect(exit._tag).toBe("Failure");
        if (exit._tag === "Failure") {
          expect(exit.cause.toString()).toContain("NotFoundError");
        }
      }),
    ));
});
