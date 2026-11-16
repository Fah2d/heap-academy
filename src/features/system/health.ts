import "server-only";

// GET /api/health (FR-SYS-04): the uptime check and the deploy smoke call it.
// It reports liveness. Whether the database answers joins this response with
// the database client in WP-2.1 (docs/spec/02-architecture.md section 9.2).
export function healthResponse(): Response {
  return Response.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
}
