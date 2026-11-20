# WP-3.1 code review 3

- Reviewer: code-reviewer subagent, fresh context
- Range: 17facd4..be2c7c0 on `wp/3.1-python-worker` (24bceee, b1212e4, cd42ab1, ce59773, d31371c, a06e244, 3d2bfe6 docs, be2c7c0 dependency), checking the fixes for `code-review-2.md` and `security-review-2.md`
- Date: 2026-11-20
- Verdict: CHANGES REQUIRED. No blocker, one major, six minors.

The reviewer works read-only; the implementer saved this report from its final message, unchanged.

## Round-2 findings: status

| Finding | Status |
|---|---|
| CR2 BLOCKER: exactly 64,000 characters reported as cut | Fixed for a run the worker ends. Removing the fix fails the new test. A related case remains on the time-limit and stop paths (MINOR 1). |
| CR2 MAJOR 2 / SR2 MINOR 2: error attributes make `run` raise; huge `lineno` | Fixed. Probes: removing the `try` around `outcome()` makes `run` raise `ValueError('no')`; removing the line bound gives `line: 10**30`. The tests catch both. The `+ 1` allowance is untested (MINOR 2). |
| CR2 MINOR 1: no cyclic `__del__` test | Fixed. With `collect()` removed, the next run fails with `TypeError: 'NoneType' object is not callable`, so the test catches it. |
| CR2 MINOR 2: `exit(False)` | Fixed and tested. `exit(True)` and `exit(0.0)` stay `runtime`, which matches CPython. |
| CR2 MINOR 3: silent `reconfigure` fallback | Fixed. The worker's `runPython` raises, so `load` ends in `load_failed`. The test catches a restored silent `except`. Pyodide 314's `setStdout` only replaces the device ops (`Ve[D.stdout]=t` in `pyodide.asm.mjs`), so the reconfigured `sys.stdout` survives each per-run `setStdout`. |
| CR2 MINOR 4 / SR2 MINOR 4: `--out`, staging inside `public/` | Fixed. The `--out` tests catch a regression, but one of them is destructive if the guard ever regresses (MINOR 3). Staging has no test that catches a revert (MINOR 4). |
| CR2 MINOR 5: `pyodide.http` test | Fixed: `open_url` is attempted and must fail. |
| SR2 MINOR 1: escaping via `json`'s module state, `isinstance` and `__class__` | Fixed. Swapping in `py_encode_basestring_ascii` forges `"kind": "ok"`, and the test catches it. Swapping back to `isinstance` reports `Spoof` as `ok`, and the test catches that too. A fuzz of every code point from U+0000 to U+10FFFF (1,238 messages) parsed in Node with the exact message: 0 mismatches. |
| SR2 MINOR 5: `navigator.storageBuckets` | Fixed. The tests only check the list itself (MINOR 4). |
| SR2 MINOR 6: loader test control, `micropip` check | Control added. The new `micropip` check can never fail (MAJOR 1). |
| Owner's question: is the worker replaced after `output_limit`? | Yes. `output.ts:102-110`: a write returns false only after `truncated` is set, so text is left over only after a capped run. `core.ts:197`: `truncated` always gives outcome `output_limit`. `controller.ts:203`: `output_limit` always restarts the worker. Time limit, stop and crash restart too. Covered by `controller.test.ts:212` and the flood e2e (`runtime-restarts` is `1`, then `after`). |

## Findings

**MAJOR 1** `e2e/runtime.spec.ts:196-199`: the new `"micropip" in sys.modules` check (T-01) can never fail.
- Two reasons:
  - `loadPackage` installs a wheel but never imports it.
  - `restore()` (`run-support.ts:91-93`) removes every module that was not in the snapshot at the start of each run, and the check runs in a later run.
- CPython probe: run 1 `import json.tool` printed `True`; run 2 `'json.tool' in sys.modules` printed `False`.
- This round also removed the old `not.toContain("'loaded'")` assertion. That was right: Pyodide 314's `loadPackageInner` logs failures and resolves with the list of packages it loaded. But nothing on the Python side replaced it.
- The commit message ("the loaders pass only if micropip never arrived") and the PR (line 169, "checks both what the loaders settled with, read from Python, and the request log") claim evidence the test does not produce. Only the request log, with its new control, actually checks anything.
- Fix: note what `loadPackage` resolved with (expect an empty list), and in the probe run assert `importlib.util.find_spec("micropip") is None`.

**MINOR 1** `src/runtime/controller.ts:130`: a program that prints exactly 64,000 characters and then loops or is stopped is reported as cut.
- The page cannot tell this apart from "hit the cap and caught the write error", because the worker never sends more than 64,000.
- `controller.test.ts:228` builds this exact case (2 × 32,000) and expects `truncated: true`.
- This is rarer than the round-2 blocker, but it is the same wrong report.
- Fix: the worker marks the output message that carries the cut. That is a protocol field, so it needs a schema change. Otherwise record the limitation.

**MINOR 2** `src/runtime/worker/run-support.ts:164`: no test notices if the `+ 1` in `line > line_count + 1` is removed.
- CPython 3.9.6 never reports a syntax error one past the end. `if True:\n`, `x = (\n`, `def f():\n` and `print(1\n` all give line 1 of 1.
- Python 3.10 and later, as in Pyodide's 3.14, can report line 2 for `if True:\n`. Without the `+ 1`, that line would be dropped.
- Fix: test it directly with a raised `SyntaxError`. In a three-line program, `lineno = 4` must be kept and `lineno = 5` dropped.

**MINOR 3** `scripts/build-runtime.test.ts:75`: the `"src/runtime"` case runs the real script against the real source tree.
- If the guard ever regresses, `pnpm test` replaces `src/runtime/worker` with compiled output and deletes the source.
- Fix: use a source-side path that does not exist (for example `src/runtime/not-a-folder`). It still proves the refusal, and a regression would not destroy anything.

**MINOR 4** Two fixes have no test that would fail without them, although PR line 213 says "each with a test that fails without it".
- cd42ab1: if staging goes back to `${target}.building-*` inside `outDir`, every test still passes. The old code also cleaned up after a successful build. `STAGING_DIR` just stays empty, and `outDir` still holds only `pyodide`. Fix: check `outDir` from inside the build (export `replaceFolder`, or add a test hook), or assert the staging folder appears in `stagingDir` while the build runs.
- b1212e4: `storageBuckets` is checked only through `BLOCKED_NAVIGATOR`, so removing it from the list passes every test. Fix: one literal assertion that the list contains `storageBuckets`.

**MINOR 5** `src/runtime/worker/run-support.ts:184-186`: the fallback reports `runtime` for every failure, including a real `MemoryError`.
- If building the outcome raises during a real out-of-memory condition, the run is reported as `runtime`. The controller then does not replace the worker (`controller.ts:202`), and the grown memory stays.
- The program's objects are still alive at that point, because the namespace is cleared after `outcome()`.
- Not reproduced by the reviewer.
- Fix: in the `except`, choose `memory` when `is_subclass(kind_of(failure), memory_error)`.

**MINOR 6** `docs/reports/pull-requests/WP-3.1.md` is out of date after be2c7c0.
- Line 35 says the build is staged beside its target and limited to the repository.
- Lines 151-152 say "Nothing has run against real Pyodide. The package is not installed".
- Line 166 says the Brotli size is unknown. It is 5,464,072.
- Line 169: see MAJOR 1.
- Line 240 asks the owner to paste the size lines.
- Fix: update these lines with the owner's Node-under-Pyodide run, named as such.

## Not fixed, for the owner (carried over)

1. The runtime e2e runs on the development server only.
2. The asset base is a constant.
3. The burst rule departs from section 5.2.
4. The worker gives up on a malformed message.
5. Loading has no time limit.
6. Validate isolation is deferred.
7. The 60 s and 120 s test budgets.
8. `immutable` on a miss under `/_runtime/pyodide/`.
9. ADR-0033 is still Proposed.

## What the reviewer ran

- `git log --format=fuller 17facd4..be2c7c0`: every author and committer is Fahad. No attribution. The diff adds no skip, `.only`, suppression, retry or TODO.
- `pnpm verify` at be2c7c0: `Test Files 27 passed (27)`, `Tests 636 passed (636)`.
- CPython 3.9.6 probes of the compiled `RUN_SUPPORT_DEFINITION`, from `public/_runtime/worker/worker/run-support.js`:
  - the original against mutations: no `collect()`, `isinstance` back, no outcome guard, no line bound, `py_encode_basestring_ascii` with `_json` blocked;
  - module carry-over between runs;
  - syntax error line numbers at the end of a file;
  - a full code-point fuzz of the escaper, parsed in Node 26.
- `copyRuntime` against the installed package into the session's scratch folder: `314.0.7 13531207 5464072`. The staging folder was empty afterwards.
- Read Pyodide 314.0.7's `setStdout` and `loadPackageInner` in `node_modules/pyodide/pyodide.asm.mjs`.
- Lockfile: `ws@8.23.0`, which is 8.17.1 or later; `pyodide@314.0.7` with an sha512 integrity hash.

## Not checked

- No browser. None of `e2e/runtime.spec.ts` or `runtime-headers.spec.ts` ran. Still unverified:
  - whether Playwright logs dedicated-worker requests in Firefox and WebKit. If it does not, the new control fails the loader test there by design;
  - whether `open_url` fails in each engine.
- `pnpm build` and `next start`. The reviewer relied on the implementer's report.
- Python 3.14 behavior of the line bound and the escaper. Only CPython 3.9 was probed. The Node-under-Pyodide run covers part of this.
- Out of scope: the working tree has an uncommitted change to `.claude/settings.json` from the owner. It does not touch the attribution keys and is not in this range.
