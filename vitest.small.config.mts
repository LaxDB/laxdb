import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/world-lacrosse", "packages/api", "packages/cli"],
  },
});
