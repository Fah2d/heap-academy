import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { z } from "zod";
import { runtimeHeaders, SECURITY_HEADERS } from "./src/infrastructure/http/security-headers";
import {
  parsePublicEnvironment,
  RELEASE_LOCAL,
  serverEnvironmentSchema,
} from "./src/infrastructure/env/schema";
import { pageExtensions } from "./src/infrastructure/env/page-extensions";
import { RUNTIME_ASSET_BASE_URL, RUNTIME_ROOT, WORKER_DIRECTORY } from "./src/runtime/assets";

// The variables the browser bundle needs are validated at build; server
// variables are validated when the server starts, in src/instrumentation.ts
// (docs/spec/02-architecture.md section 13).
parsePublicEnvironment(process.env);

// Inlined into server code, because a prebuilt deployment does not see the
// build's environment at run time. Parsed by the one schema like any variable.
// The browser gets the same value as NEXT_PUBLIC_HEAP_RELEASE and sends it
// with an error report (docs/spec/07-operations.md section 4.2). It is not
// secret: /api/health returns it.
const release =
  serverEnvironmentSchema.shape.HEAP_RELEASE.parse(process.env.HEAP_RELEASE) ?? RELEASE_LOCAL;

// Where the file system cannot push change events, such as an agent's
// sandbox that denies macOS FSEvents, the development server can poll
// instead. Unset, it uses events as usual.
const pollIntervalMs = z.coerce
  .number()
  .int()
  .positive()
  .optional()
  .parse(process.env["NEXT_WATCH_POLL_INTERVAL_MS"]);

export default function config(phase: string): NextConfig {
  return {
    poweredByHeader: false,
    // next dev would otherwise write an AGENTS.md into the repository. Agent
    // instructions live in CLAUDE.md, which the owner keeps.
    agentRules: false,
    reactStrictMode: true,
    env: { HEAP_RELEASE: release, NEXT_PUBLIC_HEAP_RELEASE: release },
    // Development-only pages end in `.dev.tsx` (WP-1.4); pages also built for
    // Vercel previews end in `.preview.tsx` (WP-3.4). A production build
    // leaves both out entirely: no route, no bundle.
    pageExtensions: pageExtensions(phase === PHASE_DEVELOPMENT_SERVER, process.env["VERCEL_ENV"]),
    ...(pollIntervalMs !== undefined && { watchOptions: { pollIntervalMs } }),
    // Every response, static files included (docs/spec/06-security-privacy.md
    // section 5.1). The page policy is per request, in src/proxy.ts; the Python
    // worker's own policy and the runtime files' caching are set here.
    headers() {
      return Promise.resolve([
        { source: "/:path*", headers: [...SECURITY_HEADERS] },
        ...runtimeHeaders({
          runtimeRoot: RUNTIME_ROOT,
          runtimeAssetBase: RUNTIME_ASSET_BASE_URL,
          workerDirectory: WORKER_DIRECTORY,
        }),
      ]);
    },
  };
}
