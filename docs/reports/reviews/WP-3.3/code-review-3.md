# WP-3.3 code review 3

- Reviewer: code-reviewer subagent, fresh context, read-only on the repository
- Range: the round-2 fixes 9043a9a, 06c39bb, f7261ad (`git show` of each). Branch `wp/3.3-grader` at f65a033, checkout `/private/tmp/claude-501/night-a`.
- Date: 2026-11-24
- Verdict: **APPROVE.** No blocker, no major, four minors. Every round-2 finding the description lists as fixed is fixed. Each new test fails when its fix is removed. The minors are two hook-order gaps (both reachable only by hook chains a program sets up on purpose), one test-only option that nothing enforces, and two stale docs.

## Round-2 findings against the fixes

| Round 2 | Fixed? | Mutant result |
|---|---|---|
| Code MAJOR 1 / Security MAJOR 1: `ready` reported before the pending fresh check was sent | Yes. `send` runs first, so the status goes from `restarting` to `checking`, then `ready` is reported. The second guard on `stop()` was not added, but it is not needed: `pending` is now set only while `current` is the check. | c1 (old order): `× ... a fresh check reaches the new worker before its ready is reported ...  Tests 1 failed \| 34 passed (35)`. c4 (`ready` sent before `send`, status already `checking`): same test fails. |
| Code MINOR 2: a profile hook that puts back a raising trace hook made the harness raise | Yes, for that program | h1 (both inline clears removed): `Tests 9 failed \| 23 passed (32)`. h2 (`set_profile(None)` removed): 9 failed. **h3 (`set_trace(None)` removed) and h4 (order swapped) survive** (MINOR 1). |
| Code MINOR 3 / Security MINOR 2: guards not pinned one at a time | Yes | h5 (outer guard removed): `Tests 10 failed \| 22 passed (32)`, including `× ... a hook that raises only in the harness's own steps ...`. h6 (`set_profile(None)` removed from `restore`): `× [FR-RUN-04] a profile hook that never raises is removed ...`. h7 (guard in `finished` removed): `× ... an exit whose code raises is described from the exit itself ...`. |
| Security MINOR 3: cut output graded `mismatch` | Yes | g1 (rule removed) and g2 (`mismatch` instead): `× [FR-RUN-03] fails at the output limit, even when the kept output would match  Tests 1 failed \| 36 passed (37)` |
| Code MINOR 4 / Security MINOR 7, memory part | Yes | r1: `× [FR-RUN-06] after a memory error the next test case runs on a new thread  Tests 1 failed \| 21 passed (22)` |
| Code MINOR 4 / Security MINOR 7, version part (f7261ad) | Yes | r2 (`parsed.version !== HARNESS_VERSION` removed): `× [FR-RUN-06] a result from another harness version is a crash, and the rest are not run  Tests 1 failed \| 21 passed (22)` |
| Code MINOR 5: boundary mutants | Yes | h8 (`>=`) and h9 (`> limit + 1`): `× ... a missing name that is empty or too long is left out ...`. t1 (limit 13) and t2 (limit 50): `× [FR-GRD-01] accepts 1 to the limit of test cases  Tests 1 failed \| 27 passed (28)` |
| Code MINOR 6: `used = false` in `spawn` untested | Yes | c2: `× [T-22] a worker started after a time limit is new ...  Tests 1 failed \| 34 passed (35)` |
| Code MINOR 7: comments | Yes. `harness.ts:4`, `:19-24`, `:116-121`, `:240-246` and `controller.ts:103-104` now say "must", and that the spec text is an open owner decision. | Not applicable |

Every harness mutant also fails the hash tripwire. The table counts only the behavior tests.

## Findings

**MINOR 1** `src/grader/harness.ts:250-252`, and the test at `harness.test.ts` "a profile hook that puts back a raising trace hook ...". The order and the second call of the fallback's hook clearing are not pinned by any test.
- Problem: the comment says "The hooks are cleared first, before any call that could run them." That holds only in the order `set_profile(None)` then `set_trace(None)`, and only with both calls. The test's tracer raises, and CPython removes a trace hook that raises, so the test passes without the inline `set_trace(None)` (h3) and with the two calls swapped (h4). The only test that fails is the hash tripwire, and it fails on any edit (`Tests 1 failed | 31 passed (32)`).
- Evidence: probe P2 is a tracer that puts back the profile hook and raises, while the profile hook puts back the tracer:
  ```
  import sys
  def tracer(frame, event, arg):
      sys.setprofile(prof)
      raise ValueError('t')
  def prof(frame, event, arg):
      sys.settrace(tracer)
  sys.setprofile(prof)
  ```
  Output in real Pyodide 314.0.7 under Node, through `loadHarness`, on a copy:
  ```
  HEAD:  P2 RESULT {"version":"1","stage":"program","output":"","truncated":false,"error":{"kind":"runtime","message":""}}
         P2-next RESULT {"version":"1","stage":"program","output":"next\n","truncated":false}
  h3:    P2 THREW PythonError / P2-next THREW PythonError
  h4:    P2 THREW PythonError / P2-next THREW PythonError
  ```
- Fix: add P2 as a test. It should return a result, and the next test case should print `next`. It fails under both h3 and h4.

**MINOR 2** `src/grader/harness.ts:143-145` (`restore` clears the trace hook first), and `docs/reports/pull-requests/WP-3.3.md:236`. The description says the reverse order was reverted because "no test could tell the two orders apart". That is not true.
- Problem: when two hooks that never raise put each other back, a program that ends cleanly is graded as a runtime error with no message and no output. In `restore`, `set_trace(None)` runs first. The profile hook then fires on the `c_call` of `set_profile(None)` and puts the tracer back. The tracer stays active for the rest of `run_case`, raises inside the harness, and the fallback replaces the program's real result. With the profile hook cleared first, the result is correct. The next test case is correct either way, so nothing leaks into later cases and the result fails closed. It does not happen without a hook chain written on purpose, so this is a MINOR.
- Evidence (probes P3 and P5 on a copy, HEAD against `restore` with `set_profile(None)` first):
  ```
  P3 = import sys / def tracer(f,e,a): sys.setprofile(prof) / def prof(f,e,a): sys.settrace(tracer) / sys.setprofile(prof)
  HEAD:           P3 RESULT {...,"stage":"program","output":"","truncated":false,"error":{"kind":"runtime","message":""}}
  profile first:  P3 RESULT {...,"stage":"program","output":"","truncated":false}
  P5 (same chain, prints 'mine'):
  HEAD:           P5 RESULT {...,"output":"","truncated":false,"error":{"kind":"runtime","message":""}}
  profile first:  P5 RESULT {...,"output":"mine\n","truncated":false}
  ```
  With the fallback changed to report the exception it caught, the traceback shows where it came from:
  ```
  File "<exec>", line 259, in run_case / File "<exec>", line 100, in restore / File "main.py", line 3, in tracer
  NameError: name 'sys' is not defined.
  ```
- Fix: in `restore`, call `set_profile(None)` before `set_trace(None)`. Add P3 as a test that expects `error: undefined`. Correct the sentence at `WP-3.3.md:236`.

**MINOR 3** `src/grader/node-runner/runner.ts:94-101`. The comment says "only the runner's own tests set" `threadUrl`, but nothing enforces that.
- Who can misuse it: the lint rule (`scripts/eslint/module-boundaries.mjs:48`, `:170-171`) still limits importers of the runner to tests, scripts and the runner itself. Those can already start any `Worker`, so the option gives no new capability. It does not widen any production or learner path. What it adds is an integrity risk: a script that passed a `threadUrl` would get verdicts that never came from Pyodide. The runner still applies `parseHarnessResult`, the version check and `grade`. No caller sets it except `runner.test.ts:172` (`grep -rn threadUrl` found only `runner.ts` and `runner.test.ts`).
- Fix (optional): keep the option off the exported signature. For example, an internal `createRunner(options)` with `createNodeRunner` fixing `THREAD_URL`, and the test importing the internal one through a test-only export. Or add a lint or grep check that only `*.test.ts` passes `threadUrl`. At least update the API row at `docs/reports/pull-requests/WP-3.3.md:28`, which still reads `createNodeRunner({ timeLimitMs })`.

**MINOR 4** `src/runtime/controller.ts:61`. The `ready` event's meaning changed, but the event type does not say so.
- Problem: after 9043a9a, `ready` can arrive while `status` is `checking`, after an isolation restart. Only the inline comment at `:247-249` says this. A consumer that infers "idle" from the event type would show ready during a check. Current consumers read `status` instead. That covers `reduceView` on this branch and on `wp/3.4-statechart`. On `wp/4.3-validate-publish`, `controller-checks.ts` `begin()` returns early because `waiting.runId` is set. So nothing is broken today.
- Fix: add a doc comment to the `ready` variant of `ControllerEvent`: "a worker finished loading; after an isolation restart the controller may already be `checking`; read `status`."

## Checked and found sound

- In the fresh-check test, the listener's `run()` and `check()` are refused with `not_ready`, and `ready` is emitted once. The new worker receives exactly `init` and the check. Stop gives the check its `check_done` and replaces the worker.
- Stop while the fresh worker starts, and a crash while it starts. Read only; existing tests cover them.
- `grade` still sends an error to its own branch before the new truncated rule, so a cut run with a program error stays `program_error`. `parseTestResult` puts no condition on `truncated` for failed results, so the new `output_limit` results parse on the page.
- The stand-in thread (`scripts/testing/other-harness-version-thread.ts`) is erasable TypeScript, passes lint and the type check, and is closed in `finally`.
- `CHECK_TEST_LIMIT` is pinned with literals 12 and 13, citing section 1.3.
- No `.skip`, `.only`, suppression comment, TODO, retry or timeout change in the diff of `src` and `scripts`.
- Attribution: `git log --format=fuller` on 9043a9a~1..f65a033 shows Fahad as author and committer on every commit. A grep for `claude|anthropic|co-authored|generated` in the messages printed `NO_ATTRIB`.

## What was run

- `pnpm verify` at f65a033: exit 0, `Test Files 42 passed (42)`, `Tests 1033 passed (1033)`. pnpm tried a dependency install first, which the sandbox refused (`ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK`); the scripts then ran on the existing `node_modules`.
- Mutants and probes ran in a copy made with `git archive HEAD` under `$TMPDIR`, with `node_modules` linked, not in the checkout. This keeps the repository read-only. On the copy, `./node_modules/.bin/vitest run src/grader src/runtime/controller.test.ts` gave `Tests 166 passed (166)`. Then 20 mutants (c1-c4, h1-h9, g1-g2, t1-t2, r1-r3), each applied, tested and restored. The probe files P1-P5 ran in real Pyodide 314.0.7. The copy was deleted afterwards. `git status --short` in `/private/tmp/claude-501/night-a` is empty.

## Not checked

- Any browser. `e2e/grader-parity-runtime.spec.ts` and the controller's fresh-worker path against a real worker were not run.
- `pnpm build` and the compiled worker.
- The merged WP-3.1 changes between f7261ad and f65a033 (`src/proxy.ts` and others), which are outside this range.
- How the `ready` change interacts with WP-3.4 and WP-4.3 once merged. I only read their branches.
