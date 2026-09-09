import { Schema } from "effect";

export class NotFoundError extends Schema.TaggedError<NotFoundError>()(
  "NotFoundError",
  {
    domain: Schema.String,
    id: Schema.Union([Schema.Number, Schema.String]),
    message: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
    code: Schema.optional(Schema.Number),
  },
) {}

export class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  {
    domain: Schema.optional(Schema.String),
    message: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
    code: Schema.optional(Schema.Number),
  },
) {}

export class CliInputError extends Schema.TaggedError<CliInputError>()(
  "CliInputError",
  {
    source: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class DatabaseError extends Schema.TaggedError<DatabaseError>()(
  "DatabaseError",
  {
    domain: Schema.optional(Schema.String),
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
    code: Schema.optional(Schema.Number),
    sqlCode: Schema.optional(Schema.String),
  },
) {}

export class ConstraintViolationError extends Schema.TaggedError<ConstraintViolationError>()(
  "ConstraintViolationError",
  {
    constraint: Schema.String,
    code: Schema.optional(Schema.Number),
    detail: Schema.optional(Schema.String),
    message: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
    sqlCode: Schema.optional(Schema.String),
  },
) {}

export class AuthenticationError extends Schema.TaggedError<AuthenticationError>()(
  "AuthenticationError",
  {
    code: Schema.optional(Schema.Number),
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class AuthorizationError extends Schema.TaggedError<AuthorizationError>()(
  "AuthorizationError",
  {
    code: Schema.optional(Schema.Number),
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}
