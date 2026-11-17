import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "./proxy";

afterEach(() => {
  vi.restoreAllMocks();
});

function run(url: string, headers: Record<string, string> = {}) {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  return proxy(new NextRequest(url, { headers }));
}

// NextResponse.next({ request: { headers } }) passes the request headers on
// to the app as `x-middleware-request-<name>`.
const forwarded = (response: Response, name: string) =>
  response.headers.get(`x-middleware-request-${name}`);

describe("proxy", () => {
  it("[NFR-SEC-02] sets a policy with this request's nonce on the response and on the request", () => {
    const response = run("https://heap.test/courses");
    const policy = response.headers.get("content-security-policy") ?? "";
    const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
    expect(nonce).toBeDefined();
    expect(forwarded(response, "content-security-policy")).toBe(policy);
  });

  it("[NFR-SEC-02] gives every request a different nonce", () => {
    const first = run("https://heap.test/").headers.get("content-security-policy");
    const second = run("https://heap.test/").headers.get("content-security-policy");
    expect(first).not.toBe(second);
  });

  it("[NFR-OBS-01] gives every request an ID, on the response and for the app", () => {
    const response = run("https://heap.test/");
    const id = response.headers.get("x-request-id");
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(forwarded(response, "x-request-id")).toBe(id);
  });

  it("[NFR-OBS-01] replaces a request ID the client sent", () => {
    const response = run("https://heap.test/", { "x-request-id": "client_chosen_id_1234" });
    expect(response.headers.get("x-request-id")).not.toBe("client_chosen_id_1234");
    expect(forwarded(response, "x-request-id")).not.toBe("client_chosen_id_1234");
  });

  it("[NFR-OBS-01] logs the request with its ID and path, without the query string", () => {
    const write = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const response = proxy(new NextRequest("https://heap.test/api/health?email=a%40b.test"));
    const entry: unknown = JSON.parse(String(write.mock.calls[0]?.[0]));
    expect(entry).toMatchObject({
      level: "info",
      requestId: response.headers.get("x-request-id"),
      route: "GET /api/health",
      outcome: "request",
    });
    expect(JSON.stringify(entry)).not.toContain("email");
  });

  it("[NFR-PRIV-03] [T-16] logs an email in the path as a parameter, and bounds the line", () => {
    const write = vi.spyOn(console, "log").mockImplementation(() => undefined);
    proxy(new NextRequest(`https://heap.test/ada@example.com/${"x".repeat(3000)}`));
    const line = String(write.mock.calls[0]?.[0]);
    expect(line).not.toContain("ada@example.com");
    expect(line).not.toContain("xxx");
    expect(JSON.parse(line)).toMatchObject({ route: "GET /:param/:param" });
  });

  it("[NFR-SEC-02] gives production no unsafe-eval, and upgrades requests over HTTPS only", () => {
    // Vitest runs with NODE_ENV=test, as a production server runs with production.
    expect(process.env.NODE_ENV).not.toBe("development");
    const secure = run("https://heap.test/").headers.get("content-security-policy") ?? "";
    expect(secure).not.toContain("'unsafe-eval'");
    expect(secure).toContain("upgrade-insecure-requests");
    const plain = run("http://127.0.0.1:3100/").headers.get("content-security-policy") ?? "";
    expect(plain).not.toContain("upgrade-insecure-requests");
  });

  it("[NFR-SEC-02] gives the development server unsafe-eval", () => {
    vi.stubEnv("NODE_ENV", "development");
    try {
      expect(run("http://127.0.0.1:3000/").headers.get("content-security-policy")).toContain(
        "'unsafe-eval'",
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("[NFR-SEC-02] names the report endpoint on this origin", () => {
    const response = run("https://heap.test/");
    expect(response.headers.get("reporting-endpoints")).toBe(
      'csp="https://heap.test/api/csp-report"',
    );
  });
});

describe("proxy matcher", () => {
  const matches = (path: string) =>
    config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(path));

  it("[T-01] leaves the runtime's files alone, so the worker keeps its own policy", () => {
    expect(matches("/_runtime/worker/worker/python-worker.js")).toBe(false);
    expect(matches("/_runtime/pyodide/314.0.7/pyodide.asm.wasm")).toBe(false);
  });

  it("[NFR-SEC-02] still runs for pages and route handlers", () => {
    expect(matches("/")).toBe(true);
    expect(matches("/dev/runtime")).toBe(true);
    expect(matches("/api/health")).toBe(true);
    expect(matches("/_runtimes")).toBe(true);
  });
});
