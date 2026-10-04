/**
 * Practice CLI
 *
 * Usage:
 *   bun src/practice.ts list --pretty
 *   bun src/practice.ts get <publicId>
 *   bun src/practice.ts create --duration 120 --location "Main Field"
 *   bun src/practice.ts add-item <practiceId> --type drill --drill <drillId>
 *   bun src/practice.ts list-items <practiceId>
 *   bun src/practice.ts review <practiceId> --went-well "Good energy"
 *   bun src/practice.ts --base-url https://api.laxdb.io list
 *   LAXDB_API_URL=https://api.laxdb.io bun src/practice.ts list
 *
 * Add --pretty for formatted JSON output.
 */

import { BunRuntime, BunServices } from "@effect/platform-bun";
import { ApiClient } from "@laxdb/api/client";
import {
  CreatePracticeInput,
  PracticeEdgeInput,
  UpdatePracticeInput,
} from "@laxdb/core/practice/practice.schema";
import { Effect, Option, Schema } from "effect";
import { Argument, Command, Flag } from "effect/cli";

import { parseJsonValue } from "./json";
import { apiLayer, baseUrlFlag, output, prettyFlag, readStdin } from "./shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const decodePracticeEdges = Schema.decodeUnknownEffect(
  Schema.Array(PracticeEdgeInput),
);

// ---------------------------------------------------------------------------
// Practice CRUD
// ---------------------------------------------------------------------------

const listCommand = Command.make(
  "list",
  { pretty: prettyFlag, baseUrl: baseUrlFlag },
  ({ pretty, baseUrl }) =>
    Effect.gen(function* () {
      const client = yield* ApiClient;
      const practices = yield* client.Practices.listPractices();
      yield* output(practices, pretty);
    }).pipe(Effect.provide(apiLayer(baseUrl))),
);

const getCommand = Command.make(
  "get",
  {
    publicId: Argument.String("publicId"),
    pretty: prettyFlag,
    baseUrl: baseUrlFlag,
  },
  ({ publicId, pretty, baseUrl }) =>
    Effect.gen(function* () {
      const client = yield* ApiClient;
      const practice = yield* client.Practices.getPractice({
        payload: { publicId },
      });
      yield* output(practice, pretty);
    }).pipe(Effect.provide(apiLayer(baseUrl))),
);

const nameFlag = Flag.String("name").pipe(
  Flag.withDescription("Practice name"),
  Flag.optional,
);
const dateFlag = Flag.String("date").pipe(
  Flag.withDescription("Practice date (ISO 8601)"),
  Flag.optional,
);
const durationFlag = Flag.Int("duration").pipe(
  Flag.withDescription("Duration in minutes"),
  Flag.optional,
);
const locationFlag = Flag.String("location").pipe(
  Flag.withDescription("Field/facility name"),
  Flag.optional,
);
const statusFlag = Flag.Literals("status", [
  "draft",
  "scheduled",
  "in-progress",
  "completed",
  "cancelled",
] as const).pipe(Flag.withDescription("Practice status"), Flag.optional);
const descriptionFlag = Flag.String("description").pipe(
  Flag.withDescription("Practice description"),
  Flag.optional,
);
const notesFlag = Flag.String("notes").pipe(
  Flag.withDescription("Coach notes"),
  Flag.optional,
);

const createCommand = Command.make(
  "create",
  {
    name: nameFlag,
    date: dateFlag,
    duration: durationFlag,
    location: locationFlag,
    status: statusFlag,
    description: descriptionFlag,
    notes: notesFlag,
    pretty: prettyFlag,
    baseUrl: baseUrlFlag,
  },
  (opts) =>
    Effect.gen(function* () {
      const client = yield* ApiClient;
      const practice = yield* client.Practices.createPractice({
        payload: {
          name: Option.getOrNull(opts.name),
          date: Option.getOrNull(opts.date),
          description: Option.getOrNull(opts.description),
          notes: Option.getOrNull(opts.notes),
          durationMinutes: Option.getOrNull(opts.duration),
          location: Option.getOrNull(opts.location),
          status: Option.getOrUndefined(opts.status),
        },
      });
      yield* output(practice, opts.pretty);
    }).pipe(Effect.provide(apiLayer(opts.baseUrl))),
);

const updateCommand = Command.make(
  "update",
  {
    publicId: Argument.String("publicId"),
    name: nameFlag,
    date: dateFlag,
    duration: durationFlag,
    location: locationFlag,
    status: statusFlag,
    description: descriptionFlag,
    notes: notesFlag,
    pretty: prettyFlag,
    baseUrl: baseUrlFlag,
  },
  (opts) =>
    Effect.gen(function* () {
      const client = yield* ApiClient;
      const practice = yield* client.Practices.updatePractice({
        payload: {
          publicId: opts.publicId,
          name: Option.getOrUndefined(opts.name),
          date: Option.getOrUndefined(opts.date),
          description: Option.getOrUndefined(opts.description),
          notes: Option.getOrUndefined(opts.notes),
          durationMinutes: Option.getOrUndefined(opts.duration),
          location: Option.getOrUndefined(opts.location),
          status: Option.getOrUndefined(opts.status),
        },
      });
      yield* output(practice, opts.pretty);
    }).pipe(Effect.provide(apiLayer(opts.baseUrl))),
);

const deleteCommand = Command.make(
  "delete",
  {
    publicId: Argument.String("publicId"),
    pretty: prettyFlag,
    baseUrl: baseUrlFlag,
  },
  ({ publicId, pretty, baseUrl }) =>
    Effect.gen(function* () {
      const client = yield* ApiClient;
      const practice = yield* client.Practices.deletePractice({
        payload: { publicId },
      });
      yield* output(practice, pretty);
    }).pipe(Effect.provide(apiLayer(baseUrl))),
);

// ---------------------------------------------------------------------------
// Practice items
// ---------------------------------------------------------------------------

const addItemCommand = Command.make(
  "add-item",
  {
    practiceId: Argument.String("practiceId"),
    type: Flag.Literals("type", [
      "warmup",
      "drill",
      "cooldown",
      "water-break",
      "activity",
    ] as const).pipe(Flag.withDescription("Item type")),
    drill: Flag.String("drill").pipe(
      Flag.withDescription("Drill publicId (for type=drill)"),
      Flag.optional,
    ),
    label: Flag.String("label").pipe(
      Flag.withDescription("Label for non-drill items"),
      Flag.optional,
    ),
    duration: Flag.Int("duration").pipe(
      Flag.withDescription("Duration in minutes"),
      Flag.optional,
    ),
    itemNotes: Flag.String("notes").pipe(
      Flag.withDescription("Item notes"),
      Flag.optional,
    ),
    groups: Flag.String("groups").pipe(
      Flag.withDescription("Groups (comma-separated, e.g. attack,midfield)"),
      Flag.optional,
    ),
    order: Flag.Int("order").pipe(
      Flag.withDescription("Order index"),
      Flag.optional,
    ),
    priority: Flag.Literals("priority", [
      "required",
      "optional",
      "if-time",
    ] as const).pipe(Flag.withDescription("Item priority"), Flag.optional),
    pretty: prettyFlag,
    baseUrl: baseUrlFlag,
  },
  (opts) =>
    Effect.gen(function* () {
      const client = yield* ApiClient;
      const groupValues = Option.map(opts.groups, (csv) =>
        csv
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      );

      const item = yield* client.Practices.addPracticeItem({
        payload: {
          practicePublicId: opts.practiceId,
          type: opts.type,
          drillPublicId: Option.getOrUndefined(opts.drill),
          label: Option.getOrUndefined(opts.label),
          durationMinutes: Option.getOrUndefined(opts.duration),
          notes: Option.getOrUndefined(opts.itemNotes),
          groups: Option.getOrUndefined(groupValues),
          orderIndex: Option.getOrUndefined(opts.order),
          priority: Option.getOrUndefined(opts.priority),
        },
      });
      yield* output(item, opts.pretty);
    }).pipe(Effect.provide(apiLayer(opts.baseUrl))),
);

const updateItemCommand = Command.make(
  "update-item",
  {
    itemId: Argument.String("itemId"),
    type: Flag.Literals("type", [
      "warmup",
      "drill",
      "cooldown",
      "water-break",
      "activity",
    ] as const).pipe(Flag.withDescription("Item type"), Flag.optional),
    drill: Flag.String("drill").pipe(
      Flag.withDescription("Drill publicId"),
      Flag.optional,
    ),
    label: Flag.String("label").pipe(
      Flag.withDescription("Item label"),
      Flag.optional,
    ),
    duration: Flag.Int("duration").pipe(
      Flag.withDescription("Duration in minutes"),
      Flag.optional,
    ),
    itemNotes: Flag.String("notes").pipe(
      Flag.withDescription("Item notes"),
      Flag.optional,
    ),
    groups: Flag.String("groups").pipe(
      Flag.withDescription("Groups (comma-separated)"),
      Flag.optional,
    ),
    order: Flag.Int("order").pipe(
      Flag.withDescription("Order index"),
      Flag.optional,
    ),
    priority: Flag.Literals("priority", [
      "required",
      "optional",
      "if-time",
    ] as const).pipe(Flag.withDescription("Item priority"), Flag.optional),
    pretty: prettyFlag,
    baseUrl: baseUrlFlag,
  },
  (opts) =>
    Effect.gen(function* () {
      const client = yield* ApiClient;
      const groupValues = Option.map(opts.groups, (csv) =>
        csv
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      );

      const item = yield* client.Practices.updatePracticeItem({
        payload: {
          publicId: opts.itemId,
          type: Option.getOrUndefined(opts.type),
          drillPublicId: Option.getOrUndefined(opts.drill),
          label: Option.getOrUndefined(opts.label),
          durationMinutes: Option.getOrUndefined(opts.duration),
          notes: Option.getOrUndefined(opts.itemNotes),
          groups: Option.getOrUndefined(groupValues),
          orderIndex: Option.getOrUndefined(opts.order),
          priority: Option.getOrUndefined(opts.priority),
        },
      });
      yield* output(item, opts.pretty);
    }).pipe(Effect.provide(apiLayer(opts.baseUrl))),
);

const removeItemCommand = Command.make(
  "remove-item",
  {
    itemId: Argument.String("itemId"),
    pretty: prettyFlag,
    baseUrl: baseUrlFlag,
  },
  ({ itemId, pretty, baseUrl }) =>
    Effect.gen(function* () {
      const client = yield* ApiClient;
      const item = yield* client.Practices.removePracticeItem({
        payload: { publicId: itemId },
      });
      yield* output(item, pretty);
    }).pipe(Effect.provide(apiLayer(baseUrl))),
);

const listItemsCommand = Command.make(
  "list-items",
  {
    practiceId: Argument.String("practiceId"),
    pretty: prettyFlag,
    baseUrl: baseUrlFlag,
  },
  ({ practiceId, pretty, baseUrl }) =>
    Effect.gen(function* () {
      const client = yield* ApiClient;
      const items = yield* client.Practices.listPracticeItems({
        payload: {
          practicePublicId: practiceId,
        },
      });
      yield* output(items, pretty);
    }).pipe(Effect.provide(apiLayer(baseUrl))),
);

const reorderItemsCommand = Command.make(
  "reorder-items",
  {
    practiceId: Argument.String("practiceId"),
    order: Flag.String("order").pipe(
      Flag.withDescription("Comma-separated item publicIds in new order"),
    ),
    pretty: prettyFlag,
    baseUrl: baseUrlFlag,
  },
  (opts) =>
    Effect.gen(function* () {
      const client = yield* ApiClient;
      const orderedIds = opts.order
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const items = yield* client.Practices.reorderPracticeItems({
        payload: {
          practicePublicId: opts.practiceId,
          orderedIds,
        },
      });
      yield* output(items, opts.pretty);
    }).pipe(Effect.provide(apiLayer(opts.baseUrl))),
);

const listEdgesCommand = Command.make(
  "list-edges",
  {
    practiceId: Argument.String("practiceId"),
    pretty: prettyFlag,
    baseUrl: baseUrlFlag,
  },
  ({ practiceId, pretty, baseUrl }) =>
    Effect.gen(function* () {
      const client = yield* ApiClient;
      const edges = yield* client.Practices.listPracticeEdges({
        payload: {
          practicePublicId: practiceId,
        },
      });
      yield* output(edges, pretty);
    }).pipe(Effect.provide(apiLayer(baseUrl))),
);

const replaceEdgesCommand = Command.make(
  "replace-edges",
  {
    practiceId: Argument.String("practiceId"),
    edges: Flag.String("edges").pipe(
      Flag.withDescription(
        "JSON array of edges; falls back to stdin when omitted",
      ),
      Flag.optional,
    ),
    pretty: prettyFlag,
    baseUrl: baseUrlFlag,
  },
  (opts) =>
    Effect.gen(function* () {
      const client = yield* ApiClient;
      const rawEdges = yield* Option.match(opts.edges, {
        onNone: () => readStdin,
        onSome: (value) => parseJsonValue(value, "--edges"),
      });
      const edges = yield* decodePracticeEdges(rawEdges);
      const replaced = yield* client.Practices.replacePracticeEdges({
        payload: {
          practicePublicId: opts.practiceId,
          edges,
        },
      });
      yield* output(replaced, opts.pretty);
    }).pipe(Effect.provide(apiLayer(opts.baseUrl))),
);

// ---------------------------------------------------------------------------
// Practice review
// ---------------------------------------------------------------------------

const reviewCommand = Command.make(
  "review",
  {
    practiceId: Argument.String("practiceId"),
    wentWell: Flag.String("went-well").pipe(
      Flag.withDescription("What went well"),
      Flag.optional,
    ),
    needsImprovement: Flag.String("needs-improvement").pipe(
      Flag.withDescription("What needs improvement"),
      Flag.optional,
    ),
    reviewNotes: Flag.String("notes").pipe(
      Flag.withDescription("Review notes"),
      Flag.optional,
    ),
    pretty: prettyFlag,
    baseUrl: baseUrlFlag,
  },
  (opts) =>
    Effect.gen(function* () {
      const client = yield* ApiClient;

      // Try to get existing review first; create if not found
      const existing = yield* client.Practices.getPracticeReview({
        payload: { practicePublicId: opts.practiceId },
      }).pipe(Effect.option);

      const review = yield* Option.match(existing, {
        onNone: () =>
          client.Practices.createPracticeReview({
            payload: {
              practicePublicId: opts.practiceId,
              wentWell: Option.getOrNull(opts.wentWell),
              needsImprovement: Option.getOrNull(opts.needsImprovement),
              notes: Option.getOrNull(opts.reviewNotes),
            },
          }),
        onSome: () =>
          client.Practices.updatePracticeReview({
            payload: {
              practicePublicId: opts.practiceId,
              wentWell: Option.getOrUndefined(opts.wentWell),
              needsImprovement: Option.getOrUndefined(opts.needsImprovement),
              notes: Option.getOrUndefined(opts.reviewNotes),
            },
          }),
      });

      yield* output(review, opts.pretty);
    }).pipe(Effect.provide(apiLayer(opts.baseUrl))),
);

const getReviewCommand = Command.make(
  "get-review",
  {
    practiceId: Argument.String("practiceId"),
    pretty: prettyFlag,
    baseUrl: baseUrlFlag,
  },
  ({ practiceId, pretty, baseUrl }) =>
    Effect.gen(function* () {
      const client = yield* ApiClient;
      const review = yield* client.Practices.getPracticeReview({
        payload: {
          practicePublicId: practiceId,
        },
      });
      yield* output(review, pretty);
    }).pipe(Effect.provide(apiLayer(baseUrl))),
);

// ---------------------------------------------------------------------------
// Bulk subcommands
// ---------------------------------------------------------------------------

const bulkCreateCommand = Command.make(
  "bulk-create",
  { pretty: prettyFlag, baseUrl: baseUrlFlag },
  ({ pretty, baseUrl }) =>
    Effect.gen(function* () {
      const client = yield* ApiClient;
      const raw = yield* readStdin;
      const items = yield* Schema.decodeUnknownEffect(
        Schema.Array(Schema.toEncoded(CreatePracticeInput)),
      )(raw);
      const results = yield* Effect.forEach(
        items,
        (item) => client.Practices.createPractice({ payload: item }),
        { concurrency: 5 },
      );
      yield* output(results, pretty);
    }).pipe(Effect.provide(apiLayer(baseUrl))),
);

const bulkUpdateCommand = Command.make(
  "bulk-update",
  { pretty: prettyFlag, baseUrl: baseUrlFlag },
  ({ pretty, baseUrl }) =>
    Effect.gen(function* () {
      const client = yield* ApiClient;
      const raw = yield* readStdin;
      const items = yield* Schema.decodeUnknownEffect(
        Schema.Array(Schema.toEncoded(UpdatePracticeInput)),
      )(raw);
      const results = yield* Effect.forEach(
        items,
        (item) => client.Practices.updatePractice({ payload: item }),
        { concurrency: 5 },
      );
      yield* output(results, pretty);
    }).pipe(Effect.provide(apiLayer(baseUrl))),
);

const bulkDeleteCommand = Command.make(
  "bulk-delete",
  { pretty: prettyFlag, baseUrl: baseUrlFlag },
  ({ pretty, baseUrl }) =>
    Effect.gen(function* () {
      const client = yield* ApiClient;
      const raw = yield* readStdin;
      const ids = yield* Schema.decodeUnknownEffect(
        Schema.Array(Schema.String),
      )(raw);
      const results = yield* Effect.forEach(
        ids,
        (publicId) =>
          client.Practices.deletePractice({ payload: { publicId } }),
        { concurrency: 5 },
      );
      yield* output(results, pretty);
    }).pipe(Effect.provide(apiLayer(baseUrl))),
);

// ---------------------------------------------------------------------------
// Root command + CLI runner
// ---------------------------------------------------------------------------

const practiceCommand = Command.make("practice").pipe(
  Command.withSubcommands([
    listCommand,
    getCommand,
    createCommand,
    updateCommand,
    deleteCommand,
    addItemCommand,
    updateItemCommand,
    removeItemCommand,
    listItemsCommand,
    reorderItemsCommand,
    listEdgesCommand,
    replaceEdgesCommand,
    reviewCommand,
    getReviewCommand,
    bulkCreateCommand,
    bulkUpdateCommand,
    bulkDeleteCommand,
  ]),
);

Command.run(practiceCommand, { version: "0.1.0" }).pipe(
  Effect.provide(BunServices.layer),
  BunRuntime.runMain,
);
