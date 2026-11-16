import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { z } from "zod";
import { parsePublicEnvironment } from "./src/infrastructure/env/schema";

// The variables the browser bundle needs are validated at build; server
// variables are validated when the server starts, in src/instrumentation.ts
// (docs/spec/02-architecture.md section 13).
parsePublicEnvironment(process.env);

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
    // Development-only pages end in `.dev.tsx`. Only the development server
    // treats that as a page extension, so `next build` leaves them out
    // entirely: no route, no bundle (WP-1.4).
    pageExtensions:
      phase === PHASE_DEVELOPMENT_SERVER ? ["dev.tsx", ...PAGE_EXTENSIONS] : PAGE_EXTENSIONS,
    ...(pollIntervalMs !== undefined && { watchOptions: { pollIntervalMs } }),
  };
}
