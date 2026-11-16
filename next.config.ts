import type { NextConfig } from "next";
import { parseEnvironment } from "./src/infrastructure/env/schema";

// Configuration is validated at build (docs/spec/02-architecture.md section 13).
parseEnvironment(process.env);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
