**Base: `wp/3.1-python-worker`; merges after WP-3.1.** `main` is at 0efe863 (#3 to #8). `wp/3.1-python-worker`, which carries that `main` since 5f72072, is merged into this branch (last in f178765, at c4ca7f1), so until WP-3.1 merges this pull request also shows WP-3.1's commits. It is a **draft**: no browser test has run (no browser can start in the sandbox that built it).

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
| The harness, `HARNESS_VERSION` "1". Per test case: restore builtins, the module table and the streams; a fresh `__main__` namespace; `stdin` from the test case; the program; then, if it finished without an error, the follow-up code in the same namespace. Output is captured up to 64,000 characters; past that a write keeps what fits and raises an exception the program's `except Exception` cannot catch. The count lives in the harness, not on the stream, a text subclass is counted as text, and the result is cut to the limit again whatever the program did. Standard error is discarded. `exit()`, `exit(0)` and `exit(False)` count as finishing; an exit whose code cannot be read does not. The result says which stage failed, with the error's kind, summary, the learner's line, and, when the follow-up code itself names something the program did not define, the missing name ("This test needs something named `area`"), 1 to 200 characters. A misspelled name inside the learner's function is the learner's error at its line. Builtins, the module table, the streams, the recursion limit and the trace and profile hooks are restored after the program, again after a garbage-collection pass, and before the next case, and nothing after learner code starts looks a builtin up by name. If learner code still makes a harness step raise, the harness restores the state and returns a runtime error for the program: it never raises. The result is built without `json`. A test pins a hash of the Python next to the version, so the version cannot be forgotten. | `src/grader/harness.ts` |
| Verdicts. A test case passes when nothing failed and the output matches under its mode. It fails with `mismatch`, `program_error`, `after_code_error` or `output_limit`, decided from the harness's result, or `time_limit`, `stopped` or `crashed`, decided by whoever owns the clock. After a time limit, Stop or a crash, the rest are `not_run`. The summary counts each and says whether every test case passed and whether one reached the time limit (validation rule 5). | `src/grader/grade.ts` |
| Node runner: `createNodeRunner({ timeLimitMs })` with `check(source, testCases)` and `close()`. The thread loads Pyodide from the `pyodide` package and evaluates the harness. At the limit, when the thread dies, or after a memory error, the thread is terminated and the next check starts a new one. A result of another harness version is a crash, as in the worker. | `src/grader/node-runner/` |
| Lint: `src/grader/node-runner/` is exempt from purity, and only it, tests and scripts may import it (ADR-0032, built here as that ADR says). Only a test may import a test file, so a test cannot pass the runner on. An `import()` or `require` whose source is computed is refused, except the worker's one import of Pyodide from its asset base. | `scripts/eslint/module-boundaries.mjs`, `eslint.config.mjs` |
| Protocol: `init { assetBase, harnessVersion }`; `check { runId, source, tests }`; `test_result { runId, result }`; `check_done { runId, summary }`. Test cases, results and summaries are parsed by the grader's parsers. A summary whose counts do not add up is refused. | `src/runtime/protocol.ts` |
| Worker: evaluates the harness at load. Refuses an `init` whose harness version is not its own (`fatal version_mismatch`), so a page never trusts a stale cached worker's verdicts. For `check`, closes the runtime's own streams, runs each test case, posts each result as it is decided, then the summary. A harness result it cannot parse, or of another version, means the runtime is broken (`fatal runtime_crashed`). | `src/runtime/worker/core.ts` |
| Controller: `check(source, tests)`, status `checking`. The clock restarts with every result, so each test case gets 5 seconds. At the limit, on Stop, or when the worker dies, the running test case fails with that reason, the rest are not run, and a new worker starts. A result out of order, or a summary that disagrees with the results, means the worker is broken. A memory error in any test case starts a new worker after the check. `check(source, tests, { freshWorker: true })` first replaces a worker that has run anything (restart reason `isolation`), for Validate (T-22, T-23); Stop or a crash while that worker starts ends the check. | `src/runtime/controller.ts` |
| The worker now compiles from `src`, so it can import the grader. Its URL moves to `/_runtime/worker/runtime/worker/python-worker.js`; the headers match `/_runtime/worker/` by prefix and are unchanged. | `tsconfig.worker.json`, `src/runtime/assets.ts` |
| The example lesson of section 7, and the parity cases. | `src/grader/example-lesson.ts`, `src/grader/parity-cases.ts` |
| Property testing: a seeded generator and `forAll`, outside `src` so the pure modules' tests can import it. | `scripts/testing/property.ts` |
| The development page shows the new `checking` status; it sends no checks. | `src/features/workspace/client/runtime-view.ts`, `src/messages/runtime-dev.ts` |

## Up to date with main

`wp/3.1-python-worker` at c4ca7f1 is merged in f178765. It carries `main` at 0efe863 (#3 to #8) and WP-3.1's round 4 fixes (58128a3). One conflict, `docs/reports/local-build-progress.md`: WP-3.1's copy was taken, because it is the newer one and already holds this branch's section. No code conflicted. The earlier merges: WP-3.1 at e06e9c3 with `main` at 0efe863 in 4e255ef, and `main` at 037c4ad through WP-3.1 in 6f0cfe8.

`pnpm verify` on f178765, exit 0:

```
 Test Files  42 passed (42)
      Tests  1012 passed (1012)
```

`pnpm build` with CI's fake public values on f178765, exit 0 (`runtime: pyodide 314.0.7, 13531207 bytes, 5464072 with Brotli (budget 6500000)`, `runtime: worker compiled`). `node scripts/check-bundle.mjs .next/static` and `node scripts/check-static.mjs .next`: exit 0.

Not run on the merge: the browser tests.

## How it was verified

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

Each mutant run also failed the hash test, which fails on any edit to the Python. The browser tests have not run.

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

`npx playwright test --list --project=runtime-chromium`: "Total: 28 tests in 2 files". The browser tests have not run.

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

**Not run, owner to run:** `e2e/grader-parity-runtime.spec.ts`, the 13 parity cases in each of `runtime-chromium`, `runtime-firefox` and `runtime-webkit`. `npx playwright test --list --project=runtime-chromium` loads it: "Total: 28 tests in 2 files" (13 here, 15 in `runtime.spec.ts`). Like WP-3.1's browser tests, it opens `/dev/runtime`, which routes once #3 is merged.

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

Not fixed, for you:

- **Security MINOR 1:** `freshWorker` is optional and off by default. Making it required changes the controller's API for every caller; it belongs with owner action 3.
- **Security MINOR 4:** further ways past the lint rule (an import through `scripts/`, `createRequire`, an aliased `require`, `module.require`, a `Worker` URL, a `?raw` suffix), and no build-output check for Node-runner symbols. `scripts/eslint/module-boundaries.mjs` is an enforcement control; changing it is left to you.
- **Security MINOR 5:** `sys.monitoring`, `gc.callbacks`, audit hooks, `sys.excepthook` and `sys.unraisablehook` survive into later test cases on the same worker. Covered by "a check is evidence only for code that is not hostile" and `freshWorker`; listed under "Not fixed".
- **Security MINOR 6:** a learner function that calls `exit()` during the follow-up code ends that stage cleanly. See the new deviation.
- **Security MINOR 7 (version part), code MINOR 4 (version part):** the runner's harness-version check has no test; a test needs a seam for the version.
- The `restore` order (profile hook first) was tried and reverted: with the fallback clearing the hooks, no test could tell the two orders apart.

No third review round has run on 9043a9a and 06c39bb.

## Try it

There is no learner-facing change to try. From the repository root, the grader's own tests run the harness in real Pyodide:

```sh
pnpm vitest run src/grader
```

## Owner actions now due

1. After #3, #4 and WP-3.1 are merged, run the browser parity suite (command above) and paste the output.
2. Decide the deviations below.
3. Decide whether to open a `spec-change` that adds to WP-4.3's "Done when": Validate uses `check(..., { freshWorker: true })` for every program, with a test that a tampering program in one validation does not change the next one's verdict; and adds to T-23 that Validate is no evidence for hostile imported code, so the owner reads imported code before pressing Validate.
4. Decide whether `pyodide` moves to `devDependencies` (security review, MINOR 4).
5. Decide whether `contains` with an empty expected text should be refused; today it always passes (code review, design notes).
6. Ask for a third review round on the round 2 fixes (9043a9a, 06c39bb), or accept them on this evidence.
7. Decide security review 2, MINOR 1 (make `freshWorker` required) with action 3, and MINOR 4 (the lint rule's remaining bypasses and a build-output check).

## Deviations from the plan or the spec

- **Comparison runs in TypeScript, not in the Python harness.** Section 3.1 has the harness return structured results; it returns the output and the error, and `grade` decides the verdict. The same function decides it in the worker and in the Node runner, so parity holds, and the rules are property-tested where they are written.
- **After a time limit, Stop or a crash, the remaining test cases are `not_run`.** Section 2.2 says a test case that reaches the limit fails, and is silent on the rest. Running them on a new worker would make a learner whose program loops wait 5 seconds plus a new worker for every test case. Validation is unaffected: the lesson already fails rule 5.
- **Each test case gets its own 5 second clock.** Section 5.4 counts a run's budget from `run` to `run_done`; section 2.2 makes each test case its own run.
- **`exit(0)` in the program still runs the follow-up code**, because the program finished without an error (section 2.2, step 4).
- **The property tests use a 70-line seeded generator** (`scripts/testing/property.ts`) instead of a new dependency. It has no shrinking: a failure names the seed and the input as drawn.
- **A learner function that calls `exit()` while the follow-up code runs ends that stage cleanly** (security review 2, MINOR 6). Python ends with status 0, so the harness counts it as finished, as for `exit(0)` in the program. A test case whose follow-up code only asserts, with an empty expected text, then passes. Section 2.2 says a test case fails when the follow-up code raises an error; whether `SystemExit` there counts is for you, with action 5.
- **Output cut with no error is graded `output_limit`** (security review 2, MINOR 3). The spec does not name the reason for this case; the controller already reports a cut run this way.
- **`HARNESS_VERSION` stays "1"** although the Python changed again. No harness version has shipped, so no cached worker holds an older one; the hash in `harness.test.ts` is updated.
- **The worker's URL moved** to `/_runtime/worker/runtime/worker/python-worker.js`, because the worker now compiles from `src`.

## Not fixed, for later packages or for you

- **Validate must ask for a fresh worker before each program it validates** (WP-3.1 security review 3, MAJOR 1; WP-3.3 security review 1, MAJOR 1). A program can rewrite the harness's closure, as it can the run support's, and the change lasts until the worker is replaced. For a learner this only touches their own results. The controller now offers `freshWorker`; WP-4.3 must use it. No isolation stops a hostile lesson from forging its own pass.
- **The run support and the harness each restore the state** with their own copy of the same routine. Moving Run onto the harness would leave one copy; that changes WP-3.1's tested code and is left for WP-3.4 or later.
- **Hooks other than trace and profile** (security review 2, MINOR 5): `sys.monitoring` callbacks, `gc.callbacks`, audit hooks, `sys.excepthook` and `sys.unraisablehook` set by one test case stay for the later ones on the same worker. A fresh worker is the control.
- **The lint rule's remaining bypasses** (security review 2, MINOR 4), for you.
- **FR-GRD-07** (naming a near miss) is a Should requirement for a later package.

## Risks and rollback

- The worker's URL changed. Nothing outside this repository loads it, and the development page takes it from `WORKER_URL`.
- No learner page uses the grader yet, so reverting the merge rolls everything back.

## Definition of Done

- [ ] Every "Done when" line is met, with evidence above. **Not met:** the three browser engines (written, not run).
- [x] Every cited Must requirement has a test that names its ID. The browser tests have not run.
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
