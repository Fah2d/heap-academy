# Code review 2, WP-2.1

Reviewer: `code-reviewer`, fresh context. Range: `origin/main..036626d`. Verdict: **CHANGES REQUIRED**, 1 BLOCKER, 4 MAJOR, 7 MINOR. Every round-1 finding fixed or answered. On the PGlite harness all 224 assertions passed with and without the seed, and the seed ran twice safely.

## BLOCKER

1. The Done-when lines still have no evidence: no generated types, nothing run on the Supabase image, the `db` job never run, staging never reached through the workflow, and no record that the owner agreed to move the `/api/health` database check to WP-2.2.

## MAJOR

1. `20261120120200_content.sql`: a published lesson may have zero test cases and empty instructions. As an admin at `aal2`, `save_lesson(..., '', '[]', '', '[]', '', '[]', true)` then publishing gave `RESULT | published | 0 | 0`.
2. `04_triggers.test.sql:233-240`: the FR-ADM-10 stale-save test does not bite. With `new.updated_at := now()` removed, all 224 assertions still passed.
3. No size check has a test. Eight limits loosened together (XP, test case count, test case name, titles, the test case id pattern, `display_name`, completion `code`) and all 224 assertions passed.
4. Commit 036626d is authored with the machine's default identity, not the owner's: the clone had no `user.email`. Already pushed; re-authoring needs a force push.

## MINOR

1. `seed.sql` and `apply-migrations.sh` describe the CLI wrongly: CLI 2.122.1 records each seed file's hash in `supabase_migrations.seed_files` and runs it once; a changed file only refreshes the hash.
2. `apply-migrations.test.ts` checks only the last argument; the `[NFR-SEC-03]` IDs are wrong; a read error is caught silently.
3. Nothing in the repository tests the seed's run-twice guard.
4. `docs/reports/local-build-progress.md` is stale.
5. `content_checks.sql:47`: `btrim(name)` trims only spaces; the WP-3.3 parser's `trim()` strips all whitespace.
6. The stored key is `afterCode`; `04-content-system.md` sections 2.1 and 8 say `after_code`.
7. Two triggers have no test: `published_at` set on every update, and `touch_updated_at` doing nothing, both pass.

## Response

| Finding | Done |
|---|---|
| BLOCKER 1 | Not fixable in this environment: no Docker. Listed for the owner in the pull request description with the exact commands. The health check moves to WP-2.2, where the database clients are built: the owner told the night session to pick the reading that fits the spec, and `08-delivery-plan.md` puts the clients in WP-2.2. |
| MAJOR 1 | `lessons_published_complete`: a published lesson has instructions and at least one test case. Tested with the validation mark set, so the check and not the publish rule refuses it. |
| MAJOR 2 | `05_limits.test.sql`: a lesson loaded an hour ago is saved once, then the same copy is refused as an admin at `aal2`, and the refused save changed nothing. With the `updated_at` bump removed, 2 tests fail. |
| MAJOR 3 | `05_limits.test.sql`: boundary pairs for every title, the course summary, XP, instructions, starter, solution, test case count, name and id, wrong answers, `display_name` as a learner, and completion `code`. Each of the reviewer's loosened limits now fails at least one test. |
| MAJOR 4 | The clones now carry the owner's identity. The pushed commits are for the owner to decide: listed in the pull request. |
| MINOR 1 | Comments corrected in both files. |
| MINOR 2 | The full argument list is asserted; IDs are `[T-22]` and `[T-12]`; `existsSync` replaces the catch. |
| MINOR 3 | Not added: `supabase test db` runs pgTAP files, which cannot run `seed.sql` again. The PGlite harness run is recorded in the pull request. |
| MINOR 4 | Updated with this round. |
| MINOR 5 | The name check refuses any name made only of the characters JavaScript's `trim()` removes. Tested with a tab and with Unicode spaces. |
| MINOR 6 | Recorded as a proposed spec change in the pull request: `afterCode`, matching the parser of WP-3.3. |
| MINOR 7 | Tested: renaming a published lesson keeps `published_at`; a sent `updated_at` on a solution is replaced by the server's time. |
