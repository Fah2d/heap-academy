import "server-only";
import { z } from "zod";
import { safeReturnPath } from "@/domain/auth/return-path";
import type { UseCaseResult } from "@/infrastructure/actions/define-action";
import type { SignInProvider } from "@/infrastructure/auth/sign-in-provider";
import type { RequestEmailCodeFailure, VerifyEmailCodeFailure } from "../types";

// Sign-in with a six-digit code sent by email (FR-AUTH-02, FR-AUTH-04,
// FR-AUTH-05, FR-AUTH-06, T-11; docs/spec/02-architecture.md section 11.1).
// The use cases take the provider as an argument; the provider adapter
// (infrastructure/auth/sign-in-provider.ts) maps its answers to outcomes.

/** The part of the sign-in provider these use cases call. */
export type EmailCodeProvider = Pick<
  SignInProvider,
  "sendEmailCode" | "verifyEmailCode" | "signOut"
>;

// RFC 5321 caps a forward path at 256 octets, so an address is at most 254.
const email = z.string().trim().max(254).pipe(z.email());
// Turnstile documents tokens of up to 2048 characters.
const challengeToken = z.string().min(1).max(2048);
// A pasted code may carry spaces: "123 456".
const code = z
  .string()
  .max(32)
  .transform((value) => value.replace(/\s/g, ""))
  .pipe(z.string().regex(/^\d{6}$/));
// Up to safeReturnPath's limit; any such string is accepted and made safe,
// so a bad return path never blocks sign-in.
const returnTo = z.string().max(512).optional();

export const requestEmailCodeInput = z.strictObject({ email, challengeToken });
export const verifyEmailCodeInput = z.strictObject({ email, code, returnTo });
export const signOutInput = z.strictObject({});

// The largest JSON form of an input within the field limits. A limit counts
// UTF-16 units, and JSON spends at most six bytes on one ("\u0000"), plus
// room for the field names.
const jsonLimit = (...lengths: number[]) =>
  6 * lengths.reduce((sum, length) => sum + length, 0) + 256;
export const MAX_REQUEST_BYTES = jsonLimit(254, 2048);
export const MAX_VERIFY_BYTES = jsonLimit(254, 32, 512);
export const MAX_SIGN_OUT_BYTES = 16;

export type { RequestEmailCodeFailure, VerifyEmailCodeFailure } from "../types";

/**
 * Asks the provider to send a code. The answer is the same for an address
 * with an account and one without (T-11): the provider creates the account
 * when the code is first used.
 */
export async function requestEmailCode(
  input: z.infer<typeof requestEmailCodeInput>,
  provider: EmailCodeProvider,
): Promise<UseCaseResult<null, RequestEmailCodeFailure>> {
  const outcome = await provider.sendEmailCode(input.email, input.challengeToken);
  return outcome === "sent" ? { ok: true, value: null } : { ok: false, error: outcome };
}

/** Checks the code, and says where to go next: a path on this site only (FR-AUTH-04). */
export async function verifyEmailCode(
  input: z.infer<typeof verifyEmailCodeInput>,
  provider: EmailCodeProvider,
): Promise<UseCaseResult<{ returnTo: string }, VerifyEmailCodeFailure>> {
  const outcome = await provider.verifyEmailCode(input.email, input.code);
  return outcome === "signed_in"
    ? { ok: true, value: { returnTo: safeReturnPath(input.returnTo) } }
    : { ok: false, error: outcome };
}

export async function signOut(
  provider: EmailCodeProvider,
): Promise<UseCaseResult<null, "unavailable">> {
  const outcome = await provider.signOut();
  return outcome === "signed_out" ? { ok: true, value: null } : { ok: false, error: outcome };
}
