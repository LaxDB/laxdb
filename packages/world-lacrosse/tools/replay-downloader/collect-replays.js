const fs = require("node:fs");
const path = require("node:path");

const collectionUrl = state.collectionUrl;
if (
  typeof collectionUrl !== "string" ||
  !collectionUrl.startsWith("https://tv.worldlacrosse.sport/sportitemset/")
) {
  throw new Error(
    "Set state.collectionUrl to a World Lacrosse sportitemset URL first",
  );
}

state.page = context.pages()[0];
if (!state.page || state.page.isClosed())
  throw new Error("No Playwriter-enabled tab found");

await state.page.goto(collectionUrl, {
  waitUntil: "domcontentloaded",
  timeout: 30000,
});
await waitForPageLoad({ page: state.page, timeout: 10000 });
console.log("Collection:", state.page.url());
const collectionLogs = await getLatestLogs({
  page: state.page,
  sinceLastCall: true,
});
console.log(`Collection page log entries: ${collectionLogs.length}`);

const replayLinks = await state.page.locator("a").evaluateAll((anchors) =>
  anchors
    .map((anchor) => ({
      text: (anchor.innerText ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      url: anchor.href,
    }))
    .filter(
      (item) => item.text[0] === "REPLAY" && item.url.includes("/sportitem/"),
    ),
);

const uniqueLinks = Array.from(
  new Map(replayLinks.map((item) => [item.url, item])).values(),
);
console.log(`Found ${uniqueLinks.length} replay(s)`);

const collected = [];
for (let index = 0; index < uniqueLinks.length; index += 1) {
  const replay = uniqueLinks[index];
  const responsePromise = state.page
    .waitForResponse(
      (response) =>
        response.url().includes("/graphql") &&
        (response.request().postData() ?? "").includes(
          "generateSportItemMediaPlaybackUrl",
        ),
      { timeout: 30000 },
    )
    .catch(() => null);

  await state.page.goto(replay.url, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await waitForPageLoad({ page: state.page, timeout: 8000 });
  const response = await responsePromise;
  const playback = response ? await response.json().catch(() => null) : null;
  const playbackUrl = playback?.data?.generateSportItemMediaPlaybackUrl?.url;
  const master =
    typeof playbackUrl === "string" && playbackUrl.includes(".m3u8")
      ? playbackUrl
      : null;
  const durationSeconds = await state.page
    .locator("video")
    .first()
    .evaluate((video) =>
      Number.isFinite(video.duration) ? video.duration : null,
    )
    .catch(() => null);
  await state.page.evaluate(() => {
    document.querySelectorAll("video").forEach((video) => {
      video.pause();
    });
  });

  const id = replay.url.split("/").filter(Boolean).at(-1);
  const [
    status = "REPLAY",
    date = "unknown-date",
    title = id,
    competition = "",
  ] = replay.text;
  collected.push({
    id,
    status,
    date,
    title,
    competition,
    pageUrl: replay.url,
    masterUrl: master,
    durationSeconds,
  });
  console.log(
    `[${index + 1}/${uniqueLinks.length}] ${title}: ${master ? "stream found" : "NO STREAM"}`,
  );
  const pageLogs = await getLatestLogs({
    page: state.page,
    sinceLastCall: true,
  });
  console.log(`Page log entries: ${pageLogs.length}`);
}

const manifestPath = path.resolve(process.cwd(), "replays.json");
let previous = [];
if (fs.existsSync(manifestPath)) {
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (Array.isArray(parsed.replays)) previous = parsed.replays;
  } catch {}
}
const mergedById = new Map(previous.map((item) => [item.id, item]));
for (const item of collected) {
  const existing = mergedById.get(item.id);
  mergedById.set(item.id, {
    ...existing,
    ...item,
    masterUrl: item.masterUrl ?? existing?.masterUrl ?? null,
    durationSeconds: item.durationSeconds ?? existing?.durationSeconds ?? null,
  });
}
const merged = Array.from(mergedById.values());
const manifest = {
  collectionUrl,
  updatedAt: new Date().toISOString(),
  replays: merged,
};
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Saved ${merged.length} replay(s) to ${manifestPath}`);
state.page.removeAllListeners();
