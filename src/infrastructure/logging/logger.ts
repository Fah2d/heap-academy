import { RELEASE_LOCAL } from "@/infrastructure/env/schema";
import { parseRequestId, type RequestId } from "@/infrastructure/http/request-id";
import type { LogRoute } from "@/infrastructure/logging/route";

// Structured JSON on the server, with an allowlist of fields
// (.claude/rules/server.md, docs/spec/07-operations.md section 4.1): the
// request ID, the route, an outcome code, the duration, and the release. No
// field takes free text, so no email, name, learner code, or token can reach
// a log line (NFR-PRIV-03, T-16).
//
// The types say this, and the line is also built from the named fields and
// checked at run time: TypeScript lets an object variable with extra fields
// through, and a cast can carry any string.

export type LogLevel = "info" | "warn" | "error";

export type LogEntry = {
  level: LogLevel;
  requestId: RequestId | "none";
  /** From `logRoute`: the method and the path's pattern, `GET /api/health`. */
  route: LogRoute;
  /** A short code for what happened: `request`, `csp-violation:script-src-elem:inline`. */
  outcome: string;
  durationMs?: number;
};

export type Logger = (entry: LogEntry) => void;

const LEVELS: ReadonlySet<string> = new Set(["info", "warn", "error"]);
/** Lowercase words, digits, `:` and `-`. An email or an address cannot match. */
const OUTCOME = /^[a-z0-9][a-z0-9:-]{0,79}$/;
/** What `logRoute` produces. */
const ROUTE = /^[A-Z]{3,7} \/(?:[a-z0-9:-]{1,64}(?:\/[a-z0-9:*-]{1,64})*)?$/;

/** Written in place of a value that fails its check, so the line shows that something was wrong. */
export const REJECTED = "rejected";

function line(entry: LogEntry, time: string, release: string): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    time,
    release,
    level: LEVELS.has(entry.level) ? entry.level : "error",
    requestId: entry.requestId === "none" ? "none" : (parseRequestId(entry.requestId) ?? REJECTED),
    route: typeof entry.route === "string" && ROUTE.test(entry.route) ? entry.route : REJECTED,
    outcome:
      typeof entry.outcome === "string" && OUTCOME.test(entry.outcome) ? entry.outcome : REJECTED,
  };
  const { durationMs } = entry;
  if (typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs >= 0) {
    fields["durationMs"] = Math.round(durationMs);
  }
  return fields;
}

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
    write(JSON.stringify(line(entry, now().toISOString(), release)));
  };
}

/** The server's logger: one JSON line per entry on standard output, which the host collects. */
export const log: Logger = createLogger({
  // Standard output is the log sink on the host.
  write: (text) => {
    console.log(text);
  },
  now: () => new Date(),
  // Inlined at build by next.config.ts.
  release: process.env.HEAP_RELEASE ?? RELEASE_LOCAL,
});
