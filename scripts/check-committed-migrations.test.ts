import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Run the exact CI command in a disposable local Git repository.
const workflow = await Bun.file(
  new URL("../.github/workflows/deploy.yml", import.meta.url),
).text();
const match = workflow.match(
  /      - name: Check committed migrations\n        shell: bash\n        run: \|\n((?:          .*\n)+)/u,
);
const command = match?.[1] ?? assert.fail("CI migration check not found");
const cwd = mkdtempSync(join(tmpdir(), "committed-migrations-"));
const env = {
  ...process.env,
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
};

function git(...args: string[]) {
  const result = spawnSync("git", args, { cwd, env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

function check(name: string, generator: string, expected: number) {
  writeFileSync(
    join(cwd, "packages/core/package.json"),
    JSON.stringify({ scripts: { "db:generate": generator } }),
  );
  const result = spawnSync("bash", ["-e", "-o", "pipefail", "-c", command], {
    cwd,
    env,
    encoding: "utf8",
  });
  assert.equal(
    result.status,
    expected,
    `${name}: ${result.stdout}\n${result.stderr}`,
  );
  if (expected === 1) {
    assert.match(result.stdout, /commit the generated SQL and snapshots/u);
  }
  console.log(`PASS: ${name}`);
}

try {
  mkdirSync(join(cwd, "packages/core/migrations"), { recursive: true });
  git("init", "--quiet");
  writeFileSync(join(cwd, "packages/core/migrations/0000.sql"), "SELECT 1;\n");
  git("add", ".");
  git(
    "-c",
    "user.name=CI test",
    "-c",
    "user.email=ci@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "fixture",
  );
  check(
    "clean migrations; unrelated untracked package.json ignored",
    "true",
    0,
  );
  check("changed tracked SQL", "echo 'SELECT 2;' >> migrations/0000.sql", 1);
  git("restore", "packages/core/migrations");
  check(
    "new untracked migration directory",
    "mkdir -p migrations/new && echo 'SELECT 2;' > migrations/new/migration.sql && echo '{}' > migrations/new/snapshot.json",
    1,
  );
  git("add", "packages/core/migrations");
  check("staged generated files", "true", 1);
  git("reset", "--hard", "--quiet", "HEAD");
  check("deleted tracked SQL", "unlink migrations/0000.sql", 1);
  git("restore", "packages/core/migrations");
  check("generator failure propagates", "exit 42", 42);
  renameSync(join(cwd, ".git"), join(cwd, "hidden-git"));
  check("Git status failure propagates", "true", 128);
} finally {
  rmSync(cwd, { recursive: true, force: true });
}
