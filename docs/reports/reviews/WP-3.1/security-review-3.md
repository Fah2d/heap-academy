# WP-3.1 security review 3

- Reviewer: security-reviewer subagent, fresh context
- Range: 17facd4..be2c7c0 on `wp/3.1-python-worker` (24bceee, b1212e4, cd42ab1, ce59773, d31371c, a06e244, be2c7c0)
- Threats in scope: T-01, T-15, T-22 and T-23 (Validate, deferred), the supply chain, and sections 5.1 and 5.2 for `/_runtime/`
- Date: 2026-11-20
- Verdict: CHANGES REQUIRED. No blocker, one major (documentation only), three minors.

The reviewer works read-only; the implementer saved this report from its final message, unchanged.

## Merge gate (unchanged from round 2, partly met)

- Met: `pyodide@314.0.7` is installed and `ws` resolves to 8.23.0.
- Still open: `e2e/runtime-headers.spec.ts` in all three engines on the production server, `e2e/runtime.spec.ts` in all three engines, and accepting ADR-0033.

## Dependency

- The lockfile's sha512 matches the registry for all three packages: `pyodide@314.0.7` (`0YvXxEhf…R1A==`), `ws@8.23.0` (`wCkmX8QM…noQ==`) and `@types/emscripten@1.41.6` (`uN+9i8bF…MdEXg==`).
- The only new transitive packages are `ws` and `@types/emscripten`. `pnpm why ws` shows one version, 8.23.0, which is past the CVE-2024-37890 fix in 8.17.1. `pnpm audit --prod` reports "No known vulnerabilities found".
- None of the three packages has a `preinstall`, `install`, `postinstall` or `prepare` script, or a `binding.gyp`. `strictDepBuilds: true` and `minimumReleaseAge: 1440` are in force; 314.0.7 was published on 2026-09-14.
- No app or client code imports `pyodide`. Only `build-runtime.mjs` copies files from it. The five files under `public/_runtime/pyodide/314.0.7/` match the package byte for byte (SHA-256).
- 314.0.8 is now the latest version. The pin is deliberate (the E-02 measurement).

## Round-2 items

| Item | Status |
|---|---|
| MINOR 1: escaping relies on `json` state; `isinstance` follows a fake `__class__` | The module-state and `__class__` routes are fixed and tested. The report can still be forged another way: see MAJOR 1. |
| MINOR 2: huge `lineno`, attributes that raise | Fixed and tested (`run-support.ts:163-166`, and the fallback around `outcome`). |
| MINOR 3: a miss under `/_runtime/worker/` | Not fixed; listed under "Not fixed" in the PR. Unchanged. |
| MINOR 4: staging inside `public/` | Fixed. Staging is in `node_modules/.cache/heap-runtime`, swapped in with two renames. `--out` must be strictly inside `public/`, tested for a source folder, `public` itself, and a folder outside the repository. A failed second rename leaves no output and fails the build, so it fails closed. |
| MINOR 5: `navigator.storageBuckets` | Fixed (`lockdown.ts:38-44`). |
| MINOR 6: loader-test control | The control is added. The `micropip` check proves nothing: see MINOR 1. |
| MINOR 7: proxy matcher prefixes | Not in this range. Unchanged. |

## Regression questions

- **Does the controller always replace the worker after `output_limit`? Yes.** A write fails only once `truncated` is set (`output.ts:102-110`). That is the only time the handler throws (`core.ts:161-163`). Whenever `truncated` is set, the worker reports `output_limit` (`core.ts:197-198`), and the controller restarts on it (`controller.ts:203`). The 64,000 leftover characters seen under Node come from Python's buffer after a failed write, and that worker is always discarded. Trusting the worker's own `truncated` flag in `finishReported` changes nothing here, because a program can no longer post messages to the page (`postMessage` is removed). Covered by `controller.test.ts:219-223` and the e2e test at `runtime.spec.ts:103`.
- **`hasattr(js, "fetch")` is True under Node.** That is expected: the fake host's lock-down does nothing. Only the browser e2e tests (not yet run) prove the lock-down.
- **Refusing to start without streaming.** If `reconfigure` raises, `runPython` throws and the worker stops with `load_failed`. This replaces a silent `pass`, so it is stricter.
- **Nothing weakens the lock-down, the worker policy, the headers, or the output-folder rule.** `next.config.ts`, `vercel.json`, `src/proxy.ts`, `src/infrastructure`, `.github` and `pnpm-workspace.yaml` are unchanged in this range. The lock-down list only grew.
- **Note:** the `--out` check compares paths as written, so a symlink inside `public/` that points elsewhere would pass. This needs write access to the repository; negligible.

## Findings

**MAJOR 1** `docs/reports/pull-requests/WP-3.1.md:272`, and the closure in `src/runtime/worker/run-support.ts:76,163,194`. Threats T-22 and T-23.
- **Problem:** the PR says "The report itself can no longer be forged", and offers "or drop pending callbacks between runs" as a fix for Validate. Both are wrong.
- **Attack:** a program finds the runner through `sys._getframe(1)` and `gc.get_referrers`, then rewrites the runner's closure cells (`result`, `compile_program`). From then on, every later run on that worker gets a forged report, and the program sees each later program's source. `restore()` does not restore those cells.
- **Evidence:** a CPython 3.9.6 probe against the compiled `RUN_SUPPORT_DEFINITION`. A later `raise ValueError("real failure")` came back as `{"kind": "ok", …}`, and the hook printed `SPY saw next program: 'raise ValueError("real failure")'`.
- **Impact now:** limited to the learner's own results, which section 6 already accepts. For T-23, code in an imported lesson could fake the Validate results of every lesson validated after it in the same worker. That breaks T-22's control.
- **Fix:**
  - Correct line 272: the report can be forged by the running program, and the change persists until the worker is replaced.
  - Strike "drop pending callbacks" as a fix. For Validate (WP-3.3 or WP-4.3), a fresh worker per case is the only option that holds.
  - Add the persistence across runs to the deferred Validate item.

**MINOR 1** `e2e/runtime.spec.ts:196` (assertion at :200). Threat T-01.
- **Problem:** `"micropip" in sys.modules` is always False, so the check proves nothing. `loadPackage` installs the package without importing it, and `restore()` removes any module not in its snapshot at the start of each run (`run-support.ts:87-94`). The old `'loaded'` check was also removed, so the request log is now the only real evidence.
- **Evidence:** a CPython probe. Run 1 imported `fractions`; run 2 printed `True False` (the saved flag, then `"fractions" in sys.modules`).
- **Fix:** check the file system instead, with `importlib.util.find_spec("micropip") is None`.

**MINOR 2** `e2e/runtime.spec.ts:149-152`. Threat T-01.
- **Problem:** `except Exception: print("refused")` treats any error as a refusal, including a renamed or missing `open_url`. That test also does not check the request log for `/api/health`. In 314.0.7, after the lock-down, the refusal shows up as a `NameError` on `XMLHttpRequest` (`pyodide/http/__init__.py`).
- **Fix:** print `type(error).__name__` and assert on it, and add the request-log check that the loader test uses.

**MINOR 3** `docs/reports/pull-requests/WP-3.1.md:153` and "Owner actions" item 1. Out of date after be2c7c0: "The package is not installed", and the step to add the dependency. Fix: update both, and record that the sha512 check and `pnpm audit --prod` have now been done.

## Deferred, for the owner

1. Validate isolation (round 2, item 1). Narrowed by MAJOR 1: the only acceptable form is a fresh worker per Validate case.
2. Round-2 deferred items 2 and 3, unchanged.

## What the reviewer ran

- `git diff 17facd4..be2c7c0`, plus the full `controller.ts`, `core.ts`, `lockdown.ts`, `output.ts` and `run-support.ts`, and the e2e lock-down tests.
- `pnpm verify`: exit 0, 27 test files, 636 tests passed.
- `pnpm audit --prod`: "No known vulnerabilities found". `pnpm why ws` and `pnpm why @types/emscripten`: one version each.
- Registry metadata for the three packages: integrity, publish date, maintainers and scripts. Local `package.json` files checked for install scripts.
- SHA-256 of the copied runtime files against `node_modules/pyodide`.
- `pyodide/http/__init__.py` from `python_stdlib.zip`.
- Two CPython 3.9.6 probes of the compiled run support (closure tampering; `sys.modules` reset), kept in the session's scratch folder.
- `git log`: author and committer are Fahad on all seven commits. `pnpm attribution` passed inside `pnpm verify`.

## Not checked

- Any browser: the lock-down in a real worker, `storageBuckets` in Chromium workers, the worker policy, the header rule order, and whether Playwright logs worker requests in Firefox and WebKit.
- The closure attack inside Pyodide 3.14 itself. `gc` and `sys._getframe` are standard there, but the reviewer did not run it.
- Vercel's build cache for `node_modules/.cache`, and Vercel's header merge.
- Whether 314.0.8 fixes anything security-related.
