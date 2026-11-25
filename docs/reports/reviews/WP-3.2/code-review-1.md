# WP-3.2 code review 1

- Reviewer: code-reviewer subagent, fresh context
- Range: 942ff46..8b14df0 on `wp/3.2-live-input` (38cd684, e628f33, 9e2fdd5, 000945b, 8b14df0), stacked on `wp/3.1-python-worker`
- Date: 2026-11-20
- Verdict: CHANGES REQUIRED. No blocker, two majors, four minors.

The reviewer works read-only. The implementer saves this report from its final message, unchanged.

## "Done when" status

| Line | Status |
|---|---|
| A program that calls `input()` twice passes in three engines | Not met. It passes under Node with real Pyodide 314.0.7 (`interactive.test.ts`, 13 of 13). `e2e/live-input-runtime.spec.ts` has not run in any engine. |
| With the capability removed, the batch path passes the same program | Under Node, yes: `WebAssembly.Suspending` is deleted before load, `ready` says `false`, and the batch path passes. The browser version has not run. |
| A ten second wait for input does not reach the time limit | Yes at unit level, in the controller (`controller.test.ts`, fake timers) and the worker (`interactive.test.ts`, `durationMs < 1000` after two 10 s waits). The browser version (`page.clock`) has not run. Caveat: MAJOR 1. |

## Findings

**MAJOR 1** `src/runtime/worker/run-support.ts:102-131` and `src/runtime/worker/core.ts:237-253`: a program can stop the page's clock and keep running, which defeats FR-RUN-02 (Must).
- The comment says the reader's state "lives in the closure, so a program cannot reach the page's function through it by an attribute". It can: `__closure__` is an attribute.
- Calling `request_line()` makes the worker post `input_request` at once, before Python has suspended. The controller then clears the timer (`controller.ts:256`) and waits for an answer, while the program runs on.
- Probe: real Pyodide under Node, driving the core copied unchanged from this branch.
  ```python
  import sys
  fill = [c.cell_contents for c in type(sys.stdin).readline.__closure__ if getattr(c.cell_contents, "__name__", "") == "fill"][0]
  request_line = fill.__closure__[fill.__code__.co_freevars.index("request_line")].cell_contents
  request_line()
  n = 0
  while n < 3_000_000: n += 1
  print("kept running", n)
  ```
  Posted, in order: `"JsProxy\n"`, `input_request(run-1)`, `"kept running 3000000\n"`, `run_done(run-1)` with `durationMs: 0`.
  - On the page, `status` is `awaitingInput` with no timer from the `input_request` on. A `while True: pass` there runs until Stop.
  - If the learner answers, the time the program was busy is also subtracted from `durationMs` (`core.ts:248`).
- Limits of the damage: Check uses batch, so grading is not affected. The tab does not freeze, and Stop works.
- The test that claims this is covered only checks `vars(sys.stdin)` (`run-support.test.ts:449`, "[FR-RUN-04] the reader keeps its state out of reach of attributes"). The PR repeats the claim at line 65 ("no state reachable through attributes").
- Fix:
  - Post `input_request` only once the stack has really switched, for example from a `queueMicrotask` in `requestLine`. The worker thread cannot run a microtask while Python runs without suspending.
    - Probe with that one-line change: `"kept running 3000000\n"` comes before `input_request`, so the clock ran during the loop.
    - Two answered `input()` calls still pass, and all 139 tests in `src/runtime` pass.
  - Add a Pyodide test with the program above. It must reach the time limit, or post nothing before its output.
  - Correct the comment, the test title and the PR.
  - A program that calls `request_line()` and then suspends by some other means (`pyodide.ffi.run_sync` on another promise) still gets through. Record that as a residual risk for the owner, beside ADR-0004's.

**MAJOR 2** `src/runtime/worker/run-support.ts:117-118` and `src/runtime/worker/core.ts:239-241`: both flushes that put the prompt on screen before the wait can be removed without any test failing. They are what makes FR-WSP-08's "the console shows the prompt" true.
- Mutation run: copies of `src/runtime` with the 4 relevant test files (87 tests), real Pyodide.
  - m0, unchanged: 87 passed.
  - m2, Python `flush()` in `fill` removed: 87 passed.
  - m3, JS `output.flush()` in `requestLine` removed: 87 passed.
- Why they survive: `input()` flushes `sys.stdout` itself, and the output collector sends its first writes at once (burst). Every prompt test uses `input()` with little output before it.
- Both flushes matter. Probe output:
  - m2, `sys.stdout.write("Q? ")` then `sys.stdin.readline()`: `input_request(run-1) | "Q? got 7\n"`. The prompt arrives after the answer.
  - m3, 20 `print` lines then `input("Q? ")`: `... "7\n" | input_request(run-2) | "8\n9\n...19\nQ? "`. The learner waits with no prompt on screen.
- Fix: two tests in `interactive.test.ts`:
  - a prompt written with `sys.stdout.write` (or `print(..., end="")`) and then read with `sys.stdin.readline()`;
  - more lines than the burst before `input()`.
  Each asserts the prompt text comes before `<input>` in the transcript.

**MINOR 1** `src/runtime/worker/interactive.test.ts:168-176`: the test for an old run's reader does not exercise the guard it is named for (`state !== running`, `core.ts:238`).
- Its second run is batch. There `can_run_sync()` is false, so the reader ends before `request_line` is called.
- Mutation m1, `|| state !== running` removed: 87 passed.
- Probe with an interactive second run on m1: `input_request(run-1)` is posted with the old run id, and the run hangs. The page drops the request, and the run ends only at the time limit. Unchanged: `"''\n" | run_done(run-2)`.
- The PR (line 17) puts this case down to "a read where the run cannot wait". That is true only for a batch run.
- Fix: run the second program in interactive mode, and assert no `input_request` and `''`.

**MINOR 2** `src/runtime/protocol.ts:218-220` with `run-support.ts:123`: an `input` line may contain `"\n"`, and the reader turns it into two answers. Batch `stdin` lines with a newline are refused (`protocol.ts:165`).
- Probe: `parsePageMessage({type:"input", line:"a\nb"})` gives `ok: true`, while batch stdin `["a\nb"]` gives `invalid_field`.
- A program with two `input()` calls given the answer `"a\nb"` asks once and prints `['a', 'b']`.
- The dev page's `<input>` cannot produce this, but `sendInput` is the API the WP-5.x workspace will call.
- Fix: refuse `"\n"` in `input.line` in the schema, as for batch, and test it.

**MINOR 3** `src/features/workspace/client/use-runtime.ts:53-55` and `components/runtime-console.tsx:79-80`: `sendInput`'s result is thrown away and the field is cleared anyway.
- An answer longer than 10,000 characters is refused (`invalid`). It disappears and nothing is shown, so the program waits with no explanation. That is a silent failure.
- Fix: return the `InputRequest`, and keep the text and show the refusal when `ok` is false. Otherwise cap the field at `STDIN_LINE_LENGTH_LIMIT`.

**MINOR 4** `e2e/live-input-runtime.spec.ts:109-115`: the batch test that reads past the end passes whether or not the capability was removed. With text in Input, the console sends a batch run either way (`runtime-console.tsx:56`).
- Only the previous test checks that the hint is absent.
- If `page.route` does not catch the worker script in some engine, this test still goes green.
- Fix: also assert `inputHint` has count 0 here, or move that check into `beforeEach`.

## Checked and sound

- Races between input and the end of a run:
  - an answer for a run that is not waiting, or for another run id, is dropped (`core.ts:326`); the core test proves the run-id check;
  - an `input_request` from a terminated worker is ignored (`live()`);
  - a second request while one waits gets `undefined` and posts nothing;
  - `run_done` while `awaitingInput` ends normally;
  - Stop and a crash while waiting restart the worker and report `durationMs` without the wait.
- Time accounting in the controller:
  - `pause` and `resume` with what is left of the limit; the tests catch both a missing pause and resuming with the full limit;
  - the latency of sending a message is counted against the program, which errs on the safe side.
- Isolation: `sys.stdin` comes back from `sys_snapshot` after every run (tested). An old reader in a later run gets the end of input (see MINOR 1 for the test).
- Batch runs are still synchronous: the batch branch has no `await`.
- The default pool is `forks`, so `execArgv` goes to child processes, which accept V8 flags.

## What the reviewer ran

- `git log --format=fuller 942ff46..8b14df0`: every author and committer is Fahad. No attribution. The diff adds no skip, `.only`, suppression, retry or TODO.
- `pnpm verify` at 8b14df0, Node 26.13.1: format, lint, types and attribution passed; `Test Files 28 passed (28)`, `Tests 673 passed (673)`.
- `vitest run src/runtime/worker/interactive.test.ts --reporter=verbose`: 13 passed, all against real Pyodide.
- Probes in the session scratchpad: copies of `src/runtime` driven under Vitest with real Pyodide 314.0.7.
  - Reaching `request_line` through `__closure__` (MAJOR 1).
  - Mutants m1, m2 and m3 against the 4 test files, with the unchanged copy m0 as control.
  - Answers containing a newline.
  - The microtask variant, m4, against all of `src/runtime`.

## Not checked

- No browser. `e2e/live-input-runtime.spec.ts` has not run. Still open:
  - whether Playwright's WebKit and Firefox builds have JSPI. If one does not, the interactive tests fail there and the three-engine line is not met;
  - whether `page.route` catches a dedicated worker's script in Firefox and WebKit;
  - whether `route.fulfill({ response, body })` keeps working if the dev server compresses the worker script;
  - whether `page.clock` drives the controller's timers as intended.
- Node 24 with `--experimental-wasm-jspi`, which is what CI uses. Not available here.
- Whether `setTimeout` (and so `asyncio.sleep` through `run_sync`) is still there after the worker's lock-down. This decides how wide the residual in MAJOR 1 is.
- `pnpm build`. The reviewer relied on the PR's report.
- Out of scope: the owner's uncommitted `.claude/settings.json`. `docs/reports/pull-requests/WP-3.2.md` is untracked and was read only for its claims.
