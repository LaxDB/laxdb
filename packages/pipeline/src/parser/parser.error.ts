import { Schema, Effect } from "effect";

export class ParserError extends Schema.TaggedError<ParserError>()(
  "ParserError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
    code: Schema.optional(Schema.Number).pipe(
      Schema.withDecodingDefault(Effect.succeed(422)),
    ),
  },
) {}

export class SelectorError extends Schema.TaggedError<SelectorError>()(
  "SelectorError",
  {
    message: Schema.String,
    selector: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
    code: Schema.optional(Schema.Number).pipe(
      Schema.withDecodingDefault(Effect.succeed(400)),
    ),
  },
) {}
