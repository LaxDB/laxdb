import assert from "node:assert/strict";

import { BunRuntime, BunServices } from "@effect/platform-bun";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Stream from "effect/Stream";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const workflow = yield* fs.readFileString(
    path.join(import.meta.dirname, "../.github/workflows/deploy.yml"),
  );
  const match = workflow.match(
    /      - name: Check committed migrations\n        shell: bash\n        run: \|\n((?:          .*\n)+)/u,
  );
  const command = match?.[1] ?? assert.fail("CI migration check not found");
  // Scope owns the fixture and removes it even when a check fails.
  const cwd = yield* fs.makeTempDirectoryScoped({
    prefix: "committed-migrations-",
  });
  const core = path.join(cwd, "packages/core");
  const migrations = path.join(core, "migrations");

  const run = Effect.fn("run")(function* (binary: string, args: string[]) {
    const child = yield* spawner.spawn(
      ChildProcess.make(binary, args, {
        cwd,
        env: { GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" },
        extendEnv: true,
      }),
    );
    return yield* Effect.all(
      {
        code: child.exitCode,
        output: child.all.pipe(Stream.decodeText(), Stream.mkString),
      },
      { concurrency: "unbounded" },
    );
  }, Effect.scoped);

  const git = Effect.fn("git")(function* (...args: string[]) {
    const result = yield* run("git", args);
    assert.equal(result.code, 0, result.output);
  });

  const check = Effect.fn("check")(function* (
    name: string,
    generator: string,
    expected: number,
  ) {
    yield* fs.writeFileString(
      path.join(core, "package.json"),
      JSON.stringify({ scripts: { "db:generate": generator } }),
    );
    const result = yield* run("bash", ["-e", "-o", "pipefail", "-c", command]);
    assert.equal(result.code, expected, `${name}: ${result.output}`);
    if (expected === 1) {
      assert.match(result.output, /commit the generated SQL and snapshots/u);
    }
    yield* Effect.log(`PASS: ${name}`);
  });

  yield* fs.makeDirectory(migrations, { recursive: true });
  yield* git("init", "--quiet");
  yield* fs.writeFileString(path.join(migrations, "0000.sql"), "SELECT 1;\n");
  yield* git("add", ".");
  yield* git(
    "-c",
    "user.name=CI test",
    "-c",
    "user.email=ci@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "fixture",
  );
  yield* check(
    "clean migrations; unrelated untracked package.json ignored",
    "true",
    0,
  );
  yield* check(
    "changed tracked SQL",
    "echo 'SELECT 2;' >> migrations/0000.sql",
    1,
  );
  yield* git("restore", "packages/core/migrations");
  yield* check(
    "new untracked migration directory",
    "mkdir -p migrations/new && echo 'SELECT 2;' > migrations/new/migration.sql && echo '{}' > migrations/new/snapshot.json",
    1,
  );
  yield* git("add", "packages/core/migrations");
  yield* check("staged generated files", "true", 1);
  yield* git("reset", "--hard", "--quiet", "HEAD");
  yield* check("deleted tracked SQL", "unlink migrations/0000.sql", 1);
  yield* git("restore", "packages/core/migrations");
  yield* check("generator failure propagates", "exit 42", 42);
  yield* fs.rename(path.join(cwd, ".git"), path.join(cwd, "hidden-git"));
  yield* check("Git status failure propagates", "true", 128);
});

main.pipe(Effect.scoped, Effect.provide(BunServices.layer), BunRuntime.runMain);
