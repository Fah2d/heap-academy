---
paths:
  - "src/features/admin/**"
  - "src/app/admin/**"
---

# Admin dashboard

The dashboard is specified in `docs/spec/03-experience.md` section 7, the lesson model in `docs/spec/04-content-system.md`, and the gate in `docs/spec/02-architecture.md` section 11.2.

## The gate

- Every `/admin` layout calls the one server guard. Anyone not on the allow-list gets `notFound()`. An admin with no factor goes to `/admin/setup`; an admin at `aal1` goes to `/admin/verify`.
- The guard is a convenience. The database is the authority. No feature depends on the guard alone.
- Pages here send `Cache-Control: private, no-store`.
- Nothing in the learner interface links to `/admin`.

## Data

- Admin queries live in `features/admin/server` and use the session client. They may read solutions and drafts. Lint forbids importing them anywhere else.
- Saves carry the row's `updated_at`. A save over a newer version is refused and the owner is asked to reload (FR-ADM-10).
- Unsaved changes are never lost silently. Warn before leaving.

## Validation and publishing

- Validation runs the solution, the starter, and every wrong answer against the test cases, with the same runtime and harness learners use (`.claude/rules/runtimes.md`).
- The dashboard computes a hash of the gradable content it validated: starter, solution, wrong answers, and test cases. The save action recomputes the hash of what it is saving and passes `validated = true` to `save_lesson` only when the two match.
- Publish is offered only after a passing validation of the content now in the editor. The database rule is the backstop (`docs/spec/02-architecture.md` section 7.2).
- Import creates a draft and runs nothing until the owner presses Validate.
- Preview uses the real workspace and records nothing.
