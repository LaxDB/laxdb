const EXCLUDED_TEST_PACKAGES = new Set(["@laxdb/pipeline"]);
const SERIAL_TEST_PACKAGES = new Set(["@laxdb/core"]);
const IS_CI = Boolean(process.env.CI);
const CI_TEST_ARGS = IS_CI ? ["--reporter=minimal"] : [];

async function discoverTestPackages() {
  const packageJsonGlob = new Bun.Glob("packages/*/package.json");
  const packages = [];

  for await (const packageJsonPath of packageJsonGlob.scan({ cwd: Bun.cwd })) {
    const packageJson = await Bun.file(packageJsonPath).json();
    const testScript = packageJson.scripts?.test;

    if (typeof testScript !== "string") continue;

    const name =
      typeof packageJson.name === "string"
        ? packageJson.name
        : packageJsonPath.split("/").at(-2);
    const script =
      typeof packageJson.scripts?.["test:run"] === "string"
        ? "test:run"
        : "test";

    if (EXCLUDED_TEST_PACKAGES.has(name)) continue;

    packages.push({
      name,
      dir: packageJsonPath.replace(/\/package\.json$/u, ""),
      script,
    });
  }

  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

async function runPackageTest(pkg) {
  if (!IS_CI) {
    console.log(`\n=== ${pkg.name}: test ===`);
  }

  try {
    const subprocess = Bun.spawn(["bun", "run", pkg.script, ...CI_TEST_ARGS], {
      cwd: pkg.dir,
      stdin: "inherit",
      stdout: IS_CI ? "pipe" : "inherit",
      stderr: IS_CI ? "pipe" : "inherit",
    });
    const [code, stdout, stderr] = await Promise.all([
      subprocess.exited,
      IS_CI ? new Response(subprocess.stdout).text() : "",
      IS_CI ? new Response(subprocess.stderr).text() : "",
    ]);

    return { pkg, code, error: null, stdout, stderr };
  } catch (error) {
    return { pkg, code: 1, error, stdout: "", stderr: "" };
  }
}

const packages = await discoverTestPackages();
const serialPackages = packages.filter((pkg) =>
  SERIAL_TEST_PACKAGES.has(pkg.name),
);
const parallelPackages = packages.filter(
  (pkg) => !SERIAL_TEST_PACKAGES.has(pkg.name),
);

if (packages.length === 0) {
  console.log("No workspace test scripts found.");
  process.exit(0);
}

if (!IS_CI) {
  console.log(
    `Discovered ${packages.length} workspace test package${packages.length === 1 ? "" : "s"}.`,
  );

  if (parallelPackages.length > 0) {
    console.log(
      `Running in parallel: ${parallelPackages.map((pkg) => pkg.name).join(", ")}`,
    );
  }

  if (serialPackages.length > 0) {
    console.log(
      `Running serially (shared DB state): ${serialPackages
        .map((pkg) => pkg.name)
        .join(", ")}`,
    );
  }
}

const failures = [];
const parallelResultsPromise = Promise.all(
  parallelPackages.map(runPackageTest),
);

for (const pkg of serialPackages) {
  const result = await runPackageTest(pkg);
  if (result.code !== 0) {
    failures.push(result);
  }
}

const parallelResults = await parallelResultsPromise;
for (const result of parallelResults) {
  if (result.code !== 0) {
    failures.push(result);
  }
}

if (failures.length > 0) {
  console.error("\nWorkspace test failures:");
  for (const failure of failures) {
    console.error(`- ${failure.pkg.name}`);
    if (failure.stdout) {
      process.stdout.write(failure.stdout);
    }
    if (failure.stderr) {
      process.stderr.write(failure.stderr);
    }
    if (failure.error) {
      console.error(`  ${String(failure.error)}`);
    }
  }
  process.exit(1);
}

if (!IS_CI) {
  console.log("\nAll workspace tests passed.");
}
