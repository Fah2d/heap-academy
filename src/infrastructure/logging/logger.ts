import { RELEASE_LOCAL } from "@/infrastructure/env/schema";
import type { RequestId } from "@/infrastructure/http/request-id";

// Structured JSON on the server, with an allowlist of fields
// (.claude/rules/server.md, docs/spec/07-operations.md section 4.1): the
// request ID, the route, an outcome code, the duration, and the release. No
// field takes free text, so no email, name, learner code, or token can reach
// a log line (NFR-PRIV-03).

export type LogLevel = "info" | "warn" | "error";

export type LogEntry = {
  level: LogLevel;
  requestId: RequestId | "none";
  /** The method and path, without the query string: `GET /courses`. */
  route: string;
  /** A short code for what happened: `request`, `csp-violation:script-src-elem:inline`. */
  outcome: string;
  durationMs?: number;
};

export type Logger = (entry: LogEntry) => void;

export function createLogger({
  write,
  now,
  release,
}: {
  write: (line: string) => void;
  now: () => Date;
  release: string;
}): Logger {
  return (entry) => {
    write(JSON.stringify({ time: now().toISOString(), release, ...entry }));
  };
}

/** The server's logger: one JSON line per entry on standard output, which the host collects. */
export const log: Logger = createLogger({
  // Standard output is the log sink on the host.
  write: (line) => {
    console.log(line);
  },
  now: () => new Date(),
  // Inlined at build by next.config.ts.
  release: process.env.HEAP_RELEASE ?? RELEASE_LOCAL,
});
