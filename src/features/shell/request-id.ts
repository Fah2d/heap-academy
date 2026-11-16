import { z } from "zod";

// The request ID that proxy.ts gives every request (NFR-OBS-01, WP-1.3).
// Error pages show it so a learner can quote it, and the server logs carry
// the same value. It arrives in a header, so it is parsed like any input.
export const REQUEST_ID_HEADER = "x-request-id";

// Built on first use: a schema built when the module loads is a call the
// bundler must keep, which would put zod in every page's browser bundle
// through the client error page's import of this feature's index.
function requestIdSchema() {
  return z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);
}

export type RequestId = z.infer<ReturnType<typeof requestIdSchema>> & {
  readonly __brand: "RequestId";
};

/** The request ID from the header value, or undefined when it is absent or malformed. */
export function parseRequestId(value: string | null): RequestId | undefined {
  const parsed = requestIdSchema().safeParse(value);
  return parsed.success ? (parsed.data as RequestId) : undefined;
}
