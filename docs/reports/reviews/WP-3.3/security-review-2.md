# WP-3.3 security review 2

- Reviewer: security-reviewer subagent, fresh context, read-only
- Range: 1da8b48..bce0f08 (3eab1b2, 95abb5a, bce0f08). The checkout was at 67787b4 on `wp/3.3-grader`; that commit adds only merges and report edits on top of bce0f08 in `src/`.
- Threats in scope: T-01, T-22, T-23, and `CLAUDE.md` rule 4 (ADR-0032 for the Node runner).
- Date: 2026-11-24
- Verdict: **CHANGES REQUIRED.** One major, seven minors, no blocker. Most round-1 fixes work, and four of the five have tests. The new `freshWorker` path has a re-entrancy bug that can run a program on a used worker and turn Stop into a no-op. Several claims in the description go further than the code.

## Round-1 findings against the fix commits

| Round 1 | Status | Would a regression be caught? |
|---|---|---|
| MAJOR 1: Validate isolation | **Partly fixed.** The controller has `check(..., { freshWorker: true })` and the harness header is corrected. WP-4.3's "Done when" (`08-delivery-plan.md:153-155`) and the T-23 row (`06-security-privacy.md:77`) are unchanged; this is owner action 3. The option is off by default. | Partly. The five controller tests do not cover a caller re-entering during `ready` (MAJOR 1). |
| MINOR 1: `SystemExit.code` raises | **Fixed for that program.** "Never raises" is still false for others (MINOR 2). | Weakly. A copy with only the `finished` guard removed, and a copy with only the outer wrapper removed, each still pass the new test. |
| MINOR 2: output cap bypasses | **The size is fixed, the verdict is not.** A bypass now ends as `mismatch`, not `output_limit` (MINOR 3). | The size, yes. The verdict, no. |
| MINOR 3: `missingName` bounds and stage | **Fixed.** | Yes. |
| MINOR 4: lint bypasses | **Both reported bypasses fixed. Others remain** (MINOR 4). | Yes, for the two reported cases. |

## Findings

**MAJOR 1** `src/runtime/controller.ts:244-258` and `:399-405`. T-22, T-23.
- Problem: while a fresh-worker check waits, the new worker's `ready` sets `status = "ready"` and calls `onEvent({ type: "ready" })` before the pending check is sent. A listener that calls the controller from that event gets `ready` semantics in the middle of a check.
  - Case A, a run started from the `ready` event: the run goes to the fresh worker; the pending check is never sent and never gets `check_done`; `pending` stays set, so `stop()` takes the pending branch, `endCheck` does nothing because `current` is the run, and `stop()` returns without stopping the run.
  - Case B, a second check started from the `ready` event: it goes to the fresh worker, then the stale pending message is posted as well, so the first program runs on a used worker, which `freshWorker` promises not to do. Its results arrive under a `runId` the controller no longer tracks.
- Smaller symptom: `use-runtime.ts:29-31` passes `created.status` into the reducer on every event, so a view can show "ready" during a check.
- Evidence (real `createRuntimeController`, fake workers):
  ```
  fresh check {"ok":true,"runId":"run-2"} status restarting
  run inside ready: {"ok":true,"runId":"run-3"} status running
  status after ready: running
  new worker received: ["init:undefined","run:run-3"]
  after stop: status running workers 2 check_done events 0 run_done 1
  ```
  ```
  EVENT restarting isolation status restarting workers 1
  fresh check {"ok":true,"runId":"run-2"} status restarting
  EVENT ready  status ready workers 2
  fresh check inside ready: {"ok":true,"runId":"run-3"} status checking
  new worker received: ["init:undefined","check:run-3","check:run-2"]
  EVENT check_done run-3 status checking workers 2
  ```
- Fix: when `pending` is set, send the check before emitting `ready`, or do not emit `ready`; `status` goes from `restarting` to `checking`. In `stop()`, take the pending branch only when `current?.kind === "check"`. Tests where `onEvent` calls `run()` and `check()` on `ready` during a pending check.

**MINOR 1** `src/runtime/controller.ts:105` and `:391`, `docs/spec/08-delivery-plan.md:153-155`, `docs/spec/06-security-privacy.md:77`. T-23.
- Problem: round-1 MAJOR 1 is not closed. `freshWorker` defaults to off, so WP-4.3 can still validate on a used worker, and the plan and the threat table do not require it.
- Fix: make the option required, or add a `validate()` that always replaces a used worker, so the type checker makes WP-4.3 decide. The owner opens the `spec-change` in action 3 before WP-4.3 starts.

**MINOR 2** `src/grader/harness.ts:4` and `:238-249`, and the description's "it never raises".
- Problem: `sys._getframe(0).f_back.f_locals['result'] = None` makes the harness raise on that case and every later one on the interpreter, because `run_case` and the fallback share the `result` cell. In the browser the worker posts `fatal runtime_crashed` and a new worker starts: it fails closed. The two guards are not tested one at a time.
- Evidence:
  ```
  1 result cell set to None | HARNESS RAISED: TypeError: 'NoneType' object is not callable
  1b next case | HARNESS RAISED: TypeError: 'NoneType' object is not callable
  ```
  ```
  harness-a.ts | odd exit: {...,"error":{"kind":"runtime","message":"Odd","line":5}} | next: {...,"output":"next\n",...}
  harness-b.ts | odd exit: {...,"error":{"kind":"runtime","message":""}} | next: {...,"output":"next\n",...}
  ```
- Fix: reword: the harness never raises because of the program's own errors; code that rewrites the harness's closure can make it raise, and the worker treats that as `runtime_crashed`. Optionally build the fallback text once at definition time. Add one test where each guard is the only defence.

**MINOR 3** `src/grader/grade.ts:202-205`, `src/grader/harness.ts:115-119` and `:282-286`. FR-RUN-03.
- Problem: the output count is reachable through `type(sys.stdout).write.__closure__`, and a bypass (or a program that catches `OutputLimit` and keeps going) ends with `truncated` and no error, so `grade` returns `mismatch`.
- Evidence:
  ```
  closure state room | error: undefined truncated: true len: 64000 | verdict: failed mismatch
  direct StringIO.write | error: undefined truncated: true len: 64000 | verdict: failed mismatch
  plain flood | error: {"kind":"output_limit"} truncated: true len: 64000 | verdict: failed output_limit
  ```
- Fix: in `grade`, treat `result.truncated` with no other error as `output_limit`. Assert the reason in the direct-write test. Correct the comment and the description.

**MINOR 4** `scripts/eslint/module-boundaries.mjs:131`, `:163` and `:236-237`. `CLAUDE.md` rule 4, ADR-0032.
- Problem: the Node runner can still be imported from production code without a lint error, each way needing a deliberate change: a `src/` file importing from `scripts/` or `e2e/` (not checked), with `scripts/` allowed to import the runner; `createRequire(import.meta.url)(...)`, an aliased `require`, `module.require`; `new Worker(new URL(".../node-runner/thread.ts", import.meta.url))`; a query suffix (`./x.test.ts?raw`). No build-output check looks for `node-runner` or `pyodide` in `.next/server`.
- Evidence (repository ESLint configuration, `lintText`):
  ```
  src/features/workspace/server/a.ts => NO BOUNDARY ERROR   (export from "../../../../scripts/launder.ts")
  scripts/launder.ts => NO BOUNDARY ERROR                    (export from "../src/grader/node-runner/runner.ts")
  src/features/workspace/server/b.ts => NO BOUNDARY ERROR   (createRequire(...)("../../../grader/node-runner/runner.ts"))
  src/features/workspace/server/c.ts => NO BOUNDARY ERROR   (const req = require; req(...))
  src/features/workspace/server/d.ts => NO BOUNDARY ERROR   (new Worker(new URL(".../node-runner/thread.ts", ...)))
  src/features/workspace/server/e.ts => NO BOUNDARY ERROR   ("./launder.test.ts?raw")
  src/features/workspace/server/f.ts => heap/module-boundaries
  src/features/workspace/server/g.ts => heap/module-boundaries
  src/features/workspace/server/h.ts => NO BOUNDARY ERROR   (module.require(...))
  ```
- Fix: report any non-test `src/` file whose import resolves outside `src/`; report `createRequire` and any call or `new URL(..., import.meta.url)` whose first argument contains `node-runner`; strip `?` and `#` suffixes; add a post-build check that `.next/server` and `.next/static` contain no `node-runner`, `createNodeRunner` or `loadHarness`.

**MINOR 5** `src/grader/harness.ts:17-19` and `:141-151`. T-22 (same worker only).
- Problem: `restore` clears `settrace` and `setprofile` but not `sys.monitoring` (PEP 669). A monitoring callback survives into later cases and writes into their output. `gc.callbacks`, audit hooks, `sys.excepthook` and `sys.unraisablehook` persist too.
- Evidence:
  ```
  5b later innocent case | parsed: {"version":"1","stage":"after_code","output":"hello\nMON <module>\nafter\n","truncated":false}
  ```
- Fix: in `restore`, `sys.monitoring.set_events(tool, 0)` and `sys.monitoring.free_tool_id(tool)` for tool IDs 0 to 5, and restore `excepthook` and `unraisablehook`. Name what is still not undone in the header. Add a test for `sys.monitoring`.

**MINOR 6** `src/grader/harness.ts:212-219`, and the description's "an exit whose code cannot be read does not [count as finishing]". ADR-0007.
- Problem 1: `getattr(error, "code", None)` turns a `code` property that raises `AttributeError` into `None`, so the exit counts as clean. Harmless, but the claim is false.
- Problem 2: a learner function that calls `exit()` while the follow-up code runs ends that stage "cleanly", so a test case whose follow-up code only asserts, with an empty `expected`, passes with `def area(*a): exit()`. Section 2.2 says a test case fails "when the follow-up code raises an error".
- Evidence:
  ```
  4 exit() in function during after_code | parsed: {"version":"1","stage":"after_code","output":"","truncated":false}
  4b SystemExit whose code raises AttributeError | parsed: {"version":"1","stage":"program","output":"","truncated":false}
  ```
- Fix: correct the claim; either treat `SystemExit` during `after_code` as an `after_code_error`, or record it as a deviation for the owner.

**MINOR 7** `src/grader/node-runner/runner.ts:107-108` and `:121-122`.
- Problem: the runner's harness-version check and its thread replacement after a memory error have no test.
- Fix: a runner test for each.

## Found holding

- Parser bounds: `isTextWithin` counts code points as Python's `len` does, so the 64,000, 1,000 and 200 limits agree; `quote` escapes 0xD800-0xDFFF; worker and page agree that a name is allowed only at `after_code`.
- A forged result reaching another learner or lesson: it cannot; it stays on that worker (ADR-0007), and the page recomputes the order and summary.
- A traceback that never ends: not run (it would hang the probe); by reading, the page clock ends it as `time_limit`.
- Lock-down: `caches`, `indexedDB` and `navigator.storage` are blocked, so no store outlives the worker.
- `CHECK_TEST_LIMIT` is 12, from section 1.3.

## What was run

```
$ ./node_modules/.bin/vitest run src/grader src/runtime/controller.test.ts src/runtime/worker/core.test.ts scripts/eslint/rules.test.ts
exit 0
 Test Files  8 passed (8)
      Tests  319 passed (319)
$ pnpm verify
exit 0
 Test Files  41 passed (41)
      Tests  1002 passed (1002)
```

Probes on Pyodide 314.0.7 under Node 26.13.1 through `src/grader/node-runner/host.ts`, a controller test with its own vitest root, and a lint probe through the repository's ESLint configuration, all outside the repository except one probe file copied into `scripts/` and deleted at once. The code reviewer's mutation runs touched `runner.ts` and `harness.ts` in the same checkout and restored them. `git status --short` was empty at the end.

## Not checked

- Any browser: the parity e2e, the lock-down during a check, `freshWorker` against a real worker.
- `pnpm build`, and a grep of `.next/` for Node-runner symbols.
- `pyodide_js` as a route from Python back to the page (WP-3.1).
