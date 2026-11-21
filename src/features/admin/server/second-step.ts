import "server-only";
import { z } from "zod";
import type { UseCaseResult } from "@/infrastructure/actions/define-action";
import type { SecondStepProvider } from "@/infrastructure/auth/second-step";
import type { SecondStepFailure } from "../types";

// The admin's second sign-in step (FR-ADM-02, T-19; docs/spec/03-experience.md
// section 7.1). The input is the six-digit code only: the provider finds the
// caller's own factor, so the browser never names one.

// An authenticator app shows six digits; a pasted code may carry a space.
const code = z
  .string()
  .max(32)
  .transform((value) => value.replace(/\s/g, ""))
  .pipe(z.string().regex(/^\d{6}$/));

export const secondStepInput = z.strictObject({ code });

/** The JSON form of the input at its field limit, with room for the name. */
export const MAX_SECOND_STEP_BYTES = 6 * 32 + 64;

export type { SecondStepFailure } from "../types";

/** Checks the first code from a newly added app; on success the session is at aal2. */
export async function confirmSetup(
  input: z.infer<typeof secondStepInput>,
  provider: Pick<SecondStepProvider, "confirmEnrollment">,
): Promise<UseCaseResult<null, SecondStepFailure>> {
  const outcome = await provider.confirmEnrollment(input.code);
  return outcome === "verified" ? { ok: true, value: null } : { ok: false, error: outcome };
}

/** Checks the code of this session's second step; on success the session is at aal2. */
export async function verifySecondStep(
  input: z.infer<typeof secondStepInput>,
  provider: Pick<SecondStepProvider, "verify">,
): Promise<UseCaseResult<null, SecondStepFailure>> {
  const outcome = await provider.verify(input.code);
  return outcome === "verified" ? { ok: true, value: null } : { ok: false, error: outcome };
}
