import { type Config, defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/drizzle/schema.ts",
  out: "./migrations",
  verbose: true,
}) satisfies Config;
