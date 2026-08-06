import { Schema } from "effect";

export class CliInputError extends Schema.TaggedErrorClass<CliInputError>()(
  "CliInputError",
  {
    source: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}
