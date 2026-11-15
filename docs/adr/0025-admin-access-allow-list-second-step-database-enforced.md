# ADR-0025: Admin access: allow-list, second sign-in step, enforced by the database

- Status: Proposed
- Decision due: Day 1 (WP-1.1). Confirmed by evidence in WP-2.3.
- Date proposed: 2026-11-15
- Decider: the owner
- Relates to: FR-ADM-01, FR-ADM-02, NFR-SEC-06, T-19, T-20

## Context

The dashboard can change what every learner sees. Sign-in uses email codes and Google, either of which can be phished or reached through a stolen session. The check must not depend on the interface remembering to make it.

## Decision

- Admin rights are a row in an `admins` table. No screen writes to it; the owner adds his row once by SQL.
- An admin must pass a second step with an authenticator app. The database function `private.is_admin()` is true only for a user in `admins` whose session token carries assurance level `aal2`.
- Every policy on a content table requires that function. Server actions check it too, but the database is the authority.
- Every `/admin` address answers "not found" to anyone else.

## Consequences

- Gain: A stolen learner session, or a stolen admin session without the second step, cannot change a lesson.
- Gain: A bug in an action cannot grant more than a policy allows.
- Cost: The owner needs an authenticator app and a recovery path if he loses it (a runbook).
- Cost: One admin only. Roles are a later design.

## Alternatives considered

- **A role claim in the user's metadata.** Simpler, but one writable field away from privilege escalation.
- **Check admin rights only in server code with the privileged key.** One missed check exposes everything.
- **A separate admin application.** Stronger separation, a second deployment to run.

## Evidence

E-20. Documentation only until WP-2.1 and WP-2.3 test it.

## Revisit when

A second author is added.
