import { describe, expect, it } from "vitest";
import { parseRequestId } from "@/infrastructure/http/request-id";
import { createLogger, type LogEntry, REJECTED } from "./logger";
import { logRoute } from "./route";

describe("logger", () => {
  it("[NFR-OBS-01] writes one JSON line with only the allowed fields", () => {
    const lines: string[] = [];
    const log = createLogger({
      write: (line) => lines.push(line),
      now: () => new Date("2026-11-16T10:00:00.000Z"),
      release: "0123456789abcdef0123456789abcdef01234567",
    });
    log({
      level: "info",
      requestId: parseRequestId("req_7f3a9c2e41b8") ?? "none",
      route: logRoute("GET", "/api/health"),
      outcome: "request",
      durationMs: 12,
    });
    expect(lines).toHaveLength(1);
    const entry: unknown = JSON.parse(lines[0] ?? "");
    expect(entry).toEqual({
      time: "2026-11-16T10:00:00.000Z",
      release: "0123456789abcdef0123456789abcdef01234567",
      level: "info",
      requestId: "req_7f3a9c2e41b8",
      route: "GET /api/health",
      outcome: "request",
      durationMs: 12,
    });
    expect(Object.keys(entry as object).sort()).toEqual(
      ["durationMs", "level", "outcome", "release", "requestId", "route", "time"].sort(),
    );
  });

  function capture() {
    const lines: string[] = [];
    const log = createLogger({
      write: (line) => lines.push(line),
      now: () => new Date("2026-11-16T10:00:00.000Z"),
      release: "local",
    });
    return { lines, log, entry: () => JSON.parse(lines[0] ?? "") as Record<string, unknown> };
  }

  it("[NFR-PRIV-03] [T-16] drops a field that is not on the allowlist", () => {
    const { log, entry, lines } = capture();
    const withExtra = {
      level: "info",
      requestId: "none",
      route: logRoute("GET", "/"),
      outcome: "request",
      email: "ada@example.com",
    } as const;
    const passed: LogEntry = withExtra;
    log(passed);
    expect(Object.keys(entry()).sort()).toEqual(
      ["level", "outcome", "release", "requestId", "route", "time"].sort(),
    );
    expect(lines[0]).not.toContain("ada@example.com");
  });

  it("[NFR-PRIV-03] [T-16] rejects free text cast into the route, the outcome, or the request ID", () => {
    const { log, entry, lines } = capture();
    log({
      level: "warn",
      requestId: "ada@example.com" as LogEntry["requestId"],
      route: "GET /ada@example.com" as LogEntry["route"],
      outcome: "failed for ada@example.com",
    });
    expect(entry()).toMatchObject({
      level: "warn",
      requestId: REJECTED,
      route: REJECTED,
      outcome: REJECTED,
    });
    expect(lines[0]).not.toContain("ada@example.com");
  });

  it("[NFR-OBS-01] keeps only a finite, non-negative duration, in whole milliseconds", () => {
    const base = {
      level: "info",
      requestId: "none",
      route: logRoute("GET", "/"),
      outcome: "request",
    } as const;
    for (const [durationMs, expected] of [
      [12.4, 12],
      [0, 0],
      [-1, undefined],
      [Number.NaN, undefined],
      [Number.POSITIVE_INFINITY, undefined],
    ] as const) {
      const { log, entry } = capture();
      log({ ...base, durationMs });
      expect(entry()["durationMs"], String(durationMs)).toBe(expected);
    }
  });

  it("[NFR-OBS-02] writes a browser bundle's release only when it is a commit SHA or local", () => {
    const base = {
      level: "error",
      requestId: "none",
      route: logRoute("GET", "/"),
      outcome: "client-error:worker-crashed",
    } as const;
    for (const [clientRelease, expected] of [
      ["fedcba9876543210fedcba9876543210fedcba98", "fedcba9876543210fedcba9876543210fedcba98"],
      ["local", "local"],
      ["ada@example.com", REJECTED],
      ["0123456789abcdef", REJECTED],
    ] as const) {
      const { log, entry } = capture();
      log({ ...base, clientRelease });
      expect(entry()["clientRelease"], clientRelease).toBe(expected);
    }
    const { log, entry } = capture();
    log(base);
    expect(Object.keys(entry())).not.toContain("clientRelease");
  });

  it("[NFR-OBS-01] writes an unknown level as error rather than dropping the line", () => {
    const { log, entry } = capture();
    log({
      level: "debug" as LogEntry["level"],
      requestId: "none",
      route: logRoute("GET", "/"),
      outcome: "request",
    });
    expect(entry()["level"]).toBe("error");
  });
});
