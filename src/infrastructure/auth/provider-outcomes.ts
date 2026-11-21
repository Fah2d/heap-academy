// What the auth provider's answers mean for sign-in (FR-AUTH-02, FR-AUTH-05,
// FR-AUTH-06, T-11). The provider reports failures by `error.code`, and by
// HTTP status where it has no code; the message text is not part of its
// contract (Supabase's "Error codes" page for Auth, read 2026-11-21).
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
// for a wrong one, so either name counts as a rejected code. Whether the
// provider can tell a wrong code from an expired one is checked against the
// local stack in WP-2.2 part 2; until then the sign-in view cannot show the
// two states of 03-experience.md section 8 apart (a proposed spec change in
// the WP-2.2 pull request).
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
 * A session the provider has already ended counts as signed out. Any other
 * failure is `unavailable`: the adapter still clears this device's cookies,
 * and the view says the provider could not be told.
 */
export function signOutOutcome(error: ProviderError | null): SignOutOutcome {
  if (error === null) return "signed_out";
  if (error.code === "session_not_found" || error.code === "session_expired") return "signed_out";
  return "unavailable";
}
