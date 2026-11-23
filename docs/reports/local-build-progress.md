# Local build progress

Work done in sessions while the owner was away, and what is left for the owner to run. Newest first. The newest copy of this file is on the branch named in its first section.

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

### WP-3.4: reviews done, fixes pending

Code review 1 and security review 1 of 36f4372 are in `night-b` under `docs/reports/reviews/WP-3.4/` (not committed yet). Both CHANGES REQUIRED: a Run or Check the controller refuses leaves the chart stuck (BLOCKER); a program can pause the page's clock by yielding once before it loops (MAJOR, T-02).

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
