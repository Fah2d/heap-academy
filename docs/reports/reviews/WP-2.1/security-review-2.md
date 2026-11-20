# Security review 2, WP-2.1

Reviewer: `security-reviewer`, fresh context, on its PGlite harness (PostgreSQL 18.7, pgTAP 1.3.3). Range: `origin/main..036626d`. Verdict: **APPROVE**, 3 MINOR. No path found for anonymous, a learner at `aal1` or `aal2`, or an admin at `aal1` to read solutions, wrong answers, drafts, other users' rows or `admins`, to forge XP, or to change content. Each round-1 fix was broken on purpose and a test failed each time. Round-1 MINOR 5 stays deferred to WP-6.1.

## MINOR

1. An admin at `aal2` can change `lesson_id` on a `lesson_solutions` row: the trigger compares only `solution_code` and `wrong_answers`, so a validated solution can be swapped for an unvalidated one in two requests. Fix: grant update only on `solution_code` and `wrong_answers`.
2. No test checks the privileges now written out: TRUNCATE granted to `authenticated` on the content tables, or every column of `profiles` made updatable, pass all 224 assertions.
3. Production is never seeded only as long as the `staging` environment's `SUPABASE_DB_URL` is the staging URL. Fix: name the staging project in a variable and refuse to seed any other URL.

## Not checked (reviewer)

The Supabase image; CLI seed behaviour; hosted settings; staging through the workflow.

## Response

| Finding | Done |
|---|---|
| MINOR 1 | `lesson_solutions`: select and delete on the table, insert on `lesson_id`, `solution_code` and `wrong_answers`, update on `solution_code` and `wrong_answers` only. Test: an admin at `aal2` moving a solution gets 42501. |
| MINOR 2 | `05_limits.test.sql` lists every table privilege of `anon` and `authenticated` on the seven tables, and every column a signed-in caller may insert or update on `profiles`, `completions` and `lesson_solutions`. |
| MINOR 3 | `--include-seed` needs `SEED_PROJECT_REF` and refuses a URL that does not contain it. The staging step passes `vars.STAGING_PROJECT_REF`; the owner adds that variable (runbook step 7). Tested with a stand-in CLI. |
