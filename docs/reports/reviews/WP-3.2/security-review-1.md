# WP-3.2 security review 1

- Reviewer: security-reviewer subagent, fresh context
- Range: 942ff46..8b14df0 on `wp/3.2-live-input` (38cd684, e628f33, 9e2fdd5, 000945b, 8b14df0), stacked on `wp/3.1-python-worker`
- Threats in scope: T-01, T-02, T-07, ADR-0005, architecture sections 5.2 to 5.5, and T-22 and T-23 for later work
- Date: 2026-11-20
- Verdict: CHANGES REQUIRED. No blocker, two majors, two minors. Nothing in this range lets a non-admin change content or read a solution.

The reviewer works read-only; the implementer saved this report from its final message, unchanged except that the scratchpad path of the probe scripts is shortened to their file names. The reviewer said it stopped with background work of its own still running, so this may be its interim report.

## Answers to the questions

- **Can a program wait on its own promises? Yes, but only in interactive runs.** Probe `own`: in an interactive run, `can_run_sync True` and `awaited value`. In a batch run it fails with `RuntimeError: Cannot stack switch because the Python entrypoint was a synchronous function`.
- **Does that reach anything the lock-down removed? No.** Every promise it can wait on could already be read through `.then` callbacks in WP-3.1, which is the pattern the T-01 loader test at `e2e/runtime.spec.ts:168` uses. `runProgram` leaves the Input field empty, so the existing T-01 tests now run in interactive mode on engines with stack switching.
- **What is new:** Python code from an earlier run can now run in the middle of a later interactive run while it waits, and writes into that run's output (probe `interleave`). It can also receive and forge page messages: see MAJOR 2.
- **Can the clock be paused without a real wait? Yes, three ways.** See MAJOR 1. In every case the pause lasts until the learner acts: answering, End input, or Stop.
- **Is Stop always available? Yes.** The button is enabled in `awaitingInput` (`runtime-console.tsx`), `controller.stop` accepts `awaitingInput`, and both are tested.
- **Batch runs, and so Checks, cannot pause.** The reader is installed only for interactive runs (`run-support.ts:240`). `can_run_sync()` is false in batch runs. The controller drops `input_request` from a batch run (`controller.ts:253`).
- **An old run's `request_line` is inert.** It returns a resolved future and posts nothing, because `state !== running` (probes `stale` and `stale2`/`stale3`).
- **An old answer never reaches a new run.** The worker matches both the `runId` and the run's own `running` object (`core.ts:326`). A late `sendInput` returns `not_waiting`. Run IDs are not reused after a restart.
- **The one exception is a stdlib hook,** which can capture a later run's `request_line` and its answers: see MINOR 1.
- **Are `input` and `input_end` parsed and bounded? Yes, with one gap.** Both sides parse them (`controller.ts:305`, `core.ts:298`), and a line is at most 10,000 UTF-16 units. A newline inside a line is not refused: see MINOR 2.
- **Is `null` ever sent? No.** `input_end` carries no line, and the end of input resolves to `undefined`. Anything that is not a `str` ends the input (tested).
- **ADR-0005 holds.** No `Cross-Origin-*` header and no `SharedArrayBuffer` anywhere in `src`, `scripts`, `next.config.ts` or `vercel.json`. Headers, `lockdown.ts`, `python-worker.ts`, `protocol.ts`, the lockfile and `.github` are unchanged in this range.

## Findings

**MAJOR 1** The page's clock can be paused while the program keeps running. Threat T-02 (the external watchdog), FR-RUN-02, architecture 5.4.
- **Where:**
  - `src/runtime/worker/core.ts:235-254`, where `requestLine` posts `input_request` as soon as it is called.
  - `src/runtime/controller.ts:250-259`, where the clock stops on that message.
  - `src/runtime/worker/run-support.ts:102-119`.
- **Attack 1: call `request_line` and do not wait.** The program takes it out of the reader's closure:
  ```python
  rl = type(sys.stdin).readline
  fill = rl.__closure__[rl.__code__.co_freevars.index("fill")].cell_contents
  request_line = fill.__closure__[fill.__code__.co_freevars.index("request_line")].cell_contents
  request_line()   # posts input_request; the program carries on
  ```
- **Attack 2: answer itself.** The program forges an `input` message (MAJOR 2). It tries `run-1`…`run-49`; IDs that do not match are dropped without a fatal error.
- **Attack 3: run code during a real wait.** A `js.setTimeout(create_proxy(spin))` callback runs while a genuine `input()` waits.
- **Evidence.** Real Pyodide 314.0.7 under Node 26.13.1. The worker ran in a `worker_thread`, the compiled controller on the main thread, with real timers and the default 5 s limit.
  - Attack 1: `input_request` at 0.73 s, then output and `run_done ok` at 8.73 s with `durationMs: 8004`. Status stayed `awaitingInput` throughout and there was no `time_limit`.
  - Attack 2: `"got forged"`, then 8 s of work. `run_done ok` came at 8.74 s, still `awaitingInput`.
  - Attack 3: the callback ran during the wait. The limit fired only 5 s after the page answered.
- **Worst effect:** unlimited CPU in the worker while the console says "Waiting for input" and output keeps arriving (up to the cap). It lasts until the learner answers, ends input, or stops. The tab is not frozen and Stop works.
- **Claims and tests that are wrong:**
  - The comments at `core.ts:235-236` ("the page's clock pauses only for a real wait") and `run-support.ts:103-104` ("a program cannot reach the page's function through it by an attribute") are false.
  - The test at `run-support.test.ts:449` checks only `vars(sys.stdin)`, not `__closure__`.
  - `docs/reports/pull-requests/WP-3.2.md:65` repeats the claim.
  - No test covers any of the three attacks. That is a missing test for a control in the threat table.
- **Fix:**
  1. Post `input_request` only once Python has really suspended. Have `requestLine` schedule the post as a macrotask through a host function captured before the lock-down (Python can replace `js.setTimeout`), and post only if this wait is still pending and the run is still current. A program that does not suspend never yields, so nothing is posted and the clock keeps running. This closes attack 1.
  2. Attack 2 is closed by MAJOR 2's fix.
  3. Attack 3 cannot be closed this way. Either add a liveness ping while waiting (a protocol and spec change, with an ADR), or record it as a residual risk in `06-security-privacy.md` section 6, bounded by the learner's next action. This is the owner's decision.
  4. Turn the probes into tests in `interactive.test.ts`.
  5. Correct the two comments, the test title, and the PR text.

**MAJOR 2** The worker acts on any `message` event on its global scope, and Python can both listen to those events and dispatch its own. Threat T-01 (hardening), architecture 5.5, and T-22 and T-23 ahead of `check` in WP-3.3.
- **Where:** `src/runtime/worker/python-worker.ts:56-58`, together with the new `input`/`input_end` handling at `core.ts:322-328`.
- **Attacks:**
  - A program calls `js.dispatchEvent(js.MessageEvent.new("message", …))` to answer its own input request, or to start a run the page never sent.
  - A listener added with `js.addEventListener("message", …)` in one run reads every later page message.
- **Evidence.** In the Node emulation (`wt2.mjs`, an `EventTarget` standing in for the global scope, wired as `python-worker.ts` wires it):
  - `forgeMsg`: see MAJOR 1, attack 2.
  - `forgeRun`: the worker ran `print("unrequested run")` as `run-99`, and the controller reported `unexpected_message` for its `output` and `run_done`.
  - `listen`: run 3 printed run 2's message `{"type":"run",…,"source":"secret_program = 1\npw = input(\"Password? \")",…}` and its answer `{"type":"input","runId":"run-2","line":"hunter2"}`.
  - Not run in a browser. `dispatchEvent` and `MessageEvent` do exist in a dedicated worker's global scope.
- **Partly older than this range.** Neither name was removed in WP-3.1. WP-3.2 makes the worker act on forged answers, and puts the learner's typed answers on this channel.
- **Fix:**
  1. In `python-worker.ts`, drop events whose `isTrusted` is not `true`. A dispatched event is never trusted, and Python cannot change that. Add a browser e2e test that a dispatched `input` changes nothing.
  2. For reading, move the protocol onto a `MessagePort` that the page transfers in `init` and only the entry module holds (a change to architecture 5.2). Or record it as part of WP-3.1 MAJOR 1's accepted persistence until the worker is replaced. Either way, Validate still needs a fresh worker per case.

**MINOR 1** `src/runtime/worker/run-support.ts:81,131`. `class Answers(text_base)` subclasses `io.TextIOBase`, a Python class (metaclass `ABCMeta`) that a program can change. Architecture 5.5, ADR-0004.
- **Attack:** run 1 sets `io.TextIOBase.__init__ = spy_init`. Every later reader is then wrapped, so the program sees each later run's answers and its `request_line`.
- **Evidence:** probe `hook`. Run 3 printed `run 3 sees run 2 input: ['hunter2\n']`.
- **Fix:** subclass `_io._TextIOBase` instead. It is an immutable C type whose metaclass is `type`. CPython 3.9.6: setting its `__init__` raises `can't set attributes of built-in/extension type '_io._TextIOBase'`, and `input()` works with a subclass that defines only `readline`. Add the probe as a test.

**MINOR 2** `src/runtime/protocol.ts:218-221`. `input.line` may contain `\n`, although batch `stdin` refuses it (`protocol.ts:165`) and the reader assumes "A line the page sends has no newline" (`run-support.ts:105`).
- **Evidence:** probe `newline`. `sendInput("one\ntwo")` returned `{"ok":true}`, the program printed `'one' 'two'`, and the second `input()` posted no request.
- **Fix:** refuse `\n` (and `\r`) in `input` the way `stdinLines` does, and add it to the refusal table in `protocol.test.ts`.

## What the reviewer ran

- `git diff 942ff46..8b14df0`. Read in full: `core.ts`, `run-support.ts`, `controller.ts`, `protocol.ts`, `output.ts`, `lockdown.ts`, `python-worker.ts`, `interactive.test.ts`, the new test titles, both e2e specs, the PR draft, ADR-0005, architecture 5.3 to 5.6, and the threat table.
- Compiled the worker and the controller with `tsconfig.worker.json` into the scratch folder (`main.mjs`, `main2.mjs`, `wt.mjs`, `wt2.mjs`, `probes.mjs`).
- Ran probes `own`, `forged`, `spin`, `interleave`, `hook`, `newline`, `stale`, `stale2`, `stale3`, `surface`, `forgeMsg`, `listen` and `forgeRun` against real Pyodide 314.0.7 on Node 26.13.1.
- A CPython 3.9.6 check that `_io._TextIOBase` cannot be changed.
- `pnpm verify`: exit 0, 28 test files, 673 tests passed, attribution check passed.
- `git log`: author and committer are Fahad on all five commits, with no attribution trailers.
- grep for isolation headers and `SharedArrayBuffer`: none. Diff of the config, lockfile and workflow files: no change.

## What the reviewer could not check

- **Any browser.** That covers `isTrusted` on dispatched events, MAJOR 2 in a real worker scope, the e2e specs in all three engines, and stack switching in Firefox and WebKit.
- **Whether Pyodide internals** (`pyodide_js._api.package_loader` and others) offer a dynamic `import()` route to same-origin URLs. That is WP-3.1 scope and not specific to stack switching.
- **The 10 s wait under `page.clock`,** which was not run.
- **A leftover process.** An early probe (background task `bi143syv8`, `node main.mjs own`) hung without a self-timeout. The sandbox does not let me see or stop it, so it may still be running and should be stopped from outside.
