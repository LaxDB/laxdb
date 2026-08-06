import { Effect } from "effect";

import { CliInputError } from "./error";

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
