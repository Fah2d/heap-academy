# WP-3.3 security review 6

- Reviewer: security-reviewer subagent, fresh context, read-only. This report is saved from its messages and condensed.
- Range: 65af875 (round 1) and c694902 (round 2) on `wp/3.3-grader`. The commits answer the item found for WP-3.3 during WP-3.1 security review 8: the harness had the same single `collect()` at the end of `run_case` that WP-3.1's run support had before 16711f5.
- Threats in scope: T-22 (same worker only), FR-RUN-04, `CLAUDE.md` rule 4, `.claude/rules/runtimes.md`.
- Date: 2026-11-24
- The reviewer ran `pnpm exec vitest run src/grader/harness.test.ts`, mutants of `src/grader/harness.ts` (each reverted), probe scripts of its own under Node against the repository's Pyodide 314.0.7, and `pnpm verify`. It did not run the harness in a browser. pnpm's automatic dependency install before each script failed on the sandbox's store lock, so nothing was installed.

## What 65af875 changed

- `run_case` collects and restores until a collection finds nothing (`collect_all()`), and raises `Uncollected` (a `NotRestored`) after eight passes. Before, a chain of `__del__` methods, each making a new reference cycle, had its next link run in the next test case's own collection, which wrote `INJECTED` into that case's output (the new test failed this way on the parent).
- `check()` re-raises `Uncollected` instead of reporting a runtime error.
- The fallback in `check()` now runs after the except block, so the failed case's frame, which holds the namespace, is released first, and then collects the same way; any failure in that collection makes the harness raise `NotRestored`. Before, the fallback did not collect at all.
- `HARNESS_VERSION` is "5", because "4" had already reached `wp/3.4-statechart`.

## Round 1, on 65af875: CHANGES REQUIRED, 1 MAJOR, 1 MINOR

**MAJOR 1** `src/grader/harness.ts`, `collect_all()`. Learner code runs after the restore that follows the program and before the first collection: while the namespace is cleared, and through `describe()`. It can put an object into `sys.modules`. If nothing is cyclic garbage at that point (the program keeps its classes alive in a standard library module, here `json._keep`), the first collection finds 0; that pass's restore then frees the planted object, whose `__del__` makes a cycle, and `collect_all()` returns. Reproduced: the next case's `gc.collect(); print("next")` printed `INJECTED\nnext\n`. Without the `json._keep` line it printed `next\n` only. Fix asked: a restore before the first collection, and the probe as a test. The reviewer noted that `run-support.ts` on `wp/3.1-python-worker` (16711f5) very likely has the same gap (argued, not reproduced).

**MINOR 2** The fallback's last `disable_gc()` and `enable_gc()` calls changed nothing, as `collect_all()` returns only after a restore that passed its check; their comment no longer described the path, and deleting them failed only the hash pin.

Mutants on 65af875: one collection in `run_case`, no `except Uncollected`, no fallback collection, the fallback collection's failure swallowed, `return` instead of `raise Uncollected()`, the fallback moved back into the except block, and no restore inside the loop each failed a test other than the hash pin. Restore-then-collect order inside the loop survived (safe).

What was done, in c694902: `collect_all()` restores first; the reviewer's probe is a test, which fails on 65af875; the two calls and their comment are removed.

## Round 2, on c694902: APPROVE, 2 MINOR

What it verified: three variants no longer reach the next case. An object planted from an exception's `__str__` during `describe()`, one planted during the leading restore itself (through the line cache), and one planted into the builtins during that restore (caught by `intact()`; the fallback's collection frees what is left). `collect_all()` returns only after a collection that found nothing, preceded by a restore whose check passed, so the last restore frees nothing the program owns. Removing the two calls is safe: the 5649d7a test still passes. Every round-1 mutant still fails a test other than the hash pin. `pnpm verify`: 1112 tests passed.

**MINOR 1** `run_case` cleared `namespace`, `failure` and `output` before `collect_all()`, but not `state`, the capture's dict. A program reaches it through `type(sys.stdout).write.__closure__`; an object put there was freed when `run_case` returned, after the last collection, and its cycle ran in the next case (`INJECTED\nnext\n`). With `state = None` added the probe gave `next\n`. Fix asked: clear it and add the probe as a test.

**MINOR 2** The header did not name writes through the harness's frames. `sys._getframe(1).f_locals[...]` and `sys._getframe(2).f_locals[...]` can rebind a local of `run_case` or `check` to an object that stays alive past the last collection; the reviewer's probes on `stdin` and `source` printed `INJECTED` in the next case. Clearing locals cannot close this from inside Python. Security review 1 already listed `f_locals` write-through, and `freshWorker` is the control. Fix asked: say so in the header.

Not checked by the reviewer: the browser worker; the gap in `run-support.ts`; callbacks scheduled with JavaScript timers or the asyncio event loop (in the browser all test cases run in one synchronous loop; the Node runner's thread runs one case per message, so a timer could fire between cases there, in tests and scripts only).

What was done, in ff9e6eb: `run_case` sets `state = None` with the namespace and the output, with the reviewer's probe as a test (it fails with that line removed); the header says a program can reach the harness's closure and its frames, and so keep an object alive past the last collection. No reviewer has seen ff9e6eb.
