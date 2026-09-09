import { expect, spyOn, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createBuilder } from "vite";

import { contentAssets } from "./content-assets.ts";

test.each([false, true])(
  "direct Vite builds sync assets once before parallel environments (shared config: %s)",
  async (sharedConfigBuild) => {
    const root = await mkdtemp(join(tmpdir(), "marketing content assets "));
    const log = spyOn(console, "log");
    try {
      const attachment = "attachments/nested/diagram space ü.svg";
      const body = '<svg xmlns="http://www.w3.org/2000/svg" />';
      const excluded = [
        "note.md",
        "attachments/note.MDX",
        "attachments/.hidden.svg",
        "attachments/.private/hidden.svg",
        ".obsidian/settings.json",
        "Templates/template.svg",
        "changelog/release.svg",
        "attachments/Templates/template.svg",
        "attachments/changelog/release.svg",
      ];
      for (const path of [attachment, ...excluded]) {
        const file = join(root, "src/content", path);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, body);
      }
      await writeFile(join(root, "entry.js"), 'console.log("fixture");');
      const generated = join(root, "public/content-assets");
      expect(existsSync(generated)).toBe(false);

      // Match Alchemy's builder API, without package scripts or cloud plugins.
      const builder = await createBuilder(
        {
          root,
          configFile: false,
          envDir: false,
          logLevel: "silent",
          plugins: [contentAssets()],
          environments: {
            client: { build: { outDir: "dist/client" } },
            ssr: { build: { outDir: "dist/ssr", copyPublicDir: true } },
          },
          build: { rolldownOptions: { input: join(root, "entry.js") } },
          builder: {
            sharedConfigBuild,
            async buildApp(app) {
              expect(await readFile(join(generated, attachment), "utf8")).toBe(body);
              await Promise.all(Object.values(app.environments).map((env) => app.build(env)));
            },
          },
        },
        null,
      );
      expect(existsSync(generated)).toBe(false);
      await builder.buildApp();
      expect(
        log.mock.calls.filter(([message]) => message === "Synced 1 content asset."),
      ).toHaveLength(1);
      for (const directory of ["public", "dist/client", "dist/ssr"]) {
        const assets = join(root, directory, "content-assets");
        expect(await readFile(join(assets, attachment), "utf8")).toBe(body);
        for (const path of excluded) {
          expect(existsSync(join(assets, path))).toBe(false);
        }
      }
    } finally {
      log.mockRestore();
      // Only remove the unique fixture directory created by this test.
      await rm(root, { recursive: true, force: true });
    }
  },
);
