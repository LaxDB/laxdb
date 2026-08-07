/**
 * Shared CLI utilities
 *
 * Common flags and helpers used across all CLI subcommands.
 */

import { makeApiClientLayer } from "@laxdb/api/client";
import { CliInputError } from "@laxdb/core/error";
import { Effect, Layer } from "effect";
import { Flag } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";

export const prettyFlag = Flag.boolean("pretty").pipe(
  Flag.withDescription("Pretty-print JSON output"),
  Flag.withDefault(false),
);

export const baseUrlFlag = Flag.string("base-url").pipe(
  Flag.withDescription("API base URL"),
  Flag.withDefault(process.env.LAXDB_API_URL ?? "http://localhost:1437"),
);

export const output = (data: unknown, pretty: boolean) =>
  Effect.sync(() => {
    console.log(pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data));
  });

export const readStdin: Effect.Effect<unknown, CliInputError> =
  Effect.tryPromise({
    try: () => Bun.stdin.text().then((text): unknown => JSON.parse(text)),
    catch: (cause: unknown) =>
      new CliInputError({
        source: "stdin",
        message: "Failed to read JSON from stdin",
        cause,
      }),
  });

export const apiLayer = (baseUrl: string) =>
  makeApiClientLayer(baseUrl).pipe(Layer.provide(FetchHttpClient.layer));
