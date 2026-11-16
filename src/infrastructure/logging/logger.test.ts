import { describe, expect, it } from "vitest";
import { parseRequestId } from "@/infrastructure/http/request-id";
import { createLogger } from "./logger";

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
      route: "GET /courses",
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
      route: "GET /courses",
      outcome: "request",
      durationMs: 12,
    });
    expect(Object.keys(entry as object).sort()).toEqual(
      ["durationMs", "level", "outcome", "release", "requestId", "route", "time"].sort(),
    );
  });
});
