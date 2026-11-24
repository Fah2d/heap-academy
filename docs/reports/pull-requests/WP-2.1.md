**Base: `main`.** Draft until the `db` job has run on GitHub: Docker is not available on the machine that built it, so no migration has run on the Supabase image. See "Owner actions now due".

## Up to date with main

`main` at 81fdc39 (#5, #6, #7, #8, #10) is merged into this branch in merge commit ff187e9, after the earlier merge of 0efe863 in 837fc05. No rebase, no force push. The only conflict was `docs/reports/local-build-progress.md`, which both sides had added; the resolution keeps every section of both copies. `main` adds no migration, policy test or database file, so the schema of this branch is unchanged.

`pnpm verify` on ff187e9, exit 0:

```
All matched files use Prettier code style!
 Test Files  28 passed (28)
      Tests  718 passed (718)
```

`next build` on ff187e9 with CI's public values (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_example`), exit 0. Routes: `/_not-found`, `/api/csp-report`, `/api/health`. `scripts/check-bundle.mjs .next/static` and `scripts/check-static.mjs .next`: exit 0.

Not run on the merge: `pnpm test:db` (no Docker on this machine) and e2e (no browser here).

## What and why

The database of `02-architecture.md` section 8: every table, its row level security policies, the functions and triggers of section 8.3, the seed with one sample course, the pgTAP tests, and the `db` CI job. Staging is seeded by the deploy workflow, and only staging.

- `supabase/migrations/20261120120000_admins.sql`: the `private` schema, `admins` (no client policy, no client privilege), `private.is_admin()` (security definer, empty search path, true only for a listed user at `aal2`).
- `20261120120100_content_checks.sql`: shape checks for the JSON columns (hints, outcomes, test cases with the fields and limits of `src/grader`'s parser on WP-3.3, wrong answers), and the `updated_at` trigger function.
- `20261120120200_content.sql`: `courses`, `chapters`, `lessons`, `lesson_solutions`, with size checks, keys, indexes, explicit privileges, the policies of section 8.2, the publish rule for lessons and courses, the gradable-change trigger including solution and wrong-answer changes, and a check that a published lesson has instructions and at least one test case.
- `20261120120300_profiles.sql`: `profiles`, its policies and column grants, the new-user trigger.
- `20261120120400_completions.sql`: `completions` (insert only, the insert cannot name `xp`), the completion trigger that takes XP from the lesson, `lesson_completion_counts()`.
- `20261120120500_save_lesson.sql`: `save_lesson(...)`, security invoker, refusing a stale copy (FR-ADM-10).
- `supabase/tests/database/`: five pgTAP files, 271 assertions.
- `supabase/seed.sql`: the example lesson of `04-content-system.md` section 7, saved validated through `save_lesson`; skips itself when present.
- `supabase/config.toml`: only `public` exposed, the seed enabled.
- `.github/workflows/ci.yml`: the `db` job (pinned CLI, `supabase start`, `supabase test db`). `deploy.yml`: staging migrations now pass `--include-seed`.
- `scripts/apply-migrations.sh`: `--include-seed`, refused unless `SEED_PROJECT_REF` names the project in the URL.

## Work package

- Work package: WP-2.1 Schema and policies.
- Requirements and threats covered: NFR-SEC-03, NFR-SEC-06, FR-GRD-05, FR-PRG-04, FR-PRG-07, FR-ADM-09, FR-ADM-14; T-08, T-10, T-20, T-21, T-22.
- Time box 3 hours. Started 2026-11-20 17:30 in one session; the end of that session was not recorded. Continued 2026-11-21 00:30 to 01:15. The total is not measured and is likely past one and a half times the box: the reviews took four rounds.

## How it was verified

`pnpm verify` at 506001b:

```
 Test Files  24 passed (24)
      Tests  658 passed (658)
```

Database tests, **on PGlite, not on Supabase.** The security reviewer's harness: PGlite 0.5.17 (PostgreSQL 18.7), pgTAP 1.3.3 from source, and a stub of what Supabase provides (the `anon`, `authenticated` and `service_role` roles, `auth.users`, `auth.jwt()` and `auth.uid()` reading `request.jwt.claims`, Supabase's default grants on `public`). At 506001b, with the seed applied first:

```
seed applied
== 01_admin_gate.test.sql: 33 ok, 0 not ok
== 02_content_policies.test.sql: 80 ok, 0 not ok
== 03_learner_policies.test.sql: 57 ok, 0 not ok
== 04_triggers.test.sql: 54 ok, 0 not ok
== 05_limits.test.sql: 47 ok, 0 not ok
```

The same without the seed. The seed run a second time: no error, one course, one published validated lesson, one solution.

Breaks that make at least one test fail (each run on a copy): `is_admin()` without the allow-list; `save_lesson` as security definer; public course reads with `status <> 'draft'`; no `validated_at` check on insert; the solution trigger on update only; the completion policy without the course's status; a gradable change that keeps `validated_at`; no `updated_at` bump on a lesson save; no published-lesson completeness check; table-wide update on `lesson_solutions`; `display_name` up to 400; XP 1 to 100; 13 test cases; completion code up to 2,000,000 characters.

Not verified: anything on the Supabase image. PGlite runs as a superuser and its stub is not Supabase's, so the image's Postgres version, its grants, and whether `postgres` may put a trigger on `auth.users` are not checked. The generated types do not exist. The `db` job has never run.

## Reviews

- code-reviewer: round 1 CHANGES REQUIRED (3 BLOCKER, 6 MAJOR, 11 MINOR); round 2 CHANGES REQUIRED (1 BLOCKER, 4 MAJOR, 7 MINOR). All fixed or answered: `docs/reports/reviews/WP-2.1/code-review-2.md`. The open BLOCKER is "nothing has run on Supabase", which only the `db` job or the owner can close.
- security-reviewer: round 1 CHANGES REQUIRED (5 MAJOR, 5 MINOR); round 2 **APPROVE** with 3 MINOR, all fixed: `docs/reports/reviews/WP-2.1/security-review-2.md`. Round-1 MINOR 5 is deferred to WP-6.1 (below).
- Neither reviewer has seen 506001b, the commit with the round-2 fixes.

Open MAJOR findings for the owner to waive: code review 2 MAJOR 4, below.

## Owner actions now due

1. Open this pull request so the `db` job runs on GitHub, which has Docker. Paste its log, or tell the next session to read it. Every failure is mine to fix.
2. With Docker Desktop running, in a checkout of this branch with its dependencies installed, generate the types:
   ```sh
   supabase start
   pnpm test:db
   supabase gen types typescript --local > src/infrastructure/db/database.types.ts
   supabase stop
   ```
   Commit `database.types.ts`, or paste it.
3. Add the `staging` environment variable `STAGING_PROJECT_REF` (runbook `docs/runbooks/infrastructure-setup.md` step 7). Without it, the staging job refuses to seed and fails.
4. After the `db` job has run once, add `db` to the required checks of branch protection (`05-engineering-handbook.md` section 10).
5. **Decide on commit identity.** Commit 036626d (this branch) was made in a clone with no Git identity, so it carries the machine's default name and address, which includes the computer's host name. It is pushed. Re-authoring it needs a force push, which the guardrails block. Options: (a) accept it: the squash merge on `main` uses your identity, and the branch can be deleted after the merge, though GitHub keeps the pull request's commits; (b) run, yourself, `git rebase --exec 'git commit --amend --no-edit --reset-author' origin/main` on this branch and `git push --force-with-lease`. Recommendation: (b) before the repository is made public, since the host name is personal data. Default: (a).

## Deviations from the plan or the spec

- **The `/api/health` database check moves to WP-2.2.** It needs a database client, which `08-delivery-plan.md` builds in WP-2.2. You approved it for WP-2.1 (item 5 of the `spec-change` pull request); building the client here would pull WP-2.2's dependencies into this package.
- **Generated types are missing** (owner action 2).
- **Staging through the workflow is not shown**: the deploy is off until `DEPLOY_ENABLED` is set.
- **Proposed spec change, pending owner decision:** `04-content-system.md` sections 2.1 and 8 name the follow-up code field `after_code`. The database and the WP-3.3 parser store `afterCode`. Proposal: the spec says `afterCode`, and the import format of WP-6.4 uses the same name.
- **For WP-6.1:** sending again a completion of a lesson that was since archived raises `lesson_not_found` from the trigger, before `on conflict do nothing` is reached. `mergeProgress` must not let one such row fail the whole batch (security review 1, MINOR 5).

Choices made where the spec is silent:

- A published course whose last published lesson is archived stays published, with no lesson to show. Section 8.3 says the trigger refuses publishing such a course; this reads it as a rule at publish time. Decision for the owner if section 1.1 means it always holds.
- The Postgres major version is the CLI's default; `config.toml` does not pin it. The CLI's documented default is 15, and its documentation says it must match the hosted projects, whose version is not recorded in the repository. Decision for the owner: read `show server_version;` in the production SQL editor and pin that major version.
- Limits not in the spec: a course or lesson `slug` is at most 60 characters of lowercase letters, digits and single hyphens; each course outcome at most 140 characters; a chapter summary at most 140; a wrong answer's label 1 to 80; `time_zone` 1 to 64, not checked against the time zone database.
- A draft lesson may have no test case and empty instructions. A published one needs both (a check), and publishing needs a passing validation (the trigger).
- A learner can set a past `completed_at`. The spec forbids only a future one, and a guest's sync needs past ones, so streaks can be forged; ADR-0007 accepts that.
- How `validated_at` is protected: a trigger refuses any change to it unless `save_lesson` has named the lesson in a transaction setting, in the same statement, at the transaction's time. An admin at `aal2` could set that setting by hand. This guards against a bug in the dashboard, not against the admin, which is the trust model of ADR-0026.
- The seed runs once per file hash (the CLI records it), and also skips itself when the sample course exists. A changed seed reaches staging only after its rows and its row in `supabase_migrations.seed_files` are removed by hand.

## Risks and rollback

The migrations create tables and change nothing that exists, so a rollback of the app leaves them unused. A failure in the staging job stops the deploy before production.

## Definition of Done

- [ ] Every "Done when" line is met, with evidence above. **No:** nothing has run on the Supabase image or on staging.
- [x] Every cited Must requirement has a passing test that names its ID (on PGlite).
- [ ] `pnpm verify` and every required check pass. `pnpm verify` passes; the `db` job has not run.
- [x] Every state of every changed view exists. No view changed.
- [x] No stub, dead control, placeholder, commented-out code, or invented number.
- [x] New tables have policies and policy tests. No server action in this package.
- [ ] Every reviewer blocker is fixed. Code review 2 BLOCKER 1 needs the `db` job.
- [x] No AI attribution in any commit or in this description.

Create with:

```sh
gh pr create --draft --base main --head wp/2.1-schema-policies --title "WP-2.1 Schema and policies" --body-file docs/reports/pull-requests/WP-2.1.md
```
