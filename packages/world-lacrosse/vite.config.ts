import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "world-lacrosse-generated-data-full-reload",
      handleHotUpdate({ file, server }) {
        if (file.endsWith("/src/generated/dataset.json")) {
          server.ws.send({ type: "full-reload" });
          return [];
        }
        return;
      },
    },
  ],
  server: { host: true, port: 3010 },
});
