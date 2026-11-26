# WP-3.1 security review 1

- Reviewer: security-reviewer subagent, fresh context
- Range: c792dd8..f4d093b on `wp/3.1-python-worker`
- Threats in scope: T-01, T-02; T-15 and section 5.2 because of the proxy matcher change
- Date: 2026-11-17
- Verdict: CHANGES REQUIRED. No blocker; three majors.

## Findings

**MAJOR 1** `src/proxy.ts:51` and `security-headers.ts:113-131` (T-15, NFR-SEC-02).
- A path under `/_runtime/` that is not a file, such as `/_runtime/x`, renders Next.js's not-found HTML without the proxy. That page has no script policy and no `frame-ancestors 'none'`.
- A miss under `/_runtime/pyodide/` also gets `immutable`, so a deploy race can cache a 404 for a year.
- Fix:
  - Give every `/_runtime/` response a static policy, `default-src 'none'; frame-ancestors 'none'; sandbox`, with the worker's rule last so it wins.
  - Add `frame-ancestors 'none'` to the worker policy.
  - Test the ordering, and check a miss against a production server.

**MAJOR 2** `e2e/runtime.spec.ts:108-173` (T-01).
- The test checks 8 names. It skips `WebSocketStream`, `WebTransport`, `SharedWorker`, `caches` and `navigator.serviceWorker`, and none of Pyodide's own helpers: `pyodide.http.pyfetch`, `pyxhr`, `open_url`, `pyodide_js.loadPackage`, `pyodide_js._api.loadBinaryFile`.
- It is safe today: `pyodide.http` binds `fetch` and `XMLHttpRequest` when it is imported, and it is not imported before the lock-down. In real Pyodide 314.0.7 in Node 26, `loadPackage` and `loadBinaryFile` failed with `ReferenceError: fetch is not defined`. But it is fragile: a later preload that imports `pyodide.http` early would keep a live `XMLHttpRequest`.
- Fix:
  - Add the missing names and helper attempts.
  - Assert that `pyodide.http` is not in `sys.modules` at the lock-down.
  - Prove the worker policy from inside the worker with a `securitypolicyviolation` listener.

**MAJOR 3** `playwright.config.ts` and `page.dev.tsx` (T-01, T-02).
- On this branch `next.config.ts` has no `pageExtensions`, so `/dev/runtime` is a 404 and the suite cannot run until WP-1.4 merges.
- It then runs only against the development server, whose page policy includes `'unsafe-eval'`.
- Neither the production project nor `infra:verify` checks the worker script's headers.
- Fix:
  - Add a production-server request test for the worker policy, and one for immutable plus `nosniff` on the Pyodide files.
  - Add the same check to `pnpm infra:verify`.
  - Record the WP-1.4 dependency.

**MINOR 1** `core.ts:195-203` and `protocol.ts:172` (T-02). `raise Exception('x' * 70000)` gives a 70,011-character message. The page refuses the `run_done`, and the run is reported as `time_limit`. Fix: truncate the message in the worker.

**MINOR 2** `run-support.ts:42,77-90`.
- Replacing `json._default_encoder` forges every later `ok` report in that worker.
- A callback set with `js.setTimeout(create_proxy(f), 0)` runs after the run and the restore.
- ADR-0004 accepts this for learners, but not for Validate (T-22, T-23).
- Fix for WP-3.3 or WP-4.3: a fresh worker per Validate case, a report built without `json`, and pending callbacks dropped between runs.

**MINOR 3** `lockdown.ts:13-31` (T-01). `indexedDB`, `navigator.storage` and `navigator.locks` are shared with the page's origin. Fix: remove them, or record them as a residual risk.

**MINOR 4** `scripts/build-runtime.mjs:84,120`. `--out` is deleted recursively without checking that it lies inside the repository. Fix: refuse an output folder outside the repository.

## Found blocked

- Prototype chain recovery.
- `js.Function`, `js.eval`, `run_js` and string `setTimeout`, refused by the worker policy.
- Dynamic `import()`: at most a same-origin GET whose response cannot be read; `blob:` and `data:` are blocked.
- BroadcastChannel, caches, service workers, nested workers and fonts.
- Forged messages to the page: `postMessage` is gone.
- Message parsing: `null`, extra fields, a wrong prototype and oversized fields are refused.
- No learner code on the main thread or a server.
- The output cap is enforced inside the worker.
- CSP reports are reduced to codes.

## Dependency

- The `pyodide@314.0.7` sha512 matches the registry.
- It has no install scripts.
- Its dependencies are `ws@^8.5.0` (Node only) and `@types/emscripten`. Check that the lockfile resolves `ws` to 8.17.1 or later (CVE-2024-37890).
- 314.0.8 was published on 2026-11-13; its changelog was not read.

## What the reviewer ran

- `pnpm verify` passed.
- A focused `vitest` run: 12 files, 119 tests.
- A worker compile: no `eval` and no `new Function`.
- Real Pyodide 314.0.7 in Node 26, loaded with the branch's run support and lock-down, against the attack programs above.

## Not checked

- No browser engine.
- Vercel's headers on `/_runtime/`.
- The firewall rate limit (T-14, T-25).
- WebKit's handling of worker policies.
- The canary of T-21.
