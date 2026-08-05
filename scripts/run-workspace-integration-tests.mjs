const EXCLUDED_TEST_PACKAGES = new Set(["@laxdb/pipeline"]);
const IS_CI = Boolean(process.env.CI);
const CI_TEST_ARGS = IS_CI ? ["--reporter=minimal"] : [];

async function discoverIntegrationPackages() {
  const packageJsonGlob = new Bun.Glob("packages/*/package.json");
  const packages = [];

  for await (const packageJsonPath of packageJsonGlob.scan({ cwd: Bun.cwd })) {
    const packageJson = await Bun.file(packageJsonPath).json();

    if (typeof packageJson.scripts?.["test:integration"] !== "string") {
      continue;
    }

    const name =
      typeof packageJson.name === "string"
        ? packageJson.name
        : packageJsonPath.split("/").at(-2);

    if (EXCLUDED_TEST_PACKAGES.has(name)) continue;

    packages.push({
      name,
      dir: packageJsonPath.replace(/\/package\.json$/u, ""),
    });
  }

  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

async function runPackageIntegrationTest(pkg) {
  if (!IS_CI) {
    console.log(`\n=== ${pkg.name}: test:integration ===`);
  }

  try {
    const subprocess = Bun.spawn(
      ["bun", "run", "test:integration", ...CI_TEST_ARGS],
      {
        cwd: pkg.dir,
        stdin: "inherit",
        stdout: IS_CI ? "pipe" : "inherit",
        stderr: IS_CI ? "pipe" : "inherit",
      },
    );
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

const packages = await discoverIntegrationPackages();

if (packages.length === 0) {
  console.log("No workspace integration test scripts found.");
  process.exit(0);
}

if (!IS_CI) {
  console.log(
    `Discovered ${packages.length} workspace integration test package${
      packages.length === 1 ? "" : "s"
    }.`,
  );
  console.log(
    `Running serially (shared DB state): ${packages.map((pkg) => pkg.name).join(", ")}`,
  );
}

const failures = [];

for (const pkg of packages) {
  const result = await runPackageIntegrationTest(pkg);
  if (result.code !== 0) {
    failures.push(result);
  }
}

if (failures.length > 0) {
  console.error("\nWorkspace integration test failures:");
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
  console.log("\nAll workspace integration tests passed.");
}
