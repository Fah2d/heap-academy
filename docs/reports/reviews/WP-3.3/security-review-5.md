# WP-3.3 security review 5

- Reviewer: security-reviewer subagent, fresh context, read-only. This report is saved from its messages and condensed.
- Range: 853f0c1 (round 1) and 04fcffa (round 2) on `wp/3.3-grader`. The commits answer what security review 4, round 4, noted outside its range: the garbage collector's thresholds and enabled state carried over between test cases (`(1, 1, 0) False`).
- Threats in scope: T-22 (same worker only), FR-RUN-04, FR-GRD-01, `CLAUDE.md` rule 4, `docs/spec/02-architecture.md` section 5.5, `docs/spec/04-content-system.md` section 3.1.
- Date: 2026-11-24
- The reviewer ran `pnpm exec vitest run src/grader/harness.test.ts` and two probe scripts of its own under Node against the repository's Pyodide 314.0.7 (Python 3.14.2). It did not run the harness in a browser or `pnpm verify`.

## Round 1, on 853f0c1: APPROVE, 3 MINOR

What it verified: the thresholds and enabled state are put back after the gc callbacks are cleared, so no learner callback is left to run; a `__del__` during a later clear is caught by `intact()`. `get_threshold` and `isenabled` are held from definition and return a tuple of C ints and a bool, so the comparison runs no Python. In Pyodide 314.0.7 the collector starts at `(2000, 10, 0) True`; putting the saved thresholds back made `get_threshold()` equal the snapshot again after `(1, 1, 0)`, `(0, ...)` and `(-1, -1, -1)`; threshold 2 always reads back as 0. `core.ts` defines the run support and the harness before any learner code runs, so the snapshot is clean.

**MINOR 1** `src/grader/harness.ts`, the header and `restore()`. The collector's debug flags and frozen objects still carried over. With `gc.set_debug(gc.DEBUG_SAVEALL)` and a self-referencing object in case 1, the harness's own `collect()` put case 1's namespace into `gc.garbage`, and case 2 printed `32 ['from case 1']`. `gc.freeze()` also persisted. Fix asked: save and restore the debug flags, check them in `intact()`, add a probe row; for freeze, either `gc.unfreeze()` or name it as not undone.

**MINOR 2** `restore()`, the `else: disable_gc()` branch. No test starts with the collector off, so deleting the branch would survive. Fix asked: a test with its own interpreter that calls `gc.disable()` before the harness is defined.

**MINOR 3** (true before the commit) The comment on `intact()` says it uses calls that free no object, but allocations inside `restore()` and `intact()` can start an automatic collection that runs a learner finalizer on cyclic garbage after its part was checked. The commit widened the window a little by turning the collector back on before the clears. Fix asked: turn the collector off at the start of `restore()`, require it off when the check passes, and turn it back on last. Argued, not reproduced.

What was done, in 04fcffa:

- MINOR 1: `gc.garbage` (put back in place, compared by identity), the debug flags and the thresholds are restored and checked. Probe rows for the debug flags and the saved garbage. A test with `DEBUG_SAVEALL` and a self-referencing list expects the next case to print `0 0`. `gc.freeze()` is named in the header as not undone. Decision: frozen objects change memory, not output, and `gc.unfreeze()` would also move objects the runtime itself froze, if any.
- MINOR 3: `restore()` turns the collector off after the hooks and monitoring tools are cleared (a call made before that would run their callbacks), raises `NotRestored` if the collector is on when the check passes, and only then turns it back on if it was on at definition. The probe row for the enabled state now calls `gc.enable()`. The header and the `restore()` comment say so.
- MINOR 2: with the collector off during every restore, the `else` branch is gone. A test defines the harness after `gc.disable()` in its own interpreter, runs a case that calls `gc.enable()`, and expects the next case to see `False`.

Mutants on 04fcffa, each run against `src/grader/harness.test.ts` and then restored; each fails at least one test other than the hash pin: no `disable_gc()`; no enabled check; an unconditional `enable_gc()`; no re-enable; no restore of the saved garbage, of the debug flags or of the thresholds; `intact()` without the debug flags, the thresholds or the saved garbage.

## Round 2, on 04fcffa: APPROVE, 2 MINOR

What it verified: `disable_gc()` runs after the monitoring tools are freed and before any learner container is cleared, so no automatic collection runs a finalizer inside the restore or the check; a `__del__` freed directly that calls `gc.enable()` is caught by the check and the case fails closed. The harness keeps the interpreter's own `gc.garbage` list, so rebinding the name does not escape the restore (a module attribute change, which ADR-0004 accepts). `run_case` restores the debug flags before its own `collect()`, and a `__del__` that sets `DEBUG_SAVEALL` then is undone by the last restore. Every comparison is between ints or tuples of ints. Keeping `HARNESS_VERSION` at "4" is fine, as 853f0c1 was never pushed.

**MINOR 1** `src/grader/harness.ts`, the fallback in `check()`. It no longer forced the collector back to its saved state. Reproduced with a harness defined after `gc.disable()`: an object in the line cache whose `__del__` calls `gc.enable()` and puts a second object into `gc.garbage`, whose `__del__` also calls `gc.enable()`. Both restores raised, the fallback's `intact()` passed, and `check()` returned a runtime error with the collector on. The next case's restore put it right. In production the worker defines the harness with the collector on, so the state left was the right one there. Fix asked: after the fallback's `intact()`, `disable_gc()` and then `enable_gc()` if it was on; add the reproduction as a test.

**MINOR 2** The "Not undone" paragraph of the header was not rewrapped.

What was done, in 5649d7a: both, as asked. The reviewer's reproduction is a test with its own interpreter that reads `gc.isenabled()` right after `check()` returns. Removing the two new calls fails that test. No reviewer has seen 5649d7a.
