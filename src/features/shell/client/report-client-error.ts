import type { ClientErrorReport } from "@/domain/client-error";

// The error reporter port of ADR-0019, with its one adapter: a POST to
// /api/client-error, which writes the report to the host's logs. Tests pass
// their own reporter. A report carries a code and the page's path, never an
// error message (docs/spec/07-operations.md section 4.2).

export const CLIENT_ERROR_PATH = "/api/client-error";

/** The response header that carries the request ID proxy.ts gave the report. */
const REQUEST_ID_HEADER = "x-request-id";
/** The shape of a request ID (src/infrastructure/http/request-id.ts). Anything else is not shown. */
const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** Sends a report; resolves to the reference the server logged it under, or undefined when it was not stored. */
export type ErrorReporter = (report: ClientErrorReport) => Promise<string | undefined>;

export function createErrorReporter(send: typeof fetch): ErrorReporter {
  return async (report) => {
    try {
      const response = await send(CLIENT_ERROR_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: report.code, route: report.route }),
        // No cookie: the report needs no session, and none should travel with it.
        credentials: "omit",
        // The report is still delivered if the learner leaves the page.
        keepalive: true,
      });
      if (!response.ok) return undefined;
      const reference = response.headers.get(REQUEST_ID_HEADER);
      return reference !== null && REQUEST_ID.test(reference) ? reference : undefined;
    } catch {
      // Offline, or the request was blocked: the error page shows no reference.
      return undefined;
    }
  };
}

export const reportClientError: ErrorReporter = createErrorReporter((input, init) =>
  fetch(input, init),
);
