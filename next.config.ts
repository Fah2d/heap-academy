import type { NextConfig } from "next";
import { runtimeHeaders, SECURITY_HEADERS } from "./src/infrastructure/http/security-headers";
import { RUNTIME_ASSET_BASE_URL, WORKER_DIRECTORY } from "./src/runtime/assets";
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
const release =
  serverEnvironmentSchema.shape.HEAP_RELEASE.parse(process.env.HEAP_RELEASE) ?? RELEASE_LOCAL;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  env: { HEAP_RELEASE: release },
  // Every response, static files included (docs/spec/06-security-privacy.md
  // section 5.1). The page policy is per request, in src/proxy.ts; the Python
  // worker's own policy and the runtime files' caching are set here.
  headers() {
    return Promise.resolve([
      { source: "/:path*", headers: [...SECURITY_HEADERS] },
      ...runtimeHeaders({
        runtimeAssetBase: RUNTIME_ASSET_BASE_URL,
        workerDirectory: WORKER_DIRECTORY,
      }),
    ]);
  },
};

export default nextConfig;
