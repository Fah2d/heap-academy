# WP-3.3 security review 7

- Reviewer: security-reviewer subagent, fresh context, read-only. This report is saved from its message and condensed.
- Range: 3ab21e9 on `wp/3.3-grader`. The commit answers "Timers between test cases in the Node runner", left as not checked in security review 6, round 2.
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

What was done, in d757f11: both. The comment on `check()` says it; the header is rewrapped. The hash pin moved with the comment, which is inside the Python text; `HARNESS_VERSION` stays "6", as "6" has reached no other branch. No reviewer has seen d757f11.

## Outside this commit

On this branch, `src/runtime/worker/run-support.ts` still starts a run with a bare `restore()` and ends with a single `collect()`, so in the browser a timer a check set can still write into the next run's output. On `wp/3.1-python-worker` the run support collects until nothing is left (16711f5, a7c3ba7) but still starts a run with a bare `restore()`; that is WP-3.1 security review 7, MINOR 1 ("A late callback's output reaches the next run"), an owner decision.

## Not checked by the reviewer

The browser worker in a real browser; timers made through asyncio or Pyodide's event loop (expected to behave the same, as they also run between messages); Pyodide's finalization callbacks.
