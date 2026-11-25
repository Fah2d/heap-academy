CHANGES REQUIRED

Range `938a05d..1443296` (parts 1 to 5). One MAJOR, two MINOR. Nothing in this range lets a non-admin change content or read a solution. The server side of publishing (T-20, T-22) holds.

## Findings

**MAJOR: T-07 has no injection-payload test and no control-character handling on the new solution-output view, and "Fill from solution" copies raw output into a public field.**
- `src/features/admin/components/test-case-list.tsx:318` shows the output in `<pre>{view.actual}</pre>`; `:171` copies it with `edit(index, { expected: result.actual })`; `src/features/admin/validation-view.ts:108` decides when Fill is offered.
- Threat T-07, and T-23 once import lands (WP-6.4). A solution or `afterCode` that prints terminal escapes, bidi overrides (U+202E) or other control characters shows them in the owner's `aal2` session, and Fill copies them into `expected`, which learners read.
- React renders text, so markup cannot run. T-07 also requires control characters and terminal escapes to be stripped from console output; nothing in `src/` does this yet. No new test uses an injection payload.
- Fix: `[T-07]` component tests with `<img src=x onerror=alert(1)>`, `<script>` and `\u001b[2J‮` in a name, `expected` and the solution's `actual`; show control characters other than `\n` and `\t` as visible escapes; no Fill when `actual` has them; one shared grader function for the character class, for WP-5.2's console to reuse.

**MINOR: no test guards that opening the editor runs no program** (`lesson-editor.test.tsx:470-491`, T-23). Fix: assert `checkProgram` was not called after mount, for a draft and a published lesson.

**MINOR: the lesson status is cast without being parsed** (`src/features/admin/server/lesson-store.ts`, `setLessonStatus`: `current?.status as ContentStatus | undefined`). Fix: parse with an enum schema, answer `unavailable` on a mismatch.

## What holds

- Action wrapper (T-20): both actions use `defineAction` with `access: "admin"`; access, byte limit, then `strictObject` parse. `testCases` capped at 12 and parsed by the grader's parser; `validatedHash` pattern-checked; `status` an enum checked with `canMoveStatus`. Tests cover guest, learner, learner at `aal2`, admin at `aal1`, each with no database call.
- T-22: the client never sets `validated`; the server recomputes the hash of what it saves; `private.lessons_before_write` still enforces publishing, covered by `04_triggers.test.sql` (the "Done when" bypass case).
- An admin can still call `save_lesson` with `p_validated = true` directly: accepted risk in section 6.
- The status update is conditioned on `updated_at`, so a concurrent change answers `stale`.
- `contentChanged()` runs after every successful save or status move.
- Owner code runs only through `createRuntimeController` and `createPythonWorker`, `freshWorker: true` per program. No `eval`, `new Function`, `dangerouslySetInnerHTML`, privileged client, `process.env` or console logging added.
- No dependency, lockfile, workflow, migration or ESLint change.
- T-21: gallery runtimes only under `.dev.tsx`, fake fixtures.
- Note for WP-6.4: the admin worker runs on the app origin in an `aal2` session; import brings code the owner did not write, which triggers the section 6 residual-risk review there.

## What was run

- `git diff 938a05d..1443296` in full; the migrations it relies on and `04_triggers.test.sql`, `02_content_policies.test.sql` read.
- `pnpm verify`: exit 0, 96 files, 1811 tests (pnpm's pre-run install was blocked by the sandbox, `ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK`; the checks ran on the existing `node_modules`).
- `npx vitest run` on the WP-4.3 tests: 17 files, 237 tests passed.

## Not checked

`pnpm test:db` (no local Supabase), the browser tests (never run), the T-21 canary and `pnpm infra:verify` (not built), CI (install fails until the owner's lockfile action).
