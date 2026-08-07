import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "esnext",
    rolldownOptions: {
      external: ["node:async_hooks", "cloudflare:workers"],
    },
  },
  plugins: [
    mdx(await import("./source.config.ts")),
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
        prerender: {
          outputPath: "index.html",
          enabled: true,
          // Disabled crawlLinks because fumadocs server functions don't work
          // in TanStack Start's prerender environment (returns 500 error).
          // TODO: Investigate how to properly static render /docs/* pages
          // with fumadocs + TanStack Start. May need custom prerender logic
          // or fumadocs SSG mode.
          crawlLinks: false,
        },
      },
      // TODO: Investigate prerendering /docs/* and /api/search
      // fumadocs server functions don't work reliably in TanStack Start's
      // prerender environment (returns 500 error during turbo parallel builds).
      // pages: [
      //   { path: "/docs" },
      // { path: "/api/search" },
      // ],
    }),
    react(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    watch: {
      ignored: ["**/routeTree.gen.ts", "**/.tanstack/**"],
    },
  },
});
