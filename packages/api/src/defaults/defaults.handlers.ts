import { DefaultsService } from "@laxdb/core/defaults/defaults.service";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { LaxdbApi } from "../definition";

export const DefaultsHandlers = HttpApiBuilder.group(
  LaxdbApi,
  "Defaults",
  (handlers) =>
    Effect.gen(function* () {
      const service = yield* DefaultsService;

      return handlers
        .handle("getNamespace", ({ payload }) => service.getNamespace(payload))
        .handle("patchNamespace", ({ payload }) =>
          service.patchNamespace(payload),
        );
    }),
);
