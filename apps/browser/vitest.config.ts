import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    exclude: [...configDefaults.exclude, "e2e/**"],
    maxWorkers: 4,
    setupFiles: ["./src/__tests__/setup.ts"],
    testTimeout: 10_000,
  },
  resolve: {
    alias: {
      "@speakright/core": path.resolve(__dirname, "../../packages/core/src"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
