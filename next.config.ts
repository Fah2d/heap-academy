import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { parsePublicEnvironment } from "./src/infrastructure/env/schema";

// The variables the browser bundle needs are validated at build; server
// variables are validated when the server starts, in src/instrumentation.ts
// (docs/spec/02-architecture.md section 13).
parsePublicEnvironment(process.env);

const PAGE_EXTENSIONS = ["tsx", "ts", "jsx", "js"];

export default function config(phase: string): NextConfig {
  return {
    poweredByHeader: false,
    reactStrictMode: true,
    // Development-only pages end in `.dev.tsx`. Only the development server
    // treats that as a page extension, so `next build` leaves them out
    // entirely: no route, no bundle (WP-1.4).
    pageExtensions:
      phase === PHASE_DEVELOPMENT_SERVER ? ["dev.tsx", ...PAGE_EXTENSIONS] : PAGE_EXTENSIONS,
  };
}
