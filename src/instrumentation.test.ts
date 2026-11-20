import { describe, expect, it } from "vitest";
import type { LogEntry } from "@/infrastructure/logging/logger";
import { logRequestError } from "./instrumentation";

function capture() {
  const entries: LogEntry[] = [];
  return { entries, log: (entry: LogEntry) => entries.push(entry) };
}

const request = (headers: Record<string, string | string[]> = {}) => ({
  path: "/api/health?email=ada%40example.com",
  method: "GET",
  headers: { "x-request-id": "6f1c1f0e-1d6a-4d3b-9a43-1f0d7f6c2b11", ...headers },
});

const serverError = (digest: unknown) =>
  Object.assign(new Error("failed for ada@example.com"), { digest });

describe("server error log", () => {
  it("[NFR-OBS-01] logs the digest next to the request ID, so the reference on the error page finds the line", () => {
    const { entries, log } = capture();
    logRequestError(serverError("2389742395"), request(), log);
    expect(entries).toEqual([
      {
        level: "error",
        requestId: "6f1c1f0e-1d6a-4d3b-9a43-1f0d7f6c2b11",
        route: "GET /api/health",
        outcome: "server-error:2389742395",
      },
    ]);
  });

  it("[NFR-PRIV-03] never logs the error's message or the query string", () => {
    const { entries, log } = capture();
    logRequestError(serverError("2389742395"), request(), log);
    expect(JSON.stringify(entries)).not.toContain("ada");
  });

  it("[NFR-OBS-01] says so when there is no usable digest, and invents none", () => {
    for (const error of [
      new Error("x"),
      serverError("NOT a digest!"),
      serverError(42),
      "thrown text",
    ]) {
      const { entries, log } = capture();
      logRequestError(error, request(), log);
      expect(entries[0]?.outcome).toBe("server-error:no-digest");
    }
  });

  it("[NFR-OBS-01] logs no request ID when the header is missing, repeated, or malformed", () => {
    for (const headers of [
      { "x-request-id": ["a1b2c3d4e5", "f6g7h8i9j0"] },
      { "x-request-id": "ada@example.com" },
    ]) {
      const { entries, log } = capture();
      logRequestError(serverError("1"), request(headers), log);
      expect(entries[0]?.requestId).toBe("none");
    }
  });
});
