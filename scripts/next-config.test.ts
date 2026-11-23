import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { RUNTIME_ASSET_BASE_URL, RUNTIME_ROOT, WORKER_DIRECTORY } from "../src/runtime/assets";
import { runtimeHeaders, SECURITY_HEADERS } from "../src/infrastructure/http/security-headers";

// security-headers.test.ts tests the rules; this tests that next.config.ts
// serves them, so a merge that drops the runtime's rules fails here and not
// only in the browser tests.

type Config = (phase: string) => {
  headers?: () => Promise<{ source: string; headers: { key: string; value: string }[] }[]>;
};
let config: Config;

beforeAll(async () => {
  // next.config.ts checks the public variables when it loads; these are the
  // fake values of .env.example.
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_example");
  config = ((await import("../next.config")) as { default: Config }).default;
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("next.config.ts headers", () => {
  it.each([PHASE_PRODUCTION_BUILD, PHASE_DEVELOPMENT_SERVER])(
    "[T-01] [T-15] in %s, every response gets the security headers, then the runtime's rules, with the worker's policy last",
    async (phase) => {
      const rules = await config(phase).headers?.();
      const runtime = runtimeHeaders({
        runtimeRoot: RUNTIME_ROOT,
        runtimeAssetBase: RUNTIME_ASSET_BASE_URL,
        workerDirectory: WORKER_DIRECTORY,
      });
      expect(rules).toEqual([{ source: "/:path*", headers: [...SECURITY_HEADERS] }, ...runtime]);
      // Next.js uses the later rule when two set the same header, so the
      // worker's policy must come after every other rule that sets one.
      expect(rules?.at(-1)?.source).toBe(`${WORKER_DIRECTORY}:path*`);
      expect(rules?.at(-1)?.headers.map((header) => header.key)).toContain(
        "Content-Security-Policy",
      );
    },
  );
});
