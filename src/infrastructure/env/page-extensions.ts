import { z } from "zod";

// Which files are pages in a build (next.config.ts). Development-only pages
// end in `.dev.tsx`; pages for the development server and preview
// deployments end in `.preview.tsx`, such as the runtime page the owner opens
// on a phone through the protected preview (WP-3.4). A production build has
// neither: no route, no bundle.

const BASE = ["tsx", "ts", "jsx", "js"];

/**
 * Set by Vercel on every build it runs: `production`, `preview` or
 * `development`. Unset in CI and on this machine, where builds are treated
 * as production.
 */
const deploymentKind = z.enum(["production", "preview", "development"]).optional();

export function pageExtensions(developmentServer: boolean, vercelEnv: unknown): string[] {
  if (developmentServer) return ["dev.tsx", "preview.tsx", ...BASE];
  // Anything but exactly `preview` builds the production set.
  const kind = deploymentKind.safeParse(vercelEnv);
  return kind.success && kind.data === "preview" ? ["preview.tsx", ...BASE] : BASE;
}
