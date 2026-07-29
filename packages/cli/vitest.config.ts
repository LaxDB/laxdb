import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 10000,
    include: ["src/**/*.test.ts"],
    exclude: ["src/test/**/*.integration.test.ts"],
  },
});
