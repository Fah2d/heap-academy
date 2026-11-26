# WP-3.1 code review 7

- Reviewer: code-reviewer subagent, fresh context, read-only. The implementer saved this report from its final message and added the "Fixed in" lines.
- Range: 1266681, the response to `code-review-6.md`, which reviewed c1114d4 (the `isDisposed()` guards in `restart()` in `src/runtime/controller.ts`).
- Date: 2026-11-24
- Verdict: **APPROVE.** No blockers, no majors, two minors. All five findings of code review 6 are fixed. A probe that disposes at every listener callback, 65 points over 13 scenarios, finds no path that leaves a disposed controller in another status or with a live worker. Each of the four guards has tests that fail when it is removed.

## Findings

**MINOR 1** `src/runtime/controller.test.ts`, the `restarts` table and the report tests.

- Problem: the comment says "Every way a run or a ready worker ends in a restart." The table left out a `fatal` message while ready, which reaches `restart("crashed")` through `crashed()`'s `ready` branch. The report tests covered only a report during a run. On c1114d4, disposing from `report` was also wrong while ready, loading and restarting:
  ```
  BAD fatalReady@2 status=loading live=0 ... report:fatal,AFTER:event:failed
  BAD errLoading@2 status=ready live=1 ... report:worker_error,AFTER:event:failed,AFTER:event:ready
  BAD fatalLoading@1 status=ready live=1 ... report:fatal,AFTER:event:failed,AFTER:event:ready
  BAD errRestarting@5 status=ready live=1 ... report:worker_error,AFTER:event:failed,AFTER:event:ready
  ```
  In loading and restarting, a later `start()` left a live worker with status `ready`.
- Impact: low. The single guard at the top of `crashed()` fixes every one of these states.
- **Fixed** in d2e7ff8: the row "a fatal message while ready", and two tests that dispose from the report of a worker error and of a fatal message while loading. They expect no event, one terminated worker, the status `disposed`, and still `disposed` and no new worker after `start()` and a `ready` message. Removing the `crashed()` guard now fails 4 tests (2 before).

**MINOR 2** `src/runtime/controller.test.ts`, `runDone(setup, runId: string, outcome: object)` and `let runId = ""` in `expectDisposed`.

- Problem: the helper accepted any object as the outcome and a plain string as the run ID. A typo in an outcome would be caught only at run time, as a malformed message. The empty string stood in for "no run".
- **Fixed** in d2e7ff8: `outcome` is a `WorkerOutcome` and the run ID a `RunId | undefined`, both from `protocol.ts`.

## Code review 6 findings, checked

- MAJOR 1, dispose from `run_done` after a normal run kept `ready`: **fixed**. The guard after `finishReported` returns before the memory and output-limit checks and before `status = "ready"`. The new test fails on c1114d4's controller and when this guard alone is removed.
- MINOR 2, dispose from `report` led to `failed` and allowed `start()`: **fixed** by the guard at the top of `crashed()`. Both report tests fail on c1114d4 and when this guard alone is removed.
- MINOR 3, why `isDisposed()` exists: **fixed**; the comment is accurate.
- MINOR 4, coverage of the other `restart()` callers: **fixed**, apart from the fatal-while-ready gap in MINOR 1 above.
- MINOR 5, the misleading comment on `restart()`: **fixed**; replaced by the one comment on `isDisposed()`.

## Checks that passed

- Mutants, each on a copy in `$TMPDIR`, at 1266681:
  - Guard at the start of `restart` removed: 4 failed of 35 (the `run_done` listener after the time limit, `stop`, a worker error during a run, a fatal message during a run). The memory and output-limit rows pass, because the guard after `finishReported` covers them first.
  - Guard after the `restarting` event removed: 7 failed of 35.
  - Guard in `crashed()` removed: 2 failed of 35.
  - Guard after `finishReported` removed: 1 failed of 35.
  - All four removed: 16 failed. The unchanged copy: 35 passed.
- Test first: the new test file against c1114d4's `controller.ts` gives 3 failed, 32 passed, exactly the tests for code review 6 MAJOR 1 and MINOR 2.
- Probe of every disposal point: a listener disposes at the n-th `onEvent` or `report` call, for n from 1 to 12, over 13 scenarios (a run that ends `ok` and then gets an unexpected message, a garbled message and a worker error; a learner runtime error; memory; output limit; the time limit then `stop`; a worker error and a fatal message while running, while ready and while loading; a worker error while restarting; a malformed message and an `input_request`). Each checks the status `disposed`, no live worker, no timers, no callback after dispose, no worker from `start()`, and `run()` refused. On 1266681: no BAD, 65 points. On c1114d4: 11 BAD.
- Every listener call site is safe after a dispose, by reading the code: `progress`, `output`, `malformed`, `unexpected` and `messageerror` return right after the call; `ready` sets the status before it emits; `failed` is the last statement; `finish` and `finishReported` are followed by a guarded `restart()` or the guard after `finishReported`; `fatal` and `worker_error` reach the guarded `crashed()`; messages from a worker that `dispose()` ended are dropped by `live()`.
- Test helpers: `Listeners` and `setUp(listen: Listeners = {})` replace the function parameter; `report` is still recorded before the listener runs.
- Rules: no `eslint-disable`, `ts-ignore` or `ts-expect-error`, no `.skip` or `.only`, no TODO, timeout or retry. Test titles cite FR-RUN-01. `node scripts/check-attribution.mjs --branch` and `--files`: exit 0.

## Outside this range, not counted

- A `run_done` listener that calls `stop()` on the time-limit path still nests one restart inside another, as code review 6 noted. A `run_done` listener cannot call `run()` either: the status is still `running` when `run_done` fires, so the call returns `not_ready`. Both were the same before c1114d4. WP-3.4's statechart should not rely on calling the controller from inside `run_done`.

## What the reviewer ran

- `git show c1114d4`, `git show 1266681`, `git log --format=fuller c1114d4..1266681`, `git status --short` (unchanged before and after).
- `node scripts/check-attribution.mjs --branch` and `--files`: exit 0.
- On a `git archive` copy of 1266681 in `$TMPDIR`: `prettier --check .`, `eslint --max-warnings=0 .`, `tsc --noEmit` exit 0; `vitest run --coverage` exit 0, 37 files, 875 tests; the mutants, the test-first check and the probe.

## Not checked

- The browser tests (`e2e/runtime.spec.ts`) and a real worker.
- `pnpm build`.
- The merge of these guards into `wp/3.3-grader`, which has a different `restart()`.
- d2e7ff8, the fixes for this review's two minors.
