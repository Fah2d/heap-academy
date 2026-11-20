**Merges after #4 and WP-3.1.** #4 itself merges after #3. This branch starts from `wp/3.1-python-worker` at 942ff46, so until WP-3.1 merges this pull request also shows WP-3.1's commits. It is a **draft**: no browser test has run (no browser can start in the sandbox that built it). It touches files WP-3.3 also changes (`controller.ts`, `core.ts`, the controller tests); whichever merges second needs a rebase.

## What and why

Live input (architecture section 5.3, ADR-0005). Where the browser has WebAssembly stack switching, a program that calls `input()` pauses, the page shows the prompt and an answer line, and the program continues with the answer. Where it does not, the batch path of WP-3.1 stays: answers are given before Run. The capability is detected at `ready` by a real wait, never assumed from the browser, and time spent waiting for the learner is not counted against the 5 second limit.

## Work package

- Work package: WP-3.2 Live input.
- Requirements: FR-WSP-08, NFR-COMPAT-04.
- Time box 2 hours. Started 07:00 on 2026-11-20; last commit before review 07:10; review fixes done at 07:29. The time box was not reached.

## What changed

| Item | Where |
|---|---|
| The interactive reader. For an interactive run, `sys.stdin` is a reader whose every line comes from the page: it flushes the program's output, so a prompt without a newline arrives first, then asks with `request_line` and waits with Pyodide's `run_sync`. A line gets its newline added. The end of input, an answer that is not text, or a read where the run cannot wait (an old run's reader kept by the program, say) gives `""` from then on, so `input()` raises `EOFError` and the run ends with `input_ended`. `readline(size)`, `read(size)`, `read()` and iteration work. The reader looks no builtin up by name, and it subclasses `_io._TextIOBase`, a C type a program cannot change (a program could change `io.TextIOBase` to see later answers). Standard input is restored after the run as before. | `src/runtime/worker/run-support.ts` |
| Capability detection at load: `WebAssembly.Suspending` and `WebAssembly.promising` exist, the runner has `callPromising`, and a probe that waits on a promise through `run_sync` gets the promised value back. Only then does `ready` say `interactiveInput: true`. | `src/runtime/worker/core.ts` |
| Interactive runs: entered with `callPromising(source, requestLine)`. `requestLine` waits, and posts `input_request` from a task of its own (a host `later`, taken before the lock-down), which the worker runs only once Python has suspended: a program that takes `request_line` out of the reader's closure and keeps computing asks the page nothing, so the clock keeps running. The prompt is flushed in that task. One request at a time (a second call while one waits gets the end of input and posts nothing). An `input` or `input_end` for the waiting run, after the request was posted, answers it; any other is dropped. The worker entry acts only on trusted message events, so a program cannot dispatch its own `input` or `run`. An interactive run where `ready` did not offer one is refused. A run's `durationMs` leaves out the time spent waiting. Batch runs are unchanged and stay synchronous. | `src/runtime/worker/core.ts` |
| Controller: a run is interactive where the worker can pause and no lines are given, and batch otherwise. At `input_request` the status becomes `awaitingInput` (the statechart's name) and the clock stops; `sendInput(line)` and `endInput()` answer, and the clock resumes with what is left of the limit. Stop and a crash work while waiting. An input request from a batch run, a second one, or one for another run is dropped and reported. Events `input_request`, `input` and `input_end` let the console echo the answer. `interactiveInput` is readable. | `src/runtime/controller.ts` |
| Protocol: an `input` line with a newline is refused, as a batch line is. | `src/runtime/protocol.ts` |
| Development page: an answer field with Send and End input while the program waits; the answer is echoed after the prompt. A refused answer stays in the field with the reason, and the field holds at most the protocol's limit. The batch field stays: with answers in it, the run is batch; empty, it is interactive where the runtime can pause, as a hint says. | `src/features/workspace/`, `src/messages/runtime-dev.ts` |
| Unit tests get stack switching on Node 24, which CI uses, through `--experimental-wasm-jspi`, passed only when `WebAssembly.Suspending` is missing (Node 26 refuses the flag and has the feature). | `vitest.config.ts` |

## How it was verified

`pnpm verify` on the review fixes, the last commit of this branch (Node 26.13.1):

```
$ pnpm format:check && pnpm lint && pnpm typecheck && pnpm attribution && pnpm test
$ prettier --check .
All matched files use Prettier code style!
$ eslint --max-warnings=0 .
$ tsc --noEmit
$ node scripts/check-attribution.mjs --branch && node scripts/check-attribution.mjs --files
$ vitest run --coverage
 Test Files  28 passed (28)
      Tests  678 passed (678)
```

Coverage of the changed files, as `pnpm test` prints them (no gate applies outside `src/domain` and `src/grader`):

```
  runtime-view.ts  |   86.66 |    92.85 |     100 |   86.66 | 60-61
  controller.ts    |   91.78 |    83.33 |     100 |    98.4 | 275-276
  core.ts          |   90.62 |    86.13 |     100 |   96.29 | ...36,183,355-356
```

The uncovered lines of `runtime-view.ts` are the `never` branch.

**`pnpm build`** with the `.env.example` values, as CI sets them, on the review fixes: exit 0.

**The compiled worker with real Pyodide.** `public/_runtime/worker/worker/core.js`, driven under Node 26.13.1 with Pyodide 314.0.7 and a fake host (no lock-down, no worker policy, no browser), after the review fixes. Each answer was given after moving the host's clock on 10 seconds:

```
{"type":"ready","runtimeVersion":"314.0.7","capabilities":{"interactiveInput":true}}
two ["Name? ","input_request","Age? ","input_request","Sara is 12\n"] {"kind":"ok"} duration 7
ended ["A? ","input_request","B? ","input_request","Traceback (most recent call last):\n  File \"main.py\", line 2, in <module>\n    b = input(\"B? \")\nEOFError: EOF when reading a line\n"] {"kind":"input_ended","message":"EOFError: EOF when reading a line","line":2} duration 5
readlines ["input_request","one\n","input_request","input_request","input_request","10\n"] {"kind":"ok"} duration 8
next ["1\n"] {"kind":"ok"} duration 2
```

**Tests added**, each title carrying its requirement:

- `src/runtime/worker/interactive.test.ts`, real Pyodide under Node: the capability found at ready; `input()` twice, each prompt before its request; a 10 second wait per answer left out of the duration; `input_ended` at the line that read past the end; `readline` and `read()`; the next run gets the runtime's own standard input back; a batch run on a runtime with the capability; an old run's reader, kept by the program, gives the end of input and posts no request, in an interactive and a batch run; a program that takes `request_line` from the reader's closure and keeps computing asks nothing; a prompt written with `sys.stdout.write` and 40 lines before `input()` both arrive before the request; a program that changes `io.TextIOBase` sees no later answer; a late answer dropped. Each of these was checked against a mutant: posting at once, no flush in JavaScript, no flush in Python, `io.TextIOBase` as the base, and no check for an old run each fail at least one test. Then, with `WebAssembly.Suspending` removed before the runtime loads: no capability at ready; the batch path passes the same program; `input_ended` past the answers; an interactive run refused.
- `src/runtime/worker/run-support.test.ts`, the reader in CPython with a fake wait: answers with newlines and prompts written before each request; the end of input and no further requests; `readline(2)`, `read(5)`, `read()`, iteration; no request where the run cannot wait; an answer that is not text; standard input restored; no instance attributes, and the reader working after builtins are deleted.
- `src/runtime/worker/core.test.ts`: the capability offered only when the probe's wait returns the promised value; one request at a time, a wrong run's answer dropped, the wait left out of the duration; an interactive run whose runtime fails.
- `src/runtime/protocol.test.ts`: an answer of two lines refused.
- `src/runtime/controller.test.ts`: interactive where the worker can pause, batch where it cannot or when lines are given; wait, answer, echo; a 10 second wait does not reach the time limit; execution before and after a wait counts together (3 s, a 60 s wait, then the limit 2 s later, with `durationMs` 5,000); `input_end`; Stop and a crash while waiting; answers refused when nothing waits and when too long; input requests from a batch run, a second one, and another run's dropped.
- `src/features/workspace/client/runtime-view.test.ts`: the capability at ready; the wait, and the echo after the prompt; the failed state.

**Not run, owner to run:** `e2e/live-input-runtime.spec.ts`, in each of `runtime-chromium`, `runtime-firefox` and `runtime-webkit`: `input()` twice with the answers echoed; a 10 second wait on the page's clock (`page.clock`) that does not reach the limit; End input; Stop while waiting; a program that dispatches its own `input` and `run` message events changes nothing; and, with the worker script served with `WebAssembly.Suspending` deleted first, the batch path passing the same program and ending with `input_ended` past the answers. `npx playwright test --list --project=runtime-chromium` loads it: "Total: 22 tests in 2 files" (7 here, 15 in `runtime.spec.ts`). It opens `/dev/runtime`, which routes once #3 is merged.

```sh
pnpm test:e2e e2e/live-input-runtime.spec.ts --project=runtime-chromium --project=runtime-firefox --project=runtime-webkit
```

**Not verified:** the unit tests on Node 24. CI uses Node 24, where stack switching needs the flag `vitest.config.ts` adds; no Node 24 was available here.

## Screens

The development-only runtime page gains an answer field, Send, End input, and a hint; learners never see it. No learner-facing screen or copy changes. antislop Delivery Gate: not applicable.

## Reviews

Round 1, on 942ff46..8b14df0:

- Code review: `docs/reports/reviews/WP-3.2/code-review-1.md`. CHANGES REQUIRED: no blocker, two majors, four minors.
- Security review: `docs/reports/reviews/WP-3.2/security-review-1.md`. CHANGES REQUIRED: no blocker, two majors, two minors. The reviewer said it still had background work running when it reported; no later report arrived before this was written.

| Finding | What was done |
|---|---|
| Code MAJOR 1, security MAJOR 1 attack 1: `request_line` taken from the closure stops the clock while the program runs | `input_request` is posted from a later task, only once Python has suspended. Test, and a mutant check. Comments, test title and this description corrected. |
| Security MAJOR 1 attack 2, MAJOR 2: a program dispatches its own `input` or `run` | The worker entry drops untrusted message events. Browser test written (not run). |
| Security MAJOR 1 attack 3: code from a `setTimeout` callback runs during a real wait | Not closed. See owner action 3. |
| Security MAJOR 2, reading: a listener added by a program sees later page messages | Not closed. See owner action 3. |
| Code MAJOR 2: both prompt flushes could be removed with no test failing | Two tests; each mutant now fails. |
| Code MINOR 1: the old-reader test did not reach its guard | Runs the second program interactively too; the mutant now fails. |
| Code MINOR 2, security MINOR 2: an answer with a newline | Refused by the protocol. Test. |
| Code MINOR 3: a refused answer disappeared | Kept, with the reason; the field is capped. |
| Code MINOR 4: the batch test passed without the capability removed | The check is in `beforeEach`. |
| Security MINOR 1: a program could change `io.TextIOBase` | The reader subclasses `_io._TextIOBase`. Test, and a mutant check. |

No second review round ran. The fixes have not been reviewed.

## Try it

With #3 merged, `pnpm dev`, open `/dev/runtime` in a current browser, leave Input empty, and run the sample program: the page waits for the name.

## Owner actions now due

1. After #3, #4 and WP-3.1 are merged, run the browser tests (command above) and paste the output.
2. The security reviewer reported a probe of its own (`node main.mjs own`, started from the sandbox) that may still be running and that the sandbox cannot see or stop. Check from your own terminal: `pgrep -fl "main.mjs own"`, and stop it if it is there.
3. Decide on two residual risks (security review 1, MAJOR 1 attack 3 and MAJOR 2): (a) code a program schedules with `setTimeout` can run while a real `input()` waits, so the program computes with the clock stopped until the learner answers, ends input, or stops; (b) a message listener a program adds sees the later page messages to its worker, including the learner's own answers. Both touch only the learner's own tab and worker, and Stop works. Closing (a) needs a liveness check while waiting, and (b) a `MessagePort` for the protocol; both change architecture section 5.2 and need an ADR. The default is to record both in `06-security-privacy.md` section 6 through a `spec-change` pull request.
4. Watch the first CI run of this branch on Node 24 for `src/runtime/worker/interactive.test.ts`. If the flag does not give Node 24 stack switching, the choice is moving CI to Node 26 or another way to get it; that is yours.

## Deviations from the plan or the spec

- **A run with answers given is batch even where the runtime can pause.** Section 5.3 chooses the strategy by capability; the controller does so when no lines are given. The development page needs both paths in one browser, and WP-3.1's tests send answers up front.
- **A program that calls `request_line` without waiting breaks its own later `input()`:** that call is still the one waiting, so the next real read gets the end of input. Only such a program is affected.
- **A read that cannot wait is the end of input.** Section 5.3 does not say what a read outside the run's wait does; ending the input keeps the clock honest.

## Not fixed, for later packages or for you

- The workspace console (WP-5.2) shows the prompt, the answer line and the echo for learners, with FR-WSP-08's message for `input_ended` explaining the Input field in batch mode.

## Risks and rollback

- Where detection is wrong in a browser, runs fall back to batch, which is WP-3.1's tested path.
- Nothing outside the development page uses the controller yet, so reverting the merge rolls everything back.

## Definition of Done

- [ ] Every "Done when" line is met, with evidence above. **Not met:** the three browser engines (written, not run).
- [x] Every cited Must requirement has a test that names its ID. The browser tests have not run.
- [x] `pnpm verify` and `pnpm build` pass.
- [x] Every state of every changed view exists: waiting for input, answered, ended.
- [x] No stub, dead control, placeholder, commented-out code, or invented number.
- [x] No new tables. No new server actions.
- [x] Every reviewer blocker is fixed. There were none; two findings are left for your decision (owner action 3). See Reviews.
- [x] No AI attribution in any commit or in this description.

## Opening this pull request

`gh` cannot reach GitHub from the sandbox. From your terminal in the repository root:

```sh
gh pr create --draft --base wp/3.1-python-worker --head wp/3.2-live-input \
  --title "feat(runtime): WP-3.2 live input" \
  --body-file docs/reports/pull-requests/WP-3.2.md
```

GitHub retargets it when WP-3.1's branch merges and is deleted.
