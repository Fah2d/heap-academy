// What the auth provider's answers mean for sign-in (FR-AUTH-02, FR-AUTH-05,
// FR-AUTH-06, T-11). The provider reports failures by `error.code`, and by
// HTTP status where it has no code; the message text is not part of its
// contract (Supabase Auth error codes, docs/spec/09-evidence.md E-09).
//
// Nothing here tells a known email from an unknown one: sign-ups stay on, so
// the provider sends a code to either and answers the same (T-11).

/** A failure as the provider reports it. */
export type ProviderError = { code?: string | undefined; status?: number | undefined };

export type SendOutcome = "sent" | "rate_limited" | "challenge_failed" | "unavailable";
export type VerifyOutcome = "signed_in" | "code_rejected" | "rate_limited" | "unavailable";
export type SignOutOutcome = "signed_out" | "unavailable";

const RATE_LIMITED = new Set(["over_email_send_rate_limit", "over_request_rate_limit"]);
// The documentation names `otp_expired` for an expired code and gives no code
// for a wrong one, so a wrong code is also treated as rejected under either
// name. The sign-in view shows one message for both. Confirmed against the
// local stack when the provider client is installed (WP-2.2 part 2).
const CODE_REJECTED = new Set(["otp_expired", "invalid_credentials"]);

function rateLimited(error: ProviderError): boolean {
  return (error.code !== undefined && RATE_LIMITED.has(error.code)) || error.status === 429;
}

export function sendOutcome(error: ProviderError | null): SendOutcome {
  if (error === null) return "sent";
  if (rateLimited(error)) return "rate_limited";
  if (error.code === "captcha_failed") return "challenge_failed";
  return "unavailable";
}

export function verifyOutcome(error: ProviderError | null): VerifyOutcome {
  if (error === null) return "signed_in";
  if (rateLimited(error)) return "rate_limited";
  if (error.code !== undefined && CODE_REJECTED.has(error.code)) return "code_rejected";
  return "unavailable";
}

/**
 * Signing out ends the session on this device even when the provider cannot
 * be told: the cookies are cleared either way. A session the provider has
 * already ended counts as signed out.
 */
export function signOutOutcome(error: ProviderError | null): SignOutOutcome {
  if (error === null) return "signed_out";
  if (error.code === "session_not_found" || error.code === "session_expired") return "signed_out";
  return "unavailable";
}
