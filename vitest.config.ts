import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}", "scripts/**/*.mjs"],
      exclude: ["**/*.test.{ts,tsx}"],
      reporter: ["text-summary", "text"],
      // NFR-MAINT-02: gated in the pure modules only; reported elsewhere.
      thresholds: {
        "src/domain/**": { lines: 90, branches: 90 },
        "src/grader/**": { lines: 90, branches: 90 },
      },
    },
  },
});
