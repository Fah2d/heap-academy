# WP-3.3 security review 3

- Reviewer: security-reviewer subagent, fresh context, read-only
- Range: 9043a9a, 06c39bb, f7261ad on `wp/3.3-grader`, checked out at f65a033. That commit and the others after f7261ad add only merges and report edits for these files.
- Threats in scope: T-22, T-23, FR-RUN-03, `CLAUDE.md` rule 4 and ADR-0032 (the Node runner stays test-only)
- Date: 2026-11-24
- Verdict: **APPROVE.** No blocker, no major, two minors. The race fix is complete, and the output-limit verdict fix is correct. `threadUrl` can only be reached from the runner's own test. Each new test failed when I put back the bug it covers. The hook-clearing fallback can still be made to raise. When it does, the result is a crash (fail closed), but the comments say this cannot happen.

## Round-2 findings against the fix commits

| Round 2 | Status | Would a regression be caught? |
|---|---|---|
| MAJOR 1: re-entrancy on `ready` during a fresh-worker check | **Fixed.** `status` now goes `restarting` → `checking` before `ready` is emitted. I found no other path to `ready`, or to an accepted run, while a check is pending (see "Found holding"). | Yes. With the 9043a9a `controller.ts` hunk reverted, the new test fails. |
| MINOR 2: the fallback could raise | **Partly fixed.** The reported program now gets a result. A profile hook that does not raise itself can still make the fallback raise (MINOR 1 below). It fails closed. | Yes for the reported case. With the two new lines removed, 9 harness tests fail. |
| MINOR 3: cut output graded `mismatch` | **Fixed.** `grade.ts:202-205`. | Yes. With the old `grade.ts` restored, the grade test fails. |
| MINOR 7: no test for the runner's version check | **Fixed** through `threadUrl` and the stand-in thread. | Yes. With the version condition removed, the new test fails. |

## Findings

**MINOR 1** `src/grader/harness.ts:244-252`, `src/runtime/worker/core.ts:247`. T-22, FR-GRD-01.
- **Problem:** the comment says "The hooks are cleared first, before any call that could run them". That is false. `set_profile(None)` is itself a C call, so the profile hook gets a `c_call` event for it. A profile hook that never raises can use that event to arm a raising trace function on `check`'s own frame. The next line, `set_trace(None)` at :252, then raises out of the `except` block. The comment at :245-246 says only code that rewrites the closure can make the harness raise, and `core.ts:247` still says "The harness never raises". Both are wrong.
- **Impact:** none for verdicts, because this fails closed. The worker posts `fatal runtime_crashed` (tested at `core.test.ts:417-429`) and is replaced. The Node runner reports `crashed` for that test case and `not_run` for the rest. No state leaks: the fallback's result is a fixed constant, and the next `run_case` calls `restore()` first.
- **Evidence:** I ran Pyodide 314.0.7 through `src/grader/node-runner/host.ts`, with the probe outside the repository. A trace function logs each frame to a standard-library module attribute (`json.heap_log`), which survives between test cases (ADR-0004):
  ```
  RAISED ValueError
  next: {"version": "1", "stage": "program", "output": "[('restore', 101, 'line'), ('check', 209, 'line')]\u000a", "truncated": false, "error": null}
  ```
  Line 209 of the Python is `harness.ts:252` (`set_trace(None)`). The first trap fired in `restore` and was caught. The second fired in the fallback and escaped. The same program through the real `createNodeRunner`:
  ```
  A: [["failed","crashed"],["not_run",null]] {"total":2,"passed":0,"failed":1,"notRun":1,"allPassed":false,"timeLimit":false}
  ```
  Probe program A:
  ```python
  import sys
  def T(frame, event, arg):
      raise ValueError('T')
  def P(frame, event, arg):
      if frame.f_code.co_filename != 'main.py':
          sys.settrace(T)
          frame.f_trace = T
          frame.f_trace_lines = True
  sys.setprofile(P)
  ```
  I also checked a variant with `f_trace_opcodes = True`. The harness raised there too.
- **Fix:**
  - Correct the three comments. A profile hook still runs on the call that removes it and can make the harness raise. The worker then gives up with `runtime_crashed` and is replaced, and the runner reports `crashed`.
  - Correct the PR description's "before any other call".
  - Optionally, have the host clear the hooks from JavaScript before giving up. A call made from JavaScript has no Python frame, so no `c_call` event should fire. Not verified.
  - Add program A as a harness test that expects the harness to raise, so the documented limit is pinned.

**MINOR 2** `src/grader/harness.ts:29-30`, `src/grader/harness.test.ts:313-320`. FR-GRD-04, and "no check was weakened".
- **Problem:** 06c39bb changes the Python. It updates the pinned hash from 74732271 to 3388004850 but keeps `HARNESS_VERSION = "1"`. The test's title says the hash "is updated together with HARNESS_VERSION". `harness.ts:29` says "Change it with any change to the Python below". The test comment says "A stale cached worker is refused only if the version moves with the Python." The check was met by updating the pin, which is what the test is meant to stop.
- **Impact:** small today. The harness is not on `main` (`git show main:src/grader/harness.ts` → "exists on disk, but not in 'main'"). Deploys are off. Worker files are served `Cache-Control: no-cache` (`security-headers.ts:149`).
- **Evidence:**
  ```
  -    expect({ version: HARNESS_VERSION, hash }).toEqual({ version: "1", hash: 74732271 });
  +    expect({ version: HARNESS_VERSION, hash }).toEqual({ version: "1", hash: 3388004850 });
  ```
- **Fix:** bump to `"2"`. Or record in the test and the header that versions count from the first release, and that until then only the hash moves. That needs the owner's decision.

## Found holding

- **Race fix.** I drove the real `createRuntimeController` with fake workers, from my own vitest root:
  ```
  S1 stop() from the isolation restarting event  -> check_done run-2; new worker got ["init:"]; status ready
  S2 run()/check() from the restarting event     -> {"ok":false,"error":"not_ready"} both; new worker got ["init:","check:run-2"]; status checking
  S3 check(fresh)/run() from check_done of a stopped pending check -> not_ready both
  S4 fatal after the pending check was sent      -> check_done; restarting crashed; w2 terminated true
  S6 time limit in the sent check, then fresh check -> workers 3, status checking (new worker used as is)
  ```
  - **Where `status` becomes `ready`.** It is set at three places:
    - `:255`: now only when nothing is pending.
    - `:280`: needs `current.kind === "run"` with a matching `runId`.
    - `:313`: needs a `check_done` for the current check, and the only worker that can send one during the wait has run nothing but `init`.
  - **Old workers.** Their messages are dropped (`live()`).
  - **The pending branch in `stop()`.** It still does not test `current?.kind === "check"` (my round-2 suggestion). That is unreachable: every path that clears a pending check's `current` also clears `pending`.
- **Fallback leaks no state:** its result is a fixed failed `runtime` result, so it can never pass.
- **`grade`:** an error still takes precedence; a cut result can no longer pass; this is not a weakening (the old behaviour was `mismatch`, also a failure).
- **`threadUrl`:**
  - **Callers.** The only call that passes it is `runner.test.ts:172`, with a literal `new URL(...)`. Nothing builds a URL from data, and `scripts/` has no caller. The lint rule still keeps any non-test `src/` import of `grader/node-runner` out, and it was not changed for these commits.
  - **Build output.** The on-disk build (BUILD_ID at 03:59, after f7261ad; `public/_runtime/worker/grader/harness.js` already contains the new `set_profile(None)` fallback) has no runner symbols in `.next/server`, `.next/static` or `public/_runtime`. The only `worker_threads` hit is Turbopack's own runtime (`var { workerData } = require('worker_threads');`). `public/_runtime/worker` still holds the same 11 files.
  - **Hardening, optional.** The type accepts any `URL`, including `data:`. If you want to harden it, refuse a `URL` whose protocol is not `file:`.

## What was run

- **Tests:**
  ```
  $ ./node_modules/.bin/vitest run src/runtime/controller.test.ts src/grader
   Test Files  6 passed (6)
        Tests  166 passed (166)
  $ pnpm verify
  exit 0
  All matched files use Prettier code style!
   Test Files  42 passed (42)
        Tests  1033 passed (1033)
  ```
  pnpm's pre-script install (`verifyDepsBeforeRun`) tried to run and was blocked by the sandbox (`ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK`), so nothing was installed. pnpm warned that `node_modules` "may be out of sync with your lockfile". Not checked further.
- **Mutants.** Each was restored with `git checkout -- <file>`.
  - Revert the 9043a9a `controller.ts` hunk → `× [T-22] [T-23] [FR-RUN-02] a fresh check reaches the new worker before its ready is reported…` (1 failed of 35).
  - Delete `harness.ts:251-252` → 9 failed, including `× … a profile hook that puts back a raising trace hook gives a result…`.
  - Revert the 06c39bb `grade.ts` hunk → `× [FR-RUN-03] fails at the output limit, even when the kept output would match` (1 failed of 37).
  - Drop `|| parsed.version !== HARNESS_VERSION` in `runner.ts` → `× [FR-RUN-06] a result from another harness version is a crash, and the rest are not run` (1 failed of 22).
- **Lint:** `eslint --max-warnings=0` on the six changed source files and the stand-in → exit 0.
- **Probes:** Pyodide 314.0.7 under Node 26.13.1, plus the two vitest probes. All live in `$TMPDIR/sr3`, outside the repository.
- **Final state:** `git status --short` is empty, HEAD is f65a033.

## Not checked

- Any browser: `freshWorker` against a real worker, and the parity e2e.
- A fresh `pnpm build`. I grepped the existing build and did not rebuild.
- Clearing hooks from JavaScript as a fix for MINOR 1.
- Round-2 MINORs 1, 4, 5 and 6, which are under "Not fixed, for you" and were not re-tested here.

Outside this range, not counted: calling `dispose()` from a `restarting` listener leaves a worker running after dispose, because `restart()` calls `spawn()` after the event. No learner code can run in it, and `use-runtime.ts` calls `dispose` only on unmount.
