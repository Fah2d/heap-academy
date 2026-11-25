import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The Google flow's glue with Next.js: the return path kept in a cookie by
// the start action, and read, deleted and followed by the callback
// (FR-AUTH-01, FR-AUTH-04). Next.js and the session client are faked.

vi.mock("server-only", () => ({}));

const store = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  set: vi.fn(),
  deleted: vi.fn(),
  headers: new Headers(),
}));
const auth = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  getClaims: vi.fn(() => Promise.resolve({ data: null, error: null })),
}));

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        store.cookies.has(name) ? { name, value: store.cookies.get(name) } : undefined,
      getAll: () => [],
      set: store.set,
      delete: store.deleted,
    }),
  headers: () => Promise.resolve(store.headers),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));
vi.mock("@/infrastructure/db/session-client", () => ({
  createSessionClient: () => Promise.resolve({ auth, rpc: vi.fn() }),
}));

const { startGoogleSignIn } = await import("./actions");
const { handleGoogleCallback } = await import("./google-callback");
const { RETURN_PATH_COOKIE } = await import("./return-path-cookie");

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  store.cookies.clear();
  store.headers = new Headers({ host: "heap.test", "x-forwarded-proto": "https" });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function form(returnTo: string): FormData {
  const data = new FormData();
  data.set("returnTo", returnTo);
  return data;
}

async function redirectOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as { url: string }).url;
  }
  throw new Error("no redirect");
}

describe("startGoogleSignIn", () => {
  it("[FR-AUTH-01] [FR-AUTH-04] keeps the return path in a short-lived cookie for the callback only, and goes to Google", async () => {
    auth.signInWithOAuth.mockResolvedValue({
      data: { provider: "google", url: "https://accounts.google.test/o" },
      error: null,
    });
    const url = await redirectOf(startGoogleSignIn({ failed: false }, form("/courses/python/1")));
    expect(url).toBe("https://accounts.google.test/o");
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://heap.test/auth/callback", skipBrowserRedirect: true },
    });
    expect(store.set).toHaveBeenCalledWith(RETURN_PATH_COOKIE, "/courses/python/1", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/auth/callback",
      maxAge: 600,
    });
  });

  it("[FR-AUTH-04] [T-11] keeps a safe path, never another site", async () => {
    auth.signInWithOAuth.mockResolvedValue({ data: { url: "https://g.test" }, error: null });
    await redirectOf(startGoogleSignIn({ failed: false }, form("//evil.example")));
    expect(store.set.mock.calls[0]?.[1]).toBe("/courses");
  });

  it("[FR-AUTH-01] [T-11] takes the first forwarded host, and falls back to the host header when it is malformed", async () => {
    auth.signInWithOAuth.mockResolvedValue({ data: { url: "https://g.test" }, error: null });
    store.headers = new Headers({
      host: "heap.test",
      "x-forwarded-host": "first.test, second.test",
    });
    await redirectOf(startGoogleSignIn({ failed: false }, form("/courses")));
    expect(auth.signInWithOAuth.mock.calls[0]?.[0].options.redirectTo).toBe(
      "https://first.test/auth/callback",
    );
    store.headers = new Headers({ host: "heap.test", "x-forwarded-host": "bad host/x" });
    await redirectOf(startGoogleSignIn({ failed: false }, form("/courses")));
    expect(auth.signInWithOAuth.mock.calls[1]?.[0].options.redirectTo).toBe(
      "https://heap.test/auth/callback",
    );
  });

  it("[FR-AUTH-01] says so when Google cannot start, and sets no cookie", async () => {
    auth.signInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: { code: "unexpected_failure", status: 500 },
    });
    expect(await startGoogleSignIn({ failed: false }, form("/courses"))).toEqual({ failed: true });
    expect(store.set).not.toHaveBeenCalled();
  });
});

describe("handleGoogleCallback", () => {
  const callback = (query: string) =>
    handleGoogleCallback(new NextRequest(`https://heap.test/auth/callback${query}`));

  it("[FR-AUTH-04] follows the kept path after the exchange, and deletes the cookie", async () => {
    store.cookies.set(RETURN_PATH_COOKIE, "/courses/python/1");
    auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    const response = await callback("?code=abc");
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://heap.test/courses/python/1");
    expect(store.deleted).toHaveBeenCalledWith({
      name: RETURN_PATH_COOKIE,
      path: "/auth/callback",
    });
  });

  it("[FR-AUTH-04] [T-11] makes a tampered cookie safe, and falls back without one", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    store.cookies.set(RETURN_PATH_COOKIE, "https://evil.example/x");
    expect((await callback("?code=abc")).headers.get("location")).toBe("https://heap.test/courses");
    store.cookies.clear();
    expect((await callback("?code=abc")).headers.get("location")).toBe("https://heap.test/courses");
  });

  it("[FR-AUTH-01] a refusal at Google or a failed exchange goes back to sign-in with the kept path", async () => {
    store.cookies.set(RETURN_PATH_COOKIE, "/courses/python");
    const refused = await callback("?error=access_denied");
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(refused.headers.get("location")).toBe(
      "https://heap.test/sign-in?failed=google&returnTo=%2Fcourses%2Fpython",
    );
    auth.exchangeCodeForSession.mockResolvedValue({
      data: {},
      error: { code: "bad_code_verifier" },
    });
    expect((await callback("?code=abc")).headers.get("location")).toMatch(
      /\/sign-in\?failed=google/,
    );
  });
});
