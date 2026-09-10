import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: { exclude: ["cloudflare:workers"] },
  ssr: { external: ["cloudflare:workers"] },
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
    watch: {
      ignored: ["**/route-tree.gen.ts", "**/.tanstack/**"],
    },
  },
});
