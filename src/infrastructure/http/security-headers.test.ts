import { describe, expect, it } from "vitest";
import {
  contentSecurityPolicy,
  createNonce,
  CSP_REPORT_PATH,
  reportingEndpoints,
  SECURITY_HEADERS,
} from "./security-headers";

function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split(";").map((part) => {
      const [name = "", ...values] = part.trim().split(/\s+/);
      return [name, values];
    }),
  );
}

const production = contentSecurityPolicy({ nonce: "abc123", development: false, secure: true });

describe("content security policy", () => {
  it("[NFR-SEC-02] allows scripts by this request's nonce, with strict-dynamic and nothing unsafe", () => {
    const script = directives(production).get("script-src");
    expect(script).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
  });

  it("[NFR-SEC-02] never allows unsafe-inline for scripts or style elements, nor unsafe-eval", () => {
    const policy = directives(production);
    expect(policy.get("script-src")).not.toContain("'unsafe-inline'");
    expect(policy.get("script-src")).not.toContain("'unsafe-eval'");
    expect(policy.get("style-src")).toEqual(["'self'", "'nonce-abc123'"]);
  });

  it("[NFR-SEC-02] gives unsafe-eval to the development server only", () => {
    const development = contentSecurityPolicy({ nonce: "n", development: true, secure: false });
    expect(directives(development).get("script-src")).toContain("'unsafe-eval'");
  });

  it("[T-15] forbids framing by any origin", () => {
    expect(directives(production).get("frame-ancestors")).toEqual(["'none'"]);
  });

  it("[NFR-SEC-02] matches the policy of docs/spec/06-security-privacy.md section 5.2", () => {
    const policy = directives(production);
    expect(policy.get("default-src")).toEqual(["'self'"]);
    expect(policy.get("style-src-attr")).toEqual(["'unsafe-inline'"]);
    expect(policy.get("img-src")).toEqual(["'self'", "data:"]);
    expect(policy.get("font-src")).toEqual(["'self'"]);
    expect(policy.get("connect-src")).toEqual(["'self'"]);
    expect(policy.get("worker-src")).toEqual(["'self'"]);
    expect(policy.get("object-src")).toEqual(["'none'"]);
    expect(policy.get("base-uri")).toEqual(["'none'"]);
    expect(policy.get("form-action")).toEqual(["'self'"]);
    expect(policy.has("upgrade-insecure-requests")).toBe(true);
  });

  it("[NFR-SEC-02] reports violations to /api/csp-report by both reporting mechanisms", () => {
    const policy = directives(production);
    expect(policy.get("report-uri")).toEqual([CSP_REPORT_PATH]);
    expect(policy.get("report-to")).toEqual(["csp"]);
    expect(reportingEndpoints("https://example.test")).toBe(
      'csp="https://example.test/api/csp-report"',
    );
  });

  it("[NFR-SEC-02] does not ask a plain-HTTP local server to upgrade requests", () => {
    const local = contentSecurityPolicy({ nonce: "n", development: false, secure: false });
    expect(directives(local).has("upgrade-insecure-requests")).toBe(false);
  });
});

describe("nonce", () => {
  it("[NFR-SEC-02] is 128 random bits, base64, and fresh each time", () => {
    const first = createNonce();
    expect(first).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(createNonce()).not.toBe(first);
  });
});

describe("response headers", () => {
  it("[NFR-SEC-02] [T-15] sets HSTS, nosniff, the referrer policy, and a restrictive permissions policy", () => {
    const headers = new Map(SECURITY_HEADERS.map(({ key, value }) => [key, value]));
    expect(headers.get("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("Permissions-Policy")).toContain("microphone=()");
    expect(headers.get("Permissions-Policy")).toContain("geolocation=()");
  });
});
