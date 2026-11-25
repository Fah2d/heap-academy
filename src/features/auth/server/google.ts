import "server-only";
import { z } from "zod";
import { safeReturnPath } from "@/domain/auth/return-path";
import type { UseCaseResult } from "@/infrastructure/actions/define-action";
import type { SignInProvider } from "@/infrastructure/auth/sign-in-provider";

// Sign-in with Google through the provider's redirect flow with PKCE
// (FR-AUTH-01, FR-AUTH-04, docs/spec/02-architecture.md section 11.1).
//
// The return path travels in a short-lived cookie, not in the callback
// address: the provider accepts only callback addresses on its allow-list,
// and the allow-list holds the bare `/auth/callback`.

export const CALLBACK_PATH = "/auth/callback";
export const SIGN_IN_FAILED_GOOGLE = "google";

export const startGoogleSignInInput = z.strictObject({
  returnTo: z.string().max(512).optional(),
});
export const MAX_START_GOOGLE_BYTES = 6 * 512 + 64;

export type StartGoogleValue = { url: string; returnTo: string };

/** The address of Google's sign-in page, and the safe return path to keep until the callback. */
export async function startGoogleSignIn(
  input: z.infer<typeof startGoogleSignInInput>,
  origin: string,
  provider: Pick<SignInProvider, "startGoogle">,
): Promise<UseCaseResult<StartGoogleValue, "unavailable">> {
  const started = await provider.startGoogle(new URL(CALLBACK_PATH, origin).href);
  if (!started.ok) return { ok: false, error: "unavailable" };
  return { ok: true, value: { url: started.url, returnTo: safeReturnPath(input.returnTo) } };
}

/**
 * Where the callback sends the browser: the kept return path after a
 * session is made, or back to sign-in with a notice when anything failed,
 * including a refusal on Google's page.
 */
export async function completeGoogleSignIn(
  query: { code: string | null },
  keptReturnPath: string | undefined,
  provider: Pick<SignInProvider, "completeGoogle">,
): Promise<{ outcome: "signed_in" | "failed"; location: string }> {
  const returnTo = safeReturnPath(keptReturnPath);
  if (query.code !== null && query.code !== "") {
    const outcome = await provider.completeGoogle(query.code);
    if (outcome === "signed_in") return { outcome, location: returnTo };
  }
  const params = new URLSearchParams({ failed: SIGN_IN_FAILED_GOOGLE, returnTo });
  return { outcome: "failed", location: `/sign-in?${params.toString()}` };
}
