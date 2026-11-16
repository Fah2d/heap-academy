import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  parsePolicy,
  policyProblems,
  scriptsWithoutNonce,
  verifyDeployment,
  verifyRepository,
} from "./infra-verify.mjs";

const GOOD_POLICY = (nonce: string) =>
  `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; style-src 'self' 'nonce-${nonce}'; style-src-attr 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; report-uri /api/csp-report`;

describe("policy checks", () => {
  it("[NFR-SEC-02] passes the policy of the specification", () => {
    expect(policyProblems(parsePolicy(GOOD_POLICY("abc")))).toEqual([]);
  });

  it("[NFR-SEC-02] reports a policy without a nonce, or with unsafe-inline or unsafe-eval", () => {
    expect(
      policyProblems(
        parsePolicy(
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; report-uri /r",
        ),
      ),
    ).toEqual([
      "script-src has no nonce",
      "script-src lacks 'strict-dynamic'",
      "script-src allows 'unsafe-inline'",
      "script-src allows 'unsafe-eval'",
    ]);
  });

  it("[T-15] reports a policy that allows framing", () => {
    const policy = GOOD_POLICY("abc").replace("frame-ancestors 'none'", "frame-ancestors *");
    expect(policyProblems(parsePolicy(policy))).toEqual(["frame-ancestors is not 'none'"]);
  });

  it("[NFR-SEC-02] finds script tags without the page's nonce", () => {
    const html = `<script nonce="abc" src="/a.js"></script><script>inline()</script><script nonce='zzz'></script>`;
    expect(scriptsWithoutNonce(html, "abc")).toEqual({
      total: 3,
      without: ["<script>", "<script nonce='zzz'>"],
    });
  });
});

let server: Server | undefined;

afterEach(async () => {
  await new Promise<void>((resolve) => {
    if (server === undefined) resolve();
    else server.close(() => resolve());
  });
  server = undefined;
});

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

async function serve(handler: Handler): Promise<string> {
  server = createServer(handler);
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server?.address() as AddressInfo).port}`;
}

const STATIC_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "strict-transport-security": "max-age=63072000; includeSubDomains",
};

/** A server that behaves as the application should. `broken` names one thing it gets wrong. */
function application(broken?: "inline-script" | "fixed-nonce" | "echo-id"): Handler {
  let counter = 0;
  return (request, response) => {
    counter += 1;
    const nonce = broken === "fixed-nonce" ? "fixed" : `nonce${counter}`;
    const id =
      broken === "echo-id" ? String(request.headers["x-request-id"]) : `request_${counter}_id`;
    const common = { ...STATIC_HEADERS, "x-request-id": id };
    const path = request.url ?? "/";
    if (path === "/api/health") {
      response.writeHead(200, {
        ...common,
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      response.end('{"status":"ok"}');
      return;
    }
    if (path === "/api/csp-report") {
      if (request.method !== "POST") {
        response.writeHead(405, common).end();
        return;
      }
      let size = 0;
      request.on("data", (chunk: Buffer) => (size += chunk.length));
      request.on("end", () => response.writeHead(size > 16 * 1024 ? 413 : 204, common).end());
      return;
    }
    response.writeHead(404, {
      ...common,
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": GOOD_POLICY(nonce),
    });
    const extra = broken === "inline-script" ? "<script>alert(1)</script>" : "";
    response.end(
      `<html><body><script nonce="${nonce}" src="/_next/a.js"></script>${extra}</body></html>`,
    );
  };
}

const failed = (checks: { name: string; status: string }[]) =>
  checks.filter((item) => item.status === "fail").map((item) => item.name);

describe("verifyDeployment", () => {
  it("[NFR-SEC-02] [FR-SYS-04] [NFR-OBS-01] passes a deployment that does everything right", async () => {
    const checks = await verifyDeployment({ url: await serve(application()) });
    expect(failed(checks)).toEqual([]);
    expect(checks.find((item) => item.name === "Strict-Transport-Security")?.status).toBe("skip");
  });

  it("[NFR-SEC-02] fails a page with a script that lacks the nonce", async () => {
    const checks = await verifyDeployment({ url: await serve(application("inline-script")) });
    expect(failed(checks)).toEqual(["every script carries the nonce"]);
  });

  it("[NFR-SEC-02] fails a deployment that reuses its nonce", async () => {
    const checks = await verifyDeployment({ url: await serve(application("fixed-nonce")) });
    expect(failed(checks)).toEqual(["a new nonce per request"]);
  });

  it("[NFR-OBS-01] fails a deployment that echoes the client's request ID", async () => {
    const checks = await verifyDeployment({ url: await serve(application("echo-id")) });
    expect(failed(checks)).toContain("a client-sent request ID is replaced");
  });
});

describe("verifyRepository", () => {
  it("[NFR-SEC-04] passes when scanning, push protection, reporting, and the limit are on", () => {
    const answers: Record<string, unknown> = {
      "repos/o/r": {
        security_and_analysis: {
          secret_scanning: { status: "enabled" },
          secret_scanning_push_protection: { status: "enabled" },
        },
      },
      "repos/o/r/interaction-limits": { limit: "collaborators_only" },
      "repos/o/r/private-vulnerability-reporting": { enabled: true },
    };
    expect(failed(verifyRepository("o/r", (path) => answers[path]))).toEqual([]);
  });

  it("[NFR-SEC-04] fails when the interaction limit has expired", () => {
    const answers: Record<string, unknown> = {
      "repos/o/r": {
        security_and_analysis: {
          secret_scanning: { status: "enabled" },
          secret_scanning_push_protection: { status: "enabled" },
        },
      },
      "repos/o/r/interaction-limits": {},
      "repos/o/r/private-vulnerability-reporting": { enabled: true },
    };
    expect(failed(verifyRepository("o/r", (path) => answers[path]))).toEqual([
      "interactions limited to collaborators",
    ]);
  });
});
