import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parsePublicEnvironment } from "@/infrastructure/env/schema";

// The database client of public pages (CLAUDE.md rule 9,
// docs/spec/02-architecture.md section 7.3): the publishable key and no
// session at all, so it reads exactly what an anonymous visitor may. Only
// src/content uses it.

export type PublicClient = SupabaseClient;

export function createPublicClient(): PublicClient {
  const environment = parsePublicEnvironment(process.env);
  return createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}
