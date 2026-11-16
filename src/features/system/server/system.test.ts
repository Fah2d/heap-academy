import { describe, expect, it, vi } from "vitest";
import type { LogEntry } from "@/infrastructure/logging/logger";
import {
  handleCspReport,
  MAX_LOGGED_VIOLATIONS,
  MAX_REPORT_BYTES,
  parseCspReport,
} from "./csp-report";
import { healthResponse } from "./health";

vi.mock("server-only", () => ({}));

const ORIGIN = "https://heap.test";

function post(body: string, contentType: string, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}/api/csp-report`, {
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

const reportingApi = (count = 1, blockedURL = "https://evil.test/x.js?token=secret") =>
  JSON.stringify([
    ...Array.from({ length: count }, () => ({
      type: "csp-violation",
      age: 10,
      url: "https://heap.test/",
      body: {
        documentURL: "https://heap.test/lessons/1?token=secret",
        blockedURL,
        effectiveDirective: "script-src-elem",
        disposition: "enforce",
      },
    })),
    { type: "deprecation", body: {} },
  ]);

const collect = () => {
  const entries: LogEntry[] = [];
  return { entries, log: (entry: LogEntry) => entries.push(entry) };
};

describe("health", () => {
  it("[FR-SYS-04] answers ok with the release, and is never cached", async () => {
    const response = healthResponse("0123456789abcdef0123456789abcdef01234567");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      status: "ok",
      release: "0123456789abcdef0123456789abcdef01234567",
    });
  });
});

describe("content security policy reports", () => {
  it("[NFR-SEC-02] reads the legacy format", () => {
    expect(parseCspReport("application/csp-report", legacy, ORIGIN)).toEqual({
      ok: true,
      violations: [{ directive: "script-src-elem", blocked: "inline", enforced: true }],
    });
  });

  it("[NFR-SEC-02] reads the Reporting API format and ignores other report types", () => {
    expect(parseCspReport("application/reports+json", reportingApi(), ORIGIN)).toEqual({
      ok: true,
      violations: [{ directive: "script-src-elem", blocked: "external", enforced: true }],
    });
  });

  it("[NFR-SEC-02] tells this origin, other origins, and keywords apart, and invents no directive", () => {
    const kind = (blocked: string, directive = "img-src") =>
      parseCspReport(
        "application/csp-report",
        JSON.stringify({
          "csp-report": { "blocked-uri": blocked, "effective-directive": directive },
        }),
        ORIGIN,
      );
    expect(kind("https://heap.test/a.png")).toMatchObject({ violations: [{ blocked: "self" }] });
    expect(kind("data:image/png;base64,AAAA")).toMatchObject({ violations: [{ blocked: "data" }] });
    expect(kind("eval")).toMatchObject({ violations: [{ blocked: "eval" }] });
    expect(kind("not a url")).toMatchObject({ violations: [{ blocked: "other" }] });
    expect(kind("inline", "<script>")).toMatchObject({ violations: [{ directive: "unknown" }] });
  });

  it("[NFR-SEC-02] [NFR-PRIV-03] logs a code per violation with the request ID, and no address", async () => {
    const { entries, log } = collect();
    const response = await handleCspReport(
      post(reportingApi(), "application/reports+json", { "x-request-id": "req_7f3a9c2e41b8" }),
      log,
    );
    expect(response.status).toBe(204);
    expect(entries).toEqual([
      {
        level: "warn",
        requestId: "req_7f3a9c2e41b8",
        route: "POST /api/csp-report",
        outcome: "csp-violation:script-src-elem:external",
      },
    ]);
    expect(JSON.stringify(entries)).not.toMatch(/secret|evil|lessons/);
  });

  it("[NFR-SEC-02] logs at most a fixed number of lines per request", async () => {
    const { entries, log } = collect();
    await handleCspReport(post(reportingApi(40), "application/reports+json"), log);
    expect(entries).toHaveLength(MAX_LOGGED_VIOLATIONS + 1);
    expect(entries.at(-1)?.outcome).toBe(`csp-violation:more:${40 - MAX_LOGGED_VIOLATIONS}`);
  });

  it("[NFR-SEC-02] refuses a body over the size cap with 413 and logs nothing", async () => {
    const { entries, log } = collect();
    const huge = JSON.stringify({ "csp-report": { "blocked-uri": "x".repeat(MAX_REPORT_BYTES) } });
    const response = await handleCspReport(post(huge, "application/csp-report"), log);
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
