import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProviderError } from "./provider-outcomes";
import {
  type ConfirmOutcome,
  confirmOutcome,
  type EnrollOutcome,
  enrollOutcome,
} from "./second-step-outcomes";

// The admin's second sign-in step through Supabase's multi-factor API
// (docs/spec/02-architecture.md section 11.2, FR-ADM-02, ADR-0025, E-20).
// Factors come from listFactors(), which asks the auth service for the user
// (getUser), so they are never read from the cookie alone. The client never
// names a factor: each call finds the caller's own.

export type Enrollment =
  | { ok: true; qrCodeSvg: string; secret: string }
  | {
      ok: false;
      reason: EnrollOutcome;
    };

export type SecondStepProvider = {
  /** Whether the caller has a verified authenticator app; null when the service cannot say. */
  hasVerifiedFactor: () => Promise<boolean | null>;
  /**
   * Starts setup: removes any unfinished setup, then creates a new factor and
   * returns its QR code and key. The key is shown to the admin once and never
   * stored or logged by the product.
   */
  startEnrollment: (issuer: string) => Promise<Enrollment>;
  /** Checks a code against the unfinished factor of setup; on success the session is at aal2. */
  confirmEnrollment: (code: string) => Promise<ConfirmOutcome>;
  /** Checks a code against the verified factor; on success the session is at aal2. */
  verify: (code: string) => Promise<ConfirmOutcome>;
};

/** The part of the auth client this adapter calls, so tests can fake it. */
export type MfaApi = Pick<
  SupabaseClient["auth"]["mfa"],
  "listFactors" | "enroll" | "unenroll" | "challengeAndVerify"
>;

function providerError(error: { code?: string | undefined; status?: number | undefined }) {
  return { code: error.code, status: error.status } as ProviderError;
}

type TotpFactors = { verified: string | null; unverified: string[] } | null;

async function totpFactors(mfa: MfaApi): Promise<TotpFactors> {
  const { data, error } = await mfa.listFactors();
  if (error !== null) return null;
  const totp = data.all.filter((factor) => factor.factor_type === "totp");
  return {
    verified: totp.find((factor) => factor.status === "verified")?.id ?? null,
    // Oldest first, so the last one is the newest.
    unverified: totp
      .filter((factor) => factor.status !== "verified")
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((factor) => factor.id),
  };
}

async function confirm(mfa: MfaApi, factorId: string | null, code: string) {
  if (factorId === null) return "setup_replaced" as const;
  const { error } = await mfa.challengeAndVerify({ factorId, code });
  return confirmOutcome(error === null ? null : providerError(error));
}

export function supabaseSecondStep(mfa: MfaApi): SecondStepProvider {
  return {
    async hasVerifiedFactor() {
      const factors = await totpFactors(mfa);
      return factors === null ? null : factors.verified !== null;
    },
    async startEnrollment(issuer) {
      const factors = await totpFactors(mfa);
      if (factors === null) return { ok: false, reason: "unavailable" };
      if (factors.verified !== null) return { ok: false, reason: "already_enrolled" };
      // One unfinished setup at a time, so the factor limit is never reached
      // by reloading the page.
      for (const factorId of factors.unverified) {
        const { error } = await mfa.unenroll({ factorId });
        if (error !== null) return { ok: false, reason: "unavailable" };
      }
      const { data, error } = await mfa.enroll({ factorType: "totp", issuer });
      if (error !== null) return { ok: false, reason: enrollOutcome(providerError(error)) };
      return { ok: true, qrCodeSvg: data.totp.qr_code, secret: data.totp.secret };
    },
    async confirmEnrollment(code) {
      const factors = await totpFactors(mfa);
      if (factors === null) return "unavailable";
      // The newest unfinished factor is the one the setup page showed.
      return confirm(mfa, factors.unverified.at(-1) ?? null, code);
    },
    async verify(code) {
      const factors = await totpFactors(mfa);
      if (factors === null) return "unavailable";
      if (factors.verified === null) return "unavailable";
      return confirm(mfa, factors.verified, code);
    },
  };
}
