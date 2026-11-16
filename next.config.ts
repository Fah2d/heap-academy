import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "./src/infrastructure/http/security-headers";
import { parsePublicEnvironment } from "./src/infrastructure/env/schema";

// The variables the browser bundle needs are validated at build; server
// variables are validated when the server starts, in src/instrumentation.ts
// (docs/spec/02-architecture.md section 13).
parsePublicEnvironment(process.env);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Every response, static files included (docs/spec/06-security-privacy.md
  // section 5.1). The script policy is per request, in src/proxy.ts.
  headers() {
    return Promise.resolve([{ source: "/:path*", headers: [...SECURITY_HEADERS] }]);
  },
};

export default nextConfig;
