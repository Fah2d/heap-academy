# WP-3.3 code review 2

- Reviewer: code-reviewer subagent, fresh context, read-only
- Range: the round-1 fixes 1da8b48..bce0f08 (3eab1b2, 95abb5a, bce0f08). Branch `wp/3.3-grader` at 67787b4.
- Date: 2026-11-24
- Verdict: **CHANGES REQUIRED.** No blocker, one major, six minors.

## Round-1 findings, checked against the fixes

| Round 1 | Fixed? | Does its test fail without the fix? |
|---|---|---|
| MAJOR 1: the harness raises | Partly. Both probes from round 1 now return a result. A hook chain still makes `check()` raise (MINOR 2). | No. Removing the outer guard in `check` (m1), the `try` in `finished` (m2), or `set_profile(None)` (m3) fails only the hash tripwire, which fails on any edit. |
| MAJOR 2: typo reported as a missing name | Yes, also for generator expressions in the follow-up code. | Yes (m6). |
| MINOR 1: output cap and name bounds | Yes, for the parser's bounds: the result is cut again at the end. | Subclass test: yes (m7). Final cut: yes (m5). Name limit: no off-by-one test (MINOR 5). |
| MINOR 2: recursion limit and hooks | Yes. | Recursion limit and trace hook: yes (m9, m8). Profile hook: no (m3). |
| MINOR 3: builtins clear untested | Yes. | Yes (m10). |
| MINOR 4: limit of 50 | Yes, 12. | No test pins 12 (MINOR 5). |
| MINOR 5: browser test's own clock | Said so in the file; listener leak fixed. | Not applicable. |
| MINOR 6: version bump | A hash tripwire is in place. | Yes. |
| MINOR 7: titles and path | Yes. | Not applicable. |
| MINOR 8: runner and worker disagree | Code changed. | No. Neither runner change has a test (m12, m13; MINOR 4). |
| MINOR 9: evidence | Yes. `Tests 1002 passed (1002)` reproduced at HEAD. | Not applicable. |

`HARNESS_VERSION` is still "1" although the Python changed. No version has shipped, so this is not a finding.

## Findings

**MAJOR 1** `src/runtime/controller.ts:244-257` and `:399-405`: during a `freshWorker` check, the controller emits `ready` while a check is in flight. A page that reacts to `ready` gets its run accepted. The check is then orphaned, and Stop stops nothing.

- Cause: on the new worker's `ready`, the code sets `status = "ready"` and emits `ready` before it sends the pending check. Any listener that calls `run()` or `check()` inside that event is accepted, and `current` is overwritten. After that `pending` stays set forever; the check never reaches a worker; `stop()` takes the `pending` branch, its `endCheck` does nothing because `current` is a run, and it returns, so the running program is not stopped (FR-RUN-02).
- A view built from events, like `reduceView` in `runtime-view.ts:38`, also shows "ready" during the check until the first `test_result`.
- Probe (real controller, fake worker): one run, then `check(..., { freshWorker: true })`, then a listener that calls `run()` on `ready`, then `stop()`:
  ```
  ready (status ready)
  run_done (status running)
  restarting:isolation (status restarting)
  ready (status ready)
  run() -> {"ok":true,"runId":"run-3"}
  check request {"ok":true,"runId":"run-2"} final status running
  new worker received ["init","run"]
  after stop(): [] status running
  ```
- No test looks at the events of a fresh check.
- Fix: when a check is pending, send it and set `checking` before emitting anything, or do not emit `ready` for that restart. Guard the `pending` branch of `stop()` with `current?.kind === "check"`. Test the event sequence, and that `run()` called from a listener in that window is refused.

**MINOR 2** `src/grader/harness.ts:141-143` and `:241-249`: "the harness never raises" is still not true. A profile hook that re-installs a raising trace hook gets past the outer guard, and every later check on that interpreter then raises too.

- Cause: `restore()` clears the trace hook before the profile hook. The profile hook fires on `restore`'s own call and on each C call, and puts the tracer back. The guard in `check` then calls `restore()` and `result()`, which are Python calls, so the tracer fires again.
- Probe (real harness, Pyodide 314.0.7 under Node):
  ```
  import sys
  def tracer(frame, event, arg):
      raise ValueError('t')
  def prof(frame, event, arg):
      sys.settrace(tracer)
  sys.setprofile(prof)
  ```
  ```
  chain THREW ValueError PythonError 1
  next-1 THREW ValueError PythonError 1
  next-2 THREW ValueError PythonError 1
  ```
- Effect: in the worker, `fatal runtime_crashed` and a restart; in the Node runner, a discarded thread. Needs deliberately hostile code and harms only the learner's own results.
- Fix (checked on a copy of `HARNESS_SOURCE`): in `restore`, call `set_profile(None)` before `set_trace(None)`; in the `except` of `check`, call `set_profile(None)` and then `set_trace(None)` inline, before any Python call. Output of the fixed copy:
  ```
  fixed chain {"version": "1", "stage": "program", "output": "", "truncated": false, "error": {"kind": "runtime", "message": "", "line": null, "name": null}}
  fixed next {"version": "1", "stage": "program", "output": "next\u000a", "truncated": false, "error": null}
  ```
  Add this program as a test. Also say in the harness header that the fallback reports stage `program` with an empty message and no output, even when the failure came in the follow-up code.

**MINOR 3** `src/grader/harness.test.ts:202-214`: the two "never raises" tests do not pin the code they were written for. The guards mask each other, and the profile hooks used in the tests raise, so CPython removes them anyway. Mutants m1, m2 and m3 each fail only the hash tripwire (`Tests 1 failed | 27 passed (28)`).
- Fix: three tests. A hook that raises only in the harness's own frames, which reaches the outer guard. A profile hook that never raises, with `sys.getprofile() is None` asserted in the next case. `finished` on the `Odd` exit, asserting the full error including the message `Odd`, which the fallback would not give.

**MINOR 4** `src/grader/node-runner/runner.ts:107` and `:121-122`: the two runner changes for round-1 MINOR 8 have no tests.
  ```
  m12-runner-no-version: vitest exit 0 ::  Tests 20 passed (20)
  m13-runner-no-memory-discard: vitest exit 0 ::  Tests 20 passed (20)
  ```
- Fix for the memory change: case 1 `import json; json.marker = 1; raise MemoryError`; case 2 `import json; print(hasattr(json, "marker"))` must print `False`. For the version check: a test seam, or say in the description that it is untested.

**MINOR 5** Limits a boundary mutant gets past:
- `harness.ts:206`: `length(name) > name_limit` changed to `>=` still passes (m4). Add a name of exactly 200 characters, which is kept today.
- `test-case.test.ts:117,121`: the tests use `CHECK_TEST_LIMIT` itself, so a return to 50 passes. Pin 12 with literals, citing section 1.3.

**MINOR 6** `src/runtime/controller.ts:333`: `used = false` in `spawn` has no test (`c4-spawn-keeps-used: vitest exit 0 :: Tests 33 passed (33)`). Without it, a fresh check after a time limit or crash restart would replace a worker that is already new. Fix: test time limit, restart, ready, then a fresh check, and expect no third worker.

**MINOR 7** Comments that state what is not true or not yet built:
- `harness.ts:22-23` "Validate starts a new worker for each program (`freshWorker`)" and `controller.ts:102-103` "so Validate uses this for every program". No Validate exists, and whether WP-4.3 must use it is owner action 3. Write "must", and cite the open decision.
- `harness.ts:117-118` says the count is "not on the stream the program can reach". `type(sys.stdout).write.__closure__` reaches the state dict; setting `state['room'] = 10**12` and printing 100,000 characters still gave a cut result with `truncated: true`, so the parser's bound holds only because of the final cut, and memory is not bounded on that route. Reword the comment.

## Checked and found sound

- The controller's `freshWorker` paths for Stop and for a crash while the new worker starts, and the `used` flag after `run` and `send` (mutants c1, c2, c3 caught).
- A low `sys.setrecursionlimit` (4 to 40) in one case leaves the harness and the next case working.
- `parseHarnessResult` takes a missing name only at stage `after_code` (m11 caught).
- The lint rule: `.test` matching works; the computed-import exemption is limited to `runtime/worker/python-worker`; a computed `require` is reported everywhere.
- The e2e listener cleanup.
- Attribution: Fahad is author and committer on all three commits; no credit patterns; no `.skip`, `.only`, suppression, retry or TODO.

## What was run

- `pnpm verify` at 67787b4: exit 0, `Test Files 41 passed (41)`, `Tests 1002 passed (1002)`.
- `pnpm vitest run src/grader src/runtime/controller.test.ts scripts/eslint/rules.test.ts`: exit 0, `Test Files 7 passed (7)`, `Tests 295 passed (295)`.
- 17 mutants, each applied, tested and reverted; `git status --short` empty afterwards.
- Harness probes in real Pyodide 314.0.7 under Node 26.13.1, and a controller probe through jiti, all outside the repository.

## Not checked

- No browser, so `e2e/grader-parity-runtime.spec.ts` did not run.
- `pnpm build`.
- The compiled worker under lock-down; its behavior after MINOR 2 comes from reading `core.ts`.
