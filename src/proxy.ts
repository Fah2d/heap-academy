import { type NextRequest, NextResponse } from "next/server";
import { createRequestId, REQUEST_ID_HEADER } from "@/infrastructure/http/request-id";
import {
  contentSecurityPolicy,
  createNonce,
  reportingEndpoints,
} from "@/infrastructure/http/security-headers";
import { log } from "@/infrastructure/logging/logger";

// Runs before every page and route handler (docs/spec/02-architecture.md
// section 12). It does no network work, so it cannot slow a page down or
// fail it (07-operations.md section 10).
//
// The script policy carries a fresh nonce per request (ADR-0028). Next.js
// reads the nonce from the policy on the request and puts it on its own
// scripts, which is why the policy is set on the request as well as on the
// response. The request ID replaces any value the client sent (NFR-OBS-01).
export function proxy(request: NextRequest): NextResponse {
  const nonce = createNonce();
  const requestId = createRequestId();
  const policy = contentSecurityPolicy({
    nonce,
    development: process.env.NODE_ENV === "development",
    secure: request.nextUrl.protocol === "https:",
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  requestHeaders.set("content-security-policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", policy);
  response.headers.set("reporting-endpoints", reportingEndpoints(request.nextUrl.origin));
  response.headers.set(REQUEST_ID_HEADER, requestId);

  log({
    level: "info",
    requestId,
    route: `${request.method} ${request.nextUrl.pathname}`,
    outcome: "request",
  });
  return response;
}

export const config = {
  // Built files under _next/static are immutable and run no code of ours;
  // next.config.ts gives them the static security headers.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
