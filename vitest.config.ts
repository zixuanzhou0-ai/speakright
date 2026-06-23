import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    testTimeout: 10_000,
    exclude: [...configDefaults.exclude, "apps/browser/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
