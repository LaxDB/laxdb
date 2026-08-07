import contentCollections from "@content-collections/vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { runMarketingPrerenderConfig } from "./src/lib/marketing-prerender.ts";
import { pagefindSearch } from "./vite/pagefind.ts";

const cssModuleLocalsConvention = "camelCase" as const;

export default defineConfig(async () => {
  const { pages, filter } = await runMarketingPrerenderConfig({
    rootDirectory: import.meta.dirname,
  });

  return {
    root: import.meta.dirname,
    build: {
      outDir: `${import.meta.dirname}/dist`,
      target: "esnext",
      rolldownOptions: {
        external: ["node:async_hooks", "cloudflare:workers"],
      },
    },
    plugins: [
      contentCollections(),
      tailwindcss(),
      tanstackStart({
        pages,
        prerender: {
          enabled: true,
          autoStaticPathsDiscovery: true,
          crawlLinks: true,
          failOnError: true,
          filter,
        },
      }),
      viteReact(),
      pagefindSearch({
        index: {
          forceLanguage: "en",
        },
      }),
    ],
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
        localsConvention: cssModuleLocalsConvention,
      },
    },
  };
});
