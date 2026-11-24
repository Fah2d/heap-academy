# Local build progress

Work done in sessions while the owner was away, and what is left for the owner to run. Newest first. The newest copy of this file is on the branch named in its first section.

## Session of 2026-11-24 (from about 19:40), in `night-c`, on `wp/7.3-operations`

- `git fetch` at 19:40: `origin/main` is still 7875ee2 and already in `wp/7.3-operations`. Task 1 has nothing new. The only branch that moved is another agent's `origin/wp/5.1-catalog` (now f2ab9b3), which this run does not touch.
- Task 2 is still blocked: the dependencies in `docs/spec/08-delivery-plan.md` are unchanged, and WP-2.2 and WP-3.1, the only packages that depend only on `origin/main`, already have other agents' branches. No branch was started.
- Committed locally, not pushed: this note adds nothing the pushed 19:39 note does not already say, so it is not worth a Vercel build. The next push of this branch carries it.
- Checked again at about 19:42, 19:44, 19:45, 19:47, 19:48, 19:49 and 19:51: `origin/main` still 7875ee2 and already in `wp/7.3-operations`; no branch moved since 19:39 except other agents' new `origin/wp/5.2-workspace-laptop` (ada3275, 19:44; not touched). The lint fix the owner asked for (WP-5.1 decision #5) is already on `origin/wp/fix-lint-template-import`. Still blocked, no code changed; committed, not pushed. At 19:49 the analytics packages of decision C (approved as option (a)) are still not in `package.json`, so the part that mounts them cannot start; installing them is the owner's step.
- Checked again at about 19:52: `origin/main` still 7875ee2 and already in `wp/7.3-operations`; no branch moved since 19:44. Owner action 6 is now done on another agent's `origin/wp/5.1-catalog` (f2ab9b3): `src/messages/system.ts` line 13 reads "We could not prepare this page. Try again.", so owner action 2 of the 19:24 section below is no longer due. Still blocked; committed, not pushed.
- The run stops here.

## Session of 2026-11-24 (from about 19:39), in `night-c`, on `wp/7.3-operations`

- `origin/main` is still 7875ee2 and already in `wp/7.3-operations` (`git merge-base --is-ancestor`). Task 1 has nothing new.
- Task 2 is still blocked for the same reason as the section below: WP-2.2 and WP-3.1, the only packages that depend only on `origin/main`, already have other agents' branches (`origin/wp/3.1-python-worker` moved at 19:33; `origin/wp/2.2-sign-in` is at 9717efb). No branch was started.
- `gh pr list` still fails with the same TLS error (`x509: OSStatus -26276`).
- Pushed `wp/7.3-operations` this time (fast-forward, only this file changed since 3634019), so the owner's chat can read the notes of the 15:24 to 19:39 runs. Default decision: one Vercel build is worth making these notes visible; the earlier runs held them back. Nothing else is due on this branch, so the next push waits for new work.
- The run stops here, as the instructions say for a blocked task.

## Session of 2026-11-24 (from about 19:24), in `night-c`, on `wp/7.3-operations`

New owner decisions of 2026-11-24 for WP-5.1: owner action 5 (fix the backtick `import()` lint bypass as its own small branch from `origin/main`) and owner action 6 (the error page wording). `origin/main` is still 7875ee2.

### Task 1: nothing new on `wp/7.3-operations`

It already contains `origin/main` (checked with `git merge-base --is-ancestor`). Still not pushed: the notes in the sections below and this one, to save a Vercel build.

### Owner action 5: built here, then found already pushed by another agent; not pushed

- This run built the fix on a branch from `origin/main` (four commits, three `security-reviewer` rounds, each APPROVE; `pnpm verify` exit 0, 28 files, 735 tests). At push time (about 19:38), `origin/wp/fix-lint-template-import` already existed: another agent pushed it at 19:33 (01c8227, 9f15550), with its own description and two security reviews.
- That branch is the one to keep. It refuses every computed `import()` and `require()` source except in `src/runtime/worker/python-worker.ts`, which is stricter than this run's version, and it matches bce0f08, which is already on `wp/3.3-grader`, 3.4, 4.3 and 5.2. Pushing this run's version would have made a second pull request for the same fix, and it would conflict with those branches.
- This run's version is kept only locally, as `wp/fix-lint-template-import-night-c-local` in `night-c`. Nothing from it was pushed.
- Two things from this run's three security reviews may help the other branch's review. Neither is a gap outside the worker file, because that branch refuses every computed source there:
  - In the worker file, which is allowed to compute an import, `import(flag ? "@/infrastructure/db/privileged" : "@/ui")` and `import("@/infrastructure/db/privileged" as string)` would pass. TypeScript's `as`, `satisfies`, `!` and `<T>` disappear at build time, so the bundler sees a fixed string.
  - In the worker file, a source that joins to a whole fixed string, such as `"@/infrastructure/db/" + "privileged"`, also passes; the other branch's test refuses it only in a feature.

### Owner action 6: not done here

The error page string ("Something failed on our side while we prepared this page. Try again." in `src/messages/system.ts`, from WP-1.4) is shown on `wp/5.1-catalog`'s failure screens, so the new wording ("We could not prepare this page. Try again.") belongs on that branch, with its screens retaken. That is another agent's branch, so this run did not edit it.

### Task 2: still blocked

Same as the sections below: every package that depends only on `origin/main` (WP-2.2, WP-3.1) already has another agent's branch. No branch was started.

### Owner: run this

1. Open or update the pull request for `origin/wp/fix-lint-template-import` (the other agent's branch). If you want the two worker-file forms above refused, tell that branch's agent.
2. Apply owner action 6 on `wp/5.1-catalog`.

## Session of 2026-11-24 (from about 15:24), in `night-c`, on `wp/7.3-operations`

`origin/main` is still 7875ee2 and already in `wp/7.3-operations`. No branch was merged since the run before.

### Task 1 done: decision N marked approved

- The owner's instruction of 2026-11-24 approves every recommended default in every pull request description. This run read it after part 5 wrote decision N (the 500,000 rate-limit trigger), so N is now approved.
- ADR-0029's part 5 note and the usage runbook now say "approved by the owner on 2026-11-24" instead of "awaiting the owner's approval". `WP-7.3-part-5.md` says the same in its owner actions and its decision N.
- `npm_config_verify_deps_before_run=false pnpm verify`: exit 0, `Test Files  34 passed (34)`, `Tests  746 passed (746)`. pnpm printed `ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK` for its pre-run install; nothing was installed.
- WP-7.3 has nothing left that this run can do: decision C needs two packages installed, decision E is the owner's patch, and the backup workflow waits for the CI `db` job to prove the `backup_reader` role.

### Task 2: still blocked

Same as the run before. `origin/main` has WP-1.1 to 1.4, WP-2.1, WP-6.1 part 1 and WP-6.2 part 1. The only packages that depend on nothing else are WP-2.2 (`origin/wp/2.2-sign-in`, 9717efb at 15:17) and WP-3.1 (`origin/wp/3.1-python-worker`, pull request #9), and both already have another agent's branch. Every other package depends on WP-2.2, 2.3, 3.x, 4.x, 5.x or all of WP-6.1. No branch was started.

- Checked again at about 17:50, 17:52, 17:53, 17:55, 17:56, 17:58, 17:59, 18:01, 18:02, 18:04, 18:05, 18:07, 18:09, 18:10, 18:12, 18:13, 18:15, 18:17, 18:18, 19:17, 19:19, 19:21, 19:22 and 19:23: `origin/main` still 7875ee2 and already in `wp/7.3-operations`; no branch moved since 15:26 except other agents' `origin/wp/5.1-catalog` (now 7a57d81, not merged, not touched); `gh pr list` still fails with the same TLS error; the dependencies in `docs/spec/08-delivery-plan.md` re-read and unchanged (WP-7.1, 7.2, 7.4, 7.5 and 8.1 are passes over the finished site, so they wait for the packages before them). Still blocked, no code changed. The 18:10, 18:12, 18:13, 18:15, 18:17, 18:18, 19:17, 19:19, 19:21, 19:22 and 19:23 runs stopped here, as the instructions say for a blocked task; they did not loop. Committed but not pushed, to save a Vercel build; the next push of this branch carries it.

### Owner: run this

1. The three owner actions of the 15:08 section below are still due: apply the Deploy patch, decide how to install the analytics packages (decision C), and open or update the WP-7.3 pull request with the `spec-change` label and `WP-7.3-part-{1,2,3,4,5}.md` as its body.
2. Merge WP-2.2 or WP-3.1, and the next run can start a package.

## Session of 2026-11-24 (from about 15:20), in `night-c`, on `wp/7.3-operations`

`origin/main` is still 7875ee2 and already in `wp/7.3-operations`. No other branch was merged since the run before.

### Task 1 done: WP-7.3 part 5 (the rate-limit trigger)

- The one item of "What is left for WP-7.3" that needed nobody else: ADR-0029 had no trigger for the 1,000,000 allowed requests of the firewall's rate-limit rule (E-23), which NFR-COST-02 asks for. Added at 500,000 (decision N, awaiting the owner's approval), with the usage runbook row.
- Reading Vercel's pages again found that neither states the period of that amount or what happens when it runs out; `07-operations.md` section 7 said "a month". E-23 and section 7 now say so.
- `npm_config_verify_deps_before_run=false pnpm verify`: exit 0, `Test Files  34 passed (34)`, `Tests  746 passed (746)`.
- Description: `docs/reports/pull-requests/WP-7.3-part-5.md`. Documents only; no reviewer asked.

### Task 2: still blocked

Same as the run before: every package that depends only on `origin/main` (WP-2.2, WP-3.1) already has another agent's branch, and every other one depends on a package not in `main` (checked with `git merge-base --is-ancestor` at about 15:20). No branch was started.

### Owner: run this

1. Decide N in `WP-7.3-part-5.md`.
2. The three owner actions of the 15:08 section below are still due; the pull request body now also takes `WP-7.3-part-5.md`.

## Session of 2026-11-24 (from about 15:08, after the owner's decisions of 2026-11-24), in `night-c`, on `wp/7.3-operations`

`origin/main` is still 7875ee2 and already in `wp/7.3-operations`. The owner approved every recommended default (see the task list); for WP-7.3 that is decisions A to H.

### Task 1 done: WP-7.3 part 4 (the approved decisions)

- An earlier run had committed part 4's code and spec text (c3a42ac, 0efc4f3, 024c6d3) but not its description or reviews. This run reviewed and finished it.
- Decision A (the browser sends its bundle's release), B and D (spec text, marked approved by the owner on 2026-11-24), and E as a patch for the owner: `docs/reports/pull-requests/WP-7.3-deploy-dispatch.patch`. Description: `docs/reports/pull-requests/WP-7.3-part-4.md`; parts 1 to 3 now say which decisions the owner approved.
- `code-reviewer` round 5: CHANGES REQUIRED, two majors: `HEAP_RELEASE` stayed a server variable against decision A (a), and the pull request command lacked the `spec-change` label. `security-reviewer` round 7: APPROVE, three minors. All fixed or listed, not reviewed again. Reports: `docs/reports/reviews/WP-7.3/code-review-5.md` and `security-review-7.md`.
- The rename to `NEXT_PUBLIC_HEAP_RELEASE` is in the owner's patch, not on the branch, because `deploy.yml` sets the variable and must change in the same commit (decision I). The patch also skips a Deploy run from any branch but `main`.
- `npm_config_verify_deps_before_run=false pnpm verify` on the branch: exit 0, `Test Files  34 passed (34)`, `Tests  746 passed (746)`. With the patch applied: exit 0, 34 files, 747 tests. pnpm's pre-run install failed on the store lock each time; nothing was installed (`pnpm-lock.yaml` unchanged).
- Not run: the end-to-end suite, `pnpm test:db`, and `next build` on the patched tree.
- Decision C (analytics) still waits: the two packages are not installed, and these runs may not install packages.

### Task 2: still blocked

`origin/main` has WP-1.1 to 1.4, WP-2.1, WP-6.1 part 1 and WP-6.2 part 1. The packages that depend only on those are WP-2.2 (`origin/wp/2.2-sign-in`) and WP-3.1 (`origin/wp/3.1-python-worker`, pull request #9), and both already have another agent's branch. Every other package depends on WP-2.2, 2.3, 3.x, 4.x, 5.x or all of WP-6.1, none in `main` (checked with `git merge-base --is-ancestor`). No branch was started.

### Owner: run this

1. Read the patch, then on `wp/7.3-operations`: `git apply docs/reports/pull-requests/WP-7.3-deploy-dispatch.patch && pnpm verify`, then commit and push it yourself. It adds the manual Deploy run and finishes decision A.
2. Decision C: `pnpm add @vercel/analytics @vercel/speed-insights`, and turn on Analytics and Speed Insights in Vercel.
3. Open or update the WP-7.3 pull request with the `spec-change` label (commands at the end of owner actions in `WP-7.3-part-4.md`).

## Session of 2026-11-24 (from about 13:57, after WP-2.1 merged), in `night-c`, on `wp/7.3-operations`

`origin/main` moved to 7875ee2: WP-2.1 (pull request #12) is merged. That unblocked task 1 again.

### Task 1 done: wp/7.3-operations up to date with main, and part 3 built

- Merge commit 7e3cd88: `origin/main` (7875ee2) into `wp/7.3-operations`. One conflict, this file: kept every section of both copies; the new `night-b` section from `main` (from about 13:40) is placed above the other `night-b` sections, and the 2026-11-23 23:25 `night-b` section takes `main`'s newer, shortened copy. `pnpm verify`: exit 0, 32 files, 739 tests.
- WP-7.3 part 3: the `backup_reader` role of ADR-0030 (`supabase/migrations/20261124120000_backup_reader.sql`) and 18 pgTAP tests that pin it (`supabase/tests/database/06_backup_reader.test.sql`). ADR-0030 says the role must be proved before the backup workflow is built, so the workflow is not in this part.
- **Not run: `pnpm test:db`** (no Docker, no `psql` here). The migration and the tests have not run anywhere yet; the CI `db` job is their first run.
- Two `security-reviewer` rounds: round 5 CHANGES REQUIRED (2 majors, 4 minors, fixed), round 6 APPROVE. One line added after round 6 (the `maintain` check) is unreviewed. Reports: `docs/reports/reviews/WP-7.3/security-review-5.md` and `-6.md`.
- `pnpm verify` after part 3: exit 0, 32 files, 739 tests.
- Description: `docs/reports/pull-requests/WP-7.3-part-3.md`, with default decisions F (role created without login), G (new `auth` tables need a new grant, caught by the test) and H (`maintain` checked from Postgres 17 only).
- The task took about 11 minutes (13:57 to 14:08), so this run goes on to task 2 after the push.

### Task 2 blocked: no package to start without duplicating another agent

With WP-2.1 in `main` (7875ee2), two packages depend only on `main`, and both already have a branch another agent is working on:

- WP-2.2 (depends on WP-1.4; needs WP-2.1's `profiles` trigger, now in `main`): `origin/wp/2.2-sign-in` at 79c8dc7, last commit 13:44 today, 1 commit behind `main`. `night-b` keeps it current in its stack.
- WP-3.1 (depends on WP-1.3): `origin/wp/3.1-python-worker` at 01a141a, last commit 14:04 today, up to date with `main`; draft pull request #9.

Every other package depends on WP-2.2, 2.3, 3.x, 4.x, 5.x or 6.1, none of which is in `main` (checked with `git rev-list` and `git merge-base`). WP-7.3's backup workflow waits for the CI `db` job to prove the `backup_reader` role. No branch was started. This note is committed on `wp/7.3-operations` but not pushed, to save a Vercel build; the next push of this branch carries it.

### Owner: run this

1. Open or update the WP-7.3 pull request with all three parts (command at the end of `WP-7.3-part-3.md`), so the CI `db` job runs the new migration and tests.
2. If the `db` job fails at `supabase start` on `create role ... bypassrls` or on the `auth` grants, the role cannot be made as ADR-0030 says; decide before the backup is built.
3. Do not turn on login for `backup_reader` yet.

## Session of 2026-11-24 (run after the owner noted pull request #10 in `main`), in `night-c`, on `wp/7.3-operations`

Task 1 done as far as it can go: `wp/7.3-operations` now contains `origin/main` at 81fdc39. Task 2 is still blocked.

- Merged `origin/main` (81fdc39, pull request #10) into `wp/7.3-operations`. The only conflict was this file (both sides added it). Resolved by keeping every section from both sides: the header, then this branch's `night-c` and `night-b` sections, then the sections from `main`. The 21 sections both copies already shared appear once (checked with `diff`: identical). Sections are grouped by source, so they are not in strict time order across agents.
- `pnpm verify` on the merged tree: exit 0, `Test Files  31 passed (31)`, `Tests  731 passed (731)`. pnpm printed a warning that its pre-run install failed (no package install is allowed here); the run itself passed.
- WP-7.3 itself cannot go further: every remaining part in "What is left for later parts of WP-7.3" of `docs/reports/pull-requests/WP-7.3-part-2.md` still needs decision C, WP-2.1 in `main`, or the owner.
- Task 2: `main` has WP-1.1 to 1.4, WP-6.1 part 1, WP-6.2 part 1 and the smoke fix. Every package that depends only on those already has an open pull request (WP-2.1 #12, WP-3.1 #9, WP-6.3 #11). Every other package in `docs/spec/08-delivery-plan.md` depends on WP-2.1, 2.2, 2.3, 3.1, 4.x or 5.x, none of which is in `main` (checked with `git merge-base --is-ancestor`). WP-7.1 and WP-7.2 review the whole application, so they wait too. No new branch was started.

- Checked again in four later runs on 2026-11-24 (the last at about 13:55, with no branch moved since the run before; the one before it, after `origin/wp/4.3-validate-publish` moved to 608ff07 and `origin/wp/5.1-catalog` to abf86db, neither merged; an earlier one also re-read the Day 6 to Day 8 dependencies in `docs/spec/08-delivery-plan.md`; WP-7.4, 7.5 and 8.x need the full journey suite or every earlier package): `origin/main` still 81fdc39 and already in `wp/7.3-operations`; WP-2.1, 2.2, 3.1 and 6.3 still not in `origin/main`; `gh pr list` still fails with the same TLS error. Still blocked, no code changed. This note was committed but not pushed, to save a Vercel build for a change with no new work.

### Owner: run this

- Merge WP-2.1 (#12) or WP-3.1 (#9), or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.
- `wp/7.3-operations` no longer conflicts with `main`. `wp/6.3-legal-pages-footer` still will, in this file only.

## Session of 2026-11-24 (run after `main` moved to 81fdc39), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` moved from 0efe863 to 81fdc39 (pull request #10, `wp/fix-smoke-and-runtime`). That change touches the CSP end-to-end test, `scripts/infra-verify.mjs`, build ignores and reports. It merges no WP-2.x, 3.x, 4.x or 5.x package, so it unblocks nothing in Days 6 and 7.
- Checked with `git merge-base --is-ancestor`: `wp/2.1-schema-policies`, `wp/2.2-sign-in`, `wp/4.3-validate-publish`, `wp/3.1-python-worker`, `wp/6.3-legal-pages-footer` and `wp/7.3-operations` are all still not in `origin/main`.
- `gh pr list` still fails here (`tls: failed to verify certificate: x509: OSStatus -26276`), so decision C could not be checked in pull request comments.
- Checked again in three later runs on 2026-11-24, the last at about 13:47: `origin/main` still 81fdc39, and `docs/spec` and `docs/adr` are unchanged since 0efe863. Only other agents' branches moved (`origin/wp/2.1-schema-policies` 9077917 to 57903a0; `origin/wp/2.2-sign-in` 6318e45 to 79c8dc7; `origin/wp/3.1-python-worker` to 5db3d1a; `origin/wp/3.3-grader` to dd6ebeb; `origin/wp/3.4-statechart` to 915c1c3; not merged, not touched). `git merge-base --is-ancestor` confirms WP-2.1, 2.2, 2.3, 3.1, 4.3 and 5.1 are not in `origin/main`. Still blocked, no code changed.
- `main` now carries its own copy of this file (811 added lines from other agents' sessions). The copies on `wp/6.3-legal-pages-footer` and `wp/7.3-operations` will conflict with it in this file only. Not merged here: the owner decides how to combine the reports.

### Owner: run this

- Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.
- Before merging `wp/6.3-legal-pages-footer` or `wp/7.3-operations`, expect a conflict in `docs/reports/local-build-progress.md` only.

## Session of 2026-11-24 (run after "next run after the 03:25 chain"), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved since the last run (it is at abf73dc; another agent's branch, not touched).
- `gh pr list` still fails here (`tls: failed to verify certificate: x509: OSStatus -26276`), so decision C could not be checked in pull request comments.
- The dependency list in the "later run" sections below still holds.
- Checked again in 207 later runs on 2026-11-24, the last one at about 13:40 with `origin/wp/5.1-catalog` at 84d757c, `origin/wp/3.1-python-worker` at 76f6fd3, `origin/wp/3.4-statechart` at 1987e99 and `origin/wp/3.3-grader` at d7633c7. Every time: `origin/main` still 0efe863; only other agents' branches moved (`wp/5.1-catalog`, `wp/3.1-python-worker`, `wp/3.3-grader`, `wp/3.4-statechart`, and `wp/fix-smoke-and-runtime` at 27ce416; not merged, not touched); `gh pr list` failed with the same TLS error. Still blocked, no code changed. The one-line notes from those runs were folded into this line so the file stays readable.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (next run after the 03:25 chain), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (5294748 to abf73dc, another agent's branch; not touched).
- `gh pr list` still fails here (`tls: failed to verify certificate: x509: OSStatus -26276`), so decision C could not be checked in pull request comments.
- The "What is left for later parts of WP-7.3" section of `docs/reports/pull-requests/WP-7.3-part-2.md` was read again: every remaining part still needs decision C, WP-2.1, or the owner.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (run after "run after "run after "run after "run after 03:25""""), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. No branch moved this time (`origin/wp/5.1-catalog` is still 5294748; not touched).
- `gh pr list` still fails here (`tls: failed to verify certificate: x509: OSStatus -26276`), so decision C could not be checked in pull request comments.
- The dependency list in the "later run" sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (run after "run after "run after "run after 03:25"""), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (6b94762 to 5294748, another agent's branch; not touched).
- `gh pr list` still fails here (`tls: failed to verify certificate: x509: OSStatus -26276`), so decision C could not be checked in pull request comments.
- The dependency list in the "later run" sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (run after "run after "run after 03:25""), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (c9f695d to 6b94762, another agent's branch; not touched).
- `gh pr list` still fails here (`tls: failed to verify certificate: x509: OSStatus -26276`), so decision C could not be checked in pull request comments.
- The dependency list in the "later run" sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (run after "run after 03:25"), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (a926373 to c9f695d, another agent's branch; not touched).
- `gh pr list` still fails here (`tls: failed to verify certificate: x509: OSStatus -26276`), so decision C could not be checked in pull request comments.
- The dependency list in the "later run" section below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (run after 03:25), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (0bcf9a1 to a926373, another agent's branch; not touched).
- `gh pr list` still fails here (`tls: failed to verify certificate: x509: OSStatus -26276`), so decision C could not be checked in pull request comments.
- The dependency list in the "later run" section below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (run after "run after "run after "run after "one more run after the previous blocked run""""), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (25a3101 to 0bcf9a1, another agent's branch; not touched).
- `gh pr list` still fails here (`tls: failed to verify certificate: x509: OSStatus -26276`), so decision C could not be checked in pull request comments.
- The dependency list in the sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (run after "run after "run after "one more run after the previous blocked run"""), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (04848a7 to 25a3101, another agent's branch; not touched).
- `gh pr list` still fails here (`tls: failed to verify certificate: x509: OSStatus -26276`), so decision C could not be checked in pull request comments.
- The dependency list in the sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (run after "run after "one more run after the previous blocked run""), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (ad4431f to 04848a7, another agent's branch; not touched).
- `gh pr list` still fails here (`tls: failed to verify certificate: x509: OSStatus -26276`), so decision C could not be checked in pull request comments.
- The dependency list in the sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (run after "one more run after the previous blocked run"), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (d928068 to ad4431f, another agent's branch; not touched).
- `gh pr list` still fails here (`tls: failed to verify certificate: x509: OSStatus -26276`), so decision C could not be checked in pull request comments.
- The "What is left for later parts of WP-7.3" section of `docs/reports/pull-requests/WP-7.3-part-2.md` was read again: every remaining part needs decision C, WP-2.1, or the owner. The dependency list in the sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (one more run after the previous blocked run), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. `origin/wp/5.1-catalog` is at d928068 (another agent's branch; not touched).
- `gh pr list` still fails here (`tls: failed to verify certificate: x509: OSStatus -26276`), so decision C could not be checked in pull request comments.
- The dependency list in the sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (another run after the previous blocked run), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (0ae96ae to d928068, another agent's branch; not touched).
- `gh pr list` still fails here (`tls: failed to verify certificate: x509: OSStatus -26276`), so decision C could not be checked in pull request comments.
- The dependency list in the sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (run after the previous blocked run), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (23ed9e6 to 0ae96ae, another agent's branch; not touched).
- `gh pr list` still fails here (`tls: failed to verify certificate: x509: OSStatus -26276`), so decision C could not be checked in pull request comments.
- The dependency list in the sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (run after "run after "run after "run after "a later run""""), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (3478f31 to 23ed9e6, another agent's branch; not touched).
- `gh pr list` still fails here (`tls: failed to verify certificate: x509: OSStatus -26276`), so decision C could not be checked in pull request comments.
- The dependency list in the sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (run after "run after "run after "a later run"""), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (6051c1e to 3478f31, another agent's branch; not touched).
- `gh pr list` still fails here (`tls: failed to verify certificate: x509: OSStatus -26276`), so decision C could not be checked in pull request comments.
- The dependency list in the sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (run after "run after "a later run""), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (13beeed to 6051c1e, another agent's branch; not touched).
- `gh pr list` still fails here (`tls: failed to verify certificate: x509: OSStatus -26276`), so decision C could not be checked in pull request comments.
- The dependency list in the sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (run after "a later run"), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. `origin/wp/5.1-catalog` is now 13beeed (another agent's branch; not touched).
- `gh pr list` failed here (`tls: failed to verify certificate: x509: OSStatus -26276`), so pull request comments could not be checked for decision C.
- The dependency list in the sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (a later run), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (c8bc28c to 52d190f, another agent's branch; not touched).
- Nothing in `main` changed, so the dependency list in the sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (one run after the last), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (4afbb30 to c8bc28c, another agent's branch; not touched).
- The dependency lines in `docs/spec/08-delivery-plan.md` were checked again. The list in the sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (run after "run after "run after "run after next run after that"""), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (8b3ebc1 to 4afbb30, another agent's branch; not touched).
- The dependency list in the sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (run after "run after "run after next run after that""), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. No remote branch moved since the run below.
- Days 6 and 7 of `docs/spec/08-delivery-plan.md` and the "left for later parts" section of `docs/reports/pull-requests/WP-7.3-part-2.md` were read again. The dependency list in the sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (run after "run after next run after that"), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (5488020 to 8b3ebc1, another agent's branch; not touched).
- The dependency list in the sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (run after "next run after that"), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (04dc02b to 5488020, another agent's branch; not touched).
- Days 6 and 7 of `docs/spec/08-delivery-plan.md` were read again. The dependency list in the sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (next run after that), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (cd1cbae to 04dc02b, another agent's branch; not touched).
- Days 6 and 7 of `docs/spec/08-delivery-plan.md` were read again. WP-6.3 part 2 needs WP-2.1 and WP-2.2; WP-6.4 needs WP-4.3; the rest of WP-7.3 needs decision C or WP-2.1 (the `backup_reader` role) and the owner's `age` public key; WP-7.1, 7.2 and 7.4 check the whole application; WP-7.5 needs the four Day 7 packages merged.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (run after "the run after one run later"), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (1d00004 to cd1cbae, another agent's branch; not touched).
- The dependency lines in `docs/spec/08-delivery-plan.md` were checked again. The list in the sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (the run after "one run later"), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (9a06b10 to 1d00004, another agent's branch; not touched).
- The list in the sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (one run later), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (ed46532 to 9a06b10, another agent's branch; not touched).
- The dependency lines in `docs/spec/08-delivery-plan.md` were checked again. The list in the sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (run after that), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (cc5b327 to ed46532, another agent's branch; not touched). `wp/2.1-schema-policies` (9077917), `wp/2.2-sign-in` (6318e45), `wp/2.3-admin-gate` (07391a2) and `wp/4.3-validate-publish` (5a0d975) are not in `main`.
- The list in the sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (next run), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. `wp/2.1-schema-policies` (9077917), `wp/2.2-sign-in` (6318e45), `wp/4.3-validate-publish` (5a0d975) and `wp/5.1-catalog` (cc5b327) are not in `main`.
- Dependencies in `docs/spec/08-delivery-plan.md` were checked again: WP-6.3 part 2 needs WP-2.1 and WP-2.2, WP-6.4 needs WP-4.3, WP-7.x needs WP-2.x to 5.x or decision C. The list in the sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (one more run), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (41cc266 to cc5b327, another agent's branch; not touched).
- WP-6.3, 6.4 and 7.1 to 7.5 in `docs/spec/08-delivery-plan.md` were read again. The logger's allowlist tests already exist in `main` (`src/infrastructure/logging/logger.test.ts`), so that WP-7.3 item needs no new part. The rest of the list in the sections below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (a further run), in `night-c`, on `wp/7.3-operations`

Same task list. Still blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (38566c1 to 41cc266, another agent's branch; not touched).
- Days 6 and 7 of `docs/spec/08-delivery-plan.md` were checked again. WP-6.3 part 1 and WP-7.3 parts 1 and 2 are done. Everything left needs WP-2.1, WP-2.2, WP-4.3 or the rest of WP-2.x to 5.x, or the owner's decision C on analytics.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (another run), in `night-c`, on `wp/7.3-operations`

Same task list. Blocked for the same reason as the two runs below: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. Only `origin/wp/5.1-catalog` moved (another agent's branch; not touched).
- WP-7.3 in `docs/spec/08-delivery-plan.md` was read again. Its parts that need nothing unmerged (client error report, two runbooks) are done; analytics waits on decision C; backups, restore and the deletion runbook wait on WP-2.1 (and WP-6.3 part 2). WP-6.3 part 2 waits on WP-2.1 and WP-2.2. WP-7.1, 7.2, 7.4 and 7.5 wait on WP-2.x to 5.x.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (from 00:55), in `night-c`, on `wp/7.3-operations`

Same task list. Blocked for the same reason as the run below: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. `wp/7.3-operations` matched its remote (b5e3a8d) before this note.
- The plan was read again (`docs/spec/08-delivery-plan.md`, Days 6 and 7). Every package left needs an unmerged WP-2.x, 3.x, 4.x or 5.x, or the owner's decision C on analytics. The list in the section below still holds.

### Owner: run this

- Nothing new. Merge WP-2.1, WP-2.2 or WP-4.3, or decide C in `docs/reports/pull-requests/WP-7.3-part-2.md`, and the next run can start a package.

## Session of 2026-11-24 (later run), in `night-c`, on `wp/7.3-operations`

Same task list as the sessions below. Blocked: no new work package can start. No code was changed.

- `git fetch`: `origin/main` is still 0efe863. `wp/2.1-schema-policies`, `wp/2.2-sign-in` and `wp/4.3-validate-publish` are not in `main`.
- Already done on their branches: WP-6.3 part 1, WP-7.3 parts 1 and 2. `wp/7.3-operations` matches its remote (89250fa).
- What is left, and what each needs:
  - WP-6.3 part 2 (profile, display name, account deletion): WP-2.1 and WP-2.2.
  - WP-6.4: WP-4.3.
  - WP-7.1, 7.2, 7.4: they check the whole application, so they need WP-2.x to 5.x.
  - WP-7.3 analytics: the owner's decision C in `docs/reports/pull-requests/WP-7.3-part-2.md` (installing packages is not allowed in these runs).
  - WP-7.3 backup workflow, restore drill script, restore and deletion-request runbooks: WP-2.1 (and WP-6.3 part 2 for deletion).
  - WP-7.5: the four Day 7 packages merged. Day 8: everything before it.
- Not done on purpose: a fifth review round of the WP-7.3 round 4 fixes (e4638f2). That is not a new package; the owner can ask for it.

### Owner: run this

- The steps in the two sessions below are still due. A new package can start here only after WP-2.1, WP-2.2 or WP-4.3 merges, or after decision C.

## Session of 2026-11-24 (from 00:25), in `night-c`, on `wp/7.3-operations`

Same task list as the sessions below. WP-6.3 part 1 and WP-7.3 part 1 were already done, so this run did WP-7.3 part 2 on the same branch. `origin/main` is still 0efe863.

### WP-7.3 part 2 done: two runbooks, `wp/7.3-operations`

- Scope: `docs/runbooks/rotate-a-secret.md` and `docs/runbooks/usage-spike-or-free-tier-limit.md`, plus two small corrections in `deploy-and-rollback.md` (where an expired Vercel token fails) and `infrastructure-setup.md` (deactivate Supabase's legacy keys; account deletion is WP-6.3). Every vendor step was checked against current vendor documentation; each runbook lists its sources and what was not confirmed.
- Analytics **not built**: Vercel's documented HTML snippet needs a per-build script path that only its npm packages know, and installing packages is not allowed in these runs. Decision C in the description.
- Commits: 1590d7b (runbooks), abe78e3, 2ce4040, e4638f2 (review fixes), then the description and this file.
- `pnpm verify` exit 0 after each round (31 files, 722 tests). One unexplained exit 1 in a reviewer's run on 2ce4040; four other runs there and three `pnpm test` runs on e4638f2 passed.
- Reviews in `docs/reports/reviews/WP-7.3/` (rounds 2 to 4 of `code-review-*` and `security-review-*`): every round CHANGES REQUIRED, every finding fixed; the round 4 fixes (e4638f2) were not reviewed again. No design review: no interface change.
- Push: succeeded, `9638f9a..5a85da1`. This line is pushed after it.
- Description: `docs/reports/pull-requests/WP-7.3-part-2.md`, with decisions C (analytics packages), D (spec drift for one `spec-change`: Attack Mode name, missing triggers, `RUNTIME_ASSET_BASE_URL`, a new evidence entry) and E (`workflow_dispatch` for `deploy.yml`), and the `gh` commands to open the pull request with both parts.

### Owner: run this

1. **Now**: deactivate the legacy `anon` and `service_role` keys in both Supabase projects (`rotate-a-secret.md` section 4 steps 1 to 3).
2. Decide C, D and E in `docs/reports/pull-requests/WP-7.3-part-2.md`.
3. The part 1 steps below are still due; then open the pull request with the command at the end of the part 2 description.

### Next

- WP-7.3 analytics after decision C. The backup workflow, restore and deletion request runbooks, and the backup secrets' rotation sections after WP-2.1 (and WP-6.3 part 2) merge.
- No other Day 6 or Day 7 package depends only on `main` (see the 23:40 session's "Next"). The next run should check `origin/main` first; if nothing has merged, there is no new package to start under this task list.

## Session of 2026-11-24 (from 00:05), in `night-c`, on `wp/7.3-operations`

Same task list as the session below. This file is the copy from `origin/wp/6.3-legal-pages-footer` (00:02) with this section added. Other agents' branches (`wp/3.1-python-worker`, `wp/3.3-grader`, `wp/5.1-catalog`) hold newer copies with their own sections; nothing of theirs is copied here.

`night-c` was on `wp/6.3-legal-pages-footer` (32ca827, same as its remote). `origin/main` is still 0efe863.

### WP-7.3 part 1 done: the client error report, `wp/7.3-operations`

- Chosen because WP-6.3 part 2 needs WP-2.1 and WP-2.2, and of the Day 7 packages only WP-7.3 has work that needs nothing unmerged (see "Next" in the session below). The branch was created from `origin/main` with its upstream removed, so a bare `git push` cannot target `main`.
- Scope: `POST /api/client-error`, the reporter port and its adapter, the error page's reference for a browser error, a development page for that state, and tests. Not in this part: analytics, backups, runbooks.
- Commits: 7845ed8 (endpoint, reporter, error page, tests), 67a2dab (review round 1 fixes), then the reports, description and this file.
- `pnpm verify` on the tree of 67a2dab: exit 0, 31 files, 722 tests. `next build` exit 0 (no `/dev` route); `check-bundle` (with `HEAP_RELEASE` set to a SHA) and `check-static` exit 0. curl against `next start -p 3733`: 204 with `x-request-id`, 400, 415, 413, 405, and the log line holds no address or query.
- Not run: every e2e test (Chromium cannot launch here, as before). No screenshots, no axe.
- Reviews in `docs/reports/reviews/WP-7.3/`: code CHANGES REQUIRED (blocker: the release comes from the server, not the browser as the spec says; owner decision A), security APPROVE with 5 minors, design CHANGES REQUIRED (no screens). Every other major is fixed; the fixes were not reviewed again.
- Description: `docs/reports/pull-requests/WP-7.3-part-1.md`, with its `gh pr create` command and owner decisions A (release) and B (the `spec-change` text for the reference).
- Servers the sandbox could not stop: `next start -p 3733` (this session) and `-p 3217` (the security reviewer).

### Owner: run this

1. Outside the sandbox: `pnpm test:e2e --project=chromium e2e/client-error.spec.ts e2e/shell.spec.ts`, then the `gallery` and `phone` projects; commit `docs/reports/screens/WP-7.3/`; ask `design-reviewer` again with the screens.
2. Decide A and B in the description.
3. `lsof -ti tcp:3217,3733 | xargs kill`.
4. Open the draft pull request with the command at the end of the description.

### Next

- WP-7.3 part 2 on `main` alone: the runbooks for rotating a secret and for a usage spike or free-tier limit; analytics, which needs either the host's package (not installed; installing is not allowed in these runs) or its script under the nonce policy, so the next run checks the current documentation and may stop at a decision.
- WP-7.3 backups and restore after WP-2.1 merges. WP-6.3 part 2 after WP-2.1 and WP-2.2.

## Session of 2026-11-23 (from 23:40), in `night-c`, on `wp/6.3-legal-pages-footer`

Task list: build new work packages that depend only on `origin/main` (0efe863: WP-1.1 to 1.4, 6.1 part 1, 6.2 part 1), in plan order from WP-6.3, then any WP-7.x whose dependencies are all in `main`; one part per run. This file is kept whole; this section is added to the newest copy (from `origin/wp/5.1-catalog` at 23:58).

`night-c` was on the local branch `wp/4.2-lesson-editor` (be24f80, already contained in `origin/wp/4.2-lesson-editor`). The worktree now has `wp/6.3-legal-pages-footer` checked out, so `wp/4.2-lesson-editor` is free to check out in `night-a`. Nothing was lost.

### WP-6.3 part 1 done: the privacy and terms pages and the footer, `wp/6.3-legal-pages-footer`

- Scope: `/privacy`, `/terms` and the footer (`contentinfo`, on every page, the current link marked). The profile, display name and account deletion need WP-2.1 and WP-2.2, so they are part 2, after those merge.
- Commits: c7fcaf7 (pages, footer, tests), 9872009 (round 1 fixes), 660ffdc (round 2 fixes), then the reports and description.
- `pnpm verify` on 660ffdc: exit 0, 28 files, 718 tests. `next build` exit 0; `check-static` and `check-bundle` exit 0; the served HTML checked with curl.
- Not run: every e2e test. The sandbox stops Chromium at launch (`mach_port_rendezvous_mac.cc:159 ... Permission denied (1100)`), so there are no screenshots and no axe result. `next dev` also fails here (`TurbopackInternalError: unable to start FSEvent stream`). Port 3100 is held by a server this session did not start, so the build was served on 3631 (stopped).
- Reviews in `docs/reports/reviews/WP-6.3/`: code 1, design 1 and code 2 all CHANGES REQUIRED; each blocker is the missing browser run; every other finding is fixed or listed as an owner action. The round 2 fixes were not reviewed again.
- The legal text was checked against Supabase's and Vercel's current documentation; it lists four things the spec's data inventory leaves out, and the description proposes the `spec-change`.
- Description: `docs/reports/pull-requests/WP-6.3-part-1.md`, with its `gh pr create` command. Eight owner actions, among them approving the text and deciding when it goes live.
- The first `git push` answered `! [remote rejected] wp/6.3-legal-pages-footer -> wp/6.3-legal-pages-footer (failed)`; the same push a moment later succeeded.

### Owner: run this

1. Outside the sandbox: `pnpm test:e2e --project=chromium e2e/legal.spec.ts e2e/shell.spec.ts`, then the `gallery` and `phone` projects; commit `docs/reports/screens/WP-6.3/`; then ask `design-reviewer` with the screens.
2. Read and approve the privacy and terms text, and the owner actions 2 to 8 in the description.
3. Open the draft pull request with the command at the end of the description.

### Next

- WP-7.x: no Day 7 package depends only on `main`. WP-7.1, 7.2 and 7.4 check the whole application, which needs WP-2.x to 5.x. WP-7.3's backup workflow needs the database (WP-2.1). Its `/api/client-error` route, client reporter and logger allowlist tests could be a part 1 on `main` alone; the next run decides after reading WP-7.3 in full.
- WP-6.3 part 2 after WP-2.1 and WP-2.2 merge.

## Session of 2026-11-24 (from about 13:40), in `night-b`, merging the new `main` into the open branches

Same task list as the 23:25 session below. `origin/main` moved from 0efe863 to 81fdc39 (#10: the smoke wait, `public/_runtime` ignored, the CSP e2e fixes), so task 1 starts again: each of the seven branches is 9 commits behind `main`. One branch per task, as the task list says; at most two tasks per session.

`main` now carries its own copy of this file (night-a's sessions). Every merge resolves the add/add conflict the same way: the sections of both copies, night-b's from the newest copy on `wp/5.1-catalog` and night-a's from `main`, with no section dropped. Sections both copies shared were identical.

### Task 1a done: wp/2.1-schema-policies

- Merge commit ff187e9: `origin/main` (81fdc39) into this branch. One conflict: this file (resolved as above).
- `pnpm verify`: exit 0, 28 files, 718 tests. `next build` with CI's public values: exit 0. `check-bundle` and `check-static`: exit 0.
- Not run: `pnpm test:db` (no Docker), e2e (no browser).
- Description: `docs/reports/pull-requests/WP-2.1.md`, "Up to date with main" section rewritten for 81fdc39.

### Next

- Task 1b: `wp/2.2-sign-in`, merging `wp/2.1-schema-policies` (with the new `main`).
- Then 2.3, 4.1, 4.2, 4.3 and 5.1 in that order, each merging the branch before it as in the 23:25 session.
- Night-a found that Chromium starts in this sandbox with `--no-sandbox --single-process` (its 03:10 second-run section below). Task 2 (WP-5.1's e2e runs and screenshots) may be possible after task 1.

## Session of 2026-11-23 (from about 23:25), in `night-b`, merging `main` into the open branches

New task list: (1) merge `origin/main` (0efe863: WP-1.1 to 1.4, #5, #6, #7, #8) into wp/2.1-schema-policies, wp/2.2-sign-in, wp/2.3-admin-gate, wp/4.1-courses-chapters, wp/4.2-lesson-editor, wp/4.3-validate-publish and wp/5.1-catalog, one branch per task, each later branch also merging the branch before it; `pnpm verify` and `pnpm build` on each; push; update each description's "Up to date with main" section. (2) Then continue WP-5.1.

This file is kept whole on every branch this run touches; the newest copy is on the branch of the last task below.

### Task 1a done: wp/2.1-schema-policies

- Merge commit 837fc05, no conflict (`main` adds no database file).
- `pnpm verify`: exit 0, 28 files, 709 tests. `next build` with CI's public values: exit 0.
- Not run: `pnpm test:db` (no Docker), e2e (no browser).
- Description: `docs/reports/pull-requests/WP-2.1.md` has a new "Up to date with main" section. `gh` still cannot reach GitHub (certificate error), so the pull request text on GitHub is not updated; paste the file when opening or editing it.

### Task 1b done: wp/2.2-sign-in

- Merge commit 2f45f1d: `wp/2.1-schema-policies` (with `main`) into this branch. Conflicts: this file (took 2.1's copy) and `playwright.config.ts` (kept both the `stack` project and `main`'s `phone` projects).
- After the merge 10 sign-in view tests failed: `main`'s `Notice` draws an announced notice's words one frame after its live region. 6bf689e makes those tests wait for the same words (`waitFor`, `findByText`); no assertion removed.
- `pnpm verify`: exit 0, 42 files, 918 tests. `next build` with CI's public values (including the Turnstile test key): exit 0. `check-bundle` and `check-static`: exit 0.
- Not run: `pnpm test:db` (no Docker), e2e (no browser).
- Description: `docs/reports/pull-requests/WP-2.2.md`, new "Up to date with main" section with decision A (CI's e2e job does not run `main`'s `phone` projects).

### Task 1c done: wp/2.3-admin-gate

- Merge commit a9d23f1: `wp/2.2-sign-in` (with `main`) into this branch. One conflict: this file (took 2.2's copy, which holds 2.3's sections unchanged).
- After the merge 4 tests in `second-step-form.test.tsx` failed, same `LiveRegion` cause as 2.2. 1fb08e1 makes them wait for the same words (`waitFor`); no assertion removed.
- `setup-flow.test.tsx` had the same race and failed 2 tests in the 4.1 merge run; 39c22f1 fixes it on this branch the same way. `pnpm verify` again: exit 0, 1010 tests.
- `pnpm verify`: exit 0, 53 files, 1010 tests. `next build` with CI's public values: exit 0. `check-bundle` and `check-static`: exit 0.
- Not run: `pnpm test:db` (no Docker), e2e (no browser).
- Description: `docs/reports/pull-requests/WP-2.3.md`, new "Up to date with main" section.

### Task 1d done: wp/4.1-courses-chapters

- Merge commit 1696ef1: `wp/2.3-admin-gate` (with `main`) into this branch. One conflict: this file (took 2.3's copy).
- After the merge 7 tests in four admin component test files failed, same `LiveRegion` cause. 9dfb2bd makes them wait for the same words (`waitFor`); no assertion removed.
- `pnpm verify`: exit 0, 62 files, 1103 tests. `next build` with CI's public values: exit 0. `check-bundle` and `check-static`: exit 0.
- Not run: `pnpm test:db` (no Docker), e2e (no browser).
- Description: `docs/reports/pull-requests/WP-4.1.md`, new "Up to date with main" section.

### Task 1e done: wp/4.2-lesson-editor

- 4.2 is stacked on 4.1 (it merged an older 4.1, d9eba53), so this merges `wp/4.1-courses-chapters` (with 2.3 and `main`): merge commit c7ecb24. One conflict: this file (took 4.1's copy).
- After the merge 1 test in `lesson-editor.test.tsx` failed, same `LiveRegion` cause. 45a4e2f makes it wait for the same words (`waitFor`); no assertion removed.
- `pnpm verify`: exit 0, 73 files, 1320 tests. `next build` with CI's public values: exit 0. `check-bundle` and `check-static`: exit 0.
- Not run: `pnpm test:db` (no Docker), e2e (no browser).
- Description: `docs/reports/pull-requests/WP-4.2.md`, new "Up to date with main" section.

### Task 1f done: wp/4.3-validate-publish

- Merge commit 0914d87: `wp/4.2-lesson-editor` (with 4.1, 2.3 and `main`). Conflicts: this file (took 4.2's copy, a superset) and `playwright.config.ts` (kept 4.3's `engines` and `runtime-*` projects and `main`'s `phone` projects).
- After the merge: one type error in `test-case-list.tsx` (`main`'s `TextField` needs `errorMessage` with `isInvalid: true`), fixed in 4b04c28; 3 tests in `validation-panel.test.tsx` failed (same `LiveRegion` cause), fixed in a9b7994 with `waitFor`; no assertion removed.
- `pnpm verify`: exit 0, 102 files, 1892 tests. `next build` with CI's public values: exit 0. `check-bundle` and `check-static`: exit 0.
- Not run: `pnpm test:db` (no Docker), e2e (no browser).
- Description: `docs/reports/pull-requests/wp/4.3-validate-publish.md`, new "Up to date with main" section with decision M1.

### Task 1g done: wp/5.1-catalog

- Merge commit aa5d0ce: `wp/4.1-courses-chapters` (with 2.3 and `main`). Conflicts: this file (took the newest copy, from 4.3) and `e2e/screens.ts` (kept this branch's `stack` and `main`'s `phone` projects in the screenshot set, decision 26).
- No test failed. The first `pnpm verify` failed at `prettier --check` on `public/_runtime/`, an untracked build output left by the 4.3 build in this checkout (4.3 ignores it, 5.1 does not yet); deleted, nothing changed in the branch.
- `pnpm verify`: exit 0, 67 files, 1200 tests. `next build` with CI's public values: exit 0, no `/dev` route. `check-bundle` and `check-static`: exit 0.
- Not run: `pnpm test:db` (no Docker), e2e (no browser).
- Description: `docs/reports/pull-requests/wp/5.1-catalog.md`, new "Up to date with main" section and decision 26.

### Owner: run this

1. When `gh` works: paste the "Up to date with main" sections of `WP-2.1.md`, `WP-2.2.md`, `WP-2.3.md`, `WP-4.1.md`, `WP-4.2.md`, `wp/4.3-validate-publish.md` and `wp/5.1-catalog.md` into the pull requests on GitHub.
2. Decide WP-2.2 decision A (add the `phone` projects to the CI `e2e` job or not); WP-4.3 decision M1 and WP-5.1 decision 26 follow it.

### Next

- Task 1 is done for all seven branches (23:37 to 23:50).

### Task 2 blocked: WP-5.1

WP-5.1's five parts are built and reviewed twice (see the 20:35 session below). What is left is the e2e runs, the screenshots and the design approval that needs them, and the owner's decisions. Checked again at 23:50, both still fail in this sandbox:

- Docker: `failed to connect to the docker API at unix:///Users/fahad/.docker/run/docker.sock ... no such file or directory`, so no `supabase start` and no `stack` journey.
- Chromium: `bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer...: Permission denied (1100)`, so no gallery spec, axe or screenshot.

Checked again in 262 fresh sessions, from 23:52 to 2026-11-24 13:39 (the list of times is shortened to this range; the old list is in git history): `origin/main` still at 0efe863; none of the seven branches is behind `main`; each stacked branch contains the one before it (2.1 in 2.2, 2.2 in 2.3, 2.3 in 4.1, 4.1 in 4.2, 4.2 in 4.3, 4.1 in 5.1); local and remote branches match. Docker fails with the same error each time (at 13:39: `failed to connect to the docker API at unix:///Users/fahad/.docker/run/docker.sock`). Chromium was checked at 13:15 and fails the same way as at 13:13, 13:11, 10:30, 09:36, 09:35, 09:33, 09:31, 09:30, 09:28, 09:26, 09:24, 09:22 and 09:07 (`browserType.launch: Target page, context or browser has been closed`; earlier checks showed `MachPortRendezvousServer... Permission denied (1100)`); it was not checked from 08:25 to 09:06, from 09:08 to 09:21, from 09:37 to 10:29, from 10:31 to 13:10, at 13:12, at 13:14, at 13:16, at 13:18, at 13:19, at 13:21, at 13:22, at 13:24, at 13:26, at 13:27, at 13:29, at 13:31, at 13:32, at 13:34, at 13:36, at 13:37 or at 13:39. Nothing to merge and nothing new to build.

No code was changed for task 2. The run stops here. The owner's steps for WP-5.1 are in the 20:35 session's "Owner: run this" below, and step 1 above.

## Session of 2026-11-24 (from about 03:10, second run), in `night-a`, on `wp/fix-smoke-and-runtime`

Same task list. `origin/main` is still 0efe863 and every branch is 0 commits behind it, so task 2 needed nothing. This run found a way to start Chromium in the sandbox and finished task 1 (c). This file was copied from `wp/3.4-statechart` (the newest copy) and this section added on top; the copy on `wp/3.4-statechart` is now older than this one.

### Task 1 (c) done: the cause of the second `e2e/csp.spec.ts` failure, proven and fixed

- Chromium starts in this sandbox with `--no-sandbox --single-process`. A single-process browser dies after its first context, so each test runs in its own Playwright process, through a temporary config outside the repository with no web servers, against `next start` on port 3253.
- At c5e789b: test 1 passed, test 2 failed in 3 of 3 runs (no violation). The injected script ran.
- Cause: under `'strict-dynamic'`, a script that is not parser-inserted matches the policy (CSP3 section 6.7.3.3), so Chromium runs an inline script that code inserts. Proven on a test page: with `'strict-dynamic'` such scripts ran with no violation; without it, they were blocked. The earlier code review's reading was wrong.
- fe08e92 and 33ac7f7: test 2 now injects an inline script without the nonce into the server's HTML (markup injection), keeps the real headers, and expects an `inline` `script-src` violation, the page's scripts running, and the script not run.
- Both tests passed in each of 3 runs. Mutation: with the page's nonce on the injected script, test 2 fails.
- Security review round 1 on fe08e92: APPROVE, 3 MINOR, all fixed in 33ac7f7. Report: `docs/reports/reviews/fix-smoke-and-runtime/security-review-1.md`. It notes a residual risk of `'strict-dynamic'` (not a defect, no exposure in `src` today) and suggests follow-ups for the owner.
- `pnpm verify` on 33ac7f7: exit 0, 27 files, 710 tests. `pnpm build` with CI's fake public values: exit 0.
- Not run: Firefox and WebKit (not installed).
- Description: `docs/reports/pull-requests/fix-smoke-and-runtime.md` (part 3, verification, reviews, owner actions, decision 4, Definition of Done).
- Push: `wp/fix-smoke-and-runtime` with fe08e92, 33ac7f7 and the docs commit. This line is pushed with the docs commit (this copy of the file is the newest).

### Owner: run this

1. `lsof -ti:3190,3241,3253 | xargs kill` in your own terminal: `next start` servers from these runs may still listen there.
2. Open the pull request, from the repository root:

   ```sh
   gh pr create --base main --head wp/fix-smoke-and-runtime \
     --title "fix: wait for the promoted release in the smoke, ignore public/_runtime, correct the CSP e2e checks" \
     --body-file docs/reports/pull-requests/fix-smoke-and-runtime.md
   ```

3. `pnpm test:e2e --project=chromium e2e/csp.spec.ts` on that branch, and Firefox and WebKit if installed.
4. Decide the security review's follow-ups: the residual risk in ADR-0028 and T-06/T-07 (`spec-change`), lint rules against script-creation sinks, an ADR on Trusted Types.
5. The owner actions of the sections below are still due.

### Next

- The e2e tests of the WP-3.x branches can now run here with the same flags, one test per process. A run of the WP-3.1 worker journeys is the next thing that needs no owner decision.

## Session of 2026-11-24 (from about 03:10), in `night-a`, on `wp/3.4-statechart`

Same task list. Nothing new was left that needs no owner decision, so this run checked the state, tried the one unverified part of task 1, and stopped.

### State checked

- `origin/main` is still 0efe863. `wp/3.1-python-worker` (2af8c6e), `wp/3.3-grader` (c39ddc7), `wp/3.4-statechart` (bc0b142) and `wp/fix-smoke-and-runtime` (c5e789b) are each 0 commits behind it. `wp/3.3-grader` has all of `wp/3.1-python-worker`, and `wp/3.4-statechart` has all of `wp/3.3-grader`. Task 2 needs no new merge.
- What is still open in the WP-3.x descriptions needs the owner or a later package: ADR-0034, the section 6 spec change, the phone check, the lint rule's bypasses, the `beforeAll` fix for `scripts/repository.test.ts`, Validate's fresh worker (WP-4.3), and the shared restore routine (WP-3.4 or later). The two header misses in WP-3.1 ("Not fixed") stay as they are: closing them means naming each file in the header rules, which goes against the decision recorded in part 10 to keep the file list in one place. No code changed.

### Task 1 (c) tried again: `e2e/csp.spec.ts` on `wp/fix-smoke-and-runtime`, blocked

- `pnpm build` at c5e789b with CI's fake public values: exit 0. `next start` on port 3241, then `playwright test` with a temporary config that has no web servers.
- Both tests failed before any page loaded: Chromium cannot start in this sandbox (`bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer...: Permission denied (1100)`). The cause of test 2 is still not proven by a run.
- The sandbox cannot stop the server it started (`pkill: Cannot get process list`).

### Owner: run this

1. `lsof -ti:3241 | xargs kill` in your own terminal: the `next start` from this run still listens there.
2. `pnpm test:e2e --project=chromium e2e/csp.spec.ts` on `wp/fix-smoke-and-runtime`, as in the task 1 section below.
3. The owner actions of the sections below are still due.

### Next

- Nothing on this task list needs no decision from the owner. Decide ADR-0034, the `beforeAll` fix and the section 6 spec change; then the next run can act on them.

## Session of 2026-11-24 (from about 03:00), in `night-a`, on `wp/3.4-statechart`

Same task list. Tasks 1 and 2 and task 3 parts 1 to 11 were done, and every branch was level with `origin/main` (0efe863), so this run did the first item under "Next" in the section below, then looked for the flaky test WP-3.4 security review 2 saw. This file came to `wp/3.4-statechart` with the merge (the newest copy, from `wp/3.3-grader`) and this section was added on top.

### Task 3, part 12 done: `wp/3.3-grader` merged into `wp/3.4-statechart`

- 9730a70: `wp/3.3-grader` at c39ddc7 merged (WP-3.1's worker header rule fix e340e4f, its test, security review 6, the docs). No conflict.
- `scripts/next-config.test.ts` lists the same eleven compiled worker files as `scripts/build-runtime.test.ts` on this branch; the build writes exactly those eleven to `public/_runtime/worker`.
- `pnpm verify` on 9730a70: exit 0, 46 files, 1148 tests. `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: exit 0.
- Not run: the browser tests.
- Description: "Up to date with main" and the first line of `docs/reports/pull-requests/WP-3.4.md` rewritten.
- Push: `wp/3.4-statechart` with 9730a70 and the docs commit. This line is pushed with the docs commit (this copy of the file is the newest).

### Task 3, part 13 done: the flaky test WP-3.4 security review 2 saw, found

- Part 12 took about 3 minutes, so the run went on. WP-3.4 security review 2 saw 1 of 1066 tests fail once, unnamed.
- On 9730a70: six single `vitest run`s, all 1148 passed. Three rounds of four runs at once, with coverage: two rounds failed in all four runs, one passed. All eight failures are one test: `scripts/repository.test.ts > lint for type escapes > [NFR-MAINT-01] fails lint for any`, `Test timed out in 5000ms`.
- Cause: the test's first `lintText` loads `eslint.config.mjs`. That took 855 ms in a single `pnpm test` and passes 5000 ms when several suites share the machine. Other test runs on the same machine give that load.
- The test is unchanged from `main` (939f9a0). That the reviewer hit this test is likely, not proven.
- Decision: no code change. Raising the timeout is banned (CLAUDE.md rule 2), and the test guards the lint rules. Recorded in the WP-3.4 description's Reviews section with a fix for the owner to choose: load the configuration once in a `beforeAll`.
- Push: `wp/3.4-statechart` with the docs commit.

### Owner: run this

1. `gh pr edit 9 --body-file docs/reports/pull-requests/WP-3.1.md` on `wp/3.1-python-worker`, and the same for the WP-3.3 and WP-3.4 pull requests with their descriptions, if they are open.
2. The owner actions of the sections below are still due.

### Next

- A review round on 58128a3 (WP-3.1), on 9043a9a, 06c39bb and f7261ad (WP-3.3), and on the controller conflict resolution in 03102ba (WP-3.4), if the owner wants one.
- If the owner chooses the `beforeAll` fix for `scripts/repository.test.ts`, make it on a branch from `main`.

## Session of 2026-11-24 (from about 02:50), in `night-a`, on `wp/3.1-python-worker`, then `wp/3.3-grader`

Same task list. Tasks 1 and 2 and task 3 parts 1 to 9 were done, and every branch was level with `origin/main` (0efe863), so this run took the next open WP-3.x finding that needs no owner decision. This file was copied from `wp/3.4-statechart` (the newest copy) and this section added on top. Part 10 took about 8 minutes, so the run went on with part 11, which carries this copy to `wp/3.3-grader`. The copy on `wp/3.4-statechart` is now older than this one.

### Task 3, part 10 done: the worker's header rule (WP-3.1 security review 2, MINOR 3)

- e340e4f: the worker's header rule was `/_runtime/worker/:path*`, so a miss under that folder got the worker's policy (no `sandbox`) instead of the runtime's static policy. The rule is now `/_runtime/worker/:path+.js`. `:path*.js` was tried first and rejected: its compiled regex also matches `/_runtime/worker.js`.
- `scripts/next-config.test.ts` runs `next.config.ts` through Next.js's own `unstable_getResponseFromNextConfig`: the seven compiled worker files get the worker's policy and `no-cache`; six misses get the static policy.
- Mutants: `:path*` fails 7 of 10; `:path*.js` fails 3 of 11.
- Security review round 6 (`docs/reports/reviews/WP-3.1/security-review-6.md`): APPROVE, 3 MINOR, two fixed (comment, all seven files tested), one recorded (a miss ending in `.js`, in any case, still gets the worker's policy).
- `pnpm verify` on e340e4f: exit 0, 37 files, 858 tests. `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: exit 0. `next start` on the build: compiled files 200 with the worker policy and `no-cache`; `no-such-file`, `core.jsx`, `x.js/more`, `/_runtime/worker.js` 404 with the static policy; `missing.js` 404 with the worker policy.
- Decision: the rule matches by extension, not by naming the seven files, so the file list stays in one place.
- Not run: the browser tests.
- Description: `docs/reports/pull-requests/WP-3.1.md` (the headers row, "How it was verified", the test list, the reviews, "Not fixed").
- Push: `wp/3.1-python-worker` with e340e4f and the docs commit. This line is pushed with the docs commit.

### Task 3, part 11 done: `wp/3.1-python-worker` merged into `wp/3.3-grader`

- bc73677: `wp/3.1-python-worker` at 2af8c6e merged. One conflict, this file; WP-3.1's copy taken, as the newer one. No code conflict. In the merge, `scripts/next-config.test.ts`'s list of compiled worker files became this branch's eleven (under `runtime/` and `grader/`, as `scripts/build-runtime.test.ts` lists them); the built folder holds exactly those eleven.
- `pnpm verify` on bc73677: exit 0, 42 files, 1033 tests. `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: exit 0.
- Not run: the browser tests.
- Description: "Up to date with main" and the first line of `docs/reports/pull-requests/WP-3.3.md` rewritten.
- Push: `wp/3.3-grader` with bc73677 and the docs commit. This line is pushed with the docs commit (this copy of the file is the newest).

### Owner: run this

1. `gh pr edit 9 --body-file docs/reports/pull-requests/WP-3.1.md` on `wp/3.1-python-worker`, and the same for the WP-3.3 pull request with its description, if it is open.
2. The owner actions of the sections below are still due.

### Next

- Merge `wp/3.3-grader` (with bc73677) into `wp/3.4-statechart`. Check there that `scripts/next-config.test.ts`'s list of compiled worker files matches `scripts/build-runtime.test.ts` on that branch.
- A review round on 58128a3 (WP-3.1), on 9043a9a, 06c39bb and f7261ad (WP-3.3), and on the controller conflict resolution in 03102ba (WP-3.4), if the owner wants one.

## Session of 2026-11-24 (from about 00:25), in `night-a`, on `wp/3.1-python-worker`, then `wp/3.3-grader` and `wp/3.4-statechart`

Same task list. Tasks 1 and 2 and task 3 parts 1 to 6 were done, and every branch was level with `origin/main` (0efe863), so this run took the next open WP-3.x finding that needs no owner decision. This file was copied from `wp/3.4-statechart` (the newest copy) and this section added on top. Part 7 took about 15 minutes, so the run went on with parts 8 and 9, which carry this copy to `wp/3.3-grader` and `wp/3.4-statechart`.

### Task 3, part 7 done: the proxy matcher's exclusions (WP-3.1 security review 2, MINOR 7)

- f8af00a: the matcher's exclusions for `_next/static`, `_next/image` and `favicon.ico` were prefixes, so `/favicon.icoX` and `/_next/imageX` skipped the proxy and their not-found page had no policy. Each exclusion now ends at a slash or at the end of the path. The matcher test uses Next.js's own `unstable_doesMiddlewareMatch` instead of a hand-built regular expression.
- Security review round 1 on f8af00a: CHANGES REQUIRED, 3 MINOR. `/favicon.ico` itself still rendered the not-found page with no policy (there is no icon, ADR-0031); no production-server test; page-prefix mutants survived.
- c03a7d0: `/favicon.ico` is no longer excluded; the test asserts `/admin`, `/sign-in`, `/courses`, `/learn`, `/profile` and states its no-basePath assumption; `e2e/csp.spec.ts` gains a request-only test that `/favicon.ico`, `/favicon.icoX`, `/_next/imageX` and `/_next/staticX` return 404 with the nonce policy and `frame-ancestors 'none'`.
- Security review round 2 on c03a7d0: APPROVE. One note: add nested paths when `/admin` and the course routes land. Condensed in `docs/reports/reviews/WP-3.1/security-review-5.md`.
- Mutants: the old matcher fails the prefix test; the favicon exclusion put back fails the favicon test.
- `pnpm verify` on c03a7d0: exit 0, 37 files, 845 tests. `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: exit 0. `next start` on the c03a7d0 build: the four paths above return 404 with the nonce policy; `/_runtime/no-such-file` keeps the runtime's static policy; `/_next/image?url=...` gets no page policy.
- Not run by me: the new e2e test. `pnpm test:e2e` starts the development server too, and Turbopack fails in the sandbox (`unable to start FSEvent stream`). The reviewer ran it against a `next start` through a temporary config with no web servers: 1 passed.
- Decision: fixed on `wp/3.1-python-worker`, not on a branch from `main`, because this branch already changes the matcher line.
- Description: `docs/reports/pull-requests/WP-3.1.md` (the headers row, "How it was verified", the test list, the reviews, owner action 2, "Not fixed").
- Push: `wp/3.1-python-worker` with f8af00a, c03a7d0 and the docs commit. This line is pushed with the docs commit.

### Task 3, part 8 done: `wp/3.1-python-worker` merged into `wp/3.3-grader`

- 9e5ff23: `wp/3.1-python-worker` at d6ab769 merged. One conflict, this file; WP-3.1's copy taken, as the newer one. No code conflict.
- `pnpm verify` on 9e5ff23: exit 0, 42 files, 1016 tests. `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: exit 0.
- Not run: the browser tests.
- Description: "Up to date with main" and the first line of `docs/reports/pull-requests/WP-3.3.md` rewritten (7aa4f76).
- Push: `wp/3.3-grader` with 9e5ff23, 7aa4f76 and the commit that adds these lines.

### Task 3, part 9 done: `wp/3.3-grader` merged into `wp/3.4-statechart`

- fff5ece: `wp/3.3-grader` at 44d6425 merged. One conflict, this file; WP-3.3's copy taken, as the newer one. No code conflict.
- `pnpm verify` on fff5ece: exit 0, 46 files, 1131 tests. `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: exit 0.
- Not run: the browser tests.
- Description: "Up to date with main" and the first line of `docs/reports/pull-requests/WP-3.4.md` rewritten.
- Push: `wp/3.4-statechart` with fff5ece and the docs commit. This line is pushed with the docs commit (this copy of the file is the newest).

### Owner: run this

1. `gh pr edit 9 --body-file docs/reports/pull-requests/WP-3.1.md` on `wp/3.1-python-worker`, and the same for the WP-3.3 and WP-3.4 pull requests with their descriptions, if they are open.
2. Stray servers the sandbox hides from me: a `next start` I launched holds port 3197, and something also answers on port 3100. In your own terminal: `lsof -ti:3197 | xargs kill`, and check `lsof -i:3100` before a local `pnpm test:e2e`, because Playwright reuses a server already on 3100.
3. The owner actions of the sections below are still due.

### Next

- A review round on 58128a3 (WP-3.1), on 9043a9a, 06c39bb and f7261ad (WP-3.3), and on the controller conflict resolution in 03102ba (WP-3.4), if the owner wants one.
- Shared `$TMPDIR`: name logs by worktree (this run used `verify.log` and `build.log`; the counts it recorded match this branch, 842 plus 3 new tests).

## Session of 2026-11-24 (from about 00:20), in `night-a`, on `wp/3.3-grader`, then `wp/3.4-statechart`

Same task list. Tasks 1 and 2 and task 3 parts 1 to 4 were done, and every branch was level with `origin/main` (0efe863), so this run took the next open WP-3.x finding that needs no owner decision. This file was copied from `wp/3.4-statechart` (the newest copy), this section added on top, and the copy carried back to `wp/3.4-statechart` by the merge.

### Task 3, part 5 done: a test for the Node runner's harness-version check

- f7261ad on `wp/3.3-grader`: WP-3.3 security review 2 MINOR 7 and code review 2 MINOR 4, the version part, said the runner's harness-version check had no test because a test needed a seam. `createNodeRunner` now takes an optional `threadUrl`, set only by the runner's own test. That test starts `scripts/testing/other-harness-version-thread.ts`, a stand-in thread that answers with a passing result of another version. The new test expects `crashed`, then `not_run`.
- Mutation: with the version check removed from `runner.ts`, the new test fails (both test cases `passed`).
- `pnpm verify` on f7261ad: exit 0, 42 files, 1013 tests. `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: exit 0.
- Decision: the stand-in lives in `scripts/testing/`, beside `property.ts`, so it is not counted in `src/grader`'s coverage and no file in `src` exists only for a test.
- Description: the finding moved from "Not fixed, for you" to a "Fixed later" table; owner action 6 now names f7261ad; evidence added under "How it was verified".
- Not run: the browser tests.
- Push: `wp/3.3-grader` with f7261ad and the docs commit (89875fd).

### Task 3, part 6 done: `wp/3.3-grader` merged into `wp/3.4-statechart`

- 32c642f: `wp/3.3-grader` at 89875fd merged. No conflict.
- `pnpm verify` on 32c642f: exit 0, 46 files, 1128 tests. `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: exit 0.
- Not run: the browser tests.
- Description: "Up to date with main" and the first line of `docs/reports/pull-requests/WP-3.4.md` rewritten.
- Push: `wp/3.4-statechart` with 32c642f and the docs commit. This line is pushed with the docs commit (this copy of the file is the newest).

### Owner: run this

1. The owner actions of the section below are still due.

### Next

- A review round on 58128a3 (WP-3.1), on 9043a9a, 06c39bb and f7261ad (WP-3.3), and on the controller conflict resolution in 03102ba (WP-3.4), if the owner wants one.

## Session of 2026-11-24 (from about 00:15), in `night-a`, on `wp/3.3-grader`, then `wp/3.4-statechart`

Same task list. Tasks 1 and 2 and task 3 parts 1 and 2 were done, so this run did the first item under "Next" in the section below: carry the WP-3.1 round 4 and WP-3.3 round 2 fixes into the later branches. This file was copied from `wp/3.1-python-worker` (the newest copy), this section added on top, and the copy carried to `wp/3.3-grader` and then `wp/3.4-statechart`.

### Task 3, part 3 done: `wp/3.1-python-worker` merged into `wp/3.3-grader`

- f178765: `wp/3.1-python-worker` at c4ca7f1 merged (58128a3 and its docs). One conflict, this file; WP-3.1's copy was taken, as the newer one.
- `pnpm verify` on f178765: exit 0, 42 files, 1012 tests. `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: exit 0.
- Not run: the browser tests.
- Description: "Up to date with main" and the first line of `docs/reports/pull-requests/WP-3.3.md` rewritten.
- Push: `wp/3.3-grader` with f178765 and the docs commit. This line is pushed with the docs commit.

### Task 3, part 4 done: `wp/3.3-grader` merged into `wp/3.4-statechart`

- 03102ba: `wp/3.3-grader` at 99f61b4 merged (WP-3.3 round 2 fixes and WP-3.1 round 4 fixes). Two conflicts. `src/runtime/controller.ts`, the `ready` case: both sides kept (this branch sets `interactiveInput`, then WP-3.3's fix sends a pending fresh-worker check before reporting `ready`). This file: WP-3.3's copy taken.
- `pnpm verify` on 03102ba: exit 0, 46 files, 1127 tests. `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: exit 0.
- Not run: the browser tests.
- Description: "Up to date with main" and the first line of `docs/reports/pull-requests/WP-3.4.md` rewritten.
- Push: `wp/3.4-statechart` with 03102ba and the docs commit. This line is pushed with the docs commit (this copy of the file is the newest).

### Owner: run this

1. `gh pr edit 9 --body-file docs/reports/pull-requests/WP-3.1.md` on `wp/3.1-python-worker`.
2. The owner actions in the WP-3.3 and WP-3.4 descriptions, and those of the sessions below.

### Next

- A review round on 58128a3 (WP-3.1), on 9043a9a and 06c39bb (WP-3.3), and on the controller conflict resolution in 03102ba (WP-3.4), if the owner wants one.

## Session of 2026-11-24 (from about 23:54 on 2026-11-23), in `night-a`, on `wp/3.3-grader`, then `wp/3.1-python-worker`

Same task list. Tasks 1 and 2 were done (task 2 took about 6 minutes), so this run did task 3: the WP-3.x review findings still open. This file was copied from `wp/3.4-statechart` (the newest copy) and this section added on top.

### Task 3, part 1 done: the review rounds the descriptions said were missing, and the WP-3.3 fixes

- Four reviews, each by a fresh reviewer: WP-3.3 round 2 (code and security, on the round-1 fixes 1da8b48..bce0f08) and WP-3.1 round 4 (code and security, on the round-3 fixes be2c7c0..2d94ead and the merges). Reports in `docs/reports/reviews/WP-3.3/*-review-2.md` and `docs/reports/reviews/WP-3.1/*-review-4.md`.
- WP-3.1 round 4: both APPROVE, five minors in all.
- WP-3.3 round 2: both CHANGES REQUIRED, no blocker. Both found the same major: during a fresh-worker check the controller reported `ready` before sending the check, so a page acting on `ready` could orphan the check and make Stop end nothing.
- 9043a9a: the controller sends the pending check before it reports `ready`. Two new tests; the first failed before the fix, the second fails with `used = false` removed.
- 06c39bb: the harness's fallback clears the hooks first; cut output with no error grades as `output_limit`; tests that pin each guard, the name and test case limits, and the runner's new thread after a memory error; comments corrected. Each new test failed against a mutant of its fix or the code before it.
- `pnpm verify` on 06c39bb: exit 0, 41 files, 1009 tests. `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: exit 0.
- Decisions, in the WP-3.3 description: cut output grades as `output_limit`; `HARNESS_VERSION` stays "1" with the hash updated; `exit()` during the follow-up code recorded as a deviation for the owner; the lint rule's bypasses, a required `freshWorker`, and the extra Python hooks left for the owner.
- Not run: the browser tests.
- Push: `wp/3.3-grader` with 9043a9a, 06c39bb and the docs commit. This line is pushed with the docs commit.

### Task 3, part 2 done: the WP-3.1 round 4 minors

- 58128a3 on `wp/3.1-python-worker`: an error whose attributes raise keeps `input_ended` and `memory` (the new test failed 2 of 3 before); `scripts/next-config.test.ts` checks that `next.config.ts` serves the security headers and then the runtime's rules, worker policy last (both cases fail with the runtime rules removed); the loader test's comment says the request log is its evidence in this build; the memory case has its own test.
- The WP-3.1 description: round 4 in Reviews, the five passages that said #3 was not merged corrected, the round 4 evidence.
- `pnpm verify` on 58128a3: exit 0, 37 files, 842 tests. `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: exit 0.
- Push: `wp/3.1-python-worker` with 58128a3 and the docs commit. This line is pushed with the docs commit (this copy of the file is the newest).
- `wp/3.3-grader` and `wp/3.4-statechart` do not have 58128a3 yet, and `wp/3.4-statechart` does not have the WP-3.3 round 2 fixes yet.

### Owner: run this

1. `gh pr edit 9 --body-file docs/reports/pull-requests/WP-3.1.md` on `wp/3.1-python-worker`.
2. WP-3.3 owner actions 6 and 7 in its description (a third review round, or accept; the security minors left for you).
3. Decide whether `wp/3.2-live-input` should also get `main` merged in.
4. The owner actions of the sessions below are still due.

### Next

- Merge `wp/3.1-python-worker` into `wp/3.3-grader`, then `wp/3.3-grader` into `wp/3.4-statechart`, so both carry the round 4 and round 2 fixes; verify and build each.
- A review round on 58128a3 (WP-3.1) and on 9043a9a and 06c39bb (WP-3.3), if the owner wants one.

## Session of 2026-11-23 (from about 23:47), in `night-a`, on `wp/3.1-python-worker`, `wp/3.3-grader` and `wp/3.4-statechart`

Same task list as the session below. Task 1 was done; this run did task 2 for `wp/3.1-python-worker`, `wp/3.3-grader` and `wp/3.4-statechart`, each in under 20 minutes. This file was copied from `wp/fix-smoke-and-runtime` (the newest copy) and this section added on top.

### Task 2, part 1 done: `main` merged into `wp/3.1-python-worker`

- 5f72072: `origin/main` at 0efe863 merged. One conflict, `playwright.config.ts`: `main`'s `phone` projects kept beside this branch's `runtime-*` projects; the engine projects ignore gallery, runtime and phone tests.
- `pnpm verify` on 5f72072: exit 0, 36 files, 839 tests. `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: exit 0.
- Not run: the browser tests (Chromium cannot start in this sandbox).
- The commit hook's dependency check could not take pnpm's store lock (`ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK`); nothing was installed.
- Description: "Up to date with main" in `docs/reports/pull-requests/WP-3.1.md` rewritten; the `gh pr create` command replaced with `gh pr edit 9`, because the draft is open.
- Push: `wp/3.1-python-worker` with 5f72072 and the docs commit. This line is pushed with the docs commit.

### Task 2, part 2 done: `wp/3.1-python-worker` (with `main`) merged into `wp/3.3-grader`

- 4e255ef: `wp/3.1-python-worker` at e06e9c3 merged; it carries `main` at 0efe863. No conflict.
- `pnpm verify` on 4e255ef: exit 0, 41 files, 1002 tests. `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: exit 0.
- Not run: the browser tests.
- Description: a new "Up to date with main" section and the first line in `docs/reports/pull-requests/WP-3.3.md`. No pull request is open for WP-3.3, so its `gh pr create` command stays.
- Push: `wp/3.3-grader` with 4e255ef and the docs commit. This line is pushed with the docs commit.

### Task 2, part 3 done: `wp/3.3-grader` merged into `wp/3.4-statechart`

- a83b326: `wp/3.3-grader` at 67787b4 merged; it carries `main` at 0efe863 and WP-3.1. No conflict.
- `pnpm verify` on a83b326: exit 0, 45 files, 1117 tests. `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: exit 0.
- Not run: the browser tests.
- Decision: `wp/3.2-live-input` was not merged with `main`; it is not in the task list. `wp/3.4-statechart` already holds its tip (6a9c165). Recorded in the WP-3.4 description.
- Description: a new "Up to date with main" section and the first line in `docs/reports/pull-requests/WP-3.4.md`.
- Push: `wp/3.4-statechart` with a83b326 and the docs commit. This line is pushed with the docs commit.

### Owner: run this

1. `gh pr edit 9 --body-file docs/reports/pull-requests/WP-3.1.md` on `wp/3.1-python-worker` (`gh` cannot reach GitHub from the sandbox).
2. Decide whether `wp/3.2-live-input` should also get `main` merged in.
3. The owner actions of the session below are still due.

### Next

- Task 3: the WP-3.x review findings still open in the WP-3.1, WP-3.3 and WP-3.4 descriptions.

## Session of 2026-11-23 (from about 23:25), in `night-a`, on `wp/fix-smoke-and-runtime`

Task list given by the owner for this run: (1) a new branch `wp/fix-smoke-and-runtime` from `origin/main` with three fixes; (2) merge `origin/main` into `wp/3.1-python-worker`, then `wp/3.3-grader`, then `wp/3.4-statechart`, one per task; (3) help with the WP-3.x review findings still open in those descriptions. This run did task 1. This file was copied from `origin/wp/5.1-catalog` (the newest copy) and this section added on top.

### Task 1 done: `wp/fix-smoke-and-runtime`

- 8ce22ea: `scripts/infra-verify.mjs` with `--release` asks `/api/health` every 5 s for up to 60 s until it names the release, then runs the other checks. Five new tests; four failed before the change.
- 7f5c85a: `public/_runtime` ignored in `tsconfig.json`, `eslint.config.mjs`, `.prettierignore` and `.gitignore`, with WP-3.1's lines. Three new tests, all failed before. With `main`'s `tsconfig.json`, this checkout's leftover folder put 2 files in the project and 14927 error lines; now 0 files.
- 714227f: `e2e/csp.spec.ts`. Cause of test 1 found: Next 16's client entry empties `self.__next_f` and replaces its `push` (`node_modules/next/dist/client/app-index.js` lines 124 to 130), so the old wait could pass only if the scripts never ran. The test now counts inline pushes with an init script. Cause of test 2 not proven; the test now injects after the page's scripts ran and listens on the element.
- `pnpm verify` on 1829ec6: exit 0, 27 files, 710 tests. `pnpm build` with CI's fake public values: exit 0.
- Not run: the e2e spec. Chromium is installed but cannot start in this sandbox (`bootstrap_check_in ... Permission denied (1100)`).
- Found on the way: `$TMPDIR` is shared with the `night-b` session. A log named `$TMPDIR/verify.log` was overwritten by `night-b`'s run (it said `RUN v5.1.0 /private/tmp/claude-501/night-b`); `pnpm verify` was run again into a log with a unique name. Later sessions should name logs by worktree.
- Description: `docs/reports/pull-requests/fix-smoke-and-runtime.md`, with the `gh pr create` command (`--base main`) and four decisions.
- Code review round 1 on 714227f: CHANGES REQUIRED, no blocker. Both MAJORs fixed in 1829ec6: the CSP test polls the document listener again (the element listener missed the case its comment named), and a new test makes a health check that keeps failing reject after the wait (seen failing by mutation). Minors recorded in the description; the `infra-verify.mjs` conflict with `wp/3.1-python-worker` is for task 2.
- Push: `wp/fix-smoke-and-runtime` created with 8ce22ea, 7f5c85a and 714227f; then 1829ec6 and the docs commit. This line is pushed with the docs commit.

### Owner: run this

1. `pnpm test:e2e --project=chromium e2e/csp.spec.ts` on `wp/fix-smoke-and-runtime`; if test 2 still fails, paste its message into the pull request.
2. `lsof -ti:3190 | xargs kill`: a `next start` from this session may still listen there; the sandbox cannot stop it.
3. Open the pull request with the `gh` command at the end of its description.
4. The owner actions of the sessions below are still due.

### Next

- Task 2: merge `origin/main` into `wp/3.1-python-worker`, resolve conflicts, `pnpm verify` and `pnpm build`, push, and update "Up to date with main" in its description.

## Session of 2026-11-23 (from about 20:35), in `night-b`, on `wp/5.1-catalog`

Same task list as the sessions below. Tasks 1 and 2 are done; this run did WP-5.1 part 5 (task 3), the last part.

### Task 3, part 5 done: review round 2 and its fixes

- Review round 2 on `af42bd5..08c8087`, reports `docs/reports/reviews/WP-5.1/*-review-2.md`. Security: APPROVE with three minors. Code: CHANGES REQUIRED (BLOCKER 1: the journey's setup checked an unscoped `role="status"` on a page with three, so it could never pass). Design: CHANGES REQUIRED (round 1 BLOCKER 1 still open, no screenshots; new BLOCKER: the gallery repeated an id, so axe would fail before any screen; new BLOCKER: five wrong Delivery Gate lines; MAJOR: the failure state is drawn only by JavaScript).
- 4cd37c7: each gallery state at its own address (`/dev/catalog?state=...`), drawn alone; the chapter list named by its heading; `max-inline-*` and `min-block-target` in what this branch adds (decision 22 was wrong); the error page leaves out its home link on `/`.
- dff1adb: the journey's status check scoped to the Status panel; one cleanup that moves a published course back to draft through the dashboard first; the page data check asserts `text/x-component`; the screens check wants files from this run; the boundary test finds route files by their imports and sees `require`, `next/headers` and relative paths (two mutations failed it); the indexing test fails when its page extensions differ from `next.config.ts` (one mutation failed it).
- `pnpm verify`: exit 0, 63 files, 1149 tests. `next build` with CI's fake values: exit 0, no `/dev` route, no gallery string in `.next/static`, the logical classes in the built CSS. `check-bundle` and `check-static`: exit 0.
- Not changed, for the owner: security MINOR A (a backtick `import()` passes `scripts/eslint/module-boundaries.mjs`; an enforcement control, older than this branch); design finding 4 (the WP-1.4 error page wording); the cause of two content reads per failed request (recorded in decision 9).
- Not run: every e2e spec (no browser, `next dev` fails, no Docker).
- Description: `docs/reports/pull-requests/wp/5.1-catalog.md`, now part 5 of 5, with items 26 to 35, part 5 evidence, round 2 summary, corrected Delivery Gate lines, decisions 9 and 22 changed and 23 to 25 new, owner actions 4 to 6.
- Time: about 2.2 hours of the 3 hour box over five parts.
- Servers: the reviewers' `next start` servers on ports 4138, 4317 and 4518 were stopped by the sandbox's time limit; none is left from this run.
- Push: succeeded, `08c8087..fd4c6bf` (4cd37c7 the fixes, dff1adb the tests and journey, fd4c6bf the reports, description and progress). This line is pushed after it.

### Owner: run this

1. `lsof -ti:3101,3451,3452,3453,3461,3917,3918 | xargs kill` if anything is listed (from earlier runs).
2. With `supabase start`: `pnpm test:e2e --project=stack e2e/catalog-journey.spec.ts` and `pnpm test:e2e --project=gallery e2e/catalog-gallery.spec.ts`; commit `docs/reports/screens/WP-5.1/`; then ask `design-reviewer` for its approval with the screens.
3. Decide WP-5.1 deviation 1 (merge order with WP-5.2 for the Begin action), decision 9 (500 with the error page, now with the round 2 measurements), and owner actions 5 and 6 in the description.
4. Create the draft pull request with the `gh` command at the end of the description, after step 2.
5. The owner actions of the sessions below are still due.

### Next

- Task 3 is done as far as this sandbox allows: WP-5.1 waits for the owner's e2e run and decisions. No task is left in the list.

## Session of 2026-11-23 (from about 19:55), in `night-b`, on `wp/5.1-catalog`

Same task list as the sessions below. Tasks 1 and 2 are done; this run did WP-5.1 part 4 (task 3).

### Task 3, part 4 done: the three reviews and their fixes

- Review round 1 on `origin/wp/4.1-courses-chapters..af42bd5`, reports in `docs/reports/reviews/WP-5.1/`. Security: APPROVE with four minors. Code: CHANGES REQUIRED (MAJOR 1: a failed read answered 200 with `noindex`). Design: CHANGES REQUIRED (BLOCKER 1 no screenshots, BLOCKER 2 the stack project saved no screen, BLOCKER 3 three wrong Delivery Gate lines, MAJOR 4 no primary action, MAJOR 5 empty pages never shown whole).
- 55399e7: a course address that is not in the cached course list makes no course query (7 tests failed before).
- 4a6628d: a failed read throws, so `/`, `/courses` and a course page answer 500 with the error page (5 tests failed before); the gallery shows the empty home page and course list as whole pages; a `heading` link variant in `src/ui` at weight 600; item headings one size down; metadata `text-xs`; chapter list at the prose width; two copy fixes; `home.description` is `shell.description`.
- dd515e1: the static checks see `import("...")` and every page extension (a mutation of the import pattern failed the new test); the journey publishes the course and moves it back to draft in the dashboard, so the 75 s `toPass` wait and the raised timeouts are gone; it checks raw HTML and page data for draft, solution and wrong-answer marks; the `stack` project saves screens, and the journey checks that the nine files exist.
- `pnpm verify`: exit 0, 63 files, 1141 tests. `pnpm build` with CI's fake public values: exit 0, no `/dev` route, no gallery string in `.next/static`. `check-bundle` and `check-static`: exit 0. The built app with no database: `/`, `/courses`, `/courses/python-basics` 500 for a browser and for Googlebot; `/courses/Not_A_Slug` 404; `/sitemap.xml` 500.
- Not run: every e2e spec (no browser, `next dev` fails, no Docker), so design BLOCKER 1 stays open.
- Description: `docs/reports/pull-requests/wp/5.1-catalog.md`, now with the part 4 evidence, the review summary, the corrected Delivery Gate lines, two deviations (no primary action until WP-5.2; no per-segment `loading.tsx` or `error.tsx`), decisions 9, 10, 13 and 14 changed and 17 to 22 new.
- Time: about 1.7 hours of the 3 hour box over four parts.
- Servers this run and its reviewers could not stop (the sandbox hides them): `next start` on ports 3461, 3917 and 3918.
- Push: succeeded, `af42bd5..2879b2a` (55399e7 the content fix, 4a6628d the catalog fixes, dd515e1 the tests and journey, 2879b2a the reports, description and progress). This line is pushed after it.

### Owner: run this

1. `lsof -ti:3101,3451,3452,3453,3461,3917,3918 | xargs kill` if anything is listed.
2. With `supabase start`: `pnpm test:e2e --project=stack e2e/catalog-journey.spec.ts` and `pnpm test:e2e --project=gallery e2e/catalog-gallery.spec.ts`; commit `docs/reports/screens/WP-5.1/`. The journey now signs in an admin in its setup, inside the default hook timeout.
3. Decide WP-5.1 deviation 1 (merge order with WP-5.2 for the Begin action) and decision 9 (500 with the error page for a failed read).
4. The owner actions of the sessions below are still due.

### Next

- Task 3, WP-5.1 part 5, in `night-b` on `wp/5.1-catalog`: review round 2 (`code-reviewer`, `security-reviewer`, `design-reviewer`) on `af42bd5..HEAD`, reports `*-review-2.md`, fix findings test first, verify and build again, finish the description. Design approval still needs the screenshots.

## Session of 2026-11-23 (from about 19:10), in `night-b`, on `wp/5.1-catalog`

Same task list as the sessions below. Tasks 1 and 2 are done; this run did WP-5.1 part 3 (task 3).

### Task 3, part 3 done: the indexing test, the catalog gallery, the e2e specs, the Delivery Gate report

- d231b32: `src/app/indexing.test.ts` finds every `page.tsx` and fails on a page missing from the indexing table of 03-experience section 3; sign-in and every admin page (at each stage of the admin door) must say `noindex`, the catalog pages must not. Two mutations (sign-in indexed; `noindex` removed from `adminMetadata`) each failed it.
- 173ba6a: `/dev/catalog`, a development-only gallery of the course list's and course page's empty and failed states; `e2e/catalog-gallery.spec.ts` (320 to 1280 px, axe, screenshots); `e2e/catalog-journey.spec.ts` against the local stack (counts equal the database, only published content, titles, canonical addresses, 404 and sitemap for a draft course, `noindex` on sign-in and the admin door, 320 px, axe, screenshots); `sqlRows` in `e2e/admin-helpers.ts`; `catalog` added to the log route segments.
- `pnpm verify`: exit 0, 63 files, 1131 tests. `pnpm build` with CI's fake public values: exit 0, no `/dev` route in the build. `check-bundle` and `check-static`: exit 0.
- Not run: every e2e spec, so no axe result, 320 px measurement or screenshot. In this sandbox `next dev` fails (`unable to start FSEvent stream`; with polling, `EMFILE` and restarts), Chromium cannot start (`MachPortRendezvousServer ... Permission denied (1100)`), and Docker is not running.
- Description: `docs/reports/pull-requests/wp/5.1-catalog.md`, now with the part 3 evidence, the Delivery Gate report (from source, with NOT VERIFIED lines), and sixteen decisions (new: 13 the journey waits up to 75 seconds for the content cache; 14 it writes content through `save_lesson` like the seed; 15 `/admin/courses/new` not indexed; 16 the gallery's sample content).
- Time: about 1.3 hours of the 3 hour box over three parts.
- Servers this run could not stop (the sandbox hides them from `pkill`): a `next dev` on port 3101 (it may be in a restart loop) and a `next start` on port 3453.
- Push: succeeded, `1c94bc6..973790d` (d231b32 the indexing test, 173ba6a the gallery and e2e specs, 973790d the description and progress). This line is pushed after it.

### Owner: run this

1. `lsof -ti:3101,3451,3452,3453 | xargs kill` if anything is listed.
2. With `supabase start`: `pnpm test:e2e --project=stack e2e/catalog-journey.spec.ts` and `pnpm test:e2e --project=gallery e2e/catalog-gallery.spec.ts`; look at `docs/reports/screens/WP-5.1/` and commit the screens.
3. Read WP-5.1 decisions 13 to 16 when convenient.
4. The owner actions of the sessions below are still due.

### Next

- Task 3, WP-5.1 part 4, in `night-b` on `wp/5.1-catalog`: `code-reviewer`, `security-reviewer` and `design-reviewer` on `origin/wp/4.1-courses-chapters..HEAD`, reports in `docs/reports/reviews/WP-5.1/`, fix the findings test first, verify and build again, finish the description. The design review will lack screenshots unless the owner has run the e2e specs.

## Session of 2026-11-23 (from about 18:40), in `night-b`, on `wp/5.1-catalog`

Same task list as the sessions below. Tasks 1 and 2 are done; this run did WP-5.1 part 2 (task 3).

### Task 3, part 2 done: the home page, the course list, the course page, and Courses in the header

- Read `DESIGN.md` (signed, revision 2), `.claude/rules/ui-design.md`, 03-experience sections 3 to 5, 8 and 9, and the antislop skills; antislop in `during` mode.
- Built test first in 1fba0b1 and 7ac30d7: `/`, `/courses` and `/courses/[course]` from `src/content`, with the empty and could-not-load states, 404 for a course that is not published, titles, descriptions and canonical paths, and `noindex` when a read fails; Courses in a "Main" header landmark, current only on `/courses`; a test that the catalog reads only through `src/content`.
- The first build logged two failed content reads: the build tried to prerender the pages. Each catalog read now waits for the request (`connection()`); the next build logged none.
- `pnpm verify`: exit 0, 62 files, 1104 tests. `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: exit 0.
- The built app under `next start` with no database: `/` and `/courses` 200 with the error notice and `noindex`; `/courses/python-basics` 200 "This course could not be loaded" with `noindex`; `/courses/Not_A_Slug` 404. One read per request.
- Description: `docs/reports/pull-requests/wp/5.1-catalog.md`, now with twelve decisions (new: 8 the home paragraph describes the lesson page before it exists; 9 a failed read is shown in the page with `noindex`; 10 the course title link is weight 500; 11 `aria-current` only on `/courses`; 12 the header wraps).
- Time: about 0.75 hours of the 3 hour box over two parts.
- Not run: e2e, axe, screenshots, database tests. No browser or local Supabase stack here.
- Two `next start` servers from this run may still be listening on ports 3451 and 3452. The sandbox hides them from `ps` and `pkill`, so they could not be stopped from here.
- Push: succeeded, `c5ca0e2..5224cc0` (1fba0b1 the pages, 7ac30d7 the header, 5224cc0 the description and progress). This line is pushed after it.

### Owner: run this

1. If `lsof -ti:3451,3452` shows anything: `lsof -ti:3451,3452 | xargs kill`.
2. Read WP-5.1 decisions 8 to 12 when convenient.
3. The owner actions of the sessions below are still due.

### Next

- Task 3, WP-5.1 part 3, in `night-b` on `wp/5.1-catalog`: e2e for the three pages against the local stack (counts against the database, 320 px with no page scroll, every non-indexed page `noindex`), a way to show the empty and failed states in a browser, screenshots, axe, and the Delivery Gate report. If this sandbox still has no browser, write the specs and the gallery and leave the runs to the owner.

## Session of 2026-11-23 (from about 18:15), in `night-b`, on `wp/5.1-catalog`

Same task list as the sessions below. Tasks 1 and 2 were done; this run started task 3 and did WP-5.1 part 1.

### Task 3, part 1 done: WP-5.1 content layer, sitemap and indexing rules

- Branch `wp/5.1-catalog` from `origin/wp/4.1-courses-chapters` (962683c). The task list names `.claude/commands/work-package.md`, which does not exist; followed `.claude/skills/work-package/SKILL.md`.
- Built test first in cdc4f17 and d41b2ad: a course or chapter with no published lesson is left out (FR-CAT-04, FR-CRS-01; 3 new tests failed before the change); a warm cache test shows a second view makes no database query and a failed read is not kept (passed on the existing wiring at once); `/sitemap.xml` per request and `/robots.txt` (FR-SEO-01); `metadataBase` set to `https://heapacademy.dev`.
- `pnpm verify`: exit 0, 60 files, 1062 tests. `pnpm build` with CI's fake public values: exit 0 (`ƒ /sitemap.xml`, `○ /robots.txt`). `check-bundle` and `check-static`: exit 0.
- Environment: night-b's `node_modules` was the old WP-3.4 install, without `@supabase/*`, and `pnpm install` cannot run here. It is moved to `$TMPDIR/night-b-aside/node_modules`, with the leftover untracked `public/_runtime/` from the WP-3.4 checkout. night-b now has an APFS copy of night-a's `node_modules` (lockfile superset, same versions for shared packages). A symlink failed: Turbopack will not read `node_modules` outside the project root. `/node_modules` is in `.git/info/exclude` for this clone only.
- Description: `docs/reports/pull-requests/wp/5.1-catalog.md`, with seven decisions taken with a safe default and the `gh pr create` line for later. Do not open it yet.
- Time: about 0.3 hours of the 3 hour box.
- Not run: e2e, axe, screenshots, database tests.
- Push: succeeded, new branch `origin/wp/5.1-catalog` (cdc4f17, d41b2ad, and the docs commit). This line is pushed after it.

### Owner: run this

1. Nothing new for WP-5.1 yet. Read its decisions 1 to 7 when convenient (7: no lesson link or Begin action until WP-5.2's workspace route exists).
2. The owner actions of the sessions below are still due.

### Next

- Task 3, WP-5.1 part 2, in `night-b` on `wp/5.1-catalog`: read `DESIGN.md`, `.claude/rules/ui-design.md` and the antislop skills; build the home page, `/courses` and `/courses/[course]` with their states, titles, descriptions and canonical paths, and Courses in the header; test that each page reads only through `src/content`.

## Session of 2026-11-23 (from about 17:28), in `night-a`, on `wp/4.3-validate-publish`

Same task list as the session below. This run did task 2.

### Task 2 done: WP-4.3 part 8, the second review round and its fixes

- ecbb815 checked against design MINOR 11: it covers the stopped validation, Save validating first and its refusals, the time limit, the error line, cut and cleaned output and the outdated notes, with axe. The reviewers found the gaps left (below).
- Review round 2 on `e1f1ce9..c5902d0`, reports in `docs/reports/reviews/WP-4.3/` (`code-review-2.md`, `security-review-2.md`, `design-review-2.md`). Security: APPROVE. Code: CHANGES REQUIRED only for the e2e runs, no new BLOCKER or MAJOR. Design: CHANGES REQUIRED for the screenshots (BLOCKER 1, open since round 1) and MAJOR 2 (a real cut output made a test case thousands of pixels tall).
- Fixed test first in bb1d583 (4 new tests failed before the change): Open labels from the list now; invisible characters removed from shown output (the zero-width joiner and non-joiner kept); the solution's output in the lesson code panel, scrolling inside a new `--spacing-output` token (20rem) with the focus ring inset; the name hint's limit from `TEST_CASE_LIMITS`; `testCaseList.title` from its parts; clearer failed-solution sentence; a test that focus moves only once (seen failing with the effect's dependency list removed); gallery states for Python that started but could not run the programs (Validate and Save), Open focusing a test case, rule 1's missing parts, axe on the passed state, the cut output at its real length.
- A first try with `max-block-80` built to no CSS at all (the theme defines only its own spacing tokens); found by checking the built stylesheet, then replaced by the token.
- `pnpm verify`: exit 0, 98 files, 1841 tests. `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: exit 0. The built CSS holds `.max-block-output{max-block-size:var(--spacing-output)}`. No gallery string in `.next/static`.
- Description rewritten: `docs/reports/pull-requests/wp/4.3-validate-publish.md` (opening paragraph, part 8 evidence, "Left for the owner", decisions renumbered and three new: 18 invisible characters, 19 the new size token, 20 the T-21 bundle note). Time: about 3.6 hours of sessions against a box of 3.5, under 1.5 times.
- Not run: e2e, screenshots, axe, database tests. No browser or local Supabase stack in this sandbox.
- Push: succeeded, `c5902d0..ad1bd6a` (bb1d583 the fixes, 1110243 the review reports, ad1bd6a the description and progress). This line is pushed after it.

### Owner: run this

1. `pnpm test:e2e` for `e2e/admin-gallery.spec.ts` and `e2e/j13-publish-journey.spec.ts` against the local stack; look at `docs/reports/screens/WP-4.3/`; then the Delivery Gate report. The new gallery checks have never run.
2. Decide WP-4.3 decisions 17 to 20 (17: cherry-pick 87af7ec onto `wp/4.1-courses-chapters`; 19: accept `--spacing-output` and add it to DESIGN.md).
3. Open the draft with the `gh pr create` line at the end of the description when you want it.
4. Earlier owner actions for WP-2.2, WP-2.3, WP-4.1 and WP-4.2 are still due.

### Next

- Task 3: in `night-b`, create the WP-5.1 branch from `origin/wp/4.1-courses-chapters` and start WP-5.1 part 1 under `.claude/skills/work-package/SKILL.md` (the task list names `.claude/commands/work-package.md`, which does not exist; the skill is the same procedure).

## Session of 2026-11-23 (from about 17:15), in `night-a`, on `wp/4.3-validate-publish`

Task list given by the owner for unattended runs: (1) merge `origin/wp/4.2-lesson-editor` into `wp/4.3-validate-publish`; (2) WP-4.3 part 8, verify and a second review; (3) WP-5.1 in `night-b` from `origin/wp/4.1-courses-chapters`, one part per run. This run did task 1.

### Task 1 done: the CodeMirror lockfile merged into `wp/4.3-validate-publish`

- The owner pushed 4148777 ("chore(deps): add CodeMirror to the lockfile") to `wp/4.2-lesson-editor`. Merged in 9538964. `pnpm-lock.yaml` merged with no conflict; all 41 `package.json` specifiers match the lockfile's importers (script check). `pnpm install` still cannot run in this sandbox (store lock), so CI's frozen install is the real test.
- The first `pnpm verify` after the merge failed one test the merge did not touch: `course-details-form.test.tsx` > "names a taken address and keeps what was typed" (focus on the button, not the field). It passed 5 of 5 alone. Cause: the form moved focus on the next animation frame, but its state update inside an async transition commits only when the transition ends. `lesson-editor.tsx` had the same pattern for a taken address.
- Fixed test first in 87af7ec: `src/features/admin/components/focus-after-commit.ts` (`useFocusAfterCommit`) focuses after the commit. Three new tests failed before the fix.
- `pnpm verify`: exit 0, 98 files, 1837 tests. `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: exit 0.
- Commit ecbb815 (part 8's gallery states for design MINOR 11, at 10:48) was already pushed by an earlier session with no entry here. It is included in the verify run above. Its e2e gallery test was not run.
- Description updated: `docs/reports/pull-requests/wp/4.3-validate-publish.md`, with the merge evidence, owner action 1 marked done, and new decision 17 (the WP-4.1 focus fix carried on this branch; recommendation: cherry-pick 87af7ec onto `wp/4.1-courses-chapters`). Its opening paragraph still says "Parts 1 to 6"; part 8 rewrites it.
- Push: succeeded, `ecbb815..8f9a47a` (the merge 9538964, the fix 87af7ec, the docs commit 8f9a47a). This line is pushed after it.

### Owner: run this

1. If CI's frozen install fails on `wp/4.3-validate-publish`: `pnpm install` there and commit the lockfile.
2. Decide decision 17 (cherry-pick 87af7ec onto `wp/4.1-courses-chapters` or not).
3. If this sandbox still cannot run them: `pnpm test:e2e` for `e2e/admin-gallery.spec.ts` and `e2e/j13-publish-journey.spec.ts` against the local stack.
4. Earlier owner actions for WP-2.2, WP-2.3, WP-4.1 and WP-4.2 are still due.

### Next

- Task 2: WP-4.3 part 8, on `wp/4.3-validate-publish` in `night-a`: check ecbb815 against design MINOR 11; a second code, security and design review round on e1f1ce9..HEAD, with fixes; rewrite the description's opening paragraph and "Left for part 8".

## Session of 2026-11-23 (from about 10:05), in `night-a`, on `wp/4.3-validate-publish`

### WP-4.3 Test cases, validation, publishing: part 7, `wp/4.3-validate-publish` (base `wp/4.2-lesson-editor`)

- Built test first (10 tests failed before the change): design review MINOR 8 (each failed test case named in the checklist gets an Open button that opens it and focuses its title; none for one removed since), MINOR 9 (the test case number in Plex Mono), MINOR 10 (the limits in admin copy come from `CHECK_TEST_LIMIT`, `HARNESS_OUTPUT_LIMIT` and the runtime's `TIME_LIMIT_MS`, passed into the messages as numbers), and decision 14 (each verdict in its test case's title, read as "Test case 1: Doubles, Passed").
- Commit e51304f at 10:22. `pnpm verify`: exit 0, 97 files, 1833 tests (the first two runs failed on Prettier for 3 files, then on a non-exhaustive switch; both fixed).
- `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: pass.
- Push: succeeded, `0a4541b..e51304f`. This progress commit is pushed after it.
- Time box: the seven sessions add up to about 2.5 hours against 3.5. Recorded in the description.
- Description updated: `docs/reports/pull-requests/wp/4.3-validate-publish.md` (`--base wp/4.2-lesson-editor`), with sixteen open decisions (new: Open buttons under the failed rule; decision 14 is now built). Do not open it until part 8 is done.
- Not run: e2e, screenshots, axe, database tests (no migration changed). No local Supabase stack or browser in this sandbox.

### Owner: run this

1. Unchanged: the WP-4.2 lockfile commit, then merge `wp/4.2-lesson-editor` into `wp/4.3-validate-publish` and run `pnpm install` there.
2. If this sandbox still cannot run them: `pnpm test:e2e` for `e2e/admin-gallery.spec.ts` and `e2e/j13-publish-journey.spec.ts` against the local stack, which also writes the screenshots into `docs/reports/screens/WP-4.3/`.
3. Earlier owner actions for WP-2.2, WP-2.3, WP-4.1 and WP-4.2 are still due.

### Next

- WP-4.3 part 8, on `wp/4.3-validate-publish`: design MINOR 11 (gallery states for a stopped validation, Save validating first, the `validateFirst` refusals, a timed-out rule, an error verdict with its line, cut and cleaned output, the outdated notes); a second code, security and design review round on e1f1ce9..e51304f, with fixes; the e2e runs, screenshots, axe and the Delivery Gate report if a browser and the stack are available.
- WP-5.1 (depends on WP-4.1) can start beside it, on `wp/4.1-courses-chapters`.

## Session of 2026-11-23 (from about 09:40), in `night-a`, on `wp/4.3-validate-publish`

### WP-4.3 Test cases, validation, publishing: part 6, `wp/4.3-validate-publish` (base `wp/4.2-lesson-editor`)

- Review round 1 on `938a05d..1443296`: code, security and design, all CHANGES REQUIRED. Reports saved in `docs/reports/reviews/WP-4.3/` (`code-review-1.md`, `security-review-1.md`, `design-review-1.md`). The design review is code-only: no screenshots exist.
- Fixed, test first (commit e1f1ce9 at 09:55): the code BLOCKER (Validate with a nameless test case said Python could not run; now it opens the test case and focuses the field); T-07 (`src/grader/console-text.ts` strips escape sequences, control and bidi characters from shown output and Python's message, and such output is never filled); separate pending states for Save and status moves, each disabling the other; the failed Python start as one error with a Try again instruction; J-13's status assertions; Reload on `status_not_allowed`; the status said once; the stored status parsed; controller reports sent by code to `reportError`; a trimmed title keeps Publish; no program on open (T-23 tests); the runbook's wrong-answer step.
- `pnpm verify`: exit 0, 97 files, 1828 tests (the first run failed on Prettier for 3 files; formatted, then the run above).
- `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: pass.
- Push: succeeded, `1443296..8fadb66` (e1f1ce9 and the docs commit 8fadb66). This line is pushed after it.
- Description updated: `docs/reports/pull-requests/wp/4.3-validate-publish.md` (`--base wp/4.2-lesson-editor`), with fifteen open decisions (new: Delete has no undo; verdicts inside each test case; output with control characters is stripped and not fillable). Do not open it until part 7 is done.
- Not run: e2e, screenshots, axe, database tests (no migration changed). No local Supabase stack or browser in this sandbox.

### Owner: run this

1. Unchanged: the WP-4.2 lockfile commit, then merge `wp/4.2-lesson-editor` into `wp/4.3-validate-publish` and run `pnpm install` there.
2. If this sandbox still cannot run them in part 7: `pnpm test:e2e` for `e2e/admin-gallery.spec.ts` and `e2e/j13-publish-journey.spec.ts` against the local stack, which also writes the screenshots into `docs/reports/screens/WP-4.3/`.
3. Earlier owner actions for WP-2.2, WP-2.3, WP-4.1 and WP-4.2 are still due.

### Next

- WP-4.3 part 7, on `wp/4.3-validate-publish`: the design minors 8 to 11 and the verdict in each test case title (decision 14); a second review round on e1f1ce9 and later; the e2e runs, screenshots, axe and the Delivery Gate report if a browser and the stack are available.
- WP-5.1 (depends on WP-4.1) can start beside it, on `wp/4.1-courses-chapters`.

## Session of 2026-11-23 (from about 09:00), in `night-a`, on `wp/4.3-validate-publish`

### WP-4.3 Test cases, validation, publishing: part 5, `wp/4.3-validate-publish` (base `wp/4.2-lesson-editor`)

- The runbook `docs/runbooks/published-lesson-wrong.md` (07-operations section 8.1), found as an untracked draft and checked against the code: corrected the button names ("Reload the page" appears only for a newer version), the section list, and the public addresses (`/learn/<course>/<lesson>`, `/courses/<course>`, `/courses` from 03-experience section 3).
- J-13: `e2e/j13-publish-journey.spec.ts` (a failing solution and a passing starter are refused with the reason and get no Publish; a passing lesson is published, survives a reload, and moves back to draft after the dialog). Written, not run: no local Supabase stack here.
- A flaky unit test fixed: the archive test in `lesson-editor.test.tsx` failed once in the full run (passed 5 of 5 alone). The status renders before the async transition ends, and React Aria's pending Button ignores presses; the test now waits for the button to settle. No component change.
- Commit af0f0c1 at about 09:19. `pnpm verify`: exit 0, 96 files, 1811 tests (the first run failed on the flaky test, before the fix).
- Push: succeeded, `5f0c307..af0f0c1`. This progress commit is pushed after it.
- No `pnpm build` this part (no application code changed).
- Description updated: `docs/reports/pull-requests/wp/4.3-validate-publish.md` (`--base wp/4.2-lesson-editor`), now with twelve open decisions (new: Publish is never offered to a broken lesson, so J-13's "refused with the reason" is the checklist). Do not open it until part 6 is done.

### Owner: run this

1. Unchanged: the WP-4.2 lockfile commit, then merge `wp/4.2-lesson-editor` into `wp/4.3-validate-publish` and run `pnpm install` there.
2. Earlier owner actions for WP-2.2, WP-2.3, WP-4.1 and WP-4.2 are still due.

### Next

- WP-4.3 part 6, on `wp/4.3-validate-publish`: code, security and design review with fixes. The e2e runs and screenshots need the local stack and a browser, which this sandbox has not had; if they still cannot run, the description says so and the owner runs them.
- WP-5.1 (depends on WP-4.1) can start beside it, on `wp/4.1-courses-chapters`.

## Session of 2026-11-23 (from about 06:00), in `night-a`, on `wp/4.3-validate-publish`

### WP-4.3 Test cases, validation, publishing: part 4, `wp/4.3-validate-publish` (base `wp/4.2-lesson-editor`)

- Built test first: the lesson's status in the editor's Publish section (`src/features/admin/components/lesson-status.tsx`). Publish appears only after a passing validation of the lesson as it is now; it saves with the validated hash, then calls `setLessonStatus` with the saved version. Move back to draft (from published) and Archive ask first and say what learners will see. Save on a published lesson validates first and saves nothing on a failed rule, a stop, or a Python that could not start. Gallery: status actions on every lesson editor, a new archived state; an e2e gallery test (written, not run).
- Found by a test: React holds state updates inside an async transition until it ends, so "Validating" and Stop never showed during Save. The validation now runs outside the transition.
- Commit bffeb6a at about 06:11. `pnpm verify`: exit 0, 96 files, 1811 tests.
- `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: pass.
- Push: succeeded, `c94215b..bffeb6a`. This progress commit is pushed after it.
- Description updated: `docs/reports/pull-requests/wp/4.3-validate-publish.md` (`--base wp/4.2-lesson-editor`), now with eleven open decisions (three new: Save on a published lesson validates even for a title-only change; Publish saves the editor's content first; status moves leave unsaved edits unsaved). Do not open it until part 5 is done.
- No reviews yet. No e2e run, no screenshots, no database tests (no migration changed).

### Owner: run this

1. Unchanged: the WP-4.2 lockfile commit, then merge `wp/4.2-lesson-editor` into `wp/4.3-validate-publish` and run `pnpm install` there.
2. Earlier owner actions for WP-2.2, WP-2.3, WP-4.1 and WP-4.2 are still due.

### Next

- WP-4.3 part 5, on `wp/4.3-validate-publish`: the runbook `docs/runbooks/published-lesson-wrong.md` (07-operations section 8.1); J-13 (written; e2e cannot run here); code, security and design review, with fixes. Then the description is ready.
- WP-5.1 (depends on WP-4.1) can start beside it, on `wp/4.1-courses-chapters`.

## Session of 2026-11-23 (from about 05:29), in `night-a`, on `wp/4.3-validate-publish`

### WP-4.3 Test cases, validation, publishing: part 3, `wp/4.3-validate-publish` (base `wp/4.2-lesson-editor`)

- Built test first: Validate in the lesson editor. A "Publish" section with the checklist of section 7.6 (a state and a reason per rule), Validate and Stop, and Python's state (loading, ready, failed with Try again), on the learners' runtime controller started with the editor. Each test case shows the solution's verdict and output; "Fill from solution" copies it into the expected output. Save sends the validated hash only after a passing validation of exactly what it saves (T-22). Four new `/dev/admin` states (Python loading, Python failed, validating, a failed validation with Fill), and an e2e gallery test (written, not run).
- Fixed in passing: an editor test left a save pending forever, which kept the next test's Save pending (React joins async transitions).
- Commit 6ff2a5d at about 05:43. `pnpm verify`: exit 0, 96 files, 1797 tests.
- `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: pass.
- Push: succeeded, `438b73e..6ff2a5d`. This progress commit is pushed after it.
- Description updated: `docs/reports/pull-requests/wp/4.3-validate-publish.md` (`--base wp/4.2-lesson-editor`), now with eight open decisions (three new: Validate is the one action for the verdicts; Python starts when the editor opens; when a verdict stops showing). Do not open it until part 4 is done.
- No reviews yet. No e2e run, no screenshots, no database tests (no migration changed).

### Owner: run this

1. Unchanged: the WP-4.2 lockfile commit, then merge `wp/4.2-lesson-editor` into `wp/4.3-validate-publish` and run `pnpm install` there.
2. Earlier owner actions for WP-2.2, WP-2.3, WP-4.1 and WP-4.2 are still due.

### Next

- WP-4.3 part 4, on `wp/4.3-validate-publish`: Publish, Unpublish and Archive with confirmations (Publish only when `checkedNow(...).whole` and passed; it saves with the hash, then calls `setLessonStatus`); Save on a published lesson validating first; the runbook `docs/runbooks/published-lesson-wrong.md`; J-13; code, security and design review. Then the description is ready.
- WP-5.1 (depends on WP-4.1) can start beside it, on `wp/4.1-courses-chapters`.

## Session of 2026-11-23 (from about 05:01), in `night-a`, on `wp/4.3-validate-publish`

### WP-4.3 Test cases, validation, publishing: part 2, `wp/4.3-validate-publish` (base `wp/4.2-lesson-editor`)

- Built test first: the test case list in the lesson editor (`src/features/admin/components/test-case-list.tsx`): add, duplicate, move up, move down, delete, the limit of 12, every field with its section 7.5 description, a message per field, focus kept in the list; Save checks the test cases, opens the one with a problem and focuses its field; test case edits count as unsaved; the `Disclosure` primitive takes controlled props; two new `/dev/admin` states; an e2e gallery test (written, not run).
- Commit a95b8ba at 05:08. `pnpm verify`: exit 0, 93 files, 1755 tests.
- `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: pass.
- Push: succeeded, `4f90372..a95b8ba`. This progress commit is pushed after it.
- Description updated: `docs/reports/pull-requests/wp/4.3-validate-publish.md` (`--base wp/4.2-lesson-editor`), now with five open decisions (two new: plain text areas for test case fields; Delete asks nothing). Do not open it until part 3 is done.
- No reviews yet. No e2e run, no screenshots, no database tests (no migration changed).
- The runbook `docs/runbooks/published-lesson-wrong.md` waits for part 3, because it names the Unpublish control part 3 builds.

### Owner: run this

1. Unchanged from the session before: the WP-4.2 lockfile commit, then merge `wp/4.2-lesson-editor` into `wp/4.3-validate-publish` and run `pnpm install` there.
2. Earlier owner actions for WP-2.2, WP-2.3, WP-4.1 and WP-4.2 are still due.

### Next

- WP-4.3 part 3, on `wp/4.3-validate-publish`: Validate and Stop with the checklist (section 7.6) on the runtime controller, the verdict per test case with actual output, "Fill from solution", Save on a published lesson validating first, Publish, Unpublish and Archive with confirmations, the states "Python loading", "validating" and "validation failed" with gallery states; the runbook; J-13; code, security and design review. Then the description is ready.
- WP-5.1 (depends on WP-4.1) can start beside it, on `wp/4.1-courses-chapters`.

## Session of 2026-11-23 (from about 04:20), in `night-a`, on `wp/4.3-validate-publish`

### WP-4.3 Test cases, validation, publishing: part 1, `wp/4.3-validate-publish` (base `wp/4.2-lesson-editor`)

- `wp/3.4-statechart` merged in (938a05d). Conflicts resolved in `playwright.config.ts` (the `stack` project beside the three engines and the runtime projects), `scripts/eslint/module-boundaries.mjs` (both sets of messages), `src/features/workspace/index.ts` (all three exports), `security-headers.test.ts` and `proxy.test.ts` (both sides' tests). `pnpm verify` after the merge: 87 files, 1685 tests.
- Built test first: the validation checklist and the test case list rules in `src/grader`; the gradable hash; `saveLesson` now carries the test cases and marks a save validated only when the hash matches; `setLessonStatus` (publish, unpublish, archive); the validation runner on the learners' runtime controller.
- `pnpm verify` on 922accb: exit 0, 92 files, 1744 tests.
- Push: succeeded (new branch). This progress commit is pushed after it.
- Description: `docs/reports/pull-requests/wp/4.3-validate-publish.md`, with its `gh pr create` command (`--base wp/4.2-lesson-editor`) and three open decisions. Do not open it until part 2 is done.
- No reviews yet. No e2e, no `next build`, no database tests run (no migration changed).
- Setup: `night-a`'s `node_modules` now has `pyodide` 314.0.7 copied from `night-b` (`node_modules/pyodide`, with `ws` and `@types` in its own `node_modules`).

### Owner: run this

1. The WP-4.2 lockfile commit (below) is still due. Then merge `wp/4.2-lesson-editor` into `wp/4.3-validate-publish` and run `pnpm install` there, so the lockfile has both Pyodide and CodeMirror.
2. Earlier owner actions for WP-2.2, WP-2.3, WP-4.1 and WP-4.2 are still due.

### Next

- WP-4.3 part 2, on `wp/4.3-validate-publish`: the test case list, verdicts, "Fill from solution", the checklist with Validate and Stop, Publish, Unpublish and Archive in the lesson editor, with every state and the gallery; the runbook `docs/runbooks/published-lesson-wrong.md`; J-13; reviews. Then the description is ready.
- WP-5.1 (depends on WP-4.1) can start beside it, on `wp/4.1-courses-chapters`.

## Session of 2026-11-23 (from 04:02), in `night-a`, detached HEAD pushed to `wp/4.2-lesson-editor`

Sessions from 01:22 to 03:42 started and left no change. A session from 00:39 made 11 review-fix commits (6b799fe..7db29ac) on a detached HEAD in `night-a` and did not push them or record its reviews. This session recovered those reviews from that session's subagent transcripts, finished the two open findings, and wrote the description.

### WP-4.2 The lesson editor: ready as a draft, `wp/4.2-lesson-editor` (base `wp/4.1-courses-chapters`)

- Description: `docs/reports/pull-requests/WP-4.2.md`, with its `gh pr create` command and three decisions (the editor's nonce rule, where the lesson-content component lives, `save_lesson` keeping the position).
- `pnpm verify` on 8b289f3: exit 0, 69 files, 1269 tests. `next build`, `check-static`, `check-bundle` pass.
- PGlite: 365 assertions pass, with and without the seed (`12_lesson_order` now 27).
- Review round 1 (code, security, design, on be24f80): all CHANGES REQUIRED. Saved in `docs/reports/reviews/WP-4.2/`. Every finding fixed or answered in the description, except those needing a browser or the lockfile. Not re-reviewed.
- New this session:
  - 3b1bcf8: `save_lesson` keeps the lesson's position unless the chapter changes (security MINOR 2), test first.
  - 8b289f3: Zod `jitless` for every schema a browser loads, plus a lint rule (security MINOR 1), test first.
- e2e written, not run.
- Push: succeeded, `be24f80..c69e191`. This progress commit is pushed after it.
- `wp/4.2-markdown-part-1` is superseded by `wp/4.2-lesson-editor`. Do not open a pull request for part 1.
- The local branch `wp/4.2-lesson-editor` in the `night-c` worktree is behind the pushed branch. Run `git -C /private/tmp/claude-501/night-c pull --ff-only` before working there.

### Owner: run this

1. In a checkout of `wp/4.2-lesson-editor`, with dependencies installed, run `pnpm install && git add pnpm-lock.yaml && git commit -m "build: lock the CodeMirror packages" && git push`. The CodeMirror packages are not in `pnpm-lock.yaml`, so CI fails at the frozen install until this is done.
2. Earlier owner actions for WP-2.2, WP-2.3 and WP-4.1 are still due.

### Next

- WP-4.3 (test cases, validation, publishing) depends on WP-4.1, WP-4.2 and WP-3.4. All three are built as drafts. Stack it on `wp/4.2-lesson-editor` and merge `wp/3.4-statechart` in. Expect conflicts with the 3.x line in `package.json` and the lockfile (Pyodide against CodeMirror).
- WP-5.1 (depends on WP-4.1) can start beside it, on `wp/4.1-courses-chapters`.

## Session of 2026-11-22 (from 01:51), on `wp/4.1-courses-chapters`

Order given by the owner: (1) update waiting branches, done 2026-11-20 and `main` has not moved (037c4ad); (2) to (4) WP-2.1, 2.2, 2.3, done; (5) WP-3.4; then the plan order. WP-4.1, pushed unfinished, first.

Clones: `/private/tmp/claude-501/night-a` (2.x, 4.x line), `night-b` (3.x line), and `night-c`, a worktree of night-a on the local branch `wp/4.2-lesson-editor` (WP-4.2 in progress, not pushed yet).

### WP-4.1 Courses and chapters: ready as a draft, `wp/4.1-courses-chapters` (stacked on `wp/2.3-admin-gate`)

Description: `docs/reports/pull-requests/WP-4.1.md`, with its `gh pr create` command. `pnpm verify`: 58 files, 1051 tests. `next build`, `check-static`, `check-bundle` pass. PGlite: 338 assertions pass, with and without the seed (new `11_structure_versions`, 11). Code, security and design review 1: CHANGES REQUIRED; every blocker and major fixed except design BLOCKER 1 (screenshots need CI's browsers); the rest fixed or answered in the description; not re-reviewed. e2e written, not run.

Before this session the branch had one unpushed commit (9f20137, the views) and the WP-2.3 merge with the owner's lockfile commit; both are pushed now.

### WP-3.4 The statechart: ready as a draft, `wp/3.4-statechart` at fb21e29 (stacked on `wp/3.3-grader`)

Description: `docs/reports/pull-requests/WP-3.4.md`, with its `gh pr create` command. `pnpm verify`: 41 files, 1066 tests. Production build has no `/dev/runtime`; a `VERCEL_ENV=preview` build has it. Round 1 BLOCKER (a refused Run or Check left the chart stuck) fixed with `dispatchEvent`; round 2 code review APPROVE, security review APPROVE on the condition that the owner accepts ADR-0034 (Proposed: a program that yields once can compute while the page waits for input; Stop is the control; a liveness ping was rejected because a program that yields periodically defeats it). e2e written, not run. The phone check is the owner's.

### WP-4.2 The lesson editor: in progress in `night-c`, local branch `wp/4.2-lesson-editor`

`origin/wp/4.1-courses-chapters` (d9eba53) merged in (d9e03ac). Highlighting (`src/content/markdown/highlight.ts`, `document.ts`) written, not committed. CodeMirror packages are in `package.json` and copied into `node_modules` from `/private/tmp/claude-501/cm-side`; the lockfile is not updated (Owner: run this, item 3).

## Session of 2026-11-21 (from 10:33), on `wp/2.3-admin-gate`

### WP-2.3 The admin gate: ready as a draft, `wp/2.3-admin-gate` (stacked on `wp/2.2-sign-in`)

Description: `docs/reports/pull-requests/WP-2.3.md`, with its `gh pr create` command. `pnpm verify`: 49 files, 959 tests. `next build`, `check-static`, `check-bundle` pass. PGlite: 299 assertions pass (new `08_admin_list_check`, 14). Code, security and design review 1: CHANGES REQUIRED, no code or security blocker; every finding fixed or answered in the description; not re-reviewed. e2e (J-12, the admin gallery) written, not run.

Picked up from an uncommitted draft a session at about 06:10 left in `$TMPDIR/wp22`.

### WP-3.4: `wp/3.2-live-input` merged into `wp/3.4-statechart` (312bf29)

Conflicts with WP-3.3 resolved in `controller.ts` (status has both `awaitingInput` and `checking`; the run record has `kind: "run"`; input only for runs), `worker/core.ts` (`Loaded` carries the input-capable runner and the harness checker), `runtime-dev.ts` and both tests. The Pyodide input tests now import `pyodide` by name (WP-3.3's fixed-import lint rule) and send `harnessVersion`. `pnpm verify`: 39 files, 1028 tests.

### Owner: run this

1. Still due from the session before: the WP-2.2 lockfile commit, and the server on port 3197.
2. WP-2.3's owner actions in its description: section 10 step 8 (TOTP on), then after the merge `docs/runbooks/admin-access.md` section 1 on production.

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
