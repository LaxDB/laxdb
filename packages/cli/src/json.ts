import { CliInputError } from "@laxdb/core/error";
import { Effect } from "effect";

export const parseJsonValue = (value: string, flagName: string) =>
  Effect.try({
    try: (): unknown => JSON.parse(value),
    catch: (cause: unknown) =>
      new CliInputError({
        source: flagName,
        message: `Failed to parse ${flagName} JSON`,
        cause,
      }),
  });
