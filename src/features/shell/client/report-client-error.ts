import type { ErrorReporter } from "@/domain/client-error";
import { RELEASE_LOCAL } from "@/domain/release";
import { parseRequestId, REQUEST_ID_HEADER } from "@/domain/request-id";

// The one adapter of the error reporter port (ADR-0019): a POST to
// /api/client-error, which writes the report to the host's logs. Tests pass
// their own reporter. A report carries a code, the page's path and the
// release of this bundle, never an error message (docs/spec/07-operations.md
// section 4.2).

export const CLIENT_ERROR_PATH = "/api/client-error";

export function createErrorReporter(send: typeof fetch, release: string): ErrorReporter {
  return async (report) => {
    try {
      const response = await send(CLIENT_ERROR_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: report.code, route: report.route, release }),
        // No cookie: the report needs no session, and none should travel with it.
        credentials: "omit",
        // The report is still delivered if the learner leaves the page.
        keepalive: true,
      });
      if (!response.ok) return undefined;
      // The request ID proxy.ts gave the report. Anything else is not shown.
      return parseRequestId(response.headers.get(REQUEST_ID_HEADER));
    } catch {
      // Offline, or the request was blocked: the error page shows no reference.
      return undefined;
    }
  };
}

export const reportClientError: ErrorReporter = createErrorReporter(
  (input, init) => fetch(input, init),
  // Inlined at build by next.config.ts.
  process.env.NEXT_PUBLIC_HEAP_RELEASE ?? RELEASE_LOCAL,
);
