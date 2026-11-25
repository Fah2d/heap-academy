"use server";

import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SIGN_IN_PER_MINUTE } from "@/infrastructure/actions/action-counter";
import { defineAction } from "@/infrastructure/actions/server-action";
import {
  MAX_REQUEST_BYTES,
  MAX_SIGN_OUT_BYTES,
  MAX_VERIFY_BYTES,
  requestEmailCode as requestEmailCodeUseCase,
  requestEmailCodeInput,
  signOut as signOutUseCase,
  signOutInput,
  verifyEmailCode as verifyEmailCodeUseCase,
  verifyEmailCodeInput,
} from "./email-code";
import {
  CALLBACK_PATH,
  MAX_START_GOOGLE_BYTES,
  startGoogleSignIn as startGoogleSignInUseCase,
  startGoogleSignInInput,
} from "./google";
import type { StartGoogleState } from "../types";
import { RETURN_PATH_COOKIE, RETURN_PATH_COOKIE_MAX_AGE } from "./return-path-cookie";

// The sign-in actions of docs/spec/02-architecture.md section 9.1, each built
// with the one wrapper. `startGoogleSignIn` is not in that table yet: Google's
// redirect has to start on the server, where the PKCE verifier cookie is set
// (a spec change proposed in the WP-2.2 pull request).

export const requestEmailCode = defineAction({
  name: "request-email-code",
  access: "anyone",
  input: requestEmailCodeInput,
  maxBytes: MAX_REQUEST_BYTES,
  perMinute: SIGN_IN_PER_MINUTE,
  run: (input, { services }) => requestEmailCodeUseCase(input, services.signIn),
});

export const verifyEmailCode = defineAction({
  name: "verify-email-code",
  access: "anyone",
  input: verifyEmailCodeInput,
  maxBytes: MAX_VERIFY_BYTES,
  perMinute: SIGN_IN_PER_MINUTE,
  run: (input, { services }) => verifyEmailCodeUseCase(input, services.signIn),
});

const signOutAction = defineAction({
  name: "sign-out",
  access: "anyone",
  input: signOutInput,
  maxBytes: MAX_SIGN_OUT_BYTES,
  run: (_input, { services }) => signOutUseCase(services.signIn),
});

/**
 * Signs out this device and goes home. The provider clears this device's
 * cookies before it is told, so even its `unavailable` leaves the device
 * signed out; the wrapper's log line records that outcome.
 */
export async function signOut(): Promise<void> {
  await signOutAction({});
  redirect("/");
}

const startGoogleAction = defineAction({
  name: "start-google-sign-in",
  access: "anyone",
  input: startGoogleSignInInput,
  maxBytes: MAX_START_GOOGLE_BYTES,
  perMinute: SIGN_IN_PER_MINUTE,
  run: async (input, { services }) => {
    const origin = await requestOrigin();
    return startGoogleSignInUseCase(input, origin, services.signIn);
  },
});

/**
 * The Google button's form action: the browser is sent to Google, or the
 * form shows a notice. It needs JavaScript, like the rest of the page: the
 * page policy's `form-action 'self'` stops a plain form post from following
 * the redirect to another origin.
 */
export async function startGoogleSignIn(
  _previous: StartGoogleState,
  form: FormData,
): Promise<StartGoogleState> {
  const returnTo = form.get("returnTo");
  const result = await startGoogleAction(typeof returnTo === "string" ? { returnTo } : {});
  if (!result.ok) return { failed: true };
  (await cookies()).set(RETURN_PATH_COOKIE, result.value.returnTo, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: CALLBACK_PATH,
    maxAge: RETURN_PATH_COOKIE_MAX_AGE,
  });
  redirect(result.value.url);
}

/**
 * This site's origin as the browser sees it. The host comes from the
 * request; the auth provider sends a callback that is not on its allow-list
 * to the site address instead, so a forged host can only misdirect the
 * forger's own browser. Only the first value of a forwarded list counts, and
 * a malformed one falls back to the `host` header.
 */
async function requestOrigin(): Promise<string> {
  const list = await headers();
  const first = (name: string) => list.get(name)?.split(",")[0]?.trim() || undefined;
  const protocol = first("x-forwarded-proto") === "http" ? "http" : "https";
  for (const host of [first("x-forwarded-host"), first("host")]) {
    if (host !== undefined && URL.canParse(`${protocol}://${host}`)) {
      const origin = new URL(`${protocol}://${host}`);
      if (origin.host === host.toLowerCase()) return origin.origin;
    }
  }
  throw new Error("A server action request without a usable host header.");
}
