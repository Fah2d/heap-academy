import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { refreshSession, SESSION_REFRESH_TIMEOUT_MS } from "@/infrastructure/auth/session-refresh";
import { parsePublicEnvironment } from "@/infrastructure/env/schema";
import { createRequestId, REQUEST_ID_HEADER } from "@/infrastructure/http/request-id";
import {
  contentSecurityPolicy,
  createNonce,
  reportingEndpoints,
  SIGN_IN_PATH,
} from "@/infrastructure/http/security-headers";
import { log } from "@/infrastructure/logging/logger";
import { logRoute } from "@/infrastructure/logging/route";

// Runs before every page and route handler (docs/spec/02-architecture.md
// sections 11.1 and 12). Its only network work is the session refresh, for a
// request that carries a session cookie, and that never holds a page longer
// than SESSION_REFRESH_TIMEOUT_MS (07-operations.md section 10).
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
          global: { fetch: fetchWithin(SESSION_REFRESH_TIMEOUT_MS) },
        },
      );
    },
    timeoutMs: SESSION_REFRESH_TIMEOUT_MS,
  });
  // The page reads the refreshed token from the request's cookies.
  for (const { name, value } of refresh.cookies) request.cookies.set(name, value);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  requestHeaders.set("content-security-policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const { name, value, options } of refresh.cookies) {
    response.cookies.set(name, value, options);
  }
  // The provider asks for `cache-control: private, no-store` with new
  // cookies, so no shared cache keeps one visitor's session.
  for (const [name, value] of Object.entries(refresh.headers)) response.headers.set(name, value);
  response.headers.set("content-security-policy", policy);
  response.headers.set("reporting-endpoints", reportingEndpoints(request.nextUrl.origin));
  response.headers.set(REQUEST_ID_HEADER, requestId);

  const route = logRoute(request.method, request.nextUrl.pathname);
  log({ level: "info", requestId, route, outcome: "request" });
  if (refresh.status === "timed-out" || refresh.status === "failed") {
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

/** A fetch that gives up after `milliseconds`, so a slow auth service frees its connection. */
function fetchWithin(milliseconds: number): typeof fetch {
  return (input, init) => {
    const timeout = AbortSignal.timeout(milliseconds);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return fetch(input, { ...init, signal });
  };
}

export const config = {
  // Built files under _next/static are immutable and run no code of ours;
  // next.config.ts gives them the static security headers.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
