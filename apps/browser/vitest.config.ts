import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
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
