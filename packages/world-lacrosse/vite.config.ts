import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

import { tournamentMode } from "./src/lib/tournament-mode";
import { tournamentStartOptions } from "./vite/tournament-start-options";

function generatedDataReload(): Plugin {
  return {
    name: "world-lacrosse-generated-data-reload",
    handleHotUpdate({ file, server }) {
      if (!file.includes("/src/generated/")) return;
      server.ws.send({ type: "full-reload" });
      return [];
    },
  };
}

export default defineConfig(async () => {
  const root = import.meta.dirname;
  const startOptions = await tournamentStartOptions(tournamentMode);
  const modeTournamentData =
    tournamentMode === "live"
      ? `${root}/src/lib/live-mode-tournament-data.ts`
      : `${root}/src/lib/mode-tournament-data.ts`;

  return {
    root,
    build: {
      outDir: `${root}/dist`,
      target: "esnext",
      rolldownOptions: {
        external: ["node:async_hooks", "cloudflare:workers"],
      },
    },
    plugins: [tanstackStart(startOptions), react(), generatedDataReload()],
    resolve: {
      alias: [
        {
          find: "./mode-tournament-data",
          replacement: modeTournamentData,
        },
      ],
    },
    server: {
      host: true,
      port: 3010,
      watch: {
        ignored: ["**/routeTree.gen.ts", "**/.tanstack/**"],
      },
    },
  };
});
