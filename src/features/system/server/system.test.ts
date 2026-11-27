import { describe, expect, it, vi } from "vitest";
import type { CountResult } from "@/infrastructure/actions/action-counter";
import type { LogEntry } from "@/infrastructure/logging/logger";
import {
  handleCspReport,
  MAX_LOGGED_VIOLATIONS,
  MAX_REPORT_BYTES,
  parseCspReport,
} from "./csp-report";
import { healthResponse } from "./health";

vi.mock("server-only", () => ({}));
// Every report is counted first (T-14); this counter allows each one unless a
// test says otherwise.
const counter = vi.hoisted(() => ({
  count: vi.fn(async (_action: string, _perMinute: number): Promise<CountResult> => "allowed"),
  headers: [] as Pick<Headers, "get">[],
}));
vi.mock("@/infrastructure/actions/request-counter", () => ({
  requestCounter: (headers: Pick<Headers, "get">) => {
    counter.headers.push(headers);
    return counter.count;
  },
}));

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
    const response = await handleCspReport(
      post(reportingApi(25, "inline"), "application/reports+json"),
      log,
    );
    expect(response.status).toBe(204);
    expect(entries).toHaveLength(MAX_LOGGED_VIOLATIONS + 1);
    expect(entries.at(-1)?.outcome).toBe(`csp-violation:more:${25 - MAX_LOGGED_VIOLATIONS}`);
  });

  it("[NFR-SEC-02] refuses a body over the size cap with 413 and logs nothing", async () => {
    const { entries, log } = collect();
    const huge = JSON.stringify({ "csp-report": { "blocked-uri": "x".repeat(MAX_REPORT_BYTES) } });
    const response = await handleCspReport(post(huge, "application/csp-report"), log);
    expect(response.status).toBe(413);
    expect(entries).toEqual([]);
  });

  it("[T-14] counts each report for its request at 120 a minute, before reading the body", async () => {
    counter.count.mockClear();
    counter.headers.length = 0;
    const request = post(legacy, "application/csp-report", { "x-real-ip": "203.0.113.7" });
    expect((await handleCspReport(request, () => undefined)).status).toBe(204);
    expect(counter.count.mock.calls).toEqual([["csp-report", 120]]);
    expect(counter.headers[0]?.get("x-real-ip")).toBe("203.0.113.7");
  });

  it("[T-14] refuses a report over the limit with 429, unread and unlogged", async () => {
    const { entries, log } = collect();
    const request = post(legacy, "application/csp-report");
    const response = await handleCspReport(request, log, async () => "refused");
    expect(response.status).toBe(429);
    expect(request.bodyUsed).toBe(false);
    expect(entries).toEqual([]);
  });

  it("[T-14] answers 503 and logs an error when the counter does not answer", async () => {
    const { entries, log } = collect();
    const response = await handleCspReport(
      post(legacy, "application/csp-report"),
      log,
      async () => "unavailable",
    );
    expect(response.status).toBe(503);
    expect(entries).toEqual([
      expect.objectContaining({ level: "error", outcome: "error:counter-unavailable" }),
    ]);
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

  it("[NFR-SEC-02] logs a report-only violation at info, and an enforced one at warn", async () => {
    const body = (disposition: string) =>
      JSON.stringify({
        "csp-report": {
          "blocked-uri": "inline",
          "effective-directive": "style-src-attr",
          disposition,
        },
      });
    const { entries, log } = collect();
    await handleCspReport(post(body("report"), "application/csp-report"), log);
    await handleCspReport(post(body("enforce"), "application/csp-report"), log);
    expect(entries.map(({ level }) => level)).toEqual(["info", "warn"]);
    expect(parseCspReport("application/csp-report", body("report"), ORIGIN)).toMatchObject({
      violations: [{ enforced: false }],
    });
  });

  it("[NFR-SEC-02] prefers the effective directive over the violated one", () => {
    const both = JSON.stringify({
      "csp-report": {
        "blocked-uri": "inline",
        "effective-directive": "script-src-elem",
        "violated-directive": "script-src",
      },
    });
    expect(parseCspReport("application/csp-report", both, ORIGIN)).toMatchObject({
      violations: [{ directive: "script-src-elem" }],
    });
  });

  it("[NFR-PRIV-03] [T-16] logs a directive that is not a policy directive as unknown", () => {
    for (const directive of ["fatima-alharbi", "ada@example.com", "script-src-elemx"]) {
      expect(
        parseCspReport(
          "application/csp-report",
          JSON.stringify({ "csp-report": { "effective-directive": directive } }),
          ORIGIN,
        ),
        directive,
      ).toMatchObject({ violations: [{ directive: "unknown" }] });
    }
  });

  it("[NFR-SEC-02] refuses more than 100 reports in one body", () => {
    expect(parseCspReport("application/reports+json", reportingApi(99), ORIGIN)).toMatchObject({
      ok: true,
    });
    expect(parseCspReport("application/reports+json", reportingApi(100), ORIGIN)).toEqual({
      ok: false,
    });
  });

  it("[NFR-SEC-02] caps the body at 8 kB, as 07-operations.md section 7 says", async () => {
    expect(MAX_REPORT_BYTES).toBe(8000);
    const sized = (bytes: number) => {
      const shell = JSON.stringify({ "csp-report": { "blocked-uri": "" } });
      return JSON.stringify({ "csp-report": { "blocked-uri": "x".repeat(bytes - shell.length) } });
    };
    const atCap = await handleCspReport(
      post(sized(8000), "application/csp-report"),
      () => undefined,
    );
    const over = await handleCspReport(
      post(sized(8001), "application/csp-report"),
      () => undefined,
    );
    expect(atCap.status).toBe(400);
    expect(over.status).toBe(413);
  });
});
