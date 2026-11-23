// What a browser may say about an error (docs/spec/07-operations.md section
// 4.2): a short code and the path of the page, nothing else. No message text
// is sent, because a message can hold a learner's code or their own words
// (NFR-PRIV-03, T-16). The server adds the release and the request ID.

export const CLIENT_ERROR_CODES = [
  "runtime-load-failed",
  "worker-crashed",
  "unexpected-exception",
] as const;

export type ClientErrorCode = (typeof CLIENT_ERROR_CODES)[number];

export type ClientErrorReport = {
  code: ClientErrorCode;
  /** The page's path, without its query or fragment. The server logs only its pattern. */
  route: string;
};

/**
 * The error reporter port of ADR-0019. Sends a report and resolves to the
 * reference the server logged it under, or undefined when it was not stored.
 * Code that cannot import a feature, such as the runtime, is given one.
 */
export type ErrorReporter = (report: ClientErrorReport) => Promise<string | undefined>;

/** The longest path a report may carry. */
export const MAX_REPORTED_ROUTE_LENGTH = 2048;

/** The path of an address, with no query and no fragment, cut to the longest a report may carry. */
export function reportedRoute(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] ?? "";
  const route = path.startsWith("/") ? path : `/${path}`;
  return route.slice(0, MAX_REPORTED_ROUTE_LENGTH);
}
