**Base: `wp/3.1-python-worker`; merges after WP-3.1.** `main` is at 0efe863 (#3 to #8). `wp/3.1-python-worker`, which carries that `main` since 5f72072, is merged into this branch (last in df1c7bb, at aec6c83), so until WP-3.1 merges this pull request also shows WP-3.1's commits. It is a **draft**: the browser tests have run in Chromium only (on 459c0c3: the 13 parity cases and WP-3.1's 15 runtime tests pass), not in Firefox or WebKit. Review round 3 on the round-2 fixes: code and security both **APPROVE**; their six minors are answered in b67f730 or listed for you. Security review 4 (the restore of `sys.monitoring`, `gc.callbacks` and the other hooks, 203b6bb to 3fa2bd3): **APPROVE** in round 5; its last minor is answered in 3fa2bd3. Security review 5 (the garbage collector's state, 853f0c1 to 5649d7a): **APPROVE** in round 2; its two minors are answered in 5649d7a. Security review 6 (collecting until nothing is left, 65af875 to ff9e6eb): **APPROVE** in round 2; its two minors are answered in ff9e6eb, which security review 7, round 2, has seen. Security review 7 (each test case starts with the harness's collections, 3ab21e9 to be9375c): **APPROVE** in round 2, on d757f11 and ff9e6eb; its two minors are answered in be9375c, which round 3 approved with no findings.

## What and why

The grader of `04-content-system.md` sections 2 and 3: one test case model, three comparison modes, a Python harness that runs each test case in isolation and never raises, a Node runner for the tests, `check` in the worker protocol, and a parity suite that runs the same cases under Node and in three browser engines.

1. **The test case schema and its limits** (FR-GRD-01). One hand-written parser, used by the worker, the page and the Node runner. A refusal names the field and, in a list, the test case.
2. **The comparison modes** (FR-GRD-03): `normalized`, `exact`, `contains`, in TypeScript, with property tests.
3. **The Python harness**: section 2.2 for one test case, with section 5.5's isolation. Standard library only, versioned, and every outcome a structured result. The worker and the Node runner evaluate the same text.
4. **The Node runner** (section 3.2): Pyodide in a Node worker thread, with the browser's time limit behavior. Test-only (ADR-0032).
5. **`check` in the worker protocol**: `check`, `test_result`, `check_done`, and `init.harnessVersion`. The controller gives each test case its own 5 second clock.
6. **The parity suite** (FR-GRD-04): 13 lessons and programs with the verdict each test case must get. The section 7 example lesson is among them. One file runs them through the Node runner, and one through the real worker in Chromium, Firefox and WebKit.

## Work package

- Work package: WP-3.3 The grader.
- Requirements: FR-GRD-01, FR-GRD-03, FR-GRD-04, FR-RUN-04, NFR-MAINT-02, NFR-PERF-06.
- Time box 3 hours. Started 06:22 on 2026-11-20; last commit before review 06:40; review fixes done at 06:57. The time box was not reached.

## What changed

| Item | Where |
|---|---|
| Test case model: `id`, `name` (1 to 80 characters, not blank), `stdin` (2,000), `afterCode` (2,000), `expected` (5,000), `match` (default `normalized`), `hint` (200). Limits count characters as a reader does. Absent `stdin`, `afterCode` and `hint` are empty. Null is never valid. A check carries 1 to 12 test cases with distinct IDs, the lesson's limit (section 1.3). | `src/grader/test-case.ts` |
| Comparison. `normalized`: `\r\n` and `\r` become `\n`, each line loses trailing whitespace (`trimEnd`, which includes Unicode spaces), trailing blank lines go; leading whitespace and case stay. `exact`: the same text. `contains`: the normalized expected text appears in the normalized output. | `src/grader/compare.ts` |
| The harness, `HARNESS_VERSION` "3". Per test case: restore builtins, the module table and the streams; a fresh `__main__` namespace; `stdin` from the test case; the program; then, if it finished without an error, the follow-up code in the same namespace. Output is captured up to 64,000 characters; past that a write keeps what fits and raises an exception the program's `except Exception` cannot catch. The count lives in the harness, not on the stream, a text subclass is counted as text, and the result is cut to the limit again whatever the program did. Standard error is discarded. `exit()`, `exit(0)` and `exit(False)` count as finishing; an exit whose code cannot be read does not. The result says which stage failed, with the error's kind, summary, the learner's line, and, when the follow-up code itself names something the program did not define, the missing name ("This test needs something named `area`"), 1 to 200 characters. A misspelled name inside the learner's function is the learner's error at its line. Builtins, the module table, the streams, the import lists (`sys.path`, `sys.meta_path`, `sys.path_hooks`, `sys.path_importer_cache`), the recursion limit, the integer digit limit, the trace and profile hooks, the `sys.monitoring` tools, `gc.callbacks`, the async generator hooks and the exception, unraisable, display and breakpoint hooks are restored after the program, again after a garbage-collection pass, and before the next case; each restore ends with an identity check of all of them, and the harness raises (fails closed) when the state is not back, and nothing after learner code starts looks a builtin up by name. If learner code still makes a harness step raise, the harness restores the state and returns a runtime error for the program. When the state cannot be put back (a hook chain, a callback that keeps moving, a `__del__` that changes the state while it is restored), the harness raises, and its caller replaces the runtime (`runtime_crashed` in the worker, `crashed` in the Node runner). The result is built without `json`. A test pins a hash of the Python next to the version, so the version cannot be forgotten. | `src/grader/harness.ts` |
| Verdicts. A test case passes when nothing failed and the output matches under its mode. It fails with `mismatch`, `program_error`, `after_code_error` or `output_limit`, decided from the harness's result, or `time_limit`, `stopped` or `crashed`, decided by whoever owns the clock. After a time limit, Stop or a crash, the rest are `not_run`. The summary counts each and says whether every test case passed and whether one reached the time limit (validation rule 5). | `src/grader/grade.ts` |
| Node runner: `createNodeRunner({ timeLimitMs, threadUrl })` (`threadUrl` is set only by the runner's own test) with `check(source, testCases)` and `close()`. The thread loads Pyodide from the `pyodide` package and evaluates the harness. At the limit, when the thread dies, or after a memory error, the thread is terminated and the next check starts a new one. A result of another harness version is a crash, as in the worker. | `src/grader/node-runner/` |
| Lint: `src/grader/node-runner/` is exempt from purity, and only it, tests and scripts may import it (ADR-0032, built here as that ADR says). Only a test may import a test file, so a test cannot pass the runner on. An `import()` or `require` whose source is computed is refused, except the worker's one import of Pyodide from its asset base. | `scripts/eslint/module-boundaries.mjs`, `eslint.config.mjs` |
| Protocol: `init { assetBase, harnessVersion }`; `check { runId, source, tests }`; `test_result { runId, result }`; `check_done { runId, summary }`. Test cases, results and summaries are parsed by the grader's parsers. A summary whose counts do not add up is refused. | `src/runtime/protocol.ts` |
| Worker: evaluates the harness at load. Refuses an `init` whose harness version is not its own (`fatal version_mismatch`), so a page never trusts a stale cached worker's verdicts. For `check`, closes the runtime's own streams, runs each test case, posts each result as it is decided, then the summary. A harness result it cannot parse, or of another version, means the runtime is broken (`fatal runtime_crashed`). | `src/runtime/worker/core.ts` |
| Controller: `check(source, tests)`, status `checking`. The clock restarts with every result, so each test case gets 5 seconds. At the limit, on Stop, or when the worker dies, the running test case fails with that reason, the rest are not run, and a new worker starts. A result out of order, or a summary that disagrees with the results, means the worker is broken. A memory error in any test case starts a new worker after the check. `check(source, tests, { freshWorker: true })` first replaces a worker that has run anything (restart reason `isolation`), for Validate (T-22, T-23); Stop or a crash while that worker starts ends the check. | `src/runtime/controller.ts` |
| The worker now compiles from `src`, so it can import the grader. Its URL moves to `/_runtime/worker/runtime/worker/python-worker.js`; the headers match `/_runtime/worker/` by prefix and are unchanged. | `tsconfig.worker.json`, `src/runtime/assets.ts` |
| The example lesson of section 7, and the parity cases. | `src/grader/example-lesson.ts`, `src/grader/parity-cases.ts` |
| Property testing: a seeded generator and `forAll`, outside `src` so the pure modules' tests can import it. | `scripts/testing/property.ts` |
| The development page shows the new `checking` status; it sends no checks. | `src/features/workspace/client/runtime-view.ts`, `src/messages/runtime-dev.ts` |

## Up to date with main

`wp/3.1-python-worker` at aec6c83 is merged in df1c7bb. Since the last merge (9e1a9dc, at e3c39b7) it adds WP-3.1's fix for a listener that disposes the controller (c1114d4, 1266681, d2e7ff8), WP-3.1 code reviews 6 and 7, and the docs. `main` is still 0efe863 (#3 to #8). Three conflicts:

- `src/runtime/controller.ts`, `crashed()`: WP-3.1's guard at the top kept, then this branch's waiting-check branch, with a new guard after its `endCheck("crashed")`. The merge also adds guards after the `test_result` event and after `completeCheck` in `check_done`, which WP-3.1 does not have.
- `src/runtime/controller.test.ts`: both imports kept; the test helper took WP-3.1's `listen` listeners, and 89fb157 then removed this branch's `onEvents` array.
- `docs/reports/local-build-progress.md`: WP-3.1's copy taken, as the newer one.

Code review 4 on df1c7bb: CHANGES REQUIRED, 4 MINOR, all fixed in 89fb157 (see Reviews). No reviewer has seen 89fb157.

`pnpm verify` on 89fb157, exit 0:

```
 Test Files  42 passed (42)
      Tests  1066 passed (1066)
```

`pnpm build` with CI's fake public values on 89fb157, exit 0. `node scripts/check-bundle.mjs .next/static` and `node scripts/check-static.mjs .next`: exit 0. Also on df1c7bb: `pnpm verify` exit 0 (42 files, 1065 tests), `pnpm build` exit 0 (`runtime: pyodide 314.0.7, 13531207 bytes, 5464072 with Brotli (budget 6500000)`, `runtime: worker compiled`), both checks exit 0.

Not run on the merge: the browser tests.

## How it was verified

**Security review 7, round 2 fix (be9375c), 2026-11-24.** A test reads `builtins` on the interpreter after `check()` returns, so it fails without `state = None`; two comments inside the Python text name both causes of a failed start collection. `HARNESS_VERSION` is "7". On be9375c with `state = None` removed, `src/grader/harness.test.ts`: `Tests 2 failed | 81 passed (83)` (the new test and the hash pin); with it back, `Tests 83 passed (83)`. `pnpm verify` on be9375c, exit 0:

```
 Test Files  42 passed (42)
      Tests  1115 passed (1115)
```

`pnpm build` with CI's fake public values on be9375c: exit 0 (`runtime: pyodide 314.0.7, 13531207 bytes, 5464072 with Brotli (budget 6500000)`, `runtime: worker compiled`); the built `public/_runtime/worker/grader/harness.js` has `HARNESS_VERSION = "7"`; `node scripts/check-bundle.mjs .next/static` and `node scripts/check-static.mjs .next`: exit 0. Not run: the browser tests.

**Security review 7 fix (3ab21e9, d757f11), 2026-11-24.** `run_case` starts with `collect_all()` instead of a bare `restore()`. In the Node runner's thread a JavaScript timer one test case set fires before the next case's message; before, its callback could make a reference cycle whose `__del__` wrote into the next case's output. `HARNESS_VERSION` is "6". `pnpm verify` on d757f11, exit 0:

```
 Test Files  42 passed (42)
      Tests  1114 passed (1114)
```

`pnpm build` with CI's fake public values on d757f11: exit 0; `node scripts/check-bundle.mjs .next/static` and `node scripts/check-static.mjs .next`: exit 0; the built `public/_runtime/worker/grader/harness.js` has `HARNESS_VERSION = "6"`. The new test, `what a timer callback does between test cases is undone and collected before the next one` in `src/grader/node-runner/runner.test.ts`, failed on the parent with the second case's output `True True\nINJECTED ok\n`; that run is also the mutant of the fix (start with `restore()` again). The reviewer reproduced the same on the reverted harness and ran the fixed one on 25 fresh threads, all passing. Not run: the browser tests.

**Security review 6 fixes (65af875 to ff9e6eb), 2026-11-24.** At the end of each test case the harness now restores, then collects and restores until a collection finds nothing, and raises `Uncollected` (a `NotRestored` that the fallback re-raises) after eight passes. The fallback in `check()` runs after the except block and collects the same way; any failure there makes the harness raise. `run_case` drops the capture's state before collecting. `HARNESS_VERSION` is "5". Before, a chain of `__del__` methods, each making a new reference cycle, ran its next link in the next test case's own collection and wrote into that case's output. `pnpm verify` on ff9e6eb, exit 0:

```
 Test Files  42 passed (42)
      Tests  1113 passed (1113)
```

`pnpm build` with CI's fake public values on ff9e6eb: exit 0; `node scripts/check-bundle.mjs .next/static` and `node scripts/check-static.mjs .next`: exit 0; the built `public/_runtime/worker/grader/harness.js` has `HARNESS_VERSION = "5"`. Six new tests; each fails on the code before its fix (the first two and the fallback test on 5649d7a, the reviewers' probes on 65af875 and c694902). Mutants of `src/grader/harness.ts`, each run against `src/grader/harness.test.ts` and then restored; each fails at least one test other than the hash pin: one collection in `run_case`; no `except Uncollected`; no collection in the fallback; the fallback's collection failure swallowed; `return` instead of `raise Uncollected()`; no restore inside the loop; the fallback moved back into the except block; no restore before the first collection; no `state = None`. Two survive, both equivalent: `Uncollected` not a subclass of `NotRestored` (the fallback re-raises it by name), and restore-then-collect inside the loop (safe with the leading restore). Not run: the browser tests.

**Security review 5 fixes (853f0c1 to 5649d7a), 2026-11-24.** Between test cases the harness now restores the garbage collector's thresholds, enabled state, debug flags and saved garbage (`gc.garbage`), checks them in `intact()`, and keeps the collector off from the start of the restore until the check has passed. `HARNESS_VERSION` is "4". `pnpm verify` on 5649d7a, exit 0:

```
 Test Files  42 passed (42)
      Tests  1106 passed (1106)
```

`pnpm build` with CI's fake public values on 5649d7a: exit 0; `node scripts/check-bundle.mjs .next/static` and `node scripts/check-static.mjs .next`: exit 0; the built `public/_runtime/worker/grader/harness.js` has `HARNESS_VERSION = "4"`. Mutants of `src/grader/harness.ts`, each run against `src/grader/harness.test.ts` and then restored; each fails at least one test other than the hash pin: no `disable_gc()` in `restore()`; no enabled check; an unconditional `enable_gc()`; no re-enable; no restore of the saved garbage, of the debug flags or of the thresholds; `intact()` without the debug flags, the thresholds or the saved garbage; the fallback without its two collector calls. Not run: the browser tests.

**Security review 4 fixes (203b6bb to 3fa2bd3), 2026-11-24.** `pnpm verify` on 3fa2bd3, exit 0:

```
 Test Files  42 passed (42)
      Tests  1098 passed (1098)
```

`pnpm build` with CI's fake public values: exit 0; `node scripts/check-bundle.mjs .next/static` and `node scripts/check-static.mjs .next`: exit 0; the built `public/_runtime/worker/grader/harness.js` has `HARNESS_VERSION = "3"`. `src/grader/harness.test.ts` passed 6 runs of 6 on 3fa2bd3 (the line-cache test of 7468f65 had failed 1 run in 5; see Reviews). Mutants of `src/grader/harness.ts`, each run against `src/grader/harness.test.ts` and then restored; each fails at least one test other than the hash pin:

| Mutant | A test that fails |
|---|---|
| `plain_keys` accepts a `str` subclass | `a builtin key of a str subclass makes the test case a runtime error` |
| `plain_keys` after the lookups in `same_dict` | `the restore check looks at the key types of a builtin before any lookup` |
| `plain_keys(sys_dict)` after the sys-name loop | `the restore check looks at the key types of a sys name before any lookup` |
| No profile-hook check, no digit-limit check, no finalizer check, no tool check | the table row for that part |
| No line-cache restore and no line-cache check | `a line cache key the program leaves does not run its __eq__ in the next test case` |
| No line-cache check | `a __del__ that changes the line cache after its restore makes the test case a runtime error` |
| The module table emptied name by name (the old loop) | `the module table is cleared without hashing the program's keys` |

**Review round 3 fixes (b67f730), 2026-11-24.** `pnpm verify`, exit 0:

```
 Test Files  42 passed (42)
      Tests  1036 passed (1036)
```

`pnpm build` with CI's fake public values: exit 0; `node scripts/check-bundle.mjs .next/static`: exit 0; the built `public/_runtime/worker/grader/harness.js` has `HARNESS_VERSION = "2"`. Mutants of `src/grader/harness.ts`, each run against `src/grader/harness.test.ts` and then restored:

| Mutant | First new test that fails |
|---|---|
| Fallback clears the trace hook before the profile hook | `a raising trace hook that puts back the profile hook gives a result` (11 failed of 35) |
| Fallback without `set_trace(None)` | the same (11 failed of 35) |
| `restore` clears the trace hook first (the old order) | `two hooks that put each other back and never raise leave a clean program's result as it is` (2 failed of 35, with the hash pin) |

**The runner's version check test (f7261ad), 2026-11-24.** `pnpm verify` on f7261ad, exit 0:

```
 Test Files  42 passed (42)
      Tests  1013 passed (1013)
```

`pnpm build` with CI's fake public values, exit 0; `check-bundle` and `check-static`, exit 0. With the version check removed from `runner.ts`:

```
     × [FR-RUN-06] a result from another harness version is a crash, and the rest are not run 26ms
-     "reason": "crashed",
-     "status": "failed",
+     "status": "passed",
-     "status": "not_run",
+     "status": "passed",
      Tests  1 failed | 21 skipped (22)
```

**Round 2 review fixes (9043a9a, 06c39bb), 2026-11-24.** `pnpm verify` on 06c39bb, exit 0:

```
 Test Files  41 passed (41)
      Tests  1009 passed (1009)
```

`pnpm build` with CI's fake public values on 06c39bb, exit 0; `check-bundle` and `check-static`, exit 0. Each new test was run against a mutant of its fix, or against the code before it, and failed:

```
controller, before the fix:   × a fresh check reaches the new worker before its ready is reported ...  Tests 1 failed | 34 passed (35)
controller, used = false removed:   × a worker started after a time limit is new ...  Tests 1 failed | 34 passed (35)
harness, before the fix: the hook-chain test and every later test on that interpreter failed (9 failed)
harness, outer guard removed:   Tests 10 failed | 22 passed (32)
harness, finished guard removed:   × an exit whose code raises is described from the exit itself ...
harness, set_profile(None) removed from restore:   × a profile hook that never raises is removed before the next test case
harness, name limit > changed to >=:   × a missing name that is empty or too long is left out ...
harness, inline hook clear removed:   Tests 9 failed | 23 passed (32)
runner, memory discard removed:   × after a memory error the next test case runs on a new thread  Tests 1 failed | 20 passed (21)
grade, before the fix:   × fails at the output limit, even when the kept output would match
```

Each mutant run also failed the hash test, which fails on any edit to the Python. The browser tests had not run then (Chromium results below).

**Up to date with main.** `wp/3.1-python-worker` at a288083 (WP-3.1 with `main` merged in) is merged into this branch (6f0cfe8), with no conflict. `pnpm verify` on 6f0cfe8, exit 0:

```
$ prettier --check .
All matched files use Prettier code style!
$ eslint --max-warnings=0 .
$ tsc --noEmit
$ node scripts/check-attribution.mjs --branch && node scripts/check-attribution.mjs --files
$ vitest run --coverage
 Test Files  37 passed (37)
      Tests  951 passed (951)
```

`npx playwright test --list --project=runtime-chromium`: "Total: 28 tests in 2 files". The browser tests had not run then (Chromium results below).

Before the merge:

`pnpm verify` on the review fixes (the last commit of this branch):

```
$ pnpm format:check && pnpm lint && pnpm typecheck && pnpm attribution && pnpm test
$ prettier --check .
All matched files use Prettier code style!
$ eslint --max-warnings=0 .
$ tsc --noEmit
$ node scripts/check-attribution.mjs --branch && node scripts/check-attribution.mjs --files
$ vitest run --coverage
 Test Files  32 passed (32)
      Tests  802 passed (802)
```

**Coverage** (NFR-MAINT-02). The gate (`src/grader/**`: lines 90, branches 90) is part of `pnpm test` and passed. The rows `pnpm test` prints for the grader:

```
 src/grader        |   97.44 |    97.61 |     100 |   96.93 |
  compare.ts       |   81.81 |    83.33 |     100 |      80 | 32-33
  grade.ts         |   98.49 |    97.85 |     100 |   98.13 | 121,285
  parity-cases.ts  |   83.33 |       90 |     100 |   81.81 | 149-150
 ...er/node-runner |   80.55 |       76 |   80.95 |   84.84 |
  host.ts          |    87.5 |       50 |      75 |     100 | 26
  runner.ts        |   89.47 |    85.71 |    87.5 |   92.45 | 49-50,53-54
  thread.ts        |       0 |        0 |       0 |       0 | 8-17
```

Files not listed are at 100 percent. `thread.ts` runs inside the worker thread, where the coverage tool does not reach; it is ten lines, and everything it calls (`host.ts`) is also tested in the main process. The uncovered lines in `compare.ts` and `parity-cases.ts` are the `never` branches of exhaustive switches. These numbers are for the TypeScript only: the harness's Python is a string constant the coverage tool cannot see, and it is covered by the behavior tests in `harness.test.ts`, run in real Pyodide.

**`pnpm build`** with the `.env.example` values, as CI sets them, on the review fixes: exit 0. The compiled worker now has `public/_runtime/worker/grader/{compare,grade,harness,test-case}.js` beside `runtime/`.

**The compiled worker with real Pyodide.** `public/_runtime/worker/runtime/worker/core.js`, driven under Node 26.13.1 with Pyodide 314.0.7 and a fake host (no lock-down, no worker policy, no browser), checking the section 7 lesson and two of the reviewers' programs (an exit whose code raises, a typo inside the function), after the review fixes:

```
{"type":"ready","runtimeVersion":"314.0.7","capabilities":{"interactiveInput":false}}
solution 4.9 ms passed,passed {"total":2,"passed":2,"failed":0,"notRun":0,"allPassed":true,"timeLimit":false}
starter 3.7 ms failed:mismatch,failed:mismatch {"total":2,"passed":0,"failed":2,"notRun":0,"allPassed":false,"timeLimit":false}
wrong 3.3 ms passed,failed:mismatch {"total":2,"passed":1,"failed":1,"notRun":0,"allPassed":false,"timeLimit":false}
odd_exit 3.4 ms failed:program_error,failed:program_error {"total":2,"passed":0,"failed":2,"notRun":0,"allPassed":false,"timeLimit":false}
typo 3.4 ms failed:after_code_error,failed:after_code_error {"total":2,"passed":0,"failed":2,"notRun":0,"allPassed":false,"timeLimit":false}
```

Before the fixes, `odd_exit` made the harness raise and the worker post `fatal runtime_crashed`.

**Tests added**, each title carrying its requirement:

- `src/grader/test-case.test.ts`: every field; defaults; each mode and a wrong one; each limit at the limit (in characters outside the basic plane) and one over; null, arrays, strings and class instances; an unknown field; each required field missing; null or a number in each text field; a blank name and bad IDs; 1 and 12 test cases, 0 and 13; the refused test case and field named; duplicate IDs.
- `src/grader/compare.test.ts`, property tests over 500 seeded inputs each: `normalize` is idempotent; leaves no `\r`, no trailing whitespace and no trailing blank line; unifies line endings. Under `normalized`, trailing whitespace, trailing blank lines and line endings never change the verdict, and leading whitespace and case always do. `exact` matches only the same text. `contains` matches any part, and whatever matches `normalized` matches `contains`. Plus the prompt rule of section 2.2.
- `src/grader/harness.test.ts`, in Pyodide under Node: input with a prompt; follow-up code in the program's namespace; a learner error with its line, and the follow-up code not run; a syntax error with its line; the missing name; an error inside the learner's function called from follow-up code; a syntax error in follow-up code; `input_ended`; `exit(0)`, `sys.exit(False)`, `exit(1)`; standard error not compared; a flood stopped at exactly 64,000 characters, also when the program catches `Exception`; memory, and the next case runs; builtins deleted or replaced, and the next case unaffected; follow-up code after the program deleted `print`; a fresh namespace, streams and module set; a `__del__` and a `__str__` that tamper after the program; an error whose `__str__` raises; a program that breaks `json`; a write of something that is not text. After review: an exit whose code raises and a profile hook (the harness gives a result, and the next case runs); a typo inside the learner's function (no missing name); an empty and an over-long missing name; the output limit for a text subclass and for a direct `StringIO.write`; a builtin added in one case gone in the next; the recursion limit and trace hook restored; the harness hash pinned to the version.
- `src/grader/grade.test.ts`: pass, mismatch, learner error, follow-up code error, output limit, the comparison mode; `unfinished` and the summary; harness results read and 13 broken ones refused, including a missing name outside the follow-up code; the output limit in characters; every kind of test result read back and 12 bad ones refused; summaries whose counts do not add up.
- `src/grader/node-runner/runner.test.ts`: the section 7 verdicts; the wrong answer accepted with only the first test case; a failure's actual output, error and summary; each of the 13 parity cases; a check of ten test cases in 500 ms or less once ready (NFR-PERF-06, under Node only: the laptop browser figure the requirement names is not measured); the time limit, with the next check on a new thread; a thread that dies (`os._exit(1)`) as a crash, with the next check on a new thread; `close`.
- `src/runtime/protocol.test.ts`: `check`, `test_result`, `check_done` accepted; an `init` without the harness version and five bad checks refused; five bad results and summaries refused.
- `src/runtime/worker/core.test.ts`: each result then the summary, with the runtime's stdin closed; nothing written past the harness reaches the page; a run after a check; a harness result that is not one, of another version, or a harness that raises; a check before ready; another harness version refused before loading; a harness that is not a function.
- `src/runtime/controller.test.ts`: a check end to end; each test case gets the full limit; the limit mid-check; Stop; a crash; a result out of order and a summary that disagrees; messages for another run and run messages during a check; memory restarts after the check; refusals before ready, during a run, and for invalid test cases. After review: `freshWorker` replaces a used worker and sends the check to the new one; a worker that has only loaded is kept; a run makes a worker used; Stop while the new worker starts; a new worker that fails to start.
- `scripts/eslint/rules.test.ts`: the purity exemption applies only to `src/grader/node-runner/`; only tests and the runner itself may import it; only a test may import a test file; computed imports are refused outside the worker entry.

**Browser tests in Chromium, on 459c0c3.** Chromium 159.0.8154.6 with `--no-sandbox --single-process`, one test per Playwright process, through a temporary configuration outside the repository with no web servers. The `runtime` project's files ran against `next dev --webpack` (with `WATCHPACK_POLLING=true`) on port 3259, after `node scripts/build-runtime.mjs`; the production project's files against `next start` of a `pnpm build` with CI's fake public values on port 3260.

- `e2e/grader-parity-runtime.spec.ts`: 13 of 13 passed, the same verdicts as under Node.
- `e2e/runtime.spec.ts`: 15 of 15 passed.
- `e2e/runtime-headers.spec.ts`: 4 of 4 passed. `e2e/shell.spec.ts`: 16 of 16 passed.
- `e2e/csp.spec.ts`: 1 of 3 passed. The two that fail ("the page runs its scripts with no policy violation", a 30 s timeout; "an injected inline script is blocked", `Received: false`) are the two that `wp/fix-smoke-and-runtime` corrects (the tests, not the policy). That branch is not in `main` yet; they pass here once it is merged into `main` and `main` into this branch. Not merged into this branch directly, so this pull request does not carry another pull request's change.
- The same parity file also passed 13 of 13 on `wp/3.4-statechart` at 9414a88, which holds all of this branch.

**Not run, owner to run:** the parity cases in `runtime-firefox` and `runtime-webkit` (not installed here), and in `runtime-chromium` through `pnpm test:e2e` with its own servers.

```sh
pnpm test:e2e e2e/grader-parity-runtime.spec.ts --project=runtime-chromium --project=runtime-firefox --project=runtime-webkit
```

## Screens

None. No learner-facing screen or copy changes; the development page gains one status word, "Checking", in `src/messages/runtime-dev.ts`. antislop Delivery Gate: not applicable.

## Reviews

Round 1, on 942ff46..1da8b48:

- Code review: `docs/reports/reviews/WP-3.3/code-review-1.md`. CHANGES REQUIRED: no blocker, two majors, nine minors.
- Security review: `docs/reports/reviews/WP-3.3/security-review-1.md`. CHANGES REQUIRED: no blocker, one major, four minors.

| Finding | What was done |
|---|---|
| Code MAJOR 1, security MINOR 1: an exit whose code raises, or a profile hook, made the harness raise | `finished` guarded, `code` read safely, `check` wrapped so it restores and returns a runtime error, hooks cleared in `restore`. Tests for both. |
| Code MAJOR 2: a typo inside the learner's function was reported as a missing name | The name is kept only when the innermost frame is the follow-up code. Test. |
| Security MAJOR 1: Validate isolation was only a note | `check(..., { freshWorker: true })` in the controller, with five tests. The harness header now says what is restored and that a check is no evidence for hostile code. The spec text is for you (owner action 3). |
| Code MINOR 1, security MINOR 2 and 3: the output cap and the missing name could be pushed past the parser's bounds | Count kept in the closure; text subclasses counted; output cut again; name kept only at 1 to 200 characters (`HARNESS_NAME_LIMIT`, used by `grade.ts`); a name is accepted only at stage `after_code`. Tests. |
| Code MINOR 2: recursion limit and hooks carried over | Restored. Test. |
| Code MINOR 3: removing the builtins clear was not caught | Test: a builtin added in one case is gone in the next. |
| Code MINOR 4: 50 test cases was invented | 12, from section 1.3. |
| Code MINOR 5: the browser test has its own clock | Said so in the file; the listener leak fixed. The controller's clock against a real worker waits for WP-3.4's page. |
| Code MINOR 6: nothing forces a harness version bump | Hash of the Python pinned next to the version. Coverage stated as TypeScript only. |
| Code MINOR 7: titles and a path | Corrected. |
| Code MINOR 8: runner and worker disagreed on edge cases | Runner refuses another harness version and replaces its thread after memory; `parseHarnessResult` uses the stage. |
| Code MINOR 9: evidence | Counts and the NFR-PERF-06 scope corrected in this description. |
| Security MINOR 4: the Node runner reachable through a test file or a computed import | Both refused by the lint rule, with tests. Moving `pyodide` to `devDependencies` is a lockfile change for you to decide. |

Round 2, on the round-1 fixes 1da8b48..bce0f08, run on 2026-11-24 at 67787b4:

- Code review: `docs/reports/reviews/WP-3.3/code-review-2.md`. CHANGES REQUIRED: no blocker, one major, six minors.
- Security review: `docs/reports/reviews/WP-3.3/security-review-2.md`. CHANGES REQUIRED: no blocker, one major, seven minors.

Fixed in 9043a9a and 06c39bb, each new test seen failing without its fix (a mutant of the fix, or the code before it):

| Finding | What was done |
|---|---|
| Code MAJOR 1, security MAJOR 1: during a fresh-worker check the controller reported `ready` before sending the check, so a page acting on `ready` could start a run or a second check, orphan the first and make Stop end nothing | The pending check is sent first, so the status goes from `restarting` to `checking`, and `ready` is reported after. Test: a listener on `ready` sees `checking`, its `run()` and `check()` are refused, the new worker gets exactly `init` and the check, and Stop ends the check. |
| Code MINOR 2: a profile hook that puts back a raising trace hook made the harness raise on that and every later test case | The fallback in `check` clears the profile and trace hooks before any other call. Test with the reviewer's program, and the next test case. |
| Code MINOR 3, security MINOR 2: the guards were not tested one at a time | Three tests: a hook that raises only in the harness's own frames (removing the outer guard fails it); the `Odd` exit with its full error, message `Odd`, line 5 (removing the guard in `finished` fails it); a profile hook that never raises, then `sys.getprofile()` is `None` (removing `set_profile(None)` fails it). |
| Security MINOR 3: output cut around the capture ended as `mismatch` | `grade` treats `truncated` with no error as `output_limit`, as the controller does for runs. The direct-write test asserts no error; the grade test asserts the reason. |
| Code MINOR 4, security MINOR 7: the runner's thread replacement after a memory error had no test | Test: a module attribute set before a memory error is gone in the next test case (removing the discard fails it). |
| Code MINOR 5: limits a boundary mutant got past | A name of exactly 200 characters is kept (`>=` fails it); `CHECK_TEST_LIMIT` is pinned to 12, with 12 accepted and 13 refused. |
| Code MINOR 6: `used = false` in `spawn` had no test | Test: after a time limit restart, a fresh check uses the new worker as it is (removing the line fails it). |
| Code MINOR 7, security MINOR 2 and 3: comments | The harness header and `check` say the harness does not raise because of the program's own errors, and that code rewriting its closure can still make it raise (the worker then gives up and is replaced); the fallback has no message and no output whichever stage failed. The capture comment says the count can be reached and memory is not bounded on that route. Both Validate comments say "must", and that the spec text is an open owner decision. |

Fixed since, outside the range (security review 3): calling `dispose()` from a `restarting` listener left a worker running, because `restart()` spawned after the event. WP-3.1 fixed it in its controller (c1114d4, 1266681, d2e7ff8; WP-3.1 code reviews 6 and 7). The merge of that fix into this branch adds the same guard to the check paths: after `check_done` (a finished check no longer sets `ready` on a disposed controller), after `test_result` (no clock starts for the next test case), and after a waiting check ends because its new worker failed (no `failed` event). The merge (df1c7bb) added nine tests: dispose from `check_done` after each of the six ways a check ends, from `test_result`, from the `restarting` event of a fresh check, and from the `check_done` of a waiting check whose new worker fails. Code review 4 (CHANGES REQUIRED, 4 MINOR, all fixed in 89fb157) found that the merge's commit message and this description said ten. The fix also makes `check()` refuse a fresh check when its `restarting` listener disposed the controller, adds a tenth test (dispose from the `ready` event that sent a waiting check), and removes the duplicate `onEvents` test helper. Removing any of the four new guards fails at least one test. Report: `docs/reports/reviews/WP-3.3/code-review-4.md`.

Not fixed, for you:

- **Security MINOR 1:** `freshWorker` is optional and off by default. Making it required changes the controller's API for every caller; it belongs with owner action 3.
- **Security MINOR 4:** further ways past the lint rule (an import through `scripts/`, `createRequire`, an aliased `require`, `module.require`, a `Worker` URL, a `?raw` suffix), and no build-output check for Node-runner symbols. `scripts/eslint/module-boundaries.mjs` is an enforcement control; changing it is left to you.
- **Security MINOR 5:** `sys.monitoring`, `gc.callbacks`, audit hooks, `sys.excepthook` and `sys.unraisablehook` survive into later test cases on the same worker. Covered by "a check is evidence only for code that is not hostile" and `freshWorker`; listed under "Not fixed".
- **Security MINOR 6:** a learner function that calls `exit()` during the follow-up code ends that stage cleanly. See the new deviation.
- The `restore` order (profile hook first) was tried and reverted, on the belief that no test could tell the two orders apart. Code review 3 showed that was wrong; see round 3 below.

Fixed later, in f7261ad (2026-11-24):

| Finding | What was done |
|---|---|
| Security MINOR 7 (version part), code MINOR 4 (version part): the runner's harness-version check had no test | `createNodeRunner` takes an optional `threadUrl`, set only by the runner's own test. That test starts `scripts/testing/other-harness-version-thread.ts`, which answers every test case with a passing result of another harness version. The first test case is `crashed` and the second `not_run`. With the version check removed, both pass and the test fails (seen). |

Round 3, on the round-2 fixes 9043a9a, 06c39bb and f7261ad, run on 2026-11-24 at f65a033:

- Code review: `docs/reports/reviews/WP-3.3/code-review-3.md`. **APPROVE**: no blocker, no major, four minors. Every round-2 fix verified by a mutant its test catches (20 mutants).
- Security review: `docs/reports/reviews/WP-3.3/security-review-3.md`. **APPROVE**: no blocker, no major, two minors. The race fix is complete; `threadUrl` is reachable only from the runner's test and absent from the build output.

Fixed in b67f730, each new test seen failing under a mutant of its fix (table under "How it was verified"):

| Finding | What was done |
|---|---|
| Code MINOR 1: the order and the second call of the fallback's hook clearing had no test | Test with the reviewer's program P2 (a raising tracer that puts back the profile hook), and the next test case. |
| Code MINOR 2: in `restore`, a profile hook that puts back the tracer turned a clean program into a runtime error | `restore` clears the profile hook first. Test with P3 plus a `print`: the output stays and there is no error. |
| Code MINOR 4: the `ready` event can arrive while the controller is `checking` | Doc comment on the event: read `status`, not the event. |
| Security MINOR 1: the comments said the harness cannot be made to raise by a hook | The `check` comment and `core.ts` now say a profile hook can make it raise, and that the worker then crashes and is replaced (the runner reports `crashed`). The reviewer's program A is a test that expects the harness to raise and the next test case to run. |
| Security MINOR 2: the Python changed but `HARNESS_VERSION` stayed "1" | `HARNESS_VERSION` is "2", with the new hash. Decision below. |

Not fixed, for you:

- **Code MINOR 3:** nothing enforces that only the runner's test passes `threadUrl`. It gives no new capability (only tests and scripts can import the runner). Options: an internal factory with a test-only export, or refusing a URL whose protocol is not `file:` (security review 3's optional hardening). The API row above now names the option.
- **Security MINOR 1, optional part:** clearing the hooks from JavaScript before the harness gives up, which might close the case program A pins. Not tried.

Security review 4, on 203b6bb to 3fa2bd3 (security review 2, MINOR 5: `sys.monitoring` callbacks, `gc.callbacks`, `sys.excepthook` and `sys.unraisablehook` survived into later test cases on the same interpreter). Report: `docs/reports/reviews/WP-3.3/security-review-4.md`. Five rounds:

| Round, on | Verdict | What was done |
|---|---|---|
| 1, 203b6bb | CHANGES REQUIRED, 4 MINOR | 6a4f0f8: tool ids freed in up to eight passes; local events and audit hooks named as not undone; the import lists, the importer cache, the digit limit and the async generator hooks restored; the header rewrapped. |
| 2, 6a4f0f8 | CHANGES REQUIRED, 2 MINOR | 839707a: `intact()` checks every restored part by identity at the end of `restore()` and after the fallback, and the harness raises `NotRestored` when it fails; the import-list test compares with a run from before. |
| 3, 839707a | CHANGES REQUIRED, 2 MINOR | f4c7a16: every key of the checked dicts must be a plain `str` before any lookup; one probe per checked part. The reviewer's message for this round was not saved; the report says so. |
| 4, f4c7a16 | CHANGES REQUIRED, 1 MAJOR, 2 MINOR | 7468f65: the missing probes, `str` subclass keys and the check order tested; `linecache.cache` put back and checked (a key left there ran in the next case, before the check); the module table cleared without hashing the program's keys. |
| 5, 7468f65 | **APPROVE**, 1 MINOR | 3fa2bd3: a test pins the module-table clear; the line-cache test no longer depends on hash order. No reviewer has seen 3fa2bd3. |

Decision: `HARNESS_VERSION` stays "3" through these commits, since "3" had not left this branch until they were pushed together.

Security review 5, on 853f0c1 to 5649d7a (security review 4, round 4, noted: the garbage collector's thresholds and enabled state carried over between test cases, `(1, 1, 0) False`). Report: `docs/reports/reviews/WP-3.3/security-review-5.md`. Two rounds:

| Round, on | Verdict | What was done |
|---|---|---|
| 1, 853f0c1 | **APPROVE**, 3 MINOR | 04fcffa: the debug flags and `gc.garbage` restored and checked (with `DEBUG_SAVEALL`, the harness's own collection left a case's objects for the next case); the collector off from the start of the restore until the check passes; a test with a harness defined after `gc.disable()`; `gc.freeze()` named as not undone. |
| 2, 04fcffa | **APPROVE**, 2 MINOR | 5649d7a: the fallback in `check()` turns the collector off and back on only if it was on at definition, with the reviewer's reproduction as a test; the header rewrapped. No reviewer has seen 5649d7a. |

Decisions: `HARNESS_VERSION` is "4", because "3" had left this branch by merge into `wp/3.4-statechart` (a9c8c0c). `gc.freeze()` is not undone: frozen objects change memory, not output, and `gc.unfreeze()` would also move objects the runtime froze.

Security review 6, on 65af875 to c694902 (found during WP-3.1 security review 8: the harness had the same single collection at the end of `run_case` as the run support before 16711f5). Report: `docs/reports/reviews/WP-3.3/security-review-6.md`. Two rounds:

| Round, on | Verdict | What was done |
|---|---|---|
| 1, 65af875 | CHANGES REQUIRED, 1 MAJOR, 1 MINOR | c694902: a restore before the first collection (an object planted while the namespace was cleared made a cycle only when the first restore freed it, after a collection that found nothing), with the reviewer's probe as a test; the fallback's two dead collector calls removed. |
| 2, c694902 | **APPROVE**, 2 MINOR | ff9e6eb: the capture's state dict dropped before collecting, with the reviewer's probe as a test; the header names the harness's frames as well as its closure. Security review 7, round 2, approved ff9e6eb; its test no longer guarded the fix after 3ab21e9, answered in be9375c. |

Decisions: `HARNESS_VERSION` is "5", because "4" had left this branch by merge into `wp/3.4-statechart` (4fe1874); it stays "5" through the three commits, which were pushed together. `Uncollected` is a subclass of `NotRestored`, so callers that read the type see the same family. Locals rebound through `sys._getframe(...).f_locals` can still keep an object alive past the last collection; clearing locals cannot close that from inside Python, and `freshWorker` is the control (listed below).

Security review 7, on 3ab21e9 (the timers between test cases that security review 6, round 2, left not checked); round 2 also covered ff9e6eb. Report: `docs/reports/reviews/WP-3.3/security-review-7.md`. Three rounds:

| Round, on | Verdict | What was done |
|---|---|---|
| 1, 3ab21e9 | **APPROVE**, 2 MINOR | d757f11: the comment on `check()` says that a failure in the collections at the start of a case is reported against that case, though an earlier case's timer caused it (fails closed, as a bare `restore()` did before); the header rewrapped. |
| 2, d757f11 and ff9e6eb | **APPROVE**, 2 MINOR | be9375c: a new test reads the interpreter after `check()` returns, so it fails without `state = None` (the ff9e6eb test passed without it once each case started with the collections); the comment on `check()` and the header say what an earlier case left can come from a timer or from a write into the harness's frames. Round 3 approved be9375c. |
| 3, be9375c | **APPROVE**, no findings | Nothing to do. With `state = None` replaced by `pass`, the new test fails (`Tests  2 failed | 81 passed (83)`, the other failure the hash pin). Inside the Python text only `#` lines changed. No test was weakened. |

Decisions: `HARNESS_VERSION` is "6", because "5" had left this branch by merge into `wp/3.4-statechart` (4c612bc); it stays "6" through d757f11, which changed only a comment inside the Python text, and the hash pin moved with it. It is "7" from be9375c, which changed a comment inside the Python text, because "6" had left this branch by merge into `wp/3.4-statechart` (68595de).

## Try it

There is no learner-facing change to try. From the repository root, the grader's own tests run the harness in real Pyodide:

```sh
pnpm vitest run src/grader
```

## Owner actions now due

1. Run the browser parity suite (command above) in Firefox and WebKit, and in Chromium through `pnpm test:e2e`, and paste the output.
2. Decide the deviations below.
3. Decide whether to open a `spec-change` that adds to WP-4.3's "Done when": Validate uses `check(..., { freshWorker: true })` for every program, with a test that a tampering program in one validation does not change the next one's verdict; and adds to T-23 that Validate is no evidence for hostile imported code, so the owner reads imported code before pressing Validate.
4. Decide whether `pyodide` moves to `devDependencies` (security review, MINOR 4).
5. Decide whether `contains` with an empty expected text should be refused; today it always passes (code review, design notes).
6. Review round 3 has run (both APPROVE). Decide code review 3 MINOR 3 (`threadUrl` enforcement) and whether `HARNESS_VERSION` should count from the first release instead (see Deviations).
7. Decide security review 2, MINOR 1 (make `freshWorker` required) with action 3, and MINOR 4 (the lint rule's remaining bypasses and a build-output check).

## Deviations from the plan or the spec

- **Comparison runs in TypeScript, not in the Python harness.** Section 3.1 has the harness return structured results; it returns the output and the error, and `grade` decides the verdict. The same function decides it in the worker and in the Node runner, so parity holds, and the rules are property-tested where they are written.
- **After a time limit, Stop or a crash, the remaining test cases are `not_run`.** Section 2.2 says a test case that reaches the limit fails, and is silent on the rest. Running them on a new worker would make a learner whose program loops wait 5 seconds plus a new worker for every test case. Validation is unaffected: the lesson already fails rule 5.
- **Each test case gets its own 5 second clock.** Section 5.4 counts a run's budget from `run` to `run_done`; section 2.2 makes each test case its own run.
- **`exit(0)` in the program still runs the follow-up code**, because the program finished without an error (section 2.2, step 4).
- **The property tests use a 70-line seeded generator** (`scripts/testing/property.ts`) instead of a new dependency. It has no shrinking: a failure names the seed and the input as drawn.
- **A learner function that calls `exit()` while the follow-up code runs ends that stage cleanly** (security review 2, MINOR 6). Python ends with status 0, so the harness counts it as finished, as for `exit(0)` in the program. A test case whose follow-up code only asserts, with an empty expected text, then passes. Section 2.2 says a test case fails when the follow-up code raises an error; whether `SystemExit` there counts is for you, with action 5.
- **Output cut with no error is graded `output_limit`** (security review 2, MINOR 3). The spec does not name the reason for this case; the controller already reports a cut run this way.
- **`HARNESS_VERSION` is "3"** (203b6bb), although no harness version has shipped. It moved from "2" with the restore of security review 2 MINOR 5 and stayed "3" through 6a4f0f8 and 839707a, since "3" never left this branch until they were pushed together.
- **`HARNESS_VERSION` was "2"** (b67f730), although no harness version has shipped. The Python changed in 06c39bb and again in b67f730; the pinned hash test says the version moves with it, so the version moved rather than only the pin (security review 3, MINOR 2). Decision, for you to reverse: if versions should count from the first release, set it back to "1" and say so in the test and the header.
- **The worker's URL moved** to `/_runtime/worker/runtime/worker/python-worker.js`, because the worker now compiles from `src`.

## Not fixed, for later packages or for you

- **Validate must ask for a fresh worker before each program it validates** (WP-3.1 security review 3, MAJOR 1; WP-3.3 security review 1, MAJOR 1). A program can rewrite the harness's closure, as it can the run support's, and the change lasts until the worker is replaced. For a learner this only touches their own results. The controller now offers `freshWorker`; WP-4.3 must use it. No isolation stops a hostile lesson from forging its own pass.
- **The run support and the harness each restore the state** with their own copy of the same routine. Moving Run onto the harness would leave one copy; that changes WP-3.1's tested code and is left for WP-3.4 or later.
- **Hooks the harness cannot undo** (what is left of security review 2, MINOR 5, after 203b6bb to 839707a): audit hooks (Python cannot remove them) and `sys.monitoring` local events set on a code object (no call clears them for every code object) stay for the later test cases on the same worker. A fresh worker is the control.
- **Run gets the restore on `wp/3.1-python-worker`, not yet here.** WP-3.1's run support (`src/runtime/worker/run-support.ts`) has its own copy of the routine. Since 4d6608f to a24111c (WP-3.1 security review 8, rounds 1 and 2) it restores and checks the same state and raises `NotRestored`; round 3 on a24111c has not run. Those commits are not merged into this branch yet; the merge waits for that round. Until then a `sys.monitoring` callback or a line-cache key set in one run reaches the learner's next run on this branch: the same learner's own output, with no verdict, and the next check's first restore clears it.
- **Objects frozen with `gc.freeze()`** stay in the collector's permanent generation for the later test cases (security review 5, MINOR 1). They change memory, not output, and `gc.unfreeze()` would also move objects the runtime froze. A fresh worker is the control. The collector's thresholds, enabled state, debug flags and saved garbage are restored since 853f0c1 and 04fcffa.
- **Objects kept alive through the harness's frames** (security review 6, round 2, MINOR 2). A program can rebind a local of `run_case` or `check` through `sys._getframe(...).f_locals`, so an object outlives the last collection and its cycle runs in the next test case on the same worker. The header names this; a fresh worker is the control.
- **Run's first-pass gap** (security review 6, round 1, argued). Done on `wp/3.1-python-worker` in a7c3ba7 (the same leading restore), where it could not be reproduced; it reaches this branch with the merge of WP-3.1.
- **A timer between runs** (security review 7, outside its commit). Each test case now starts with the collections (3ab21e9), so a timer between test cases, or between checks, is covered. Run still starts with a bare `restore()`, so a timer a check or a run set can still write into the next run's output in the browser. That is WP-3.1 security review 7, MINOR 1, an owner decision in WP-3.1.
- **The lint rule's remaining bypasses** (security review 2, MINOR 4), for you.
- **FR-GRD-07** (naming a near miss) is a Should requirement for a later package.

## Risks and rollback

- The worker's URL changed. Nothing outside this repository loads it, and the development page takes it from `WORKER_URL`.
- No learner page uses the grader yet, so reverting the merge rolls everything back.

## Definition of Done

- [ ] Every "Done when" line is met, with evidence above. **Not met:** Firefox and WebKit (written, not run); Chromium passes, run by hand.
- [x] Every cited Must requirement has a test that names its ID. The browser tests pass in Chromium; Firefox and WebKit have not run.
- [x] `pnpm verify` and `pnpm build` pass.
- [x] Every state of every changed view exists. The development page shows `checking`.
- [x] No stub, dead control, placeholder, commented-out code, or invented number.
- [x] No new tables. No new server actions.
- [x] Every reviewer blocker is fixed. There were none. Both round 2 majors are fixed; the minors not fixed are listed under Reviews for you.
- [x] No AI attribution in any commit or in this description.

## Opening this pull request

`gh` cannot reach GitHub from the sandbox. From your terminal in the repository root:

```sh
gh pr create --draft --base wp/3.1-python-worker --head wp/3.3-grader \
  --title "feat(grader): WP-3.3 the grader" \
  --body-file docs/reports/pull-requests/WP-3.3.md
```

GitHub retargets it to `main` when WP-3.1's branch merges and is deleted.
