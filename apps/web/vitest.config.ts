import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
  },
  resolve: {
    alias: {
      // Neutralise the Next.js "server-only" guard in unit tests
      "server-only": path.resolve(__dirname, "src/__mocks__/server-only.ts"),
      "@": path.resolve(__dirname, "src"),
    },
  },
});
