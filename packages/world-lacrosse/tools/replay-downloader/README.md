# World Lacrosse replay downloader

Collect replay pages from a World Lacrosse event page with your authenticated Chrome tab, then download their HLS streams with `ffmpeg`.

Use this only for video you are permitted to save, and respect the site's terms.

## Requirements

- Chrome with the Playwriter extension enabled on one tab
- `playwriter` CLI
- Python 3
- `ffmpeg`

## 1. Refresh the replay manifest

```bash
cd packages/world-lacrosse/tools/replay-downloader
./world-lacrosse.sh 'https://tv.worldlacrosse.sport/sportitemset/6a428b4e3f2b0b4028c73f62'
```

This revisits every item marked **REPLAY**, captures its HLS master playlist, and updates the tracked `replays.json`. Re-running it adds new replays and refreshes existing entries.

This private repository intentionally tracks the complete manifest, including playback URLs, so the downloader works immediately after cloning. `replays.example.json` remains a template showing the manifest structure. Downloaded media stays gitignored and must not be committed.

## 2. Preview downloads

```bash
python3 download-replays.py --quality 1080
```

## 3. Download (backlogged)

Batch downloading is intentionally paused because of its network, storage, and CPU cost. When explicitly resumed, all pending games can be downloaded with:

```bash
python3 download-replays.py --quality 1080 --download
```

One game as a test:

```bash
python3 download-replays.py --quality 1080 --limit 1 --download
```

Only matching titles:

```bash
python3 download-replays.py --quality 1080 --match 'USA' --download
```

Files go to `packages/world-lacrosse/downloads/replays/`. The package-local `downloads/` directory is gitignored so videos cannot be committed accidentally. Existing completed files are skipped. An interrupted `.part.mp4` is preserved with a timestamp before the next attempt.

At 1080p50, allow roughly 4–5 GB per game. The downloader stops before starting another game if less than 6 GiB remains.
