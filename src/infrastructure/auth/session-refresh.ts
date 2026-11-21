import type { CookieMethodsServer, CookieOptions } from "@supabase/ssr";

// Session refresh before every page (FR-AUTH-05, docs/spec/02-architecture.md
// section 11.1, 07-operations.md section 10). It follows the provider's
// server-side guide: getClaims() verifies the token and refreshes it when it
// has expired, and the new cookies go to the request the app sees and to the
// response. Two rules of this product come on top:
//
// - A request with no session cookie makes no call to the auth service.
// - It fails open: when the auth service is slow or down, the page is served
//   as it would be for a signed-out visitor. It never waits longer than the
//   timeout.

/** How long a page waits for the auth service before it is served anyway. */
export const SESSION_REFRESH_TIMEOUT_MS = 1500;

// The provider's session cookie, `sb-<project ref>-auth-token`, split into
// numbered chunks when it is long.
const SESSION_COOKIE = /^sb-[A-Za-z0-9-]+-auth-token(?:\.\d+)?$/;

export type RequestCookie = { name: string; value: string };
export type CookieToSet = { name: string; value: string; options: CookieOptions };

export type RefreshStatus =
  /** No session cookie: nothing was asked of the auth service. */
  | "no-session"
  /** The auth service answered, with a session or without one. */
  | "checked"
  /** No answer within the timeout. */
  | "timed-out"
  /** The call failed. */
  | "failed";

export type RefreshResult = {
  status: RefreshStatus;
  /** Cookies to set on the request and the response. Empty unless `checked`. */
  cookies: CookieToSet[];
  /** Headers the provider asks for with new cookies, such as `cache-control`. */
  headers: Record<string, string>;
};

export type AuthClient = { auth: { getClaims: () => Promise<unknown> } };

export type RefreshDependencies = {
  createClient: (cookies: CookieMethodsServer) => AuthClient;
  timeoutMs: number;
};

export function hasSessionCookie(cookies: readonly RequestCookie[]): boolean {
  return cookies.some((cookie) => SESSION_COOKIE.test(cookie.name));
}

export async function refreshSession(
  requestCookies: readonly RequestCookie[],
  dependencies: RefreshDependencies,
): Promise<RefreshResult> {
  if (!hasSessionCookie(requestCookies)) return { status: "no-session", cookies: [], headers: {} };

  let written: { cookies: CookieToSet[]; headers: Record<string, string> } = {
    cookies: [],
    headers: {},
  };
  let open = true;
  const client = dependencies.createClient({
    getAll: () => requestCookies.map(({ name, value }) => ({ name, value })),
    setAll: (cookies, headers) => {
      // Cookies written after the timeout are dropped: the response has gone.
      if (open) written = { cookies, headers };
    },
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timed-out">((resolve) => {
    timer = setTimeout(() => resolve("timed-out"), dependencies.timeoutMs);
  });
  let status: RefreshStatus;
  try {
    status = await Promise.race([
      client.auth.getClaims().then(
        () => "checked" as const,
        () => "failed" as const,
      ),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
    open = false;
  }
  return status === "checked" ? { status, ...written } : { status, cookies: [], headers: {} };
}
