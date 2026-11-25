import "server-only";
import { type Identity, identityFromClaims } from "@/domain/auth/identity";
import type { SessionClient } from "@/infrastructure/db/session-client";

/**
 * The caller from the session's verified claims (docs/spec/02-architecture.md
 * section 9.1). getClaims() checks the token's signature; getSession() is
 * never used for identity on the server (E-09). When the auth service cannot
 * answer, the caller counts as signed out, as in proxy.ts.
 */
export async function verifiedIdentity(client: SessionClient): Promise<Identity | null> {
  const { data, error } = await client.auth.getClaims();
  if (error !== null || data === null) return null;
  return identityFromClaims(data.claims);
}
