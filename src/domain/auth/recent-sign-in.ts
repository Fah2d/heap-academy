// Whether the person signed in recently enough to delete their account
// (docs/spec/02-architecture.md section 9.1, T-01). The time comes from the
// verified token's `amr` claim, which records when each sign-in method was
// used. The token's own issue time is no use: a refresh renews it without
// the person doing anything.

export const RECENT_SIGN_IN_MS = 5 * 60_000;

/**
 * The methods in which a person proves who they are. A token refresh is not
 * one. Nor is `totp`: whoever holds a session can enroll a factor of their own
 * and verify it, which would make a stolen session look new.
 */
const SIGN_IN_METHODS = new Set(["otp", "oauth", "magiclink", "email/signup"]);

export function signedInRecently(claims: unknown, now: number): boolean {
  if (typeof claims !== "object" || claims === null) return false;
  const amr = (claims as Record<string, unknown>)["amr"];
  if (!Array.isArray(amr)) return false;
  return amr.some((entry: unknown) => {
    if (typeof entry !== "object" || entry === null) return false;
    const { method, timestamp } = entry as Record<string, unknown>;
    if (typeof method !== "string" || !SIGN_IN_METHODS.has(method)) return false;
    // Seconds since 1970, as in the token's other times.
    return typeof timestamp === "number" && now - timestamp * 1000 <= RECENT_SIGN_IN_MS;
  });
}
