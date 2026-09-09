import { localApiUrl } from "@laxdb/frontend/routing";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rolldownOptions: {
      // Cloudflare resolves these built-ins in the worker runtime.
      external: ["node:async_hooks", "cloudflare:workers"],
    },
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      router: { generatedRouteTree: "./route-tree.gen.ts" },
      server: { entry: "./src/server.ts" },
    }),
    react(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api/auth/": { target: localApiUrl },
      "/api/report-images/": { target: localApiUrl },
    },
    watch: {
      ignored: ["**/route-tree.gen.ts", "**/.tanstack/**"],
    },
  },
});
