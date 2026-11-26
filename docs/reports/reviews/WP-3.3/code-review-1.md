# WP-3.3 code review 1

- Reviewer: code-reviewer subagent, fresh context
- Range: 942ff46..1da8b48 on `wp/3.3-grader` (772c468, e3811d1, a80e0ca, 79170b2, 1da8b48)
- Date: 2026-11-20
- Verdict: CHANGES REQUIRED. No blocker, two majors, nine minors.

The reviewer works read-only; the implementer saved this report from its final message, unchanged.

## Done when

| Line | Status |
|---|---|
| Unit tests cover pass, fail, learner error, follow-up code error, and time limit | Met: `harness.test.ts`, `grade.test.ts`, `runner.test.ts:113`. |
| A run that deletes builtins does not affect the next | Met for deleting and replacing builtins (`harness.test.ts:138`, parity case). A builtin *added* in one test case is not tested (MINOR 3). |
| The section 7 example lesson gives the stated verdicts under Node | Met: `runner.test.ts:28` and three parity cases pass in `pnpm verify`. |
| The same, in three browser engines | Not verified. `e2e/grader-parity-runtime.spec.ts` has not run anywhere. The PR says so. |
| Coverage in `src/grader` meets the threshold | Met as the tool measures it: 97.43 statements, 97.61 branches, 96.92 lines. The Python harness is a string constant, so none of its branches are measured (MINOR 6). |

## Findings

**MAJOR 1** `src/grader/harness.ts:176-180, 213-215, 220-222`: learner code can make the harness raise. Section 3.1 says it "never raises to the caller", and the PR claims "every outcome a structured result".
- `finished(error)` runs inside the `except` handler with no guard of its own, and it reads `error.code`. A `SystemExit` subclass whose `code` property raises therefore escapes `check()`, and the closing `restore()` never runs.
- Probe, real harness under Pyodide 314.0.7 through `loadHarness()`: `class E(SystemExit):\n    @property\n    def code(self):\n        raise ValueError('boom')\nraise E()` gave `THREW PythonError`.
- Second route: a hook set with `sys.setprofile(lambda *a: print('P'))` runs inside the harness after the program ends. Probe: `THREW PythonError`.
- Effect: the worker posts `fatal runtime_crashed` (`core.ts`, catch around `check`), and the Node thread dies. The learner sees a crashed Python instead of an error in their own program. This is the same class of bug as WP-3.1 code review 2, MAJOR 2, which was fixed in the run support.
- Fix:
  - Compute `finished` inside its own `try`, treating a raise as "not finished".
  - Read `code` with `attribute(error, "code", None)` under that guard.
  - Wrap the body of `check` in an outer `try/except base_exception` that restores the state and returns a fixed `runtime` result.
  - Clear trace and profile hooks in `restore()` (see MINOR 2).
  - Add tests for both probes. Each must get a structured result, and the next test case must run normally.

**MAJOR 2** `src/grader/harness.ts:168-172`: a typo inside the learner's own function is reported as a name the test needs.
- `name` is set for any `NameError` at stage `after_code`, wherever it was raised. It does not check whether the error came from the follow-up code or from the learner's code.
- Probe: program `def area(w, h):\n    return wdth * h`, follow-up `print(area(3, 4))`. Result: `"line": 2, "name": "wdth"`, graded `after_code_error` with `missingName: "wdth"`.
- Section 2.2 turns `missingName` into "This test needs something named `wdth`". That is wrong: the test needs `area`, which exists, and the learner misspelled a variable on line 2.
- Typos inside a function body are among the most common beginner mistakes in function lessons. `UnboundLocalError` (a `NameError` subclass, e.g. `x += 1` in a function) takes the same path.
- `harness.test.ts:79` covers a `ZeroDivisionError` raised inside the function, but not a `NameError`.
- Fix: set `name` only when the innermost traceback frame's `co_filename` is `test_file`. Add a test: a typo inside a function called from the follow-up code gives `line: 2` and no `missingName`.

**MINOR 1** `src/grader/harness.ts:105-117` and `:170`: learner-reachable values break the bounds that `parseHarnessResult` enforces, and the test case becomes `crashed`.
- The output cap counts only exact `str` writes, and `room` is an attribute the learner can rewrite:
  - `sys.stdout.write(S('x'*1000))` with `class S(str)`, written 100 times, produced 100,094 characters of output.
  - `sys.stdout.room = 10**12` produced 100,685.
  - Both are past `HARNESS_OUTPUT_LIMIT`, so `parseHarnessResult` returns `undefined` and the worker dies.
  - FR-RUN-03's acceptance line is "A print loop cannot grow memory without bound". A write loop through either route can, until the time limit.
- `NameError.name` is not truncated, but `grade.ts:127` refuses more than 200 characters. A 250-character misspelled identifier, or `raise NameError(name='n'*300)`, gave `parsed: UNDEFINED`.
- Fix:
  - In `Capture.write`, accept `str` subclasses (`is_subclass`) and convert them with `str.__str__`.
  - Keep `room` and `truncated` in closure state, not on the instance.
  - Have the harness drop or cut `name` at a limit exported next to `HARNESS_MESSAGE_LIMIT`, and use that constant in `grade.ts:127` instead of the literal 200.

**MINOR 2** `src/grader/harness.ts:119-126`: isolation does not reset interpreter settings that live outside `sys.__dict__`.
- Probe: test case 1 ran `sys.setrecursionlimit(40)`. Test case 2, a correct recursion to depth 100, then failed with `RecursionError`.
- `settrace` and `setprofile` hooks also persist, and they run inside the harness (MAJOR 1).
- Section 5.5 does not list these, so this is not a spec violation. A learner only harms their own results.
- Fix: snapshot `sys.getrecursionlimit()` at load and restore it. Call `sys.settrace(None)` and `sys.setprofile(None)` through held references in `restore()`. Otherwise record these as residual risk next to ADR-0004.

**MINOR 3** `src/grader/harness.test.ts:138`: no test notices if `dict_clear(builtins_dict)` is removed from `restore()`.
- Mutation probe (harness text with that line removed): the scenario of test 138 still prints `3 2`, so the test passes.
- But `builtins.leftover = 7` in one test case then let `print(leftover)` print `7` in the next.
- Fix: add a test case that adds a builtin, and expect `NameError` in the next.

**MINOR 4** `src/grader/test-case.ts:37`: `CHECK_TEST_LIMIT = 50` is an invented number. The spec has one.
- `04-content-system.md` section 1.3 says `tests` is "1 to 12 test cases". Section 1 also says the one schema exists "so a limit is written once".
- The PR's deviation ("Section 2.1 gives no number") looks only at section 2.1.
- Fix: one constant of 12, shared with the lesson schema when it is written, or an owner decision if checks need more. Correct the PR text.

**MINOR 5** `e2e/grader-parity-runtime.spec.ts:51-73`: the browser parity test has its own copy of the controller's clock and builds the `time_limit` and `not_run` verdicts itself.
- For the runaway case, the browser side therefore checks only that the worker sent one result and then went quiet. The product's `controller.check()` and `startCaseClock` never run against a real worker in any engine. They are tested only with a fake worker.
- Also, each `next()` call adds an `error` listener that is never removed.
- Fix: drive the real controller in the browser. WP-3.4's development page, which runs a check, is the natural place. Until then, say in the spec comment that the clock is the test's own.

**MINOR 6** `src/grader/harness.ts:21`: nothing makes anyone bump `HARNESS_VERSION` ("Change it with any change to the Python below"), and the coverage gate cannot see the Python.
- The worker refuses an `init` of another version so that a stale cached worker is never trusted. A forgotten bump defeats that check without anyone noticing.
- Fix: a test that pins a hash of `HARNESS_DEFINITION` next to the version, so changing the Python fails until both are updated. In the PR, say that NFR-MAINT-02 is met for the TypeScript only, and that the harness is covered by behavior tests.

**MINOR 7** Test titles and comments that do not match what they do:
- `harness.test.ts:145`: the title says the follow-up code "gets the builtins back even when the program deleted them". The test asserts the opposite: `NameError: name 'print' is not defined`, with restoration only in the next test case.
- `runner.test.ts:136`: cites FR-RUN-04 (isolation) for a thread crash, which is FR-RUN-06.
- `parity-cases.ts:3`: names `e2e/grader-parity.spec.ts`. The file is `e2e/grader-parity-runtime.spec.ts`.

**MINOR 8** The Node runner and the worker decide some edge cases differently, which weakens FR-GRD-04.
- `node-runner/runner.ts:104` does not refuse a result of another harness version. `core.ts` does.
- The runner keeps its thread after a `memory` error. The controller replaces the worker.
- `grade.ts:176` passes `allowMissingName: true` for any stage. A `program`-stage `missingName` is accepted by the worker but refused by the page's `parseTestResult` (`grade.ts:288`).
- None of these is reachable with today's harness, but each is a second rule for one case.
- Fix: pass `stage === "after_code"`, check the version in the runner, and discard the thread after `memory`.

**MINOR 9** `docs/reports/pull-requests/WP-3.3.md`: the evidence differs from what the tools print.
- The PR pastes `Tests 785 passed (785)` "at 1da8b48". `pnpm verify` at 1da8b48 printed `Tests 786 passed (786)`.
- NFR-PERF-06 is stated as met. The 500 ms check is measured under Node (`runner.test.ts:91`). The browser figure the requirement names ("on a laptop") is not measured. Say so.

## Design choices asked about

- **Comparison in TypeScript.** Sound. `grade` runs in both the worker and the Node runner, and the rules are property-tested where they are written. Mutants that trim leading whitespace, ignore case, skip lone `\r`, keep trailing blank lines, or skip normalizing `expected` under `contains` are each caught by a property.
  - Spec gap for the owner: `contains` with an empty `expected` always passes, and the parser allows it.
- **`not_run` after a time limit.** Reasonable, and declared as a deviation. Validation fails on rule 5 either way. It needs the owner's decision, because section 2.2 does not say what happens to the rest.
- **Output captured in Python, Pyodide's streams discarded.** Acceptable. One consequence: output through `sys.__stdout__` or `os.write(1, …)` shows in Run but not in Check. The cap is weaker than it looks (MINOR 1).
- **Follow-up code after `exit(0)`.** Consistent with section 2.2 step 4. `exit(0)` inside the follow-up code ends it quietly, with no error. Probe: output `1\n`, error `null`.
- **`CHECK_TEST_LIMIT 50`.** See MINOR 4.
- **Known tampering of the harness closure.** Not re-reported. MAJOR 1 is different: it needs no tampering, only a crafted exception or a profile hook.

## What the reviewer ran

- `git log --format=fuller 942ff46..1da8b48`: all five commits have Fahad as author and committer. Messages and diff searched for Claude, Anthropic, co-author and "generated with": none. The diff adds no `.skip`, `.only`, `skipIf`, suppression comment, retry or TODO.
- `pnpm verify` at 1da8b48: exit 0, `Test Files 32 passed (32)`, `Tests 786 passed (786)`. The coverage rows for `src/grader` are as quoted above.
- Node 26.13.1 probes of the real harness in Pyodide 314.0.7 through `src/grader/node-runner/host.ts`, scripts in the session scratchpad:
  - `SystemExit.code` property: raises.
  - `str`-subclass writes: 100,094 characters.
  - `room` overwritten: 100,685 characters.
  - Caught output-limit flood.
  - `exit(0)` in follow-up code.
  - Raising `lineno` and `name` properties: fall back correctly.
  - Recursion: correct.
  - Typo inside a function: `missingName` set.
  - 300-character and 250-character names: parse refused.
  - `setrecursionlimit` carry-over: confirmed.
  - `setprofile`: raises.
- Mutation probe: the harness text without `dict_clear(builtins_dict)`.
- Read: WP-3.3 and its six requirements; `04-content-system.md` sections 1 to 3 and 7; `02-architecture.md` sections 4.1 and 5.2 to 5.5; ADR-0032; `.claude/rules/runtimes.md`, `testing.md` and `typescript.md`; the full diff and the PR description.

## Not checked

- No browser. `e2e/grader-parity-runtime.spec.ts` did not run, so the browser half of the section 7 Done-when line is unverified.
- `pnpm build`. The reviewer relied on the implementer's report.
- The compiled worker under real Pyodide with lock-down. Only the harness was probed, through the Node host.
- Interaction with WP-3.2's interactive input, which is not on this branch.
- The antislop code-comment pass was not run.
- Out of scope: the working tree has an uncommitted change to `.claude/settings.json`. It is not in this range.
