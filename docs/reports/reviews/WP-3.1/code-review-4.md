# WP-3.1 code review 4

- Reviewer: code-reviewer subagent, fresh context
- Range: be2c7c0..2d94ead (7cf1ce6, e5f54c4, 2d94ead), the fixes for `code-review-3.md` and `security-review-3.md`. The copy reviewed is at e06e9c3. Between 2d94ead and e06e9c3 nothing changed under `src/runtime`, `scripts/build-runtime.*`, `e2e/runtime.spec.ts` or `src/infrastructure/http`; that stretch holds only merges from main and documentation.
- Date: 2026-11-23
- Verdict: **APPROVE** for this range. No blockers, no majors, three minors. The merge gate from earlier rounds still applies: browser runs in all three engines, a decision on ADR-0033, and the owner's waivers of the three open MAJORs. Approving this range does not waive any of those.

## Round-3 findings: status

| Finding | Claimed | Status |
|---|---|---|
| CR3 MAJOR 1 / SR3 MINOR 1: the `micropip` check could never fail | Fixed | **Done as asked, but it still cannot fail in this build (MINOR 1).** `find_spec("micropip") is None` reads the file system, so a module dropped by `restore()` no longer hides an install. Only the request log can catch a broken lock-down here. |
| CR3 MINOR 2: the `+ 1` line allowance has no test | Fixed | **Verified.** Removing `+ 1` fails the new test. Changing it to `+ 2` also fails it. |
| CR3 MINOR 3: the source-folder case could destroy source | Fixed | **Verified.** With the guard disabled, the case fails and only creates `src/runtime/not-a-folder/`. Nothing is deleted. |
| CR3 MINOR 4a: staging had no test that catches a revert | Fixed | **Verified.** Moving staging back to `${target}.building-` fails the new `replaceFolder` test. |
| CR3 MINOR 4b: `storageBuckets` had only an indirect test | Fixed | **Verified.** Deleting `"storageBuckets"` from `BLOCKED_NAVIGATOR` fails the new literal assertion. |
| CR3 MINOR 5: a `MemoryError` whose attributes raise was reported as `runtime` | Fixed | **Verified.** Reverting the fallback to `kind = "runtime"` fails the test. See MINOR 2. |
| CR3 MINOR 6 / SR3 MINOR 3: the description was out of date | Fixed | **Verified.** One correction needed (MINOR 1). |
| CR3 MINOR 1: exactly 64,000 characters, then the time limit or Stop, is reported as cut | Recorded under Deviations | Accepted as recorded. |
| SR3 MAJOR 1: the claim that the report "can no longer be forged" | Corrected | **Verified.** |
| SR3 MINOR 2: `open_url` accepted any error | Fixed | **Code reading only (no browser).** In Pyodide 314.0.7's `pyodide/http/__init__.py`, `from js import XMLHttpRequest` runs inside `try: ... except ImportError: pass`, and `open_url` then calls `XMLHttpRequest.new()`, which raises `NameError` with the global missing. The `/api/health` request-log assertion is added. |

## Findings

**MINOR 1** `e2e/runtime.spec.ts:214-221` and the WP-3.1 description: the Python-side assertions in the loader test still cannot fail in this build. Only the request log (line 222) can catch a broken lock-down.
- The wheel is never served. The build copies five files (`scripts/build-runtime.mjs:35-41`), and the micropip wheel is not one of them. The lock file still lists it (`micropip-0.11.1-py3-none-any.whl`).
- Pyodide asks for it at the same origin: `packageBaseUrl` defaults to the lock file's folder (`packageBaseUrl??=V(s)` in `pyodide.mjs`), which is `/_runtime/pyodide/314.0.7/`. Without the lock-down, `loadPackage("micropip")` would get a 404.
- On a 404, `loadPackage` logs the failure and resolves with `[]`. That gives "resolved 0", and `find_spec("micropip")` stays `None`. The worker's `connect-src 'self'` would also block a CDN fallback.
- The request log does catch it: the wheel request contains "micropip", and the log has its manifest control.
- Evidence:
  ```
  $ unzip -l node_modules/pyodide/python_stdlib.zip | grep -i micropip; echo $?
  1
  $ python3 -c "...d['packages'].get('micropip')..."
  ('micropip-0.11.1-py3-none-any.whl', ['micropip'])
  $ grep -o 'packageBaseUrl[^;]\{0,200\}' node_modules/pyodide/pyodide.mjs
  ...packageBaseUrl??=V(s)}e.indexURL=t,...
  ```
- Fix: keep the assertions, because they guard a future build that serves wheels. Change the test comment and the description to say that in this build the request log is the evidence.

**MINOR 2** `src/runtime/worker/run-support.ts:184-188`: the fallback recovers only `memory` from the error's class.
- An error that is not a `MemoryError`, with an attribute that raises `MemoryError`, is reported as `runtime`; the worker is then kept, although the failed allocation may have grown its memory.
- An `EOFError` subclass whose attributes raise is reported as `runtime`, not `input_ended`.
- Both need a program that defines a raising property, so a program can only cause this for its own runs.
- Probe (CPython 3.9.6, the definition taken from `run-support.ts`):
  ```
  ValueError, __traceback__ raises MemoryError -> {"kind": "runtime", "message": "", "line": null}
  EOFError, __traceback__ raises -> {"kind": "runtime", "message": "", "line": null}
  MemoryError, __traceback__ raises -> {"kind": "memory", "message": "", "line": null}
  ```
- Fix: work out the kind from `kind_of(failure)` first, which cannot raise. Then read the message and line inside the `try`. In the `except`, also choose `memory` when the exception caught there is a `MemoryError`. Whether a `SyntaxError` subclass with a raising `lineno` should stay `syntax` is a separate question; the test at line 254 expects `runtime`.

**MINOR 3** `src/runtime/worker/run-support.test.ts:275-278`: the new `MemoryError` case sits between the two assertions about `results`, and the test title does not mention memory.
- Fix: move the case into its own `it`, or at least below line 278.

No new defects otherwise: the fallback cannot raise; the `--out` guard is lexical, so a path that does not exist exercises the same branch; the new `replaceFolder` test fails on the revert; the diff adds no skip, `.only`, suppression, retry, raised timeout or TODO.

## What was run

All in a read-only copy of e06e9c3; history with `git -C` on the repository.

- Attribution, `git log --format=fuller be2c7c0..2d94ead`: every author and committer is Fahad. No credit patterns.
- `pnpm vitest run src/runtime/worker/run-support.test.ts src/runtime/lockdown.test.ts scripts/build-runtime.test.ts`: `Test Files 3 passed (3)`, `Tests 40 passed (40)`.
- Mutation checks, each restored and confirmed with `diff`:
  - M1, the fallback reverted to `kind = "runtime"`: `1 failed | 21 passed (22)`.
  - M2, `line > line_count`: `1 failed | 21 passed (22)`. M2b, `line > line_count + 2`: the same test fails.
  - M3, `"storageBuckets"` removed: `1 failed | 4 passed (5)`.
  - M4, staging at `${target}.building-`: `1 failed | 12 passed (13)`.
  - M5, the `--out` guard set to `if (false)`: `1 failed | 12 skipped (13)`; created `src/runtime/not-a-folder/{pyodide,worker}` in the copy, deleted nothing; removed afterwards.
- Gate pieces run directly: `prettier --check .` exit 0; `eslint --max-warnings=0 .` exit 0; `tsc --noEmit` exit 0; `vitest run --coverage`: `Test Files 36 passed (36)`, `Tests 839 passed (839)`, exit 0.

## Not checked

- No browser: neither `e2e/runtime.spec.ts` nor `runtime-headers.spec.ts` ran.
- `pnpm verify` as one command and the attribution script (the copy has no `.git`).
- `pnpm build` and `next start`.
- The fallback and line bound under Python 3.14; only CPython 3.9.6 was probed.
