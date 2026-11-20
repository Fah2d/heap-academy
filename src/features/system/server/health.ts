import "server-only";
import { RELEASE_LOCAL } from "@/infrastructure/env/schema";

// GET /api/health (FR-SYS-04): the uptime check and the deploy smoke call it.
// It reports liveness and the release, so the smoke can tell that the
// production address serves the deployment it just made. Whether the
// database answers joins this response with the database client in WP-2.1
// (docs/spec/02-architecture.md section 9.2).
export function healthResponse(
  release: string = process.env.HEAP_RELEASE ?? RELEASE_LOCAL,
): Response {
  return Response.json({ status: "ok", release }, { headers: { "cache-control": "no-store" } });
}
