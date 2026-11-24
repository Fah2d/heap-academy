# Security review 1, WP-2.1

Reviewer: `security-reviewer`, fresh context. Range `origin/main..d32a509` on `wp/2.1-schema-policies`. 2026-11-20.

Verdict: **CHANGES REQUIRED**.

The reviewer is read-only, so the implementer saved this report from what the reviewer returned. The response is at the end.

No path was found for anonymous, a learner, or an admin at `aal1` to read `lesson_solutions`, drafts or archived content, to write content, to raise XP, or to touch another user's profile or completions. The findings are about tests that could not catch a broken control.

## How the reviewer ran the SQL

Docker is down, so the six migrations and the seed of d32a509 were applied to PGlite 0.5.17 (PostgreSQL 18.7) with a Supabase stub: the roles `anon`, `authenticated` and `service_role`, `auth.users`, `auth.jwt()` and `auth.uid()` reading `request.jwt.claims`, and Supabase's default grants on `public`. pgTAP 1.3.3 from source. Every migration and the seed applied. Empty database: 25/25, 64/64, 48/48, 24/26. Seeded (as CI does): `02` 51/64. Postgres runs as a superuser there, unlike Supabase's `postgres` role: strong evidence, not proof.

## Findings

- **MAJOR 1:** the allow-list half of `private.is_admin()` is never tested. With the `exists (... admins ...)` clause removed, the suite's result did not change. Fix: a learner at `aal2` in `01` to `03`, and an admin whose claims carry no `aal`.
- **MAJOR 2:** `save_lesson` is never called as a non-admin, and nothing asserts it is security invoker. Made `security definer`, nothing failed. Fix: anonymous (42501), learner, admin at `aal1`, learner at `aal2` (P0001, unchanged after); a catalog test that only `private.is_admin`, `private.create_profile` and `public.lesson_completion_counts` are security definer, each with an empty search path.
- **MAJOR 3:** with the seed, `02` fails 13 of 64 (`have: (sample-course) want: (published-course)`). Fix: scope to the fixtures or remove the seed rows in the test's transaction; keep the seed in CI.
- **MAJOR 4:** no archived or unpublished-course fixture. Courses policy `status <> 'draft'` passed; the completion policy without `courses.status = 'published'` passed. Fix: those fixtures, invisible to every non-admin, and completions refused for each, including by an admin at `aal2`.
- **MAJOR 5:** the insert and delete paths of the publish rule are untested. Without the insert-time `validated_at` check, an insert with `status='published'` and `validated_at='2100-01-01'` publishes an unvalidated lesson; the solution trigger narrowed to `after update` passed.
- **MINOR 1:** PostgreSQL 18.7 reports `ON DELETE RESTRICT` as 23001 (`violates RESTRICT setting of foreign key constraint`); the tests expect 23503. Pin `[db] major_version` and assert what it returns.
- **MINOR 2:** inside one transaction, after `save_lesson(..., true)`, a further solution or test change gets `gradable_changed_at = validated_at` and passes. Run and committed as an admin at `aal2`: published, unvalidated tests and solution. Not reachable through single-request calls today. Fix: clear `validated_at` on a gradable change outside the validated call, or version counters.
- **MINOR 3:** content tables rely on default grants, which include `TRUNCATE` (ignores row level security; the API cannot issue it). Fix: `revoke all`, then grant exactly what is used.
- **MINOR 4:** `xp` is insertable; the trigger overwrites it. Fix: column insert grant without `xp`, and a test that sending it is refused.
- **MINOR 5:** re-sending a completion of a lesson that was later archived raises `lesson_not_found` before `on conflict do nothing`. `mergeProgress` must not fail its batch on it.
- Note: a learner can backdate `completed_at`; accepted by ADR-0007.

## What holds (reviewer)

`is_admin` security definer with an empty search path and qualified names; `anon` has no usage on `private`; `admins` has no grants or policies; `anon` has no privilege on `lesson_solutions`; profiles update only `display_name` and `time_zone`; completions cannot be updated or deleted and take XP from the lesson; triggers run as the caller, so no error reveals a draft; `lesson_completion_counts()` refuses non-admins; the validation setting is cleared before `save_lesson` returns; the deploy's `db push` never seeds production; the `db` job is pinned, read-only and secret-free.

The reviewer ran `git checkout d32a509` in the implementer's clone early on, detaching HEAD at the same commit, and switched back to `wp/2.1-schema-policies`. Branch and commits were checked unchanged afterwards.

## Response

| Finding | Done |
|---|---|
| MAJOR 1 | A learner at `aal2` who is not on the list in `01`, `02` and `03`; an admin with no `aal` claim in `01`. |
| MAJOR 2 | `save_lesson` as anonymous (42501), a learner, an admin at `aal1` and a learner at `aal2` (P0001 `lesson_not_found`), then the lesson and solution read unchanged. The catalog test, with the search path check. |
| MAJOR 3 | Each file removes the seed's lessons, chapters and courses inside its transaction (fixed with code review 1). |
| MAJOR 4 | Archived course, archived lesson, published lesson of an archived course and of a draft course; invisible to every non-admin in `02`; completions of each refused in `03`, as a learner (P0001) and as an admin at `aal2` (42501). |
| MAJOR 5 | Inserted as published, inserted with `validated_at`, a solution added to and removed from a published lesson, a course inserted as published. |
| MINOR 1 | The two RESTRICT tests match the message, which names the foreign key on Postgres 17 and 18. Pinning the version is open for the owner. |
| MINOR 2 | The lessons trigger clears `validated_at` on a gradable change outside the validated call. The solution trigger names the lesson in `heap.solution_changed`, so a solution change counts even when `gradable_changed_at` already equals `now()`. Two tests in the same transaction as a validated save. |
| MINOR 3 | Fixed with code review 1. |
| MINOR 4 | `grant insert (user_id, lesson_id, completed_at, code)`; sending `xp` is refused (42501). |
| MINOR 5 | Not changed here; recorded for WP-6.1 in `docs/reports/local-build-progress.md`. |

On the reviewer's harness, at the commit that carries this response: 33, 80, 57 and 54 assertions pass, with and without the seed. The reviewer's six breaks, and a seventh (a gradable change keeps `validated_at`), each make at least one test fail.
