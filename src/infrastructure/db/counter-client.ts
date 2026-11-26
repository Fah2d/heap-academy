import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parsePublicEnvironment } from "@/infrastructure/env/schema";

// The database client of the per-action counters (T-14): the publishable key
// and no session. The counter's authority is the server's signature, not the
// caller, so a stale or forged session cookie cannot stop it from answering.
// It is used for `public.count_action()` only; anything else it could read is
// what an anonymous visitor may read.

export function createCounterClient(): SupabaseClient {
  const environment = parsePublicEnvironment(process.env);
  return createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}
