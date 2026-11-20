# Code review 1, WP-2.1

Reviewer: `code-reviewer`, fresh context. Range `origin/main..d32a509` on `wp/2.1-schema-policies`. 2026-11-20.

Verdict: **CHANGES REQUIRED**.

The reviewer is read-only, so the implementer saved this report from what the reviewer returned. The response is at the end.

None of this SQL has run, for the reviewer or the implementer: Docker is not running (`docker info`: "failed to connect to the docker API ... no such file or directory"), and there is no local `psql` or `postgres`. The findings come from reading the code. The four `plan()` counts matched their assertions: 25, 64, 48 and 26, 163 in all.

## BLOCKER

1. `02_content_policies.test.sql`, 13 assertions: the seed. `config.toml` turns the seed on, so `supabase start` in CI applies `seed.sql`, which publishes `sample-course`, its chapter, `say-hello-by-name` and its solution. The `results_eq` assertions with exact arrays and no filter would return the seed's rows too, and two had no `order by`. Fix: limit each query to the fixtures, add `order by`, keep the seed in CI.
2. `01`, `02`, `03`: no test uses a learner at `aal2` who is not an admin. An `is_admin()` that checks only `aal = 'aal2'` would pass all 163 assertions, and any learner can enroll an authenticator app. Fix: add that caller to each file.
3. Work package status: no "Done when" line is evidenced. No migration applied, no pgTAP test run, no generated types, no staging seed, staging not reached while the deploy is off, the `/api/health` check open. Fix: run the tests, commit the types, then open the pull request.

## MAJOR

1. `content_checks.sql`: three-valued logic. A missing `name` or `expected` makes `valid_test_case` null, not false; `where not ...` drops the null, so `valid_test_cases` is true. Same for `"match": null` and a wrong answer with no `label` or `code`. Fix: make each check false when a key is missing, `coalesce(..., false)` the element check, and add tests.
2. `04_triggers.test.sql`: branches of the publish guard never tried: the INSERT branch (published on insert, `validated_at` on insert); a lesson validated, changed as a draft, then published; the transaction setting naming another lesson; a future `validated_at`; inserting or deleting a solution of a published lesson.
3. `04`: the course test does not tell "has a lesson" from "has a published lesson". Fix: a draft course whose only lesson is a draft.
4. `04` and `save_lesson.sql`: `save_lesson` is tested only as an admin at `aal2`. Fix: call it as a learner and as an admin at `aal1` and check nothing changed. A learner calling it on a published lesson is told `lesson_changed_since_loaded`, which is misleading.
5. Missing test: `save_lesson` on a published lesson with only the title or XP changed and `p_validated = false`, the most common save, which goes through the solution upsert.
6. `02`: no archived fixture. A policy checking `status <> 'draft'` would pass. Fix: an archived course with a published lesson, and an archived lesson in a published course.

## MINOR

1. `content.sql`: the rule depends on `now()` being fixed in a transaction. Version counters would remove that.
2. `completions.sql`: the `courses.status = 'published'` clause of the insert policy is never reached, because the trigger refuses a learner first. Fix: an admin at `aal2` completing a published lesson of a draft course.
3. `04`: FR-PRG-07 is read as the table owner, who bypasses row level security. Fix: read it as the learner.
4. `04`: the new-user trigger is tried only on the happy path. Fix: a name over 40 characters, a blank name, no email.
5. `04`: seven titles carry no requirement or threat ID.
6. `scripts/workflows.test.ts`: a `db` job with `run: true` would pass. Fix: assert its three commands.
7. `config.toml`: `[db] major_version` is not pinned.
8. `content.sql`: access depends on the platform's default table grants. Fix: explicit grants, nothing for anonymous beyond select.
9. `save_lesson.sql`: the stale check compares `updated_at` exactly; a JavaScript `Date` loses the microseconds. Fix: document that the value travels as text, or use a version.
10. `content.sql`: a published course whose last published lesson is archived stays published. Section 8.3 and section 1.1 read differently; ask the owner.
11. `local-build-progress.md`: names the temporary session clone path.

## Checked and correct (reviewer)

BEFORE triggers before row level security's check before check constraints; 42501 for missing privileges where tested; the 23503, 23505, 23514 and P0001 cases; writing fixtures with the triggers off; no attribution in the four commits. `pnpm verify`: exit 0, 23 files, 650 tests.

## Response

| Finding | Done |
|---|---|
| BLOCKER 1 | Each test file deletes the seed's lessons, chapters and courses inside its own transaction, so the seed still applies in CI and the tests see only their fixtures. Every multi-row `results_eq` has `order by`. |
| BLOCKER 2 | A learner at `aal2` who is not on the list in `01` (5 assertions), `02` (16) and `03` (3). |
| BLOCKER 3 | Open. Nothing can run in this session; see `docs/reports/local-build-progress.md`. |
| MAJOR 1 | Each JSON check is `case` on the type first (so `jsonb_array_length` and `jsonb_object_keys` never see the wrong type), then `coalesce(..., false)`; the element checks are `not coalesce(..., false)`. Tests: no name, no expected, `match` null, not a list, a repeated id, a wrong answer with no label, a wrong answer that is a string. |
| MAJOR 2 | Tests for all six branches named. |
| MAJOR 3 | `drafts-only-course`, and a course inserted as published. |
| MAJOR 4 | `save_lesson` as a learner and as an admin at `aal1`, then the lesson and solution read unchanged. Only an admin is told the copy is stale; anyone else is told `lesson_not_found`. |
| MAJOR 5 | Added, with the status, title and XP read back. |
| MAJOR 6 | `archived-course` with a published lesson, and `archived-lesson`; neither is visible to any caller but the admin at `aal2`. |
| MINOR 1 | Not changed. Recorded in the progress report as a limit of the design. |
| MINOR 2 | Added. |
| MINOR 3 | Read as the learner. |
| MINOR 4 | Added. |
| MINOR 5 | Every title in `04` names an ID. |
| MINOR 6 | Asserted, and checked against a mutant (`run: "true"`): the test fails. |
| MINOR 7 | Open, for the owner: the hosted projects' version is not recorded. |
| MINOR 8 | `revoke all`, then `select` for anonymous and the four operations for signed-in callers on the four content tables. Anonymous writes in `02` now expect 42501. |
| MINOR 9 | Documented in `save_lesson`'s comment. |
| MINOR 10 | Open, for the owner. |
| MINOR 11 | Removed. |
