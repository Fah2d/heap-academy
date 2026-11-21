import type { CookieMethodsServer } from "@supabase/ssr";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hasSessionCookie, refreshSession } from "./session-refresh";

afterEach(() => {
  vi.useRealTimers();
});

const SESSION = [{ name: "sb-abcdef-auth-token", value: "x" }];
const NEW_COOKIE = { name: "sb-abcdef-auth-token", value: "new", options: { path: "/" } };
const NO_STORE = { "cache-control": "private, no-cache, no-store, must-revalidate, max-age=0" };

function client(getClaims: (cookies: CookieMethodsServer) => Promise<unknown>) {
  const created: CookieMethodsServer[] = [];
  return {
    created,
    createClient: (cookies: CookieMethodsServer) => {
      created.push(cookies);
      return { auth: { getClaims: () => getClaims(cookies) } };
    },
  };
}

describe("hasSessionCookie", () => {
  it.each([
    ["the session cookie", "sb-abcdef-auth-token", true],
    ["a chunk of it", "sb-abcdef-auth-token.0", true],
    ["the PKCE verifier alone", "sb-abcdef-auth-token-code-verifier", false],
    ["another cookie", "theme", false],
    ["a look-alike", "xsb-abcdef-auth-token", false],
  ])("[FR-AUTH-05] %s", (_name, cookie, expected) => {
    expect(hasSessionCookie([{ name: cookie, value: "v" }])).toBe(expected);
  });
});

describe("refreshSession", () => {
  it("[FR-AUTH-05] creates no client without a session cookie", async () => {
    const fake = client(() => Promise.resolve(null));
    const result = await refreshSession([{ name: "theme", value: "dark" }], {
      createClient: fake.createClient,
      timeoutMs: 1000,
    });
    expect(result).toEqual({ status: "no-session", cookies: [], headers: {} });
    expect(fake.created).toHaveLength(0);
  });

  it("[FR-AUTH-05] passes on the cookies and headers the provider writes", async () => {
    const fake = client(async (cookies) => {
      expect(await cookies.getAll()).toEqual(SESSION);
      await cookies.setAll?.([NEW_COOKIE], NO_STORE);
      return { data: { claims: {} }, error: null };
    });
    const result = await refreshSession(SESSION, {
      createClient: fake.createClient,
      timeoutMs: 1000,
    });
    expect(result).toEqual({ status: "checked", cookies: [NEW_COOKIE], headers: NO_STORE });
  });

  it("[FR-AUTH-05] a failed call leaves the cookies alone", async () => {
    const fake = client(() => Promise.reject(new Error("network down")));
    const result = await refreshSession(SESSION, {
      createClient: fake.createClient,
      timeoutMs: 1000,
    });
    expect(result).toEqual({ status: "failed", cookies: [], headers: {} });
  });

  it("[FR-AUTH-05] stops waiting at the timeout and drops cookies written later", async () => {
    vi.useFakeTimers();
    let late: (() => Promise<void>) | undefined;
    const fake = client(
      (cookies) =>
        new Promise((resolve) => {
          late = async () => {
            await cookies.setAll?.([NEW_COOKIE], NO_STORE);
            resolve(null);
          };
        }),
    );
    const pending = refreshSession(SESSION, { createClient: fake.createClient, timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    const result = await pending;
    await late?.();
    expect(result).toEqual({ status: "timed-out", cookies: [], headers: {} });
  });
});
