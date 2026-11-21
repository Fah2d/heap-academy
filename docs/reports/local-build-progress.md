# Local build progress

Work done in sessions while the owner was away, and what is left for the owner to run. Newest first. The newest copy of this file is on the branch named in its first section.

## Session of 2026-11-21 (from 05:32), on `wp/2.2-sign-in`

Sessions between 01:31 and 05:12 started and did nothing (their scratch folders are empty). This one picked up WP-2.2 from the uncommitted work in `$TMPDIR/wp22`.

### WP-2.2 Sign-in: ready as a draft, `wp/2.2-sign-in` (stacked on `wp/2.1-schema-policies`)

Description: `docs/reports/pull-requests/WP-2.2.md`, with its `gh pr create` command. `pnpm verify`: 38 files, 867 tests. `next build`, `check-static` and `check-bundle` pass. PGlite: 285 assertions pass, including two new files (`06_is_admin_wrapper`, `07_password_on_confirm`). Design, code and security review 1: all CHANGES REQUIRED; every finding fixed or answered in the description; not re-reviewed. e2e written, not run.

`wp/2.2-sign-in-part-1` is superseded by `wp/2.2-sign-in` (its tip fadd19b is in it). Do not open a pull request for part 1.

### WP-3.4 The statechart: part 1, `wp/3.4-statechart` at e1123ce (stacked on `wp/3.3-grader`)

`src/runtime/workspace-chart.ts`: a typed reducer (ADR-0020's choice, no library), with 38 tests: every transition of the architecture diagram, every unlisted pair a no-op, the diagram checked against the table, the pending intent, the lesson region, generated paths. `pnpm verify`: 38 files, 989 tests. No reviews yet, no description yet.

Left in WP-3.4: merge `wp/3.2-live-input` (its conflicts with 3.3 in `controller.ts`, `core.ts`, `runtime-dev.ts` and their tests); drive the development page with the chart (input, a check, a runaway loop); a way for that page to exist on previews (the `.dev.tsx` pages are dropped from every `next build`, previews included); the spike report from `docs/templates/spike-report.md` after the owner's phone check.

### Setup notes added this session

- npm works with a private cache: `npm install --cache $TMPDIR/npmc ...`. `$TMPDIR/supa-side/node_modules` holds `@supabase/ssr` 0.12.7 and `@supabase/supabase-js` 2.119.2 with their dependencies. Copy them (`cp -R`, not symlinks: Turbopack does not follow links out of the project) into a clone's `node_modules` to build and test the WP-2.2 branches until the owner commits the lockfile.
- A server started with `&` in one command cannot be found or stopped from the next one (the sandbox hides it). Start and stop it in the same command (`cmd & pid=$!; ...; kill $pid`).
- The PGlite harness's `auth.users` stub (in `$TMPDIR/harness/run.mjs`) now has `encrypted_password` and `email_confirmed_at`.

### Owner: run this

1. In a checkout of `wp/2.2-sign-in`, with dependencies installed: `pnpm install && git add pnpm-lock.yaml && git commit -m "build: lock the Supabase clients" && git push`. Every CI job of WP-2.2 and of anything stacked on it fails at the frozen install until this is done.
2. A production server from this session is still listening on port 3197 and the sandbox cannot stop it: `lsof -ti tcp:3197 | xargs kill`.
3. The WP-2.2 owner actions in its description: runbook section 10 with Confirm email on and the Turnstile key split, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Vercel, `e2e` as a required check.

## Session of 2026-11-21 (from 00:30)

Order given by the owner: (1) update waiting branches, already done on 2026-11-20; (2) WP-2.1; (3) WP-2.2; (4) WP-2.3; (5) WP-3.4; then the plan order.

### Setup notes for the next session

- `pnpm install` cannot run here: pnpm fails with `Failed to open the store operation lock at "pnpm-store-operation-locks": Operation not permitted`, also with `--store-dir` and cache folders under `$TMPDIR`. So no package can be added. Scratch clones get `node_modules` by `cp -Rc` from a folder with the same `pnpm-lock.yaml`: `$TMPDIR/wp13-merge` (lockfile of `main`, sha1 `78b66709`) and `$TMPDIR/-Users-fahad-heap-academy/f5fba7f9-a8ad-4cf7-ab98-f96c832e2ec3/scratchpad/ha3` (lockfile of the WP-3.x branches with Pyodide, sha1 `afaedb81`). The main checkout's `node_modules` is stale.
- In a new clone, run `pnpm run prepare` (sets `core.hooksPath`) and set `user.name` and `user.email` from the main checkout before the first commit. Commit 036626d was made without them (see WP-2.1 owner action 5).
- `gh` cannot reach GitHub from the sandbox (certificate error), so pull requests are not opened; each description file ends with its `gh pr create` command.
- The PGlite harness: from `$TMPDIR`, `PGL=$TMPDIR/pgl SEED=1 node harness/run.mjs <clone> $TMPDIR/pgtap/pgtap.sql.in`.

## WP-2.1 Schema and policies: ready as a draft, `wp/2.1-schema-policies` at fc1b637

Description: `docs/reports/pull-requests/WP-2.1.md`, with its `gh pr create` command. `pnpm verify`: 24 files, 658 tests. PGlite: 271 assertions pass, with and without the seed. Security review 2: APPROVE. Code review 2: CHANGES REQUIRED, all fixed or answered except "nothing has run on Supabase".

This session added: the staging seed through the deploy workflow, guarded by `STAGING_PROJECT_REF`; a check that a published lesson has instructions and a test case; solutions that cannot move to another lesson; `05_limits.test.sql` (47 assertions: every size limit, the stale save across two saves, the two timestamp triggers, every table and column privilege).

Owner: open it so `db` runs; generate the types; add `STAGING_PROJECT_REF`; decide on commit 036626d's identity. Details in the description.

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
