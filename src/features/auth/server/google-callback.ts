import "server-only";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { supabaseSignInProvider } from "@/infrastructure/auth/sign-in-provider";
import { createSessionClient } from "@/infrastructure/db/session-client";
import {
  createRequestId,
  parseRequestId,
  REQUEST_ID_HEADER,
} from "@/infrastructure/http/request-id";
import { log } from "@/infrastructure/logging/logger";
import { logRoute } from "@/infrastructure/logging/route";
import { completeGoogleSignIn } from "./google";
import { RETURN_PATH_COOKIE } from "./return-path-cookie";

/**
 * `GET /auth/callback` (docs/spec/02-architecture.md section 9.2): exchanges
 * Google's code for a session, sets the session cookies, and sends the
 * browser to the kept return path, or back to sign-in when anything failed.
 */
export async function handleGoogleCallback(request: NextRequest): Promise<NextResponse> {
  const started = performance.now();
  const requestId = parseRequestId(request.headers.get(REQUEST_ID_HEADER)) ?? createRequestId();
  const store = await cookies();
  const kept = store.get(RETURN_PATH_COOKIE)?.value;
  store.delete({ name: RETURN_PATH_COOKIE, path: request.nextUrl.pathname });

  const db = await createSessionClient("read-write");
  const { outcome, location } = await completeGoogleSignIn(
    { code: request.nextUrl.searchParams.get("code") },
    kept,
    supabaseSignInProvider(db.auth),
  );
  log({
    level: outcome === "signed_in" ? "info" : "warn",
    requestId,
    route: logRoute("GET", request.nextUrl.pathname),
    outcome: outcome === "signed_in" ? "ok" : "error:google-failed",
    durationMs: Math.round(performance.now() - started),
  });
  // 303, so the browser follows with a GET whatever brought it here.
  return NextResponse.redirect(new URL(location, request.nextUrl.origin), 303);
}
