# WP-3.3 security review 7

- Reviewer: security-reviewer subagent, fresh context, read-only. This report is saved from its message and condensed.
- Range: 3ab21e9 on `wp/3.3-grader` (round 1); d757f11 and ff9e6eb (round 2). The commit answers "Timers between test cases in the Node runner", left as not checked in security review 6, round 2.
- Threats in scope: T-22 (same worker only), FR-RUN-04, `CLAUDE.md` rule 4, `.claude/rules/runtimes.md`.
- Date: 2026-11-24
- The reviewer ran `pnpm exec vitest run src/grader` (182 tests passed) and four probes of its own as untracked files under `src/grader/node-runner/`, which it deleted afterwards (`git status --short` empty). pnpm's automatic dependency install before each script failed on the sandbox's store lock, so nothing was installed; it then ran `./node_modules/.bin/vitest` directly. It did not run the harness in a browser.

## What 3ab21e9 changed

- `run_case` starts with `collect_all()` instead of a bare `restore()`: restore, then collect and restore until a collection finds nothing, raising `Uncollected` after eight passes.
- Before, a JavaScript timer that one test case set (`js.setTimeout`) fired in the Node runner's thread before the next case's message. Its callback made a reference cycle whose `__del__` ran in the next case's collection and wrote into that case's output. The new test in `src/grader/node-runner/runner.test.ts` failed this way on the parent: the second case's output was `True True\nINJECTED ok\n`.
- `HARNESS_VERSION` is "6", with the hash pin.

## Round 1, on 3ab21e9: APPROVE, 2 MINOR

What it verified:

- No state the harness claims to undo survives a timer callback into the next case, as the start collections begin with `restore()`. The next case's stdin and output are made after `collect_all()`, so the callback cannot reach them. What the start collections write goes to the original stream, which the Node host drops and the worker discards (`setStdout(discard)`, `core.ts`).
- In the browser worker all cases of one check run in one synchronous loop, so a timer fires only between checks.
- `Uncollected` at the start of a case is re-raised by `check()`. The Node runner reports that case as crashed and the rest as not run, then starts a new thread for the next check; the worker answers `runtime_crashed`. Both fail closed.
- The new test fails against the reverted harness and passed on 25 fresh threads. If the timer had not fired before the second case, `heap_fired` would be false and the test would fail, so the race can only make it fail, never pass wrongly.
- No other pinned harness version in `src` or `docs/spec`.

Probe output, as the reviewer pasted it:

```
A reverted: [["passed","ok\n"],["failed","True True\nINJECTED ok\n"]]
B fixed: {"[[\"passed\",\"ok\\n\"],[\"passed\",\"True True\\nok\\n\"]]":25}
C: [["passed",null,"ok\n",null],["failed","program_error","",{"kind":"runtime","message":""}],["passed",null,"ok\n",null]]
D: [["passed",null,"ok\n"],["failed","crashed",""],["not_run",null,null]]
D next check: [["passed","ok\n"]]
```

**MINOR 1** `src/grader/harness.ts`, the comment on `check()`. A timer callback that puts an object into the builtins whose `__del__` adds another builtin makes the next case's start restore fail `intact()`; that case is reported as a runtime error with no message though it ran correctly (probe C). This fails closed, and a bare `restore()` failed the same way before, so nothing new is exposed. Fix asked: say in the comment that a failure in the start collections is reported against the case about to run.

**MINOR 2** `src/grader/harness.ts`, the header: one line was not wrapped.

What was done, in d757f11: both. The comment on `check()` says it; the header is rewrapped. The hash pin moved with the comment, which is inside the Python text; `HARNESS_VERSION` stays "6", as "6" has reached no other branch.

## Round 2, on d757f11 and ff9e6eb: APPROVE, 2 MINOR

Round 2 also covered ff9e6eb, the answer to security review 6, round 2, which no reviewer had seen. The reviewer ran `./node_modules/.bin/vitest run src/grader` (`Tests 182 passed (182)`) and `pnpm verify` (exit 0, `Tests 1114 passed (1114)`), and probes P1 to P6 in a scratch copy under `$TMPDIR`, which it removed (`git status --short` empty).

What it verified:

- ff9e6eb: `run_case` sets `state = None` before `collect_all()`. The state dict is then held only by the closure cell of `Capture.write`, which is part of the `Capture` class's cycle, so the collections free it and the restore after them puts back what its `__del__` changed. Its test fails on the parent c694902 (`Tests 2 failed | 80 passed (82)`; the second case gave `"INJECTED\nnext"`; the other failure was the hash pin). The header names `sys._getframe` and `f_locals`.
- d757f11: inside the Python text only `#` comment lines changed; the hash pin moved; `HARNESS_VERSION` stayed "6". `wp/3.4-statechart` had the identical harness and test file.
- Neither commit removed, skipped or loosened a test.
- Still reachable, all already named in the header: rebinding a `run_case` local through `f_locals` (probe P2), a program-set `__del__` on the capture (P5), and the eight closure cells `Capture.write` shares with `_heap_make_grader` (P4). Objects stored on the `Capture` class are freed (P3). The control remains `freshWorker`.

**MINOR 1** `src/grader/harness.test.ts`, the ff9e6eb test. Since 3ab21e9 starts each case with the collections, the test passes with `state = None` removed (only the hash pin failed: `Tests 1 failed | 81 passed (82)`). Without the fix the state dict is freed as `run_case` returns, after the last restore, so what its `__del__` changes stays on the interpreter after `check()` returns. Probe P1 (a `__del__` in the state dict sets `builtins.ghosted`): `false` at HEAD, `true` without `state = None`. Fix asked: a test that reads the interpreter after `check()` returns.

**MINOR 2** `src/grader/harness.ts`, the comment on `check()` and the header. They name only a timer as the cause of a failed start collection; a write into a harness frame does the same with no timer (probe P6: the next case, a plain `print("ok")`, is a runtime error with no message; the case after it passes). Fails closed. Fix asked: "what an earlier case left, by a timer or by a write into the harness's frames".

What was done, in be9375c: both. A new test, `what a __del__ in the capture's own state changes is put back before the harness returns`, is probe P1: it reads `builtins` on the interpreter after `check()` returns. With `state = None` removed it fails (`× [FR-RUN-04] what a __del__ in the capture's own state changes is put back before the harness returns`, `Tests 2 failed | 81 passed (83)`, the other failure the hash pin); with the line back, `Tests 83 passed (83)`. The ff9e6eb test is kept. The comment on `check()` and the header name both causes. `HARNESS_VERSION` is "7", as "6" has reached `wp/3.4-statechart` by merge. No reviewer has seen be9375c.

Not checked by the reviewer in round 2: the browser worker in a real browser; a check followed by a run through `src/runtime/worker/run-support.ts` on the same worker, where MINOR 1's gap would show (argued, not reproduced); timers made through asyncio or Pyodide's event loop, and Pyodide's finalization callbacks.

## Round 3, on be9375c: APPROVE, no findings

Fresh context, 2026-11-24. The reviewer ran these:

- In a scratch copy of the tree at be9375c, under `$TMPDIR` (removed afterwards), it replaced `state = None` in `run_case` with `pass`. Two tests then failed: the new test (`AssertionError: expected true to be false`, so `builtins.ghosted` was still set) and the hash pin. The run showed `Tests  2 failed | 81 passed (83)`. With the tree unchanged: `Tests  83 passed (83)`.
- `./node_modules/.bin/vitest run src/grader` at d7633c7: `Tests  183 passed (183)`.
- `pnpm verify`: exit 0, `Test Files  42 passed (42)`, `Tests  1115 passed (1115)`, and the attribution checks passed.

What it verified:

- The new test is not fragile. `Capture.write` closes over eight cells, and the state dict is the only dict among them. If no dict were found, the program would raise, and `toMatchObject({ error: undefined })` would fail the test. The test loads its own Pyodide, so `ghosted` cannot leak into other tests.
- With every `#` line stripped, the Python text is identical before and after be9375c (both hash to `509603946472d28a8365be3bd4df49d477498eb5`). The rest of the diff is the `//` header, `HARNESS_VERSION` "6" to "7", and the hash pin, now `{ version: "7", hash: 1379851480 }`. Nothing in `src` or `docs/spec` pins "6".
- No test was removed, skipped or loosened. The only line removed from `harness.test.ts` is the old hash pin. The new test's `60_000` limit is the one the 11 other fresh-Pyodide tests use, and the ff9e6eb test is kept.
- The Python that runs is unchanged, so isolation is as before.

Not checked by the reviewer in round 3: the browser worker in a real browser; a check followed by a run through `src/runtime/worker/run-support.ts` on the same worker (the item below); timers made through asyncio or Pyodide's event loop, and Pyodide's finalization callbacks.

## Outside this commit

On this branch, `src/runtime/worker/run-support.ts` still starts a run with a bare `restore()` and ends with a single `collect()`, so in the browser a timer a check set can still write into the next run's output. On `wp/3.1-python-worker` the run support collects until nothing is left (16711f5, a7c3ba7) but still starts a run with a bare `restore()`; that is WP-3.1 security review 7, MINOR 1 ("A late callback's output reaches the next run"), an owner decision.

## Not checked by the reviewer

The browser worker in a real browser; timers made through asyncio or Pyodide's event loop (expected to behave the same, as they also run between messages); Pyodide's finalization callbacks.
