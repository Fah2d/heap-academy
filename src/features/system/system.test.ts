import { describe, expect, it, vi } from "vitest";
import type { LogEntry } from "@/infrastructure/logging/logger";
import { handleCspReport, MAX_REPORT_BYTES, parseCspReport } from "./csp-report";
import { healthResponse } from "./health";

vi.mock("server-only", () => ({}));

const URL_ = "https://heap.test/api/csp-report";

function post(body: string, contentType: string, headers: Record<string, string> = {}) {
  return new Request(URL_, {
    method: "POST",
    body,
    headers: { "content-type": contentType, ...headers },
  });
}

const legacy = JSON.stringify({
  "csp-report": {
    "document-uri": "https://heap.test/courses/python?email=a%40b.test",
    "blocked-uri": "inline",
    "effective-directive": "script-src-elem",
    "violated-directive": "script-src-elem",
    disposition: "enforce",
    "original-policy": "default-src 'self'",
  },
});

const reportingApi = JSON.stringify([
  {
    type: "csp-violation",
    age: 10,
    url: "https://heap.test/",
    body: {
      documentURL: "https://heap.test/lessons/1?token=secret",
      blockedURL: "https://evil.test/x.js?k=1",
      effectiveDirective: "script-src-elem",
      disposition: "enforce",
    },
  },
  { type: "deprecation", body: {} },
]);

describe("health", () => {
  it("[FR-SYS-04] answers ok and is never cached", async () => {
    const response = healthResponse();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
  });
});

describe("content security policy reports", () => {
  it("[NFR-SEC-02] reads the legacy format and keeps no query string", () => {
    expect(parseCspReport("application/csp-report", legacy)).toEqual({
      ok: true,
      violations: [
        {
          directive: "script-src-elem",
          blocked: "inline",
          document: "https://heap.test/courses/python",
          disposition: "enforce",
        },
      ],
    });
  });

  it("[NFR-SEC-02] reads the Reporting API format and ignores other report types", () => {
    expect(parseCspReport("application/reports+json", reportingApi)).toEqual({
      ok: true,
      violations: [
        {
          directive: "script-src-elem",
          blocked: "https://evil.test/x.js",
          document: "https://heap.test/lessons/1",
          disposition: "enforce",
        },
      ],
    });
  });

  it("[NFR-SEC-02] logs each violation with the request ID and answers 204", async () => {
    const entries: LogEntry[] = [];
    const response = await handleCspReport(
      post(reportingApi, "application/reports+json", { "x-request-id": "req_7f3a9c2e41b8" }),
      (entry) => entries.push(entry),
    );
    expect(response.status).toBe(204);
    expect(entries).toEqual([
      {
        level: "warn",
        event: "csp-violation",
        requestId: "req_7f3a9c2e41b8",
        route: "/api/csp-report",
        detail: {
          directive: "script-src-elem",
          blocked: "https://evil.test/x.js",
          document: "https://heap.test/lessons/1",
          disposition: "enforce",
        },
      },
    ]);
    expect(JSON.stringify(entries)).not.toContain("secret");
  });

  it("[NFR-SEC-02] refuses a body over the size cap with 413 and logs nothing", async () => {
    const entries: LogEntry[] = [];
    const huge = JSON.stringify({ "csp-report": { "blocked-uri": "x".repeat(MAX_REPORT_BYTES) } });
    const response = await handleCspReport(post(huge, "application/csp-report"), (entry) =>
      entries.push(entry),
    );
    expect(response.status).toBe(413);
    expect(entries).toEqual([]);
  });

  it("[NFR-SEC-02] refuses another content type with 415", async () => {
    const response = await handleCspReport(post(legacy, "text/plain"), () => undefined);
    expect(response.status).toBe(415);
  });

  it("[NFR-SEC-02] refuses a body that is not a report with 400", async () => {
    for (const body of ["not json", '{"csp-report": "x"}', '{"other": 1}']) {
      const response = await handleCspReport(post(body, "application/csp-report"), () => undefined);
      expect(response.status, body).toBe(400);
    }
  });
});
