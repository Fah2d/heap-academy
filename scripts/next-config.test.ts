import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants";
import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  RUNTIME_ASSET_BASE_URL,
  RUNTIME_ROOT,
  WORKER_DIRECTORY,
  WORKER_URL,
} from "../src/runtime/assets";
import {
  RUNTIME_STATIC_POLICY,
  runtimeHeaders,
  SECURITY_HEADERS,
  workerContentSecurityPolicy,
} from "../src/infrastructure/http/security-headers";

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
      expect(rules?.at(-1)?.source).toBe(`${WORKER_DIRECTORY}:path+.js`);
      expect(rules?.at(-1)?.headers.map((header) => header.key)).toContain(
        "Content-Security-Policy",
      );
    },
  );

  // Next.js's own matcher for next.config.ts rules decides which paths each
  // rule reaches, so a source pattern that matches more or less than intended
  // fails here (WP-3.1 security review 2, MINOR 3). This helper matches case
  // sensitively; the server does not, so `CORE.JS` gets the worker's policy
  // there. No path in another case is tested here.
  async function headersFor(path: string): Promise<Headers> {
    const response = await unstable_getResponseFromNextConfig({
      url: `https://heap.example${path}`,
      nextConfig: () => config(PHASE_PRODUCTION_BUILD),
    });
    return response.headers;
  }

  it.each([
    // Every file the runtime build compiles (scripts/build-runtime.test.ts).
    WORKER_URL,
    `${WORKER_DIRECTORY}runtime/worker/core.js`,
    `${WORKER_DIRECTORY}runtime/worker/run-support.js`,
    `${WORKER_DIRECTORY}runtime/protocol.js`,
    `${WORKER_DIRECTORY}runtime/output.js`,
    `${WORKER_DIRECTORY}runtime/lockdown.js`,
    `${WORKER_DIRECTORY}runtime/manifest.js`,
    `${WORKER_DIRECTORY}grader/harness.js`,
    `${WORKER_DIRECTORY}grader/grade.js`,
    `${WORKER_DIRECTORY}grader/compare.js`,
    `${WORKER_DIRECTORY}grader/test-case.js`,
  ])(
    "[T-01] serves the compiled worker file %s with the worker's policy, checked on every load",
    async (path) => {
      const headers = await headersFor(path);
      expect(headers.get("content-security-policy")).toBe(
        workerContentSecurityPolicy(RUNTIME_ASSET_BASE_URL),
      );
      expect(headers.get("cache-control")).toBe("no-cache");
    },
  );

  it.each([
    `${WORKER_DIRECTORY}no-such-file`,
    `${WORKER_DIRECTORY}page.html`,
    `${WORKER_DIRECTORY}core.jsx`,
    `${WORKER_DIRECTORY}core.js/more`,
    `${WORKER_DIRECTORY}.js`,
    `${RUNTIME_ROOT}worker.js`,
  ])(
    "[T-15] gives %s, a miss beside the worker's files, the static policy, not the worker's",
    async (path) => {
      const headers = await headersFor(path);
      expect(headers.get("content-security-policy")).toBe(RUNTIME_STATIC_POLICY);
      expect(headers.get("cache-control")).toBeNull();
    },
  );
});
