import "server-only";
import type { UseCaseResult } from "@/infrastructure/actions/define-action";

// Whether the caller is on the admin list, at any assurance level, asked of
// the database through `public.is_on_admin_list()` with the caller's own
// session (docs/spec/02-architecture.md section 11.2; FR-ADM-01, T-19). It is
// what tells an admin before the second step from everyone else. It grants
// nothing: every admin policy still requires `private.is_admin()`, at aal2.

/** The part of the session client this check calls, so tests can fake it. */
export type AdminListDb = {
  rpc: (name: "is_on_admin_list") => PromiseLike<{ data: unknown; error: unknown }>;
};

/** True only when the database answers true; a failed check is a refusal. */
export async function isOnAdminList(db: AdminListDb): Promise<boolean> {
  const { data, error } = await db.rpc("is_on_admin_list");
  return error === null && data === true;
}

/**
 * Runs `step` only for a caller on the admin list. Anyone else gets
 * `not_found`, the answer they would get from an action that does not exist.
 */
export async function forListedAdmin<Value, Failure extends string>(
  db: AdminListDb,
  step: () => Promise<UseCaseResult<Value, Failure>>,
): Promise<UseCaseResult<Value, Failure | "not_found">> {
  if (!(await isOnAdminList(db))) return { ok: false, error: "not_found" };
  return step();
}
