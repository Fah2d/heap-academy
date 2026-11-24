# WP-3.1 security review 2

- Reviewer: security-reviewer subagent, fresh context
- Range: f4d093b..17facd4 on `wp/3.1-python-worker`, answering `security-review-1.md` and `code-review-1.md`
- Threats in scope: T-01, T-15, T-22 and T-23 (Validate, deferred), and sections 5.1 and 5.2 for `/_runtime/`
- Date: 2026-11-17
- Verdict: APPROVE after the merge gate. No blocker and no major; seven minors (MINOR 7 predates this range).

## Merge gate

None of the browser-side T-01 and T-15 evidence has run. Before merge:
- install `pyodide@314.0.7` and check that `pnpm why ws` resolves to 8.17.1 or later;
- run `e2e/runtime-headers.spec.ts` on the production server in all three engines;
- run `e2e/runtime.spec.ts` in all three engines once WP-1.4's `pageExtensions` is merged;
- accept ADR-0033.

## Round-1 items

| Item | Status |
|---|---|
| MAJOR 1: static policy for `/_runtime/`, worker rule last, `frame-ancestors` | Addressed in code. Next 16.4.6 `resolve-routes.js:546-565` writes each matching rule's headers in order, so the later rule wins, matching the docs. Browser evidence pending. |
| MAJOR 2: lock-down and policy proven inside the worker, Pyodide's loaders | Addressed in test; not run. See MINOR 6. |
| MAJOR 3: production header test, `infra:verify` checks, WP-1.4 dependency | Addressed. |
| MINOR 1: oversized error message | Addressed and tested. |
| MINOR 2: report without `json` | Addressed, with the caveat in MINOR 1 below. |
| MINOR 2: Validate isolation | Deferred. |
| MINOR 3: `indexedDB`, `navigator.storage`, `navigator.locks` | Addressed. See MINOR 5. |
| MINOR 4: `--out` outside the repository | Addressed and tested. |

## Regression questions

- **The static policy does not break the worker.** The worker takes its policy from its own script response, and that response gets the worker rule. Pyodide's files are subresources. Not verified in a browser.
- **The hand-built report is safe with the C accelerator.** A CPython probe used an error text containing a quote, a backslash, a newline, U+2028 and a lone surrogate; it was escaped and parsed as `runtime`. See MINOR 1 and 2 for the weak spots.
- **The staging folder can be served and left behind.** Low impact; see MINOR 4.

## Findings

**MINOR 1** `run-support.ts`. The escaping relies on `encode_basestring_ascii` being the C function from `_json`.
- The pure-Python fallback reads `json.encoder.ESCAPE_DCT`, which a program can change. With `_json` blocked, a probe forged `"kind": "ok"` through a duplicate key.
- `isinstance` follows a learner-defined `__class__`, and a real failure was reported as `ok`.
- Today a learner can only change their own result, as `SystemExit(0)` already allows; it matters for Validate.
- Fix: escape without module state, and use `issubclass(type(failure), …)`.

**MINOR 2** `run-support.ts`. A `lineno` of `10**30`, or a `lineno` or `code` property that raises, makes the worker give up (`runtime_crashed`). Fix: bound the line by the program's length, and fall back to `runtime` if building the outcome raises.

**MINOR 3** `security-headers.ts`. A miss under `/_runtime/worker/` gets the worker policy, not the static one. Defence in depth only. Fix: limit the worker rule to the compiled files.

**MINOR 4** `build-runtime.mjs`.
- The staging folder sits inside the served tree.
- A killed build leaves it behind.
- Between the removal and the rename the target does not exist.
- Fix: stage outside `public/`, and swap with two renames.

**MINOR 5** `lockdown.ts`. Chromium's `navigator.storageBuckets` opens named buckets of the origin. Fix: block it.

**MINOR 6** `e2e/runtime.spec.ts`, the loaders test.
- The request log may not include worker requests in every engine; it needs a positive control.
- A `loadPackage` that settles after an error would fail the test wrongly.
- Fix: check `micropip` is not in `sys.modules`.

**MINOR 7** `src/proxy.ts:53`, from before this range. The matcher's exclusions are prefixes, so `/favicon.icoX`, `/_next/imageX` and misses under `/_next/static/` render the not-found page without a policy. Fix in WP-1.3 or WP-1.4.

## Deferred, for the owner

1. **A fresh worker per Validate case, and timers dropped between runs** (WP-3.3 or WP-4.3). Module contents also carry over between runs; only the `sys.modules` table is restored.
2. **`immutable` on a miss under `/_runtime/pyodide/`.** Narrow risk. Recovery: bump the version path.
3. **The runtime e2e on the development server only.** `06-security-privacy.md:114` says WP-3.1 confirms the page policy does not need `'wasm-unsafe-eval'`. That is not confirmed until a production page loads the runtime. The owner must accept the departure.

## What the reviewer ran

- `pnpm verify` at 17facd4: 27 files, 629 tests.
- `node scripts/infra-verify.mjs` loads with its `.ts` imports in Node 26.
- Next 16.4.6 source and bundled docs for the header order.
- CPython 3.9.6 probes of the run support: eight attack programs and a `_json`-blocked run.
- `git log`: every author and committer is Fahad; no suppression, skip, `.only` or retry.

## Not checked

- Any browser or real Pyodide.
- Vercel's header merge and build command.
- `securitypolicyviolation` in Firefox and WebKit workers.
- `_json` in Pyodide 314.
- `storageBuckets` in Chromium workers.
- The `ws` version.
