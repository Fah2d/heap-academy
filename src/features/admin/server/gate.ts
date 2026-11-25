import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { ADMIN_PATHS, type AdminGateDecision, decideAdminGate } from "@/domain/admin/gate";
import { pageIdentity } from "@/infrastructure/auth/page-identity";
import { supabaseSecondStep } from "@/infrastructure/auth/second-step";
import { createSessionClient } from "@/infrastructure/db/session-client";
import { isOnAdminList } from "./admin-list";

// The one server guard of every `/admin` layout and page
// (docs/spec/02-architecture.md section 11.2; FR-ADM-01, FR-ADM-02, T-19).
// Next.js renders a layout and its page at the same time, so a layout's check
// does not hold back the page's own reads: every admin page calls the guard
// too. React's cache() makes that one set of calls per request.
//
// The guard is a convenience for the person at the door. Every read and
// write of the dashboard goes through the caller's own session, and every
// admin policy requires aal2 (ADR-0025).

/** The visitor's place at the admin door, asked once per request. */
export const adminGateDecision = cache(async (): Promise<AdminGateDecision> => {
  const identity = await pageIdentity();
  if (identity === null) return "not_found";
  const db = await createSessionClient("read-only");
  // A failed check is a refusal: the visitor sees the not-found page.
  const onAdminList = await isOnAdminList(db);
  if (!onAdminList) return "not_found";
  const hasVerifiedFactor =
    identity.aal === "aal2" ? true : await supabaseSecondStep(db.auth.mfa).hasVerifiedFactor();
  return decideAdminGate({ identity, onAdminList, hasVerifiedFactor });
});

/**
 * Lets the visitor through when the gate's decision is `expected`. Anyone not
 * on the admin list gets the standard not-found response; an admin in the
 * wrong place is sent to the page for their stage.
 */
export async function requireAdminStage(
  expected: Exclude<AdminGateDecision, "not_found">,
): Promise<void> {
  const decision = await adminGateDecision();
  if (decision === "not_found") notFound();
  if (decision !== expected) redirect(ADMIN_PATHS[decision]);
}

/** For the layout around every `/admin` address: strangers get not-found. */
export async function requireAdminList(): Promise<void> {
  if ((await adminGateDecision()) === "not_found") notFound();
}
