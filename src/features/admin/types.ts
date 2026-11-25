// What the admin views need to know about the admin actions' answers. Kept
// outside server/, so client views can import it.

export type SecondStepFailure = "code_rejected" | "rate_limited" | "setup_replaced" | "unavailable";

/** An action's answer as the view reads it: its value, or a failure code. */
export type ActionOutcome<Value> = { ok: true; value: Value } | { ok: false; error: string };
