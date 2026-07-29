#!/usr/bin/env python3
import argparse
import json
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path


def safe_name(value: str) -> str:
    value = value.replace("|", "-").replace("/", "-").replace(":", "-")
    value = re.sub(r"[^\w\-. ()’'-]+", "", value, flags=re.UNICODE)
    return re.sub(r"\s+", " ", value).strip(" .")


def variants(master_url: str) -> list[dict[str, object]]:
    request = urllib.request.Request(master_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        lines = response.read().decode("utf-8").splitlines()
    found: list[dict[str, object]] = []
    for index, line in enumerate(lines):
        if not line.startswith("#EXT-X-STREAM-INF:") or index + 1 >= len(lines):
            continue
        attributes = dict(re.findall(r'([A-Z-]+)=("[^"]*"|[^,]*)', line))
        resolution = attributes.get("RESOLUTION", "0x0").strip('"').split("x")
        width, height = (int(resolution[0]), int(resolution[1])) if len(resolution) == 2 else (0, 0)
        bandwidth = int(attributes.get("AVERAGE-BANDWIDTH", attributes.get("BANDWIDTH", "0")))
        frame_rate = float(attributes.get("FRAME-RATE", "0"))
        found.append({
            "url": urllib.parse.urljoin(master_url, lines[index + 1].strip()),
            "width": width,
            "height": height,
            "bandwidth": bandwidth,
            "frameRate": frame_rate,
        })
    return found


def choose_variant(master_url: str, quality: int) -> dict[str, object]:
    choices = variants(master_url)
    eligible = [item for item in choices if int(item["height"]) <= quality and int(item["height"]) > 0]
    if not eligible:
        eligible = [item for item in choices if int(item["height"]) > 0]
    if not eligible:
        raise RuntimeError("No video variants found in master playlist")
    return max(eligible, key=lambda item: (int(item["height"]), float(item["frameRate"]), int(item["bandwidth"])))


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    package_dir = script_dir.parents[1]
    parser = argparse.ArgumentParser(description="Download World Lacrosse replay streams listed in replays.json")
    parser.add_argument("--manifest", type=Path, default=script_dir / "replays.json")
    parser.add_argument("--output", type=Path, default=package_dir / "downloads" / "replays")
    parser.add_argument("--quality", type=int, choices=(360, 480, 720, 1080), default=1080)
    parser.add_argument("--limit", type=int, help="Only process the first N pending games")
    parser.add_argument("--match", help="Only process games whose title contains this text")
    parser.add_argument("--download", action="store_true", help="Actually download; without this flag, only print the plan")
    args = parser.parse_args()

    if not args.manifest.exists():
        print(f"Manifest not found: {args.manifest}", file=sys.stderr)
        return 1
    if args.download and shutil.which("ffmpeg") is None:
        print("ffmpeg is not installed", file=sys.stderr)
        return 1

    data = json.loads(args.manifest.read_text())
    replays = [item for item in data.get("replays", []) if item.get("masterUrl")]
    if args.match:
        replays = [item for item in replays if args.match.casefold() in item.get("title", "").casefold()]

    args.output.mkdir(parents=True, exist_ok=True)
    pending = []
    for replay in replays:
        filename = safe_name(f"{replay.get('date', '')} - {replay['title']} - {replay['id']}.mp4")
        output = args.output / filename
        if output.exists():
            print(f"SKIP existing: {output.name}")
            continue
        pending.append((replay, output))
    if args.limit is not None:
        pending = pending[: args.limit]

    print(f"Pending: {len(pending)} game(s), quality: up to {args.quality}p, output: {args.output}")
    for number, (replay, output) in enumerate(pending, start=1):
        try:
            variant = choose_variant(replay["masterUrl"], args.quality)
        except Exception as error:
            print(f"ERROR playlist for {replay['title']}: {error}", file=sys.stderr)
            continue
        print(f"[{number}/{len(pending)}] {replay['title']} -> {variant['width']}x{variant['height']} {variant['frameRate']}fps")
        if not args.download:
            continue

        free_bytes = shutil.disk_usage(args.output).free
        if free_bytes < 6 * 1024**3:
            print("STOP: less than 6 GiB free disk space", file=sys.stderr)
            return 2
        partial = output.with_suffix(".part.mp4")
        if partial.exists():
            stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            partial.rename(partial.with_name(f"{partial.stem}-{stamp}{partial.suffix}"))
        command = [
            "ffmpeg", "-hide_banner", "-loglevel", "warning", "-stats", "-y",
            "-i", str(variant["url"]), "-c", "copy", "-bsf:a", "aac_adtstoasc",
            "-movflags", "+faststart", str(partial),
        ]
        result = subprocess.run(command)
        if result.returncode != 0:
            print(f"FAILED: {replay['title']}", file=sys.stderr)
            continue
        partial.rename(output)
        print(f"SAVED: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
