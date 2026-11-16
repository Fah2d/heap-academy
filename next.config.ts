import type { NextConfig } from "next";
import { parsePublicEnvironment } from "./src/infrastructure/env/schema";

// The variables the browser bundle needs are validated at build; server
// variables are validated when the server starts, in src/instrumentation.ts
// (docs/spec/02-architecture.md section 13).
parsePublicEnvironment(process.env);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
