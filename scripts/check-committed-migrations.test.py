"""Run the exact CI migration command in a disposable local Git repository."""

import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import textwrap

workflow = (Path(__file__).resolve().parents[1] / ".github/workflows/deploy.yml").read_text()
match = re.search(
    r"      - name: Check committed migrations\n        shell: bash\n        run: \|\n"
    r"((?:          .*\n)+)",
    workflow,
)
assert match, "CI migration check not found"
command = textwrap.dedent(match[1])
env = {**os.environ, "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": "/dev/null"}

with tempfile.TemporaryDirectory(prefix="committed-migrations-") as directory:
    root = Path(directory)
    core = root / "packages/core"
    migrations = core / "migrations"
    migrations.mkdir(parents=True)

    def git(*args):
        subprocess.run(["git", *args], cwd=root, env=env, check=True, capture_output=True)

    def check(name, generator, expected):
        (core / "package.json").write_text(json.dumps({"scripts": {"db:generate": generator}}))
        result = subprocess.run(
            ["bash", "-e", "-o", "pipefail", "-c", command],
            cwd=root, env=env, capture_output=True, text=True,
        )
        assert result.returncode == expected, f"{name}: {result.stdout}\n{result.stderr}"
        if expected == 1:
            assert "commit the generated SQL and snapshots" in result.stdout
        print(f"PASS: {name}")

    git("init", "--quiet")
    (migrations / "0000.sql").write_text("SELECT 1;\n")
    git("add", ".")
    git("-c", "user.name=CI test", "-c", "user.email=ci@example.invalid",
        "commit", "--quiet", "-m", "fixture")
    check("clean migrations; unrelated untracked package.json ignored", "true", 0)
    check("changed tracked SQL", "echo 'SELECT 2;' >> migrations/0000.sql", 1)
    git("restore", "packages/core/migrations")
    check("new untracked migration directory",
          "mkdir -p migrations/new && echo 'SELECT 2;' > migrations/new/migration.sql "
          "&& echo '{}' > migrations/new/snapshot.json", 1)
    git("add", "packages/core/migrations")
    check("staged generated files", "true", 1)
    git("reset", "--hard", "--quiet", "HEAD")
    check("deleted tracked SQL", "unlink migrations/0000.sql", 1)
    git("restore", "packages/core/migrations")
    check("generator failure propagates", "exit 42", 42)
    # Git failures must not be mistaken for a clean migration directory.
    (root / ".git").rename(root / "hidden-git")
    check("Git status failure propagates", "true", 128)
