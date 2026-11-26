import "server-only";
import { createClient } from "@supabase/supabase-js";
import { AUTH_TIMEOUT_MS, fetchWithin } from "@/infrastructure/http/fetch-within";

// The privileged client (CLAUDE.md rule 8, ADR-0027). It bypasses row level
// security, so it does one thing: delete an account. Only the account
// deletion use case may import it, which a lint rule checks.

/** Longer than a page's read: a deletion cascades through every table. */
const DELETE_TIMEOUT_MS = AUTH_TIMEOUT_MS * 5;

/** Deletes the auth user; every row of theirs goes with it by cascade (T-17). */
export async function deleteAuthUser(
  supabaseUrl: string,
  secretKey: string,
  userId: string,
): Promise<"deleted" | "unavailable"> {
  const client = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchWithin(DELETE_TIMEOUT_MS) },
  });
  const { error } = await client.auth.admin.deleteUser(userId);
  // A second request for an account already gone has nothing left to do.
  // Only the service's own "no such user": a gateway's 404 proves nothing.
  return error === null || error.code === "user_not_found" ? "deleted" : "unavailable";
}
