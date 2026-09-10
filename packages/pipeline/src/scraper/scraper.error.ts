import { Schema, Effect } from "effect";

export class ScraperError extends Schema.TaggedError<ScraperError>()(
  "ScraperError",
  {
    message: Schema.String,
    url: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
    code: Schema.optional(Schema.Number).pipe(
      Schema.withDecodingDefault(Effect.succeed(500)),
    ),
  },
) {}

export class ScraperHttpError extends Schema.TaggedError<ScraperHttpError>()(
  "ScraperHttpError",
  {
    message: Schema.String,
    url: Schema.String,
    statusCode: Schema.Number,
    cause: Schema.optional(Schema.Unknown),
    code: Schema.optional(Schema.Number).pipe(
      Schema.withDecodingDefault(Effect.succeed(502)),
    ),
  },
) {}

export class ScraperTimeoutError extends Schema.TaggedError<ScraperTimeoutError>()(
  "ScraperTimeoutError",
  {
    message: Schema.String,
    url: Schema.String,
    timeoutMs: Schema.Number,
    cause: Schema.optional(Schema.Unknown),
    code: Schema.optional(Schema.Number).pipe(
      Schema.withDecodingDefault(Effect.succeed(408)),
    ),
  },
) {}

export class ScraperRateLimitError extends Schema.TaggedError<ScraperRateLimitError>()(
  "ScraperRateLimitError",
  {
    message: Schema.String,
    url: Schema.String,
    retryAfterMs: Schema.optional(Schema.Number),
    cause: Schema.optional(Schema.Unknown),
    code: Schema.optional(Schema.Number).pipe(
      Schema.withDecodingDefault(Effect.succeed(429)),
    ),
  },
) {}

export class ScraperNetworkError extends Schema.TaggedError<ScraperNetworkError>()(
  "ScraperNetworkError",
  {
    message: Schema.String,
    url: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
    code: Schema.optional(Schema.Number).pipe(
      Schema.withDecodingDefault(Effect.succeed(503)),
    ),
  },
) {}
