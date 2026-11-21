import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { parsePublicEnvironment } from "@/infrastructure/env/schema";

// The database client for the caller's own session (CLAUDE.md rule 8,
// docs/spec/02-architecture.md section 9). It carries the publishable key and
// the session cookies, so row level security decides every read and write.
// The browser never gets a database client (ADR-0027): sign-in and every
// change go through server actions and route handlers.

export type SessionClient = SupabaseClient;

export type CookieAccess =
  /** A server action or a route handler, which may set cookies. */
  | "read-write"
  /**
   * A server component, which may not. A token refreshed here is not kept;
   * proxy.ts refreshes the session before the page renders, so the page
   * reads a fresh token.
   */
  | "read-only";

export async function createSessionClient(access: CookieAccess): Promise<SessionClient> {
  const environment = parsePublicEnvironment(process.env);
  const store = await cookies();
  return createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          if (access === "read-only") return;
          for (const { name, value, options } of list) store.set(name, value, options);
        },
      },
    },
  );
}
