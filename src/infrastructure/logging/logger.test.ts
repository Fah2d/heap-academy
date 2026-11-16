import { describe, expect, it } from "vitest";
import { createLogger } from "./logger";

describe("logger", () => {
  it("[NFR-OBS-01] writes one JSON line with the time, the request ID, and the route", () => {
    const lines: string[] = [];
    const log = createLogger({
      write: (line) => lines.push(line),
      now: () => new Date("2026-11-16T10:00:00.000Z"),
    });
    log({ level: "info", event: "request", requestId: "req_7f3a9c2e41b8", route: "/courses" });
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      time: "2026-11-16T10:00:00.000Z",
      level: "info",
      event: "request",
      requestId: "req_7f3a9c2e41b8",
      route: "/courses",
    });
  });
});
