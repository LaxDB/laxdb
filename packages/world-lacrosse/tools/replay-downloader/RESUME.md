# World Lacrosse replay downloader — resume notes

## Goal

Maintain a repeatable, package-local workflow that:

1. Opens a World Lacrosse event page in the user's authenticated Chrome session.
2. Finds every item currently labelled **REPLAY**.
3. Captures each replay's HLS master-playlist URL from the authenticated GraphQL playback response.
4. Saves those URLs to the tracked replay manifest.
5. Eventually downloads selected games with `ffmpeg` for computer-vision experiments.

Use this only for footage the user is permitted to save, and respect the site's terms.

## Target collection

- Event page: <https://tv.worldlacrosse.sport/sportitemset/6a428b4e3f2b0b4028c73f62>
- Event: 2026 World Lacrosse Women’s Championship
- Last local scan: 18 replay pages, 18 HLS master URLs captured and validated

## Manifest and downloaded media

This private repository intentionally versions the direct playback URLs needed by the downloader:

- `tools/replay-downloader/replays.json` — tracked complete stream manifest, including playback URLs
- `tools/replay-downloader/replays.example.json` — tracked manifest template
- `downloads/replays/` — local downloaded video; the entire `downloads/` directory remains gitignored

Repository access therefore includes access to the captured playback URLs. Downloaded video remains local and must not be committed.

## Proven extraction method

The site uses Apollo GraphQL and a Bitmovin player. The rendered `<video>` has a `blob:` URL, so DOM inspection is not sufficient.

The reliable source is the authenticated GraphQL operation:

```text
generateSportItemMediaPlaybackUrl
```

Its response contains the direct HLS master URL at:

```text
data.generateSportItemMediaPlaybackUrl.url
```

For each replay page, the collector should:

1. Start waiting for a GraphQL response whose request body contains `generateSportItemMediaPlaybackUrl`.
2. Navigate to the replay page.
3. Read the URL from the response JSON.
4. Record it in the tracked `replays.json`.
5. Immediately pause the video to avoid unnecessary resource use.

This was more reliable than polling browser performance resources for `.m3u8` requests.

## Proven download method

The master playlists provide multiple HLS variants. During testing, the best variant was typically 1920×1080 at 50 fps with H.264 video and AAC audio.

The downloader resolves a suitable variant and performs a stream copy with `ffmpeg` rather than re-encoding:

```bash
python3 download-replays.py --quality 1080 --limit 1 --download
```

One test game was successfully downloaded and verified:

- Resolution: 1920×1080
- Frame rate: 50 fps
- Video/audio: H.264 + AAC
- Duration: 1:42:30
- Size: 4.2 GB

The file remains under package-local, gitignored `downloads/replays/`.

## Important discovery: playlists may not equal game clips

Two replay pages mapped to the same master playlist, and one replay showed a player duration of approximately 4h45m. A playlist may represent a longer broadcast block rather than one isolated game.

Before batch downloading, investigate:

- whether adjacent replay pages share a broadcast recording,
- whether clip start/end metadata exists in GraphQL responses or player configuration,
- whether the eventual CV pipeline should accept full broadcast blocks or trim them first.

## Why downloading is backlogged

Actual batch downloading is intentionally paused because it consumes substantial network bandwidth, disk space, CPU, and time. A normal 1080p50 game was about 4.2 GB; a full event could require 75 GB or more, and long broadcast blocks could be larger.

Before resuming downloads:

- calculate expected size from HLS duration and average bandwidth,
- print the total expected storage for the selected batch,
- require explicit confirmation,
- download sequentially rather than concurrently,
- consider another machine, storage volume, or overnight execution.

Do not run the downloader merely to continue collecting or validating URLs.

## Package files

- `collect-replays.js` — Playwriter collector
- `download-replays.py` — local downloader with quality selection, dry run, filtering, disk guard, and completed-file skipping
- `world-lacrosse.sh` — collector wrapper
- `replays.example.json` — manifest template
- `replays.json` — tracked complete manifest with playback URLs
- `README.md` — usage

## Resume checkpoint

When resuming:

1. Read this file.
2. Confirm the tracked `replays.json` still contains the expected replay entries.
3. Do not start downloads automatically.
4. If new replays exist, collect only their GraphQL playback URLs and pause playback immediately.
5. Investigate clip boundaries before planning a batch download.
