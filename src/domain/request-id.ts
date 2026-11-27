// The request ID (NFR-OBS-01). proxy.ts gives every request a new one, puts
// it on the request the app sees and on the response, and the server logs
// carry it. A client-sent value is always replaced, so a reference a learner
// quotes was made by the server. Its shape lives here so the server and the
// browser, which shows it on the error page, check it the same way.
export const REQUEST_ID_HEADER = "x-request-id";

const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

export type RequestId = string & { readonly __brand: "RequestId" };

/** The request ID from a header value, or undefined when it is absent or malformed. */
export function parseRequestId(value: string | null | undefined): RequestId | undefined {
  return typeof value === "string" && REQUEST_ID.test(value) ? (value as RequestId) : undefined;
}
