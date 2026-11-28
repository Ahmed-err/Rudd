import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.{ts,tsx}", "../../packages/shared/types/**/*.test.ts"],
    exclude: ["**/node_modules/**"],
  },
  resolve: {
    alias: {
      // Neutralise the Next.js "server-only" guard in unit tests
      "server-only": path.resolve(__dirname, "src/__mocks__/server-only.ts"),
      "@": path.resolve(__dirname, "src"),
      "@rudd/shared": path.resolve(__dirname, "../../packages/shared/index.ts"),
      "@rudd/db": path.resolve(__dirname, "../../packages/db/index.ts"),
    },
  },
});
