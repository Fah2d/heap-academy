// What the sign-in view needs to know about the sign-in actions' answers.
// Kept outside server/, so the client view can import it.

export type RequestEmailCodeFailure = "rate_limited" | "challenge_failed" | "unavailable";
export type VerifyEmailCodeFailure = "code_rejected" | "rate_limited" | "unavailable";

/** An action's answer as the view reads it: its value, or a failure code. */
export type ActionOutcome<Value> = { ok: true; value: Value } | { ok: false; error: string };

export type StartGoogleState = { failed: boolean };
