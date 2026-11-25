# WP-3.1 code review 2

- Reviewer: code-reviewer subagent, fresh context
- Range: f4d093b..17facd4 on `wp/3.1-python-worker`, checking the fixes for `code-review-1.md` and `security-review-1.md`
- Date: 2026-11-17
- Verdict: CHANGES REQUIRED. One blocker and two majors, introduced or left open by this round.

## Round-1 findings: status

| Finding | Status |
|---|---|
| B: output does not stream | Fixed. Python's streams are line-buffered; see MAJOR 1 and MINOR 3. Not verified in Pyodide. |
| B: learner code after `restore()` | Fixed; CPython probes confirm. Test gap for cycles (MINOR 1). |
| B: valid messages refused | Fixed and tested. |
| M: `BaseException` by name | Fixed. The same class of failure remains (MAJOR 2). |
| M: worker reused after `output_limit` | Fixed, with unit and e2e tests. |
| M: lint and tsc see `public/_runtime/` | Fixed. |
| M: runtime e2e only on `next dev` | Deliberately not fixed; partly offset by the policy read inside the worker and the production header tests. |
| M: weak tests | Fixed; the e2e tests have not run. |
| M: asset base constant | Deliberately not fixed; a spec change is proposed. |
| m: cap not reported at the time limit | Fixed, but the fix causes the BLOCKER. |
| m: `messageerror` | Fixed. The load time limit is deliberately not fixed. |
| m: e2e weaknesses | Fixed. |
| Security: `/_runtime/` misses, T-01 coverage, production checks, minors | Fixed. The immutable 404 under `/_runtime/pyodide/` is listed, not fixed. |

## Findings

**BLOCKER** `src/runtime/controller.ts:118`: a run that prints exactly 64,000 characters and ends `ok` is reported as truncated. `finish` ORs `received >= OUTPUT_LIMIT` on every path. Probe: 63,999 `x` and a newline, then `run_done ok truncated:false`, gave `truncated: true`. Fix: trust the worker on `run_done`, use the count only when the page ends the run, and test an `ok` run at exactly the cap.

**MAJOR 1** `src/runtime/output.ts:82-91`: up to 8 sends per 50 ms window departs from section 5.2's "Batched at most every 50 ms", and the change is not recorded. The 8 has no measurement behind it. Fix: record the deviation with a proposed `spec-change`, or keep the spec's rule.

**MAJOR 2** `run-support.ts`: a program can still make `run` raise, or return a report the page refuses.
- A property-backed `lineno`, `__traceback__` or `code` made `run` raise.
- A `lineno` of `10**20` produced a report that `parseRunReport` refuses.
- The comment at `core.ts:185` is false.
- Fix: guard `outcome()`, bound the line, and add tests.

**MINOR 1** No test notices removing `collect()` or either restore; the `Keeper` programs have no cycle. A copy without `collect()` broke the next run when `kept.me = kept` was set. Fix: add the cyclic case.

**MINOR 2** `sys.exit(False)` is now `runtime`. Python exits 0 for `False`. Fix: accept `False`.

**MINOR 3** Line buffering sends text on a newline only, so the comment overstates it. The silent `except` around `reconfigure` would hide a Pyodide stream that cannot be reconfigured. Fix: reconfigure stdout and stderr only, and fail loading if that is impossible in the worker.

**MINOR 4** `build-runtime.mjs`.
- `--out src/runtime` would delete the worker's source; restrict it to `public/`.
- The comment overstates the swap.
- A killed build leaves `*.building-*` under `public/_runtime/`.

**MINOR 5** `e2e/runtime.spec.ts`.
- The 120 s budget.
- `import pyodide.http` raising `ImportError` tests Pyodide's code, not the property; assert that `open_url` or `pyfetch` fails.
- If `_api.loadBinaryFile` does not exist, the request log is the only check.

**MINOR 6** ADR-0033 is Proposed.

## Not fixed, for the owner

1. The runtime e2e on the development server only.
2. The asset base as a constant.
3. The worker giving up on a malformed message, and `input` and `input_end` dropped without a report.
4. No load time limit (WP-3.4).
5. Validate isolation (WP-3.3 or WP-4.3).
6. The 60 s and 120 s test budgets.
7. `immutable` on a miss under `/_runtime/pyodide/`.

## What the reviewer ran

- `pnpm verify` at 17facd4: 27 files, 629 tests.
- `git log --format=fuller`: every author and committer is Fahad; no `.skip`, `.only`, suppression, TODO or retry.
- CPython 3.9.6 probes of the committed run support.
- A Node 26 probe of the transpiled controller, protocol, output and run support.

## Not checked

- No browser and no Pyodide: `reconfigure` on Pyodide's streams, `setStdout` keeping the stream object, the `pyodide.http` import, `transferSize` in WebKit, and `securitypolicyviolation` in a worker.
- Next.js and Vercel header precedence on 404s.
- `pnpm build`, `next start`, `infra:verify` against a deployment.
- The `ws` version.
- A change to `run-support.ts` made during the review (24bceee) was outside the range.
