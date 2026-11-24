import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type ProviderError,
  type SendOutcome,
  type SignOutOutcome,
  sendOutcome,
  signOutOutcome,
  type VerifyOutcome,
  verifyOutcome,
} from "./provider-outcomes";

// Sign-in through Supabase Auth (docs/spec/02-architecture.md section 11.1,
// ADR-0017). The session client sets the session cookies itself; this module
// only turns the provider's answers into the outcomes the use cases know.

export type GoogleStart = { ok: true; url: string } | { ok: false };
export type GoogleCompletion = "signed_in" | "failed";

export type SignInProvider = {
  /** Sends a code. The challenge token goes to the provider, which checks it (FR-AUTH-06). */
  sendEmailCode: (email: string, challengeToken: string) => Promise<SendOutcome>;
  /** Checks the code and, when it is right, sets the session cookies. */
  verifyEmailCode: (email: string, code: string) => Promise<VerifyOutcome>;
  /**
   * Ends the session on this device only (FR-AUTH-05). The cookies are
   * cleared before the provider is told, so a provider that cannot be reached
   * still leaves this device signed out.
   */
  signOut: () => Promise<SignOutOutcome>;
  /**
   * The address of Google's sign-in page. The PKCE verifier goes into a
   * cookie, so the callback on this browser can finish it (FR-AUTH-01).
   */
  startGoogle: (callbackUrl: string) => Promise<GoogleStart>;
  /** Exchanges the code Google sent back for a session. */
  completeGoogle: (code: string) => Promise<GoogleCompletion>;
};

/** The part of the auth client this adapter calls, so tests can fake it. */
export type AuthApi = Pick<
  SupabaseClient["auth"],
  "signInWithOtp" | "verifyOtp" | "signOut" | "signInWithOAuth" | "exchangeCodeForSession"
>;

function providerError(error: { code?: string | undefined; status?: number | undefined } | null) {
  return error === null ? null : ({ code: error.code, status: error.status } as ProviderError);
}

export function supabaseSignInProvider(auth: AuthApi): SignInProvider {
  return {
    async sendEmailCode(email, challengeToken) {
      const { error } = await auth.signInWithOtp({
        email,
        // An unknown address gets an account and a code, the same answer as a
        // known one (T-11).
        options: { shouldCreateUser: true, captchaToken: challengeToken },
      });
      return sendOutcome(providerError(error));
    },
    async verifyEmailCode(email, code) {
      const { error } = await auth.verifyOtp({ email, token: code, type: "email" });
      return verifyOutcome(providerError(error));
    },
    async signOut() {
      const { error } = await auth.signOut({ scope: "local" });
      return signOutOutcome(providerError(error));
    },
    async startGoogle(callbackUrl) {
      const { data, error } = await auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl, skipBrowserRedirect: true },
      });
      if (error !== null || !data.url) return { ok: false };
      return { ok: true, url: data.url };
    },
    async completeGoogle(code) {
      const { error } = await auth.exchangeCodeForSession(code);
      return error === null ? "signed_in" : "failed";
    },
  };
}
