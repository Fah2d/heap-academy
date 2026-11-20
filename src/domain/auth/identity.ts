// Who is calling, as the verified claims of the session say
// (docs/spec/02-architecture.md section 9.1, docs/spec/06-security-privacy.md
// section 5.3). The claims come from the auth provider's getClaims(), which
// checks the token's signature; this only reads the fields the product uses.

declare const userIdBrand: unique symbol;

export type UserId = string & { readonly [userIdBrand]: true };

/** The assurance level: `aal2` after the second sign-in step (ADR-0025). */
export type AssuranceLevel = "aal1" | "aal2";

export type Identity = {
  userId: UserId;
  aal: AssuranceLevel;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A user ID in its canonical form: a lower-case UUID. */
export function parseUserId(value: unknown): UserId | undefined {
  return typeof value === "string" && UUID.test(value) ? (value as UserId) : undefined;
}

/**
 * The identity in a set of verified claims, or null when they do not name a
 * signed-in person: no claims, no valid subject, a role other than
 * `authenticated`, or an anonymous session, which the product never creates.
 * A missing or unknown assurance level counts as `aal1`, the lower one.
 */
export function identityFromClaims(claims: unknown): Identity | null {
  if (typeof claims !== "object" || claims === null) return null;
  const record = claims as Record<string, unknown>;
  const userId = parseUserId(record["sub"]);
  if (userId === undefined) return null;
  if (record["role"] !== "authenticated") return null;
  if (record["is_anonymous"] === true) return null;
  return { userId, aal: record["aal"] === "aal2" ? "aal2" : "aal1" };
}
