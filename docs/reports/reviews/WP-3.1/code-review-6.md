# WP-3.1 code review 6

- Reviewer: code-reviewer subagent, fresh context, read-only. The reviewer could not write files, so the implementer saved this report from its final message, unchanged in substance, and added the "Fixed in" lines.
- Range: c1114d4, the fix for the note outside the range in WP-3.3 `security-review-3.md`: calling `dispose()` from a `restarting` listener left a worker running, because `restart()` started a new worker after the event.
- Date: 2026-11-24
- Verdict: **CHANGES REQUIRED.** One major, four minors. Both guards are correct. Every path that reaches `restart()` now starts no worker after `dispose()`, and each guard has a test that fails without it. But the most common `run_done` path, a run that ends normally, still overwrote `disposed` with `ready`.

## Findings

**MAJOR 1** `src/runtime/controller.ts:207,214`. FR-RUN-01, the `disposed` status.

- Problem: when a run ends with an outcome other than `memory` or `output_limit` (`ok` or any learner error), `finishReported` emits `run_done`. If a listener disposes there, `receive` then runs `status = "ready"`, so `disposed` is lost. The commit's comment says a listener may dispose from `run_done`, but only the `restart()` paths honoured that.
- Impact: no worker leaks, because `worker` stays `undefined`. But a disposed controller reports `ready`. `start()` refuses it, and `run()` returns `not_ready` only because `worker === undefined`. `use-runtime.ts` passes `created.status` into the view, and `runtime-console.tsx` enables Run on `ready`. Today `dispose` is called only on unmount. The WP-3.4 statechart will read this status.
- Evidence: a probe with the real controller and the test file's fakes, on a copy in `$TMPDIR`:
  ```
  {"on":"run_done","name":"ok","workers":1,"allTerminated":true,"status":"ready","events":["run_done"],"timers":0}
  ```
- Fix: return after `finishReported(...)` when disposed, before the memory and output-limit checks and the `ready` assignment, with a test.
- **Fixed** in the follow-up commit: `if (isDisposed()) return;` after `finishReported`, and the test "dispose from the run_done event of a finished run keeps the status disposed", which also expects `run()` to return `not_ready`.

**MINOR 2** `src/runtime/controller.ts`, `fatal`, `worker_error` and `crashed()`.

- Problem: `fatal` and `worker_error` call `report(...)` before `crashed()`. If the `report` callback disposes, `crashed()` sees `status === "disposed"` and takes the `else` branch. That sets `failed` and emits `failed` after dispose. Because `failed` allows `start()`, a later `start()` starts a live worker on a disposed controller.
- Evidence: probe, `start()` called after the trigger:
  ```
  {"on":"report","name":"crash_running_error","workers":2,"liveWorkers":1,"status":"loading","events":["failed"]}
  {"on":"report","name":"crash_ready_fatal","workers":2,"liveWorkers":1,"status":"loading","events":["failed"]}
  ```
- Impact: small. This needs the error-report callback to dispose and then a later `start()`. `use-runtime.ts` does neither.
- **Fixed**: `crashed()` returns first when disposed. Two tests (a worker error and a fatal message, each disposing from `report`) expect no `failed` event, the status `disposed`, and no new worker after `start()`.

**MINOR 3** `src/runtime/controller.ts`, `isDisposed()`.

- Problem: nothing said why `isDisposed()` exists. It is needed: TypeScript narrows `status` to `"restarting"` after the assignment, so writing `status === "disposed"` inline is a type error:
  ```
  rt/controller.ts(155,9): error TS2367: This comparison appears to be unintentional because the types '"restarting"' and '"disposed"' have no overlap.
  ```
  A maintainer who sees that error may remove the guard as unreachable, or work around it with a cast.
- **Fixed**: the helper's comment says it is a function because TypeScript's narrowing of `status` does not see a listener change it.

**MINOR 4** `src/runtime/controller.test.ts`.

- Problem: the two tests reached `restart()` through the time limit and `stop()` only. The other callers had no dispose test: `crashed()` while running, `crashed()` while ready, `memory` and `output_limit`. A refactor that moved the guards into the callers would go unnoticed.
- **Fixed**: the tests run with `it.each` over seven triggers (time limit, stop, a worker error during a run, a fatal message during a run, a memory error, the output limit, a worker error while ready) for the `restarting` listener, and the six with a run for the `run_done` listener.

**MINOR 5** `src/runtime/controller.ts`, the comment on `restart()`.

- Problem: the comment said "from the `run_done` before this". That reads as if every `restart()` follows a `run_done`. `crashed()` from `ready` calls `restart()` with no `run_done`.
- **Fixed**: one comment, on `isDisposed()`: the `onEvent` and `report` listeners may call `dispose`; after that no worker is started and the status stays `disposed`.

## Checks that passed

- Mutants, each run on a copy in `$TMPDIR`; the repository was not touched:
  - Guard 1 removed: `× [FR-RUN-01] dispose from the run_done event starts no new worker and sends no restarting` (1 failed of 21).
  - Guard 2 removed: `× [FR-RUN-01] dispose from the restarting event starts no new worker` (1 failed of 21).
  - Both removed: 2 failed of 21. The unchanged copy: 21 passed.
- Every `restart()` path, with dispose from `run_done` and from `restarting`: time limit, `stop`, crash while running (`error` and `fatal`), `memory`, `output_limit` each leave one worker, terminated, status `disposed`, no event after the one that disposed, no timers left. Crash while ready, disposing from `restarting`, gives the same result.
- No regression: the 19 earlier controller tests are unchanged and pass. When nobody disposes, `restart()` behaves exactly as before.
- Test helper: `setUp(listen?)` passes the controller to the listener through a closure. It is set before any event can fire, because `createRuntimeController` emits nothing while it is being built.
- Rules: no suppressions, skipped tests, raised timeouts or retries. The test titles cite FR-RUN-01, like the existing dispose test. `git log --format=fuller c1114d4^..c1114d4`: author and committer are both Fahad, with no trailer and no attribution.

## Outside this range, not counted

- A `run_done` listener that calls `stop()` on the time-limit path sees `status` still `running` and starts a second restart inside the first. The probe shows 3 workers created (1 live) and two `restarting` events. There is no leak. The behaviour was the same before c1114d4.
- `wp/3.3-grader` has a different `restart()`, with `checking` and a pending check. The merge there was not reviewed.

## What the reviewer ran

- `git show c1114d4` and `git log --format=fuller`.
- `pnpm vitest run src/runtime/controller.test.ts`: 21 passed.
- `pnpm verify`: exit 0, 37 files, 861 tests. pnpm's pre-script install was blocked by the sandbox (store lock), and pnpm warned that `node_modules` may be out of sync with the lockfile.
- The mutants, the probe of 21 paths and the `tsc` narrowing check, all on copies in `$TMPDIR`.

## Not checked

- The browser tests (`e2e/runtime.spec.ts`) and a real worker.
- `pnpm build`.
- The merge of this fix into `wp/3.3-grader`.
