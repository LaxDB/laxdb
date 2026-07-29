import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workerSource = await readFile(
  new URL(
    "../node_modules/alchemy/src/Cloudflare/Workers/Worker.ts",
    import.meta.url,
  ),
  "utf8",
);

new Bun.Transpiler({ loader: "ts" }).transformSync(workerSource);

assert.match(
  workerSource,
  /const deleteWorkerDomain = \(accountId: string, domainId: string\)/,
  "the installed Alchemy package must include verified Worker domain deletion",
);
assert.match(
  workerSource,
  /workers\.listDomains\(\{ accountId \}\)/,
  "a failed domain response must be checked against live Cloudflare state",
);
assert.match(
  workerSource,
  /domain\.id === domainId/,
  "domain absence must be verified by its Cloudflare ID",
);
assert.equal(
  [...workerSource.matchAll(/deleteWorkerDomain\(/g)].length,
  2,
  "verified deletion must cover reconciliation and Worker teardown",
);

console.log("Alchemy Worker domain deletion regression passed.");
