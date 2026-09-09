import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { resolve } from "node:path";
import type { Plugin } from "vite";

import { syncContentAssets } from "../scripts/sync-content-assets.ts";

export function contentAssets(): Plugin {
  return {
    name: "laxdb:content-assets",
    apply: "build",
    buildApp: {
      order: "pre",
      async handler(builder) {
        // Run once before environment builds, not once per environment or config resolution.
        await syncContentAssets(
          resolve(builder.config.root, "src/content"),
          resolve(builder.config.root, "public/content-assets"),
        ).pipe(
          // oxlint-disable-next-line effecttsgo/strict-effect-provide -- This hook runs the complete asset sync program.
          Effect.provide(NodeFileSystem.layer),
          Effect.runPromise,
        );
      },
    },
  };
}
