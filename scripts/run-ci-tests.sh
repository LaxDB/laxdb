#!/usr/bin/env bash
set -euo pipefail

output="$(mktemp)"
trap 'rm -f "$output"' EXIT

run_quietly() {
  if "$@" >"$output" 2>&1; then
    return
  fi

  cat "$output"
  return 1
}

run_quietly bun run test --reporter=minimal
run_quietly bun run test:integration --reporter=minimal
