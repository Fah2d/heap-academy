import type { Instrumentation } from "next";
import { parseEnvironment } from "@/infrastructure/env/schema";
import { parseRequestId, REQUEST_ID_HEADER } from "@/infrastructure/http/request-id";
import { log as serverLog, type Logger } from "@/infrastructure/logging/logger";
import { logRoute } from "@/infrastructure/logging/route";

// Configuration is validated when the server starts
// (docs/spec/02-architecture.md section 13).
export function register(): void {
  parseEnvironment(process.env);
}

/** The digests Next.js gives server errors are short hashes; anything else is not logged. */
const DIGEST = /^[0-9a-z]{1,40}$/;

/**
 * Logs a server error with its digest next to the request ID (NFR-OBS-01).
 * The error page shows the learner the same digest, so the reference they
 * quote finds this line. The error's message is never logged: it can hold
 * anything (NFR-PRIV-03).
 */
export function logRequestError(
  error: unknown,
  request: Readonly<{ path: string; method: string; headers: NodeJS.Dict<string | string[]> }>,
  log: Logger = serverLog,
): void {
  const digest =
    typeof error === "object" && error !== null && "digest" in error ? error.digest : undefined;
  const header = request.headers[REQUEST_ID_HEADER];
  log({
    level: "error",
    requestId: parseRequestId(typeof header === "string" ? header : undefined) ?? "none",
    route: logRoute(request.method, request.path.split("?")[0] ?? ""),
    outcome:
      typeof digest === "string" && DIGEST.test(digest)
        ? `server-error:${digest}`
        : "server-error:no-digest",
  });
}

export const onRequestError: Instrumentation.onRequestError = (error, request) => {
  logRequestError(error, request);
};
