// Who may see which `/admin` address (docs/spec/02-architecture.md section
// 11.2, docs/spec/03-experience.md section 7.1; FR-ADM-01, FR-ADM-02, T-19).
// The gate is a convenience for the person at the door. The authority is the
// database: every admin policy requires `private.is_admin()`, which requires
// assurance level aal2 (ADR-0025).

import type { Identity } from "@/domain/auth/identity";

/**
 * What the gate knows about the visitor. `hasVerifiedFactor` is null when the
 * auth service could not say.
 */
export type AdminGateInput = {
  identity: Identity | null;
  onAdminList: boolean;
  hasVerifiedFactor: boolean | null;
};

/**
 * - `not_found`: not signed in, or not on the admin list. They see the same
 *   page as any missing address.
 * - `setup`: on the list with no authenticator app yet.
 * - `verify`: on the list with an app, and this session has not passed the
 *   second step.
 * - `allow`: on the list at aal2.
 */
export type AdminGateDecision = "not_found" | "setup" | "verify" | "allow";

export function decideAdminGate({
  identity,
  onAdminList,
  hasVerifiedFactor,
}: AdminGateInput): AdminGateDecision {
  if (identity === null || !onAdminList) return "not_found";
  if (identity.aal === "aal2") return "allow";
  // Setup creates a new factor, so it is offered only when the auth service
  // said there is none. When it could not say, verify is the safe page: a
  // code sent there gets the provider-down notice if there is no factor.
  if (hasVerifiedFactor === false) return "setup";
  return "verify";
}

/** The address each decision that lets the visitor in belongs to. */
export const ADMIN_PATHS = {
  allow: "/admin",
  setup: "/admin/setup",
  verify: "/admin/verify",
} as const satisfies Record<Exclude<AdminGateDecision, "not_found">, string>;

/** Where the owner creates a course (docs/spec/03-experience.md section 7.2). */
export const ADMIN_NEW_COURSE_PATH = "/admin/courses/new";

/** The editor of one lesson (docs/spec/03-experience.md section 7.4). */
export function adminLessonPath(lessonId: string): string {
  return `/admin/lessons/${encodeURIComponent(lessonId)}`;
}

/** One lesson in the real workspace, recording nothing (section 7.7). */
export function adminLessonPreviewPath(lessonId: string): string {
  return `${adminLessonPath(lessonId)}/preview`;
}

/** The editor of one course (docs/spec/03-experience.md section 7.3). */
export function adminCoursePath(courseId: string): string {
  return `/admin/courses/${encodeURIComponent(courseId)}`;
}
