import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parsePublicEnvironment } from "@/infrastructure/env/schema";

// The database client of public pages (CLAUDE.md rule 9,
// docs/spec/02-architecture.md section 7.3): the publishable key and no
// session at all, so it reads exactly what an anonymous visitor may. Only
// src/content uses it.

export type PublicClient = SupabaseClient;

/**
 * A client for the database at `address`, which the caller reads once with
 * publicDatabaseAddress() and also puts in its cache key, so the key always
 * names the database the answer came from.
 */
export function createPublicClient(address: string): PublicClient {
  const environment = parsePublicEnvironment(process.env);
  return createClient(address, environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * The address of the database the public client reads, from the environment
 * the server runs with. The content cache keys its answers by it.
 */
export function publicDatabaseAddress(): string {
  return parsePublicEnvironment(process.env).NEXT_PUBLIC_SUPABASE_URL;
}
