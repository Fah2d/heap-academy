import type { RequestId } from "@/domain/request-id";

// Making a request ID needs randomness, so it lives here; its shape and the
// header that carries it are in src/domain/request-id.ts.
export { parseRequestId, REQUEST_ID_HEADER, type RequestId } from "@/domain/request-id";

/** A new, unguessable request ID: a random UUID. */
export function createRequestId(): RequestId {
  return crypto.randomUUID() as RequestId;
}
