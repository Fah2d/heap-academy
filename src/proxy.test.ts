import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

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
    const response = proxy(new NextRequest("https://heap.test/courses?email=a%40b.test"));
    const entry: unknown = JSON.parse(String(write.mock.calls[0]?.[0]));
    expect(entry).toMatchObject({
      level: "info",
      event: "request",
      requestId: response.headers.get("x-request-id"),
      route: "/courses",
    });
    expect(JSON.stringify(entry)).not.toContain("email");
  });

  it("[NFR-SEC-02] names the report endpoint on this origin", () => {
    const response = run("https://heap.test/");
    expect(response.headers.get("reporting-endpoints")).toBe(
      'csp="https://heap.test/api/csp-report"',
    );
  });
});
