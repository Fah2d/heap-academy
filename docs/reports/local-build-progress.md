# Local build progress

Work done in a session while the owner was away, 2026-11-20, and what is left for the owner to run. Newest first.

## WP-2.1 Schema and policies, started on `wp/2.1-schema-policies`

Started at 17:30 from `main` at 037c4ad. Time box: 3 hours. This is a start, not a finished work package: no pull request yet.

### Written

| What | Where |
|---|---|
| The `private` schema, `admins` (no client policy, no client privilege), `private.is_admin()` (security definer, empty search path, true only for a listed user at `aal2`) | `supabase/migrations/20261120120000_admins.sql` |
| Shape checks for the JSON columns: hints, outcomes, test cases (the fields and limits of `src/grader`'s parser on WP-3.3, camelCase `afterCode`), wrong answers; the `updated_at` trigger function | `supabase/migrations/20261120120100_content_checks.sql` |
| `courses`, `chapters`, `lessons`, `lesson_solutions` with their size checks, keys and indexes; the policies of `02-architecture.md` section 8.2; the publish guard for lessons and courses; the gradable change trigger, including a change to the solution or the wrong answers | `supabase/migrations/20261120120200_content.sql` |
| `profiles`, its policies and column grants, and the new user trigger | `supabase/migrations/20261120120300_profiles.sql` |
| `completions` (insert only), the completion values trigger, `lesson_completion_counts()` | `supabase/migrations/20261120120400_completions.sql` |
| `save_lesson(...)`, security invoker, refusing a stale copy (FR-ADM-10) | `supabase/migrations/20261120120500_save_lesson.sql` |
| pgTAP tests: 163 assertions in four files. Every table and operation as anonymous, a learner, an admin at `aal1` and an admin at `aal2`; every trigger tried against its rule | `supabase/tests/database/` |
| Seed: one sample course with the example lesson of `04-content-system.md` section 7, saved validated through `save_lesson` | `supabase/seed.sql` |
| Local stack configuration: only `public` exposed, the seed enabled | `supabase/config.toml` |
| The `db` CI job: the pinned CLI from `scripts/install-supabase.sh`, `supabase start` on an empty database, `supabase test db`. `scripts/workflows.test.ts` now expects it | `.github/workflows/ci.yml` |
| `pnpm test:db` | `package.json` |

### Verified

`pnpm verify`, exit 0: Prettier, ESLint, `tsc`, the attribution check, and `Test Files 23 passed (23)`, `Tests 650 passed (650)`.

### Not verified

- **None of the SQL has run.** Docker is not running on this machine, and the Supabase CLI exits with status 1 and no output inside the session's sandbox. No migration has been applied and no pgTAP test has run. Expect fixes after the first run.
- **The generated types do not exist yet.** They need a running database.
- **`config.toml` is hand-written**, not from `supabase init`, and holds only the settings that differ from the CLI's defaults.

### Commands for you

No package install is needed for this work package. With Docker Desktop running, from the clone at `/private/tmp/claude-501/-Users-fahad-heap-academy/f5fba7f9-a8ad-4cf7-ab98-f96c832e2ec3/scratchpad/ha`, on `wp/2.1-schema-policies`:

```sh
supabase start
pnpm test:db
supabase gen types typescript --local > src/infrastructure/db/database.types.ts
```

Then paste the output of the first two, or tell me to read it. Every failure from `pnpm test:db` is mine to fix.

### Left in this work package

- Fix whatever the first database run finds, and commit the generated types.
- `code-reviewer` and `security-reviewer` on the SQL, after the tests pass.
- The pull request description.
- **The database check in `/api/health`**, which you approved for WP-2.1 (item 5 of the `spec-change` pull request). It needs a database client, which `08-delivery-plan.md` puts in WP-2.2 with `@supabase/supabase-js` and `@supabase/ssr`. Not started: writing it against packages that are not installed would fail `pnpm verify`. Decision for you: build the clients here, or move the check to WP-2.2.
- **Staging seed.** The deploy workflow applies migrations with `supabase db push`, which does not run `seed.sql`. Seeding staging needs a step or a runbook line; not done.
- **The required checks.** `db` is a new job name. Branch protection must list it once it has run (`05-engineering-handbook.md` section 10).

### Choices to confirm

These limits are not in the spec, so each is a choice:

- `slug` of a course or a lesson: at most 60 characters, lowercase letters, digits and single hyphens.
- Each course outcome: at most 140 characters, the course summary's limit.
- A chapter summary: at most 140 characters.
- A wrong answer's label: 1 to 80 characters, a test case name's limit.
- `time_zone`: 1 to 64 characters. It is not checked against the time zone database.
- A draft lesson may have no test case and empty instructions. Publishing needs a passing validation, and validation needs both.

How `validated_at` is protected: a trigger refuses any change to it unless `save_lesson` has named the lesson in a transaction setting, in the same statement, at the transaction's time. An admin at `aal2` could set that setting by hand. This guards against a bug in the dashboard, not against the admin, which is the trust model of ADR-0026.

## Branches brought up to date with `main`, 2026-11-20

`main` at 037c4ad (#3 and #4 merged) is merged into each waiting branch, with no rebase and no force push. `pnpm verify` passed on each before its push.

| Branch | Merge | Pushed to | Tests | Conflicts |
|---|---|---|---|---|
| `wp/spec-change-shell-nav-errors` | 803943e | fa74af4 | 650 | none |
| `wp/1.4-followups` | d750ae5 | 3585d6d | 670 | the two `design-review-5.md` and `-6.md` reports, moved to `docs/reports/reviews/WP-1.4-followups/` |
| `wp/3.1-python-worker` | f617391 | a288083 | 788 | `next.config.ts`, `playwright.config.ts`, `package.json`, `pnpm-lock.yaml` |
| `wp/3.2-live-input` | b4f0f11 (merges `wp/3.1-python-worker`) | 6a9c165 | 827 | none |
| `wp/3.3-grader` | 6f0cfe8 (merges `wp/3.1-python-worker`) | 62dc019 | 951 | none |
| `wp/6.1-merge-part-1` | 42b3708 | ac6c13c | 665 | none |
| `wp/6.2-streak-part-1` | 61eac99 | f59b8ba | 666 | none |
| `wp/4.2-markdown-part-1` | 1074bcf | 26d7f62 | 726 | none |

The `spec-change` pull request marks the four WP-1.3 decisions approved. Only the marks changed; see its "Owner actions now due".

Conflicts still ahead, between waiting branches:

- `wp/3.2-live-input` and `wp/3.3-grader`: `src/messages/runtime-dev.ts`, `src/runtime/controller.ts`, `src/runtime/controller.test.ts`, `src/runtime/worker/core.ts`, `src/runtime/worker/core.test.ts`. Whichever merges second needs `main` merged in and these resolved.
- `wp/1.4-followups` and `wp/3.1-python-worker`: `playwright.config.ts`.
