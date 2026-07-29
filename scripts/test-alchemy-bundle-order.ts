import assert from "node:assert/strict";

import { bundleOutputFromRolldownOutputBundle } from "alchemy/Bundle";
import * as Effect from "effect/Effect";
import { rolldown, type OutputBundle } from "rolldown";

const build = await rolldown({
  input: "virtual:server-entry",
  plugins: [
    {
      name: "asset-first-bundle-fixture",
      resolveId(id) {
        return id === "virtual:server-entry" ? id : null;
      },
      load(id) {
        return id === "virtual:server-entry" ? "export default {};" : null;
      },
      buildStart() {
        this.emitFile({
          type: "asset",
          name: "site.css",
          source: "body {}",
        });
      },
    },
  ],
});
const generated = await build.generate({ format: "es" });
await build.close();

const asset = generated.output.find((file) => file.type === "asset");
const entry = generated.output.find(
  (file) => file.type === "chunk" && file.isEntry,
);
assert(asset !== undefined, "fixture must emit an asset");
assert(entry !== undefined, "fixture must emit an entry chunk");

const assetFirstBundle = Object.fromEntries([
  [asset.fileName, asset],
  [entry.fileName, entry],
]) satisfies OutputBundle;
const output = await Effect.runPromise(
  bundleOutputFromRolldownOutputBundle(assetFirstBundle),
);

assert.deepEqual(
  output.files.map((file) => file.path),
  [entry.fileName, asset.fileName],
  "the entry chunk must be first even when Rolldown emits an asset first",
);

console.log("Alchemy asset-first bundle ordering regression passed.");
