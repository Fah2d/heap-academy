// The `route` field of a log line (NFR-PRIV-03, T-16). The path a client
// sends is free text: `/ada@example.com` is a valid request. So a path is
// logged as a pattern: a segment is kept only when it is one of the app's own
// route segments, and every other segment becomes `:param`. The method is
// kept only when it is a standard one. Nothing the client chose verbatim can
// reach a log line through this field.

export type LogRoute = string & { readonly __brand: "LogRoute" };

const METHODS: ReadonlySet<string> = new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
]);

/**
 * Every literal segment of a route under `src/app`. A route segment missing
 * here is logged as `:param`, which loses detail but never leaks; a test
 * checks the list against the folders. `dev`, `primitives` and `error` are
 * WP-1.4's development routes.
 */
export const ROUTE_SEGMENTS: ReadonlySet<string> = new Set([
  "api",
  "client-error",
  "csp-report",
  "health",
  "dev",
  "primitives",
  "error",
]);

/** Segments past this many are folded into one `*`, so a line stays short. */
export const MAX_ROUTE_SEGMENTS = 6;

/** The method and the path's pattern, with no query string: `GET /api/health`, `GET /:param`. */
export function logRoute(method: string, pathname: string): LogRoute {
  const verb = METHODS.has(method) ? method : "OTHER";
  const segments = pathname.split("/").filter((segment) => segment !== "");
  const shown = segments
    .slice(0, MAX_ROUTE_SEGMENTS)
    .map((segment) => (ROUTE_SEGMENTS.has(segment) ? segment : ":param"));
  if (segments.length > MAX_ROUTE_SEGMENTS) shown.push("*");
  return `${verb} /${shown.join("/")}` as LogRoute;
}
