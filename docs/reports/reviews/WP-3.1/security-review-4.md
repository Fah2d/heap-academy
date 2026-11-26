# WP-3.1 security review 4

- Reviewer: security-reviewer subagent, fresh context, read-only
- Range: be2c7c0..2d94ead (7cf1ce6, e5f54c4, 2d94ead), the merge 5f72072, and the e06e9c3 description. Also the earlier merge f617391 (main at 037c4ad, #3 and #4), which no security round had seen.
- Threats: T-01, T-15, T-22 and T-23 (Validate, still deferred), and the supply chain.
- Date: 2026-11-23

**Verdict: APPROVE.** No blocker and no major. Two minors. The merge gate from rounds 2 and 3 still holds: both e2e files run in all three engines, and ADR-0033 accepted.

## Round-3 items

| Item | Status |
|---|---|
| MAJOR 1: the description claimed the report could not be forged | **Fixed.** "Not fixed" now says the program can rewrite the runner's closure through `sys._getframe` and `gc.get_referrers`, and that the change lasts until the worker is replaced. A fresh worker per Validate case is named as the only fix that holds. |
| MINOR 1: the `micropip` check could never fail | **Fixed.** `e2e/runtime.spec.ts:219` asks `importlib.util.find_spec("micropip") is None`. This can now fail: Pyodide 314.0.7 calls `importlib.invalidate_caches()` after every `loadPackage`. `settled` also rejects any resolved value with items, or with no length (`:220-221`). The request-log check is kept. |
| MINOR 2: `open_url` treated any error as a refusal | **Fixed.** `:164` requires `NameError` and `:165` requires no `/api/health` request. Pyodide's `pyodide/http/__init__.py` has `from js import XMLHttpRequest` under `except ImportError: pass`, so `open_url` hits an unbound global. |
| MINOR 3: out-of-date dependency text | **Fixed.** The sha512 and audit results are recorded, and owner action 1 is marked done. |

## Code-review fixes in this range

- **e5f54c4, the memory classification** (`run-support.ts:184-188`). Sound. The fallback cannot raise: `issubclass(real_class, MemoryError)` follows the MRO in C without running Python code. A program could only push its own run toward `memory`, which ends in a new worker, so the error only goes the safe way. The test catches the regression: in a CPython probe, the be2c7c0 code reports `runtime` and the e06e9c3 code reports `memory`.
- **The line bound** (`:164`, at most `line_count + 1`). Tested with 4 kept and 5 dropped. The one consumer, `runtime-console.tsx:72-73`, renders the line as text.
- **2d94ead, the build script.** `replaceFolder` is only exported, not changed. The new test checks that the build runs in the staging folder while the served folder stays empty. The refused source path still goes through the same check, and a broken check would now delete nothing.
- **storageBuckets.** The test lists `sendBeacon`, `serviceWorker`, `storage`, `storageBuckets` and `locks` by name.

## The merges

- **5f72072.** No effect on the runtime headers or the proxy. `next.config.ts`, `src/proxy.ts`, `vercel.json`, `src/infrastructure`, `.github`, `package.json`, `pnpm-lock.yaml` and `pnpm-workspace.yaml` are unchanged between the merge and its first parent. In `playwright.config.ts`, `developmentOnly = [gallery, runtime, phone]` is right: `/runtime\.spec\.ts$/` does not match `runtime-headers.spec.ts`, so the header tests still run in the production `chromium`, `firefox` and `webkit` projects. There is one `webServer` for port 3101.
- **f617391.** `next.config.ts` became `config(phase)`; `headers()` still returns `SECURITY_HEADERS` on `/:path*` and then `runtimeHeaders(...)`, in both phases. `pageExtensions` adds `dev.tsx` only under `PHASE_DEVELOPMENT_SERVER`, so `/dev/runtime` is not built for production. The lockfile has the same sha512 for `pyodide@314.0.7`, `ws@8.23.0` and `@types/emscripten@1.41.6` as at be2c7c0. The workspace keeps `strictDepBuilds`, `minimumReleaseAge: 1440` and `minimumReleaseAgeStrict`; main added only a deny-by-default `allowBuilds`.
- **Authorship.** Author and committer are Fahad on 7cf1ce6, e5f54c4 and 2d94ead, with no trailers.

## Findings

**MINOR 1** `docs/reports/pull-requests/WP-3.1.md:187, :216, :291, :300, :328`. Merge gate.
- Problem: five passages still say #3 is not merged, but f617391 brought it in, so `/dev/runtime` is a page on this branch now (:187 "The development page has no route on this branch"; :216 "On this branch alone they cannot run"; :291 "once #3's development-only page mechanism is merged"; :300 owner action 2 "After #3 and #4 are merged, run the browser tests"; :328 the `webServer` deviation, now done).
- Failure: the owner may think the merge gate cannot be run yet. It can be run now.
- Fix: say the browser tests can run on this branch as it is, make owner action 2 unconditional, close the `webServer` deviation, and say the development page has a development route and no production route.

**MINOR 2** `next.config.ts:51-58`. T-01, T-15.
- Problem: no unit test ties the exported `config(phase)` to `runtimeHeaders`. `security-headers.test.ts` tests the function, not the wiring. f617391 rewrote this file in a merge.
- Failure: a later merge that drops the `...runtimeHeaders(...)` spread would remove the worker's own policy. `pnpm verify` would not notice; only `runtime-headers.spec.ts` would, and it has never run.
- Fix: a unit test that calls the default export with the production build phase and the development phase, and checks that the rule list from `headers()` ends with the worker rule from `runtimeHeaders`, and that no rule after it sets `Content-Security-Policy`.

## Deferred, for the owner (unchanged)

1. Validate isolation: a fresh worker per Validate case (WP-3.3, used by WP-4.3).
2. Round 2 MINOR 3: a miss under `/_runtime/worker/` gets the worker policy. Round 2 MINOR 7: the proxy matcher's exclusions are prefixes.
3. Round 3's note: the `--out` check compares paths as written, so a symlink inside `public/` would pass.

## What was run

```
$ pnpm vitest run src/runtime/worker/run-support.test.ts src/runtime/lockdown.test.ts scripts/build-runtime.test.ts src/runtime/controller.test.ts src/runtime/worker/core.test.ts
exit=0
 Test Files  5 passed (5)
      Tests  74 passed (74)

$ pnpm vitest run src/runtime/worker/run-support.test.ts --reporter=verbose
exit=0
 ✓ ... [FR-RUN-01] keeps a syntax error's line one past the program's end, and drops one further 47ms
 ✓ ... [FR-RUN-06] reports a memory error as memory, and the next run works 48ms
      Tests  22 passed (22)

$ pnpm vitest run src/infrastructure/http/security-headers.test.ts
exit=0
 Test Files  1 passed (1)
      Tests  16 passed (16)

$ pnpm vitest run
exit=0
 Test Files  36 passed (36)
      Tests  839 passed (839)
```

Every vitest run printed pnpm's `ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK` warning from the sandbox. Nothing was installed.

CPython 3.9 probe of the run support from be2c7c0 and from e06e9c3, with a `MemoryError` subclass whose `__traceback__` property raises:

```
old.py {"kind": "runtime", "message": "", "line": null}
new.py {"kind": "memory", "message": "", "line": null}
```

## Not checked

- Any browser, so neither e2e file.
- `pnpm build` and `pnpm verify` on e06e9c3 (the review copy had no `.git`); the description's results on 5f72072 are taken as reported.
- Vercel's header merge and its build cache for `node_modules/.cache`.
