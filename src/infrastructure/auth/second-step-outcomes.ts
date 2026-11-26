// What the auth provider's multi-factor answers mean for the admin's second
// step (FR-ADM-02, T-19). The provider reports failures by `error.code`, and
// by HTTP status where it has no code (Supabase's "Error codes" page for
// Auth, read 2026-11-21).

import type { ProviderError } from "./provider-outcomes";

export type ConfirmOutcome =
  "verified" | "code_rejected" | "rate_limited" | "setup_replaced" | "unavailable";

export type EnrollOutcome = "already_enrolled" | "unavailable";

export function confirmOutcome(error: ProviderError | null): ConfirmOutcome {
  if (error === null) return "verified";
  if (error.code === "over_request_rate_limit" || error.status === 429) return "rate_limited";
  // `mfa_challenge_expired` cannot normally happen, because the challenge is
  // created and answered in one call; if it does, a new code is the remedy,
  // as for a wrong one.
  if (error.code === "mfa_verification_failed" || error.code === "mfa_challenge_expired") {
    return "code_rejected";
  }
  // The factor shown on the setup page was replaced, by setup opened again
  // in another tab.
  if (error.code === "mfa_factor_not_found") return "setup_replaced";
  // Everything else, including `mfa_ip_address_mismatch` (the challenge and
  // the verification reached the provider from different server addresses)
  // and `mfa_totp_verify_not_enabled`, is not fixed by a new code.
  return "unavailable";
}

export function enrollOutcome(error: ProviderError): EnrollOutcome {
  // A verified factor exists, so enrolling another needs aal2.
  if (error.code === "insufficient_aal") return "already_enrolled";
  return "unavailable";
}
