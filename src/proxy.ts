import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { AUTH_UNAVAILABLE_HEADER, refreshSession } from "@/infrastructure/auth/session-refresh";
import { parsePublicEnvironment } from "@/infrastructure/env/schema";
import { AUTH_TIMEOUT_MS, fetchWithin } from "@/infrastructure/http/fetch-within";
import { createRequestId, REQUEST_ID_HEADER } from "@/infrastructure/http/request-id";
import {
  contentSecurityPolicy,
  createNonce,
  isAdminPath,
  reportingEndpoints,
  SIGN_IN_PATH,
} from "@/infrastructure/http/security-headers";
import { log } from "@/infrastructure/logging/logger";
import { logRoute } from "@/infrastructure/logging/route";

// Runs before every page and route handler (docs/spec/02-architecture.md
// sections 11.1 and 12). Its only network work is the session refresh, for a
// request that carries a session cookie, and that never holds a page longer
// than AUTH_TIMEOUT_MS (07-operations.md section 10).
//
// The script policy carries a fresh nonce per request (ADR-0028). Next.js
// reads the nonce from the policy on the request and puts it on its own
// scripts, which is why the policy is set on the request as well as on the
// response. The request ID replaces any value the client sent (NFR-OBS-01).
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const started = performance.now();
  const nonce = createNonce();
  const requestId = createRequestId();
  const policy = contentSecurityPolicy({
    nonce,
    development: process.env.NODE_ENV === "development",
    secure: request.nextUrl.protocol === "https:",
    signInPage: request.nextUrl.pathname === SIGN_IN_PATH,
  });

  const refresh = await refreshSession(request.cookies.getAll(), {
    createClient: (cookies) => {
      const environment = parsePublicEnvironment(process.env);
      return createServerClient(
        environment.NEXT_PUBLIC_SUPABASE_URL,
        environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        {
          cookies,
          global: { fetch: fetchWithin(AUTH_TIMEOUT_MS) },
        },
      );
    },
    timeoutMs: AUTH_TIMEOUT_MS,
  });
  // The page reads the refreshed token from the request's cookies.
  for (const { name, value } of refresh.cookies) request.cookies.set(name, value);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  requestHeaders.set("content-security-policy", policy);
  // Never the client's value: only this proxy decides it.
  requestHeaders.delete(AUTH_UNAVAILABLE_HEADER);
  if (refresh.status === "timed-out" || refresh.status === "failed") {
    requestHeaders.set(AUTH_UNAVAILABLE_HEADER, "1");
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const { name, value, options } of refresh.cookies) {
    response.cookies.set(name, value, options);
  }
  // The provider asks for `cache-control: private, no-store` with new
  // cookies, so no shared cache keeps one visitor's session.
  for (const [name, value] of Object.entries(refresh.headers)) response.headers.set(name, value);
  if (isAdminPath(request.nextUrl.pathname)) {
    response.headers.set("cache-control", "private, no-store");
  }
  response.headers.set("content-security-policy", policy);
  response.headers.set("reporting-endpoints", reportingEndpoints(request.nextUrl.origin));
  response.headers.set(REQUEST_ID_HEADER, requestId);

  const route = logRoute(request.method, request.nextUrl.pathname);
  log({ level: "info", requestId, route, outcome: "request" });
  if (refresh.status !== "no-session" && refresh.status !== "checked") {
    log({
      level: "warn",
      requestId,
      route,
      outcome: `session-refresh:${refresh.status}`,
      durationMs: Math.round(performance.now() - started),
    });
  }
  return response;
}

export const config = {
  // Built files under _next/static are immutable and run no code of ours;
  // next.config.ts gives them the static security headers. The runtime's
  // files under _runtime are static too, and the worker script there carries
  // its own policy, which the page policy must not replace. Each exclusion
  // ends at a slash or at the end of the path, so a path that only starts
  // with one of these names (/_next/imageX) still gets the page policy.
  // /favicon.ico is not excluded: there is no icon (ADR-0031), so that path
  // renders the not-found page, which needs the page policy like any page.
  matcher: ["/((?!_next/static/|_next/image$|_runtime/).*)"],
};
