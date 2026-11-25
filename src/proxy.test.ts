import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTH_TIMEOUT_MS } from "@/infrastructure/http/fetch-within";
import { proxy } from "./proxy";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function run(url: string, headers: Record<string, string> = {}) {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  return proxy(new NextRequest(url, { headers }));
}

const SUPABASE_URL = "https://project.supabase.test";
const SESSION_COOKIE = "sb-project-auth-token";

function stubSupabaseEnvironment() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
}

// NextResponse.next({ request: { headers } }) passes the request headers on
// to the app as `x-middleware-request-<name>`.
const forwarded = (response: Response, name: string) =>
  response.headers.get(`x-middleware-request-${name}`);

describe("proxy", () => {
  it("[FR-ADM-02] sends every admin address, and only those, with private, no-store", async () => {
    for (const path of ["/admin", "/admin/setup", "/admin/verify", "/admin/courses/x"]) {
      expect((await run(`https://heap.test${path}`)).headers.get("cache-control"), path).toBe(
        "private, no-store",
      );
    }
    for (const path of ["/administrator", "/courses", "/sign-in"]) {
      expect((await run(`https://heap.test${path}`)).headers.get("cache-control"), path).toBeNull();
    }
  });

  it("[NFR-SEC-02] sets a policy with this request's nonce on the response and on the request", async () => {
    const response = await run("https://heap.test/courses");
    const policy = response.headers.get("content-security-policy") ?? "";
    const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
    expect(nonce).toBeDefined();
    expect(forwarded(response, "content-security-policy")).toBe(policy);
  });

  it("[NFR-SEC-02] [FR-AUTH-06] frames the bot challenge on the sign-in page only", async () => {
    const policy = async (url: string) =>
      (await run(url)).headers.get("content-security-policy") ?? "";
    expect(await policy("https://heap.test/sign-in")).toContain(
      "frame-src https://challenges.cloudflare.com",
    );
    expect(await policy("https://heap.test/sign-in?returnTo=/courses")).toContain("frame-src");
    expect(await policy("https://heap.test/courses")).not.toContain("frame-src");
    expect(await policy("https://heap.test/sign-in/other")).not.toContain("frame-src");
  });

  it("[NFR-SEC-02] gives every request a different nonce", async () => {
    const first = (await run("https://heap.test/")).headers.get("content-security-policy");
    const second = (await run("https://heap.test/")).headers.get("content-security-policy");
    expect(first).not.toBe(second);
  });

  it("[NFR-OBS-01] gives every request an ID, on the response and for the app", async () => {
    const response = await run("https://heap.test/");
    const id = response.headers.get("x-request-id");
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(forwarded(response, "x-request-id")).toBe(id);
  });

  it("[NFR-OBS-01] replaces a request ID the client sent", async () => {
    const response = await run("https://heap.test/", { "x-request-id": "client_chosen_id_1234" });
    expect(response.headers.get("x-request-id")).not.toBe("client_chosen_id_1234");
    expect(forwarded(response, "x-request-id")).not.toBe("client_chosen_id_1234");
  });

  it("[NFR-OBS-01] logs the request with its ID and path, without the query string", async () => {
    const write = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const response = await proxy(new NextRequest("https://heap.test/api/health?email=a%40b.test"));
    const entry: unknown = JSON.parse(String(write.mock.calls[0]?.[0]));
    expect(entry).toMatchObject({
      level: "info",
      requestId: response.headers.get("x-request-id"),
      route: "GET /api/health",
      outcome: "request",
    });
    expect(JSON.stringify(entry)).not.toContain("email");
  });

  it("[NFR-PRIV-03] [T-16] logs an email in the path as a parameter, and bounds the line", async () => {
    const write = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await proxy(new NextRequest(`https://heap.test/ada@example.com/${"x".repeat(3000)}`));
    const line = String(write.mock.calls[0]?.[0]);
    expect(line).not.toContain("ada@example.com");
    expect(line).not.toContain("xxx");
    expect(JSON.parse(line)).toMatchObject({ route: "GET /:param/:param" });
  });

  it("[NFR-SEC-02] gives production no unsafe-eval, and upgrades requests over HTTPS only", async () => {
    // Vitest runs with NODE_ENV=test, as a production server runs with production.
    expect(process.env.NODE_ENV).not.toBe("development");
    const secure = (await run("https://heap.test/")).headers.get("content-security-policy") ?? "";
    expect(secure).not.toContain("'unsafe-eval'");
    expect(secure).toContain("upgrade-insecure-requests");
    const plain =
      (await run("http://127.0.0.1:3100/")).headers.get("content-security-policy") ?? "";
    expect(plain).not.toContain("upgrade-insecure-requests");
  });

  it("[NFR-SEC-02] gives the development server unsafe-eval", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect((await run("http://127.0.0.1:3000/")).headers.get("content-security-policy")).toContain(
      "'unsafe-eval'",
    );
  });

  it("[NFR-SEC-02] names the report endpoint on this origin", async () => {
    const response = await run("https://heap.test/");
    expect(response.headers.get("reporting-endpoints")).toBe(
      'csp="https://heap.test/api/csp-report"',
    );
  });
});

describe("proxy session refresh", () => {
  it("[FR-AUTH-05] a request without a session cookie makes no call to the auth service", async () => {
    stubSupabaseEnvironment();
    const fetchSpy = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchSpy);
    const response = await run("https://heap.test/courses", { cookie: "theme=dark; other=1" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("[FR-AUTH-05] never passes on a client's own auth-unavailable marker", async () => {
    const response = await run("https://heap.test/courses", { "x-heap-auth-unavailable": "1" });
    expect(forwarded(response, "x-heap-auth-unavailable")).toBeNull();
  });

  it("[FR-AUTH-05] a request with a session cookie asks the auth service, and the page is served", async () => {
    stubSupabaseEnvironment();
    const fetchSpy = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(JSON.stringify({ code: 500 }), { status: 500 })),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const response = await run("https://heap.test/courses", {
      cookie: `${SESSION_COOKIE}=${encodeURIComponent(JSON.stringify(EXPIRED_SESSION))}`,
    });
    expect(fetchSpy).toHaveBeenCalled();
    const firstUrl = String(fetchSpy.mock.calls[0]?.[0]);
    expect(firstUrl.startsWith(SUPABASE_URL)).toBe(true);
    expect(response.headers.get("content-security-policy")).toContain("nonce-");
  });

  it("[FR-AUTH-05] fails open: an auth service that never answers does not hold the page past the timeout", async () => {
    stubSupabaseEnvironment();
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>((_input, init) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        });
      }),
    );
    const write = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const pending = proxy(
      new NextRequest("https://heap.test/courses", {
        headers: {
          cookie: `${SESSION_COOKIE}=${encodeURIComponent(JSON.stringify(EXPIRED_SESSION))}`,
        },
      }),
    );
    await vi.advanceTimersByTimeAsync(AUTH_TIMEOUT_MS + 10);
    const response = await pending;
    expect(response.headers.get("content-security-policy")).toContain("nonce-");
    expect(response.headers.get("set-cookie")).toBeNull();
    const outcomes = write.mock.calls.map(([line]) => JSON.parse(String(line)).outcome as string);
    expect(outcomes).toContain("session-refresh:timed-out");
    expect(forwarded(response, "x-heap-auth-unavailable")).toBe("1");
  });
});

// A session whose access token expired long ago, so getClaims() refreshes it.
const EXPIRED_SESSION = {
  access_token: "a.b.c",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: 1,
  refresh_token: "refresh-token",
  user: { id: "00000000-0000-4000-8000-000000000001" },
};
