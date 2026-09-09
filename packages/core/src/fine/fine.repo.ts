import {
  batch,
  DrizzleService,
  headOrFail,
  mapBatchRow,
  query,
} from "@laxdb/core/drizzle/drizzle.service";
import { and, desc, eq, getColumns, lte, sql, type SQL } from "drizzle-orm";
import type { SQLiteUpdateSetSource } from "drizzle-orm/sqlite-core";
import { Context, Effect, Layer, Schema } from "effect";
import { nanoid } from "nanoid";

import { members, users } from "../auth/auth.sql";

import { Fine } from "./fine.schema";
import type {
  AdjustFineInput,
  ApplyFineDoublingsInput,
  CreateFineTemplateInput,
  DeleteFineTemplateInput,
  FineActionInput,
  FineByIdInput,
  IssueFineInput,
  ListAuditInput,
  MemberFinesInput,
  OrganizationScopedInput,
  UpdateFineTemplateInput,
  FineEventKind,
} from "./fine.schema";
import { fineEvents, fines, fineTemplates } from "./fine.sql";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type FineChange =
  | { readonly kind: "paid" | "forgiven" }
  | { readonly kind: "adjusted"; readonly amountCents: number }
  | { readonly kind: "doubled"; readonly dueAt: Date };

export class FineRepo extends Context.Service<FineRepo>()("FineRepo", {
  make: Effect.gen(function* () {
    const db = yield* DrizzleService;

    const fineColumns = getColumns(fines);
    const templateColumns = getColumns(fineTemplates);
    const eventColumns = getColumns(fineEvents);

    const selectFine = (input: FineByIdInput) =>
      db
        .select(fineColumns)
        .from(fines)
        .where(
          and(
            eq(fines.organizationId, input.organizationId),
            eq(fines.id, input.id),
          ),
        );

    const getFine = (input: FineByIdInput) =>
      query(selectFine(input)).pipe(Effect.flatMap(headOrFail));

    const writeFine = (
      input: FineByIdInput,
      statements: Parameters<typeof batch>[1],
    ) =>
      batch(db, [...statements, selectFine(input)]).pipe(
        Effect.flatMap((results) => headOrFail(results.at(-1) ?? [])),
        Effect.map((row) =>
          Schema.decodeUnknownSync(Fine)(mapBatchRow(fineColumns, row)),
        ),
      );

    // The audit SELECT reads the current state inside the batch. Its unique ID
    // gates the update, so a stale or repeated action cannot invent a transition.
    const fineChange = (
      input: FineActionInput,
      change: FineChange,
      at = new Date(),
    ) => {
      let set: SQLiteUpdateSetSource<typeof fines>;
      let condition: SQL | undefined = eq(fines.status, "unpaid");
      let amountCents = sql<number>`${fines.amountCents}`;
      let deltaCents = sql<number>`-${fines.amountCents}`;

      switch (change.kind) {
        case "paid":
          set = { status: "paid", paidAt: at };
          break;
        case "forgiven":
          set = { status: "forgiven" };
          break;
        case "adjusted":
          // Adjustments remain valid for settled fines, as before.
          condition = undefined;
          amountCents = sql`${change.amountCents}`;
          deltaCents = sql`${change.amountCents} - ${fines.amountCents}`;
          set = { amountCents: change.amountCents };
          break;
        case "doubled":
          condition = and(
            condition,
            eq(fines.dueAt, change.dueAt),
            lte(fines.dueAt, at),
          );
          amountCents = sql`${fines.amountCents} * 2`;
          deltaCents = sql`${fines.amountCents}`;
          set = { amountCents, dueAt: new Date(at.getTime() + WEEK_MS) };
          break;
      }

      const eventId = nanoid();
      const actorUserId = input.actorUserId ?? null;
      const note = change.kind === "paid" ? null : (input.note ?? null);
      const scope = and(
        eq(fines.organizationId, input.organizationId),
        eq(fines.id, input.id),
      );
      return [
        db
          .insert(fineEvents)
          .select(
            db
              .select({
                id: sql<string>`${eventId}`.as("id"),
                fineId: fines.id,
                kind: sql<FineEventKind>`${change.kind}`.as("kind"),
                amountCents: amountCents.as("amount_cents"),
                deltaCents: deltaCents.as("delta_cents"),
                actorUserId: sql<string | null>`${actorUserId}`.as(
                  "actor_user_id",
                ),
                note: sql<string | null>`${note}`.as("note"),
                at: sql<Date>`${at.getTime()}`.as("at"),
              })
              .from(fines)
              .where(and(scope, condition)),
          )
          .returning({ id: fineEvents.id }),
        db
          .update(fines)
          .set(set)
          .where(
            and(
              scope,
              sql`exists (select 1 from ${fineEvents} where ${fineEvents.id} = ${eventId})`,
            ),
          ),
      ];
    };

    return {
      list: (input: OrganizationScopedInput) =>
        query(
          db
            .select(fineColumns)
            .from(fines)
            .where(eq(fines.organizationId, input.organizationId))
            .orderBy(desc(fines.issuedAt)),
        ),

      listForMember: (input: MemberFinesInput) =>
        query(
          db
            .select(fineColumns)
            .from(fines)
            .where(
              and(
                eq(fines.organizationId, input.organizationId),
                eq(fines.memberId, input.memberId),
              ),
            )
            .orderBy(desc(fines.issuedAt)),
        ),

      get: getFine,

      listTemplates: (input: OrganizationScopedInput) =>
        query(
          db
            .select(templateColumns)
            .from(fineTemplates)
            .where(eq(fineTemplates.organizationId, input.organizationId)),
        ),

      createTemplate: (input: CreateFineTemplateInput) =>
        query(
          db
            .insert(fineTemplates)
            .values({
              id: nanoid(),
              organizationId: input.organizationId,
              label: input.label,
              amountCents: input.amountCents,
              createdAt: new Date(),
            })
            .returning(templateColumns),
        ).pipe(Effect.flatMap(headOrFail)),

      updateTemplate: (input: UpdateFineTemplateInput) =>
        query(
          db
            .update(fineTemplates)
            .set({
              ...(input.label !== undefined && { label: input.label }),
              ...(input.amountCents !== undefined && {
                amountCents: input.amountCents,
              }),
            })
            .where(
              and(
                eq(fineTemplates.organizationId, input.organizationId),
                eq(fineTemplates.id, input.id),
              ),
            )
            .returning(templateColumns),
        ).pipe(Effect.flatMap(headOrFail)),

      deleteTemplate: (input: DeleteFineTemplateInput) =>
        query(
          db
            .delete(fineTemplates)
            .where(
              and(
                eq(fineTemplates.organizationId, input.organizationId),
                eq(fineTemplates.id, input.id),
              ),
            )
            .returning(templateColumns),
        ).pipe(Effect.flatMap(headOrFail)),

      listMembers: (input: OrganizationScopedInput) =>
        query(
          db
            .select({
              id: members.id,
              userId: members.userId,
              role: members.role,
              name: users.name,
              email: users.email,
            })
            .from(members)
            .innerJoin(users, eq(members.userId, users.id))
            .where(eq(members.organizationId, input.organizationId)),
        ),

      issue: (input: IssueFineInput) =>
        Effect.gen(function* () {
          yield* query(
            db
              .select({ id: members.id })
              .from(members)
              .where(
                and(
                  eq(members.organizationId, input.organizationId),
                  eq(members.id, input.memberId),
                ),
              ),
          ).pipe(Effect.flatMap(headOrFail));

          const template =
            input.templateId === undefined || input.templateId === null
              ? null
              : yield* query(
                  db
                    .select(templateColumns)
                    .from(fineTemplates)
                    .where(
                      and(
                        eq(fineTemplates.organizationId, input.organizationId),
                        eq(fineTemplates.id, input.templateId),
                      ),
                    ),
                ).pipe(Effect.flatMap(headOrFail));

          const reason = input.reason ?? template?.label ?? null;
          const amountCents =
            input.amountCents ?? template?.amountCents ?? null;

          if (reason === null || amountCents === null) {
            return yield* Effect.die("missing fine amount");
          }

          const issuedAt = new Date();
          const dueAt = input.dueAt ?? new Date(issuedAt.getTime() + WEEK_MS);
          const id = nanoid();
          return yield* writeFine(
            { organizationId: input.organizationId, id },
            [
              db.insert(fines).values({
                id,
                organizationId: input.organizationId,
                memberId: input.memberId,
                templateId: input.templateId ?? null,
                reason,
                originalAmountCents: amountCents,
                amountCents,
                status: "unpaid",
                issuedAt,
                dueAt,
                paidAt: null,
                issuedByUserId: input.issuedByUserId ?? null,
              }),
              db.insert(fineEvents).values({
                id: nanoid(),
                fineId: id,
                kind: "issued",
                amountCents,
                deltaCents: amountCents,
                actorUserId: input.issuedByUserId ?? null,
                note: null,
                at: issuedAt,
              }),
            ],
          );
        }),

      pay: (input: FineActionInput) =>
        Effect.suspend(() =>
          writeFine(input, fineChange(input, { kind: "paid" })),
        ),

      forgive: (input: FineActionInput) =>
        Effect.suspend(() =>
          writeFine(input, fineChange(input, { kind: "forgiven" })),
        ),

      adjust: (input: AdjustFineInput) =>
        Effect.suspend(() =>
          writeFine(
            input,
            fineChange(input, {
              kind: "adjusted",
              amountCents: input.amountCents,
            }),
          ),
        ),

      listEvents: (input: FineByIdInput) =>
        Effect.gen(function* () {
          yield* getFine(input);
          return yield* query(
            db
              .select(eventColumns)
              .from(fineEvents)
              .where(eq(fineEvents.fineId, input.id))
              .orderBy(desc(fineEvents.at)),
          );
        }),

      listAudit: (input: ListAuditInput) =>
        query(
          db
            .select({ event: eventColumns, fine: fineColumns })
            .from(fineEvents)
            .innerJoin(fines, eq(fineEvents.fineId, fines.id))
            .where(eq(fines.organizationId, input.organizationId))
            .orderBy(desc(fineEvents.at))
            .limit(input.limit ?? 100),
        ),

      applyDoublings: (input: ApplyFineDoublingsInput) =>
        Effect.gen(function* () {
          const now = input.now ?? new Date();
          const due = yield* query(
            db
              .select(fineColumns)
              .from(fines)
              .where(and(eq(fines.status, "unpaid"), lte(fines.dueAt, now))),
          );

          if (due.length === 0) return { doubled: 0 };

          const results = yield* batch(
            db,
            due.flatMap((fine) =>
              fineChange(fine, { kind: "doubled", dueAt: fine.dueAt }, now),
            ),
          );

          return {
            doubled: results.reduce(
              (count, rows, index) =>
                count + (index % 2 === 0 ? rows.length : 0),
              0,
            ),
          };
        }),
    };
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);
}
