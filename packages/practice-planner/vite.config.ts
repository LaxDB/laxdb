import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "esnext",
    rolldownOptions: {
      external: ["node:async_hooks", "cloudflare:workers"],
    },
  },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    watch: {
      ignored: ["**/routeTree.gen.ts", "**/.tanstack/**"],
    },
  },
  css: {
    modules: {
      localsConvention: "camelCase",
    },
  },
});
