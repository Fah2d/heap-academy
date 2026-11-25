import "server-only";
import { createHmac } from "node:crypto";

// The client side of the per-action counters (T-14 in
// docs/spec/06-security-privacy.md; docs/spec/07-operations.md section 7;
// the migration 20261125120000_action_counters.sql). The server signs the
// action, the caller's address, the limit and the minute with
// `ACTION_COUNTER_KEY`; `public.count_action()` checks the signature against
// the same key in Supabase Vault, so a caller who holds only the public key
// can neither pick an address nor write a row, and a signature is good for
// about two minutes only.

/** Calls a minute per address for an action that sets no limit of its own. */
export const DEFAULT_PER_MINUTE = 120;

/**
 * Calls a minute per address for sign-in and the admin's second step: lower
 * than the default, and above what a person typing codes needs. The auth
 * provider's own limits on emails and code checks stay in force behind it.
 */
export const SIGN_IN_PER_MINUTE = 30;

/** The largest limit `public.count_action()` accepts. */
export const MAX_PER_MINUTE = 10_000;

/** What the counter says about one more call. */
export type CountResult = "allowed" | "refused" | "unavailable";

/** Whole minutes since 1970 at `nowMs`: the window a signature names. */
export function counterMinute(nowMs: number): number {
  return Math.floor(nowMs / 60_000);
}

/**
 * The HMAC `public.count_action()` expects: SHA-256 over
 * "action\naddress\nlimit\nminute", in hex.
 */
export function counterSignature(
  key: string,
  action: string,
  address: string,
  perMinute: number,
  minute: number,
): string {
  return createHmac("sha256", key)
    .update(`${action}\n${address}\n${perMinute}\n${minute}`, "utf8")
    .digest("hex");
}

type CountArguments = {
  action_name: string;
  client_address: string;
  max_hits: number;
  signature: string;
};

/** The one call the counter needs, over the caller's own session client. */
export type CountRpc = (
  name: "count_action",
  args: CountArguments,
) => PromiseLike<{ data: unknown; error: unknown }>;

/**
 * Counts one call of `action` for this request's address. A failed call is
 * `unavailable`, never `allowed`: without a counter the action does not run.
 */
export function createActionCounter(
  rpc: CountRpc,
  key: string,
  address: string,
  now: () => number = Date.now,
) {
  return async (action: string, perMinute: number): Promise<CountResult> => {
    const { data, error } = await rpc("count_action", {
      action_name: action,
      client_address: address,
      max_hits: perMinute,
      signature: counterSignature(key, action, address, perMinute, counterMinute(now())),
    });
    if (error !== null || typeof data !== "boolean") return "unavailable";
    return data ? "allowed" : "refused";
  };
}
