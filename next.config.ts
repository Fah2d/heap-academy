import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { z } from "zod";
import { SECURITY_HEADERS } from "./src/infrastructure/http/security-headers";
import {
  parsePublicEnvironment,
  RELEASE_LOCAL,
  serverEnvironmentSchema,
} from "./src/infrastructure/env/schema";

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

const PAGE_EXTENSIONS = ["tsx", "ts", "jsx", "js"];

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
    // Development-only pages end in `.dev.tsx`. Only the development server
    // treats that as a page extension, so `next build` leaves them out
    // entirely: no route, no bundle (WP-1.4).
    pageExtensions:
      phase === PHASE_DEVELOPMENT_SERVER ? ["dev.tsx", ...PAGE_EXTENSIONS] : PAGE_EXTENSIONS,
    ...(pollIntervalMs !== undefined && { watchOptions: { pollIntervalMs } }),
    // Every response, static files included (docs/spec/06-security-privacy.md
    // section 5.1). The script policy is per request, in src/proxy.ts.
    headers() {
      return Promise.resolve([{ source: "/:path*", headers: [...SECURITY_HEADERS] }]);
    },
  };
}
