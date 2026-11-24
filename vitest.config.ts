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
    // Interactive input runs real Pyodide with WebAssembly stack switching
    // (src/runtime/worker/interactive.test.ts). Node 25 and later have it;
    // Node 24, which CI uses, has it behind this flag. Newer Node refuses the
    // flag, so it is passed only where the capability is missing.
    execArgv:
      typeof Reflect.get(WebAssembly, "Suspending") === "function"
        ? []
        : ["--experimental-wasm-jspi"],
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
