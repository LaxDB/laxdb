import { Schema } from "effect";

export class FetchError extends Schema.TaggedErrorClass<FetchError>()(
  "FetchError",
  {
    url: Schema.String,
    message: Schema.String,
    status: Schema.optional(Schema.Number),
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class ScrapeError extends Schema.TaggedErrorClass<ScrapeError>()(
  "ScrapeError",
  {
    url: Schema.String,
    message: Schema.String,
  },
) {}

export class SyncStorageError extends Schema.TaggedErrorClass<SyncStorageError>()(
  "SyncStorageError",
  {
    path: Schema.String,
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export type WorldLacrosseError = FetchError | ScrapeError | SyncStorageError;
