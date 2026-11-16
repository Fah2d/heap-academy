// Structured JSON on the server (docs/spec/02-architecture.md section 13,
// docs/spec/07-operations.md section 4.1): request ID, route, outcome, and
// duration. No email, name, or learner code goes in a log line (NFR-PRIV-03),
// so an entry has no free-form text field: every value is one of the fields
// below, and `detail` takes short codes and numbers only.

export type LogLevel = "info" | "warn" | "error";

export type LogEntry = {
  level: LogLevel;
  /** What happened, as a short code: `request`, `csp-violation`. */
  event: string;
  requestId: string;
  /** The path, without its query string. */
  route: string;
  outcome?: string;
  durationMs?: number;
  detail?: Readonly<Record<string, string | number | boolean>>;
};

export type Logger = (entry: LogEntry) => void;

export function createLogger({
  write,
  now,
}: {
  write: (line: string) => void;
  now: () => Date;
}): Logger {
  return (entry) => {
    write(JSON.stringify({ time: now().toISOString(), ...entry }));
  };
}

/** The server's logger: one JSON line per entry on standard output, which the host collects. */
export const log: Logger = createLogger({
  // Standard output is the log sink on the host.
  write: (line) => {
    console.log(line);
  },
  now: () => new Date(),
});
