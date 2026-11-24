# Security review 7: WP-3.1, the first browser run of the runtime tests

- Reviewer: security-reviewer, fresh context, on 0849b56.
- Scope: `e2e/runtime.spec.ts`, the two T-01 tests "Pyodide's own loaders cannot reach the network after the lock-down" and "evaluating JavaScript from Python is refused, by the worker's own policy", which failed in the first Chromium run and were fixed in 0849b56.
- Verdict: **APPROVE**, 3 MINOR, no change needed to the diff.
- The reviewer is read-only; this file was written by the implementer from the reviewer's report.

## The diagnosis, confirmed

`run()` clears the program's namespace when the run ends (`dict_clear(namespace)`, `src/runtime/worker/run-support.ts:196`). A program that schedules `setTimeout(create_proxy(late), 0)` had 6 globals during the run and 0 when the callback fired; looking up `sys` then raised `NameError`. With the old listener, the `NameError` escapes to the worker's error event and the controller replaces the worker (`src/runtime/controller.ts:227-230`), so a rerun of the old test can also end in `AttributeError`. Both fail the test. The fixed callbacks use only their default arguments and the builtins `str` and `len`, which `restore()` puts back.

## The tests still prove their names

The reviewer put a rewriting proxy in front of the development server, which changed the served worker and its headers without changing a tracked file:

| Mutant | Result |
|---|---|
| Lock-down switched off (`lockDown` always reports success) | Test 1 fails: `Expected /^2 True /, Received "0 True []"`. With 200 ms more wait the probe read `['resolved 33', 'resolved 0']` and the request log held `/api/health` and `micropip-0.11.1-py3-none-any.whl`. |
| `'unsafe-eval'` added to the worker's `script-src` | Test 2 fails (`evaluated` three times). |
| Worker policy removed | Test 2 fails the same way. |
| Pass-through control | Both pass. |

With the lock-down working, the probe reads `['resolved 0', 'ReferenceError: fetch is not defined']`: `loadPackage` resolves quietly, so the request log and `loadBinaryFile` are the real evidence, as the test's comment says.

## Findings

1. **MINOR, `src/runtime/worker/run-support.ts:169-201` and `docs/spec/02-architecture.md` section 5.5.** Late callbacks are the learner's own code in a worker whose lock-down lasts its whole life, so T-01 is unaffected. They do break isolation between runs: a late `print("GHOST", end="")` appeared in the next run's output as `GHOSTsecond run\n`. Runs are synchronous today, so nothing interleaves. Once a program can yield (`run_sync`, or interactive input in WP-3.2), an earlier run's timers could change builtins during a later run, and Check runs each test case as its own run. Self-tampering, not a vulnerability. Suggested: before Check is built, record it under the residual risks in spec 06 or ADR-0004, then either a new worker per Check or discard stream buffers when a run starts, with an e2e test for the ghost output. **Not fixed**: source and spec change, for the owner; it joins the existing item "Validate's fresh worker (WP-4.3)".
2. **MINOR, `e2e/runtime.spec.ts:188`.** Test 1 assumes both promises settle before the second run. If that stops holding, the test fails rather than passes. **Fixed in f7dfb52:** a comment says so.
3. **MINOR, outside the diff, `src/features/workspace/client/runtime-view.ts:65`.** A late `setInterval` that prints sends output with an old run ID; each message is dropped and added to `dropped`, which has no size limit. Only the development page uses it. **Not fixed**: cap the list before a real page uses it.

## What the reviewer ran

- Both tests against the development server on port 3256 (webpack, polling watchers): passed.
- The same two tests through the rewriting proxy, with the three mutants and the control above.
- Four short programs on `/dev/runtime` with its own Playwright scripts.
- `pnpm verify`: exit 0, 37 test files, 858 tests.
- Not checked: Firefox and WebKit (not installed), the production server, a deployed host, `pnpm infra:verify`.
