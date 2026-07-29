#!/usr/bin/env bash
set -euo pipefail

COLLECTION_URL="${1:-https://tv.worldlacrosse.sport/sportitemset/6a428b4e3f2b0b4028c73f62}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

SESSION_ID=""
cleanup() {
  if [[ -n "$SESSION_ID" ]]; then
    playwriter -s "$SESSION_ID" -e 'for (const page of context.pages()) { await page.evaluate(() => document.querySelectorAll("video").forEach((video) => video.pause())).catch(() => {}) }' >/dev/null 2>&1 || true
    playwriter session delete "$SESSION_ID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

SESSION_OUTPUT="$(playwriter session new)"
SESSION_ID="$(printf '%s\n' "$SESSION_OUTPUT" | sed -n 's/^Session \([0-9][0-9]*\) created.*/\1/p')"
if [[ -z "$SESSION_ID" ]]; then
  printf '%s\n' "$SESSION_OUTPUT" >&2
  echo "Could not determine Playwriter session ID" >&2
  exit 1
fi

playwriter -s "$SESSION_ID" -e "state.collectionUrl = $(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$COLLECTION_URL")"
playwriter -s "$SESSION_ID" --timeout 600000 -f "$SCRIPT_DIR/collect-replays.js"

echo
echo "Collection updated. Preview the 1080p download plan with:"
echo "  cd '$SCRIPT_DIR' && python3 download-replays.py --quality 1080"
echo
echo "Downloading is backlogged. When explicitly resumed, use:"
echo "  cd '$SCRIPT_DIR' && python3 download-replays.py --quality 1080 --download"
