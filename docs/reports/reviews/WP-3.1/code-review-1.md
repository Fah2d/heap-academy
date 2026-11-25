# WP-3.1 code review 1

- Reviewer: code-reviewer subagent, fresh context
- Range: c792dd8..f4d093b on `wp/3.1-python-worker`
- Date: 2026-11-17
- Verdict: CHANGES REQUIRED

## Findings

**BLOCKER** `src/runtime/output.ts:63`, `:92`: output does not stream.
- The collector sends a batch only from inside a later `write`, once 50 ms have passed since the last send, and `lastSent` starts at `now()`.
- Text printed in the first 50 ms, or within 50 ms of any send, waits for the next write or the end of the run.
- Probe with a fake clock: write `"first\n"` at 5 ms, then 2 s with no write. Nothing was sent during the busy loop; everything arrived at 2005 ms.
- `e2e/runtime.spec.ts:46` can never pass.
- Fix: send at once when 50 ms have passed (start at `-Infinity`), make Python's `sys.stdout` pass text through per line, and add a unit test.

**BLOCKER** `src/runtime/worker/run-support.ts:88-90`: learner code runs after `restore()`.
- `namespace.clear()` runs a learner `__del__` after the builtins are restored, and the traceback held in `failure` keeps learner objects alive past the restore.
- Probe in CPython 3.9.6: a `__del__` doing `builtins.abs = None` breaks the next run; `builtins.len = None` makes `run` itself raise.
- Fix: clear the namespace, drop the traceback, collect garbage, then restore. Test the `__del__` case.

**BLOCKER** `src/runtime/protocol.ts:172`, `:253`: the page refuses valid worker messages.
- `outcome.message` and `output.text` are limited to 64,000 UTF-16 units, but the worker bounds neither in those units.
  - The error summary has no limit.
  - The collector counts code points, so 64,000 astral characters is 128,000 units.
- Effect: a dropped `run_done` is reported as `time_limit`, and an emoji flood shows no output.
- Fix: cut the message in the run support, align the units, and test both.

**MAJOR** `run-support.ts:86`: `except BaseException` looks up a builtin by name before the restore.
- `del builtins.BaseException; raise ValueError('x')` makes `run` raise `NameError`.
- Fix: hold the reference, and add a test.

**MAJOR** `controller.ts:176-183`: after an output-limit run the same worker is reused, and text left in Python's buffers can reach the next run.
- CPython stand-in: the next run's collector received 8,195 bytes from the previous run.
- Fix: start a new worker after `output_limit`, and extend the flood e2e with a second run.

**MAJOR** `eslint.config.mjs`, `tsconfig.json`: the generated `public/_runtime/` is not excluded from lint or from the type check.
- After a build, `eslint .` would lint Pyodide's distribution; `eslint --stdin` on that path reported `no-unused-vars` and `no-eval`.
- Fix: add `public/_runtime/**` to `globalIgnores` and to the `tsconfig.json` `exclude`.

**MAJOR** `playwright.config.ts`: the runtime e2e runs against `next dev`, whose page policy has `'unsafe-eval'`. So "the page policy works without `'wasm-unsafe-eval'`" cannot be shown there.
- Fix: run against a production build, which needs an owner decision with WP-1.4, or record the line as partly evidenced.

**MAJOR** Tests that would not catch likely bugs:
- No second run on one worker. Deleting `core.ts:204` passes every test.
- No crash while restarting.
- No test of FR-RUN-07's "a second visit loads the runtime from cache".
- T-01 is proven only for names on `js`, not for Pyodide's own loaders (`loadPackage`, `pyodide.http`).

**MAJOR** `src/runtime/assets.ts:9`: `RUNTIME_ASSET_BASE_URL` is a constant in code. Section 5.1 and `07-operations.md` say it is one configuration value, changed "without a code change". Fix: read an environment value, or propose a `spec-change`.

**MINOR** `controller.ts:236-240`: a program that catches the write error and loops ends as `time_limit` with `truncated: false`, so the cap is not reported.

**MINOR** `core.ts:217`, `:235-239`: the worker gives up on a malformed message and drops `input` and `input_end` without reporting them. Section 5.2 says "dropped and reported". State the departure.

**MINOR** `controller.ts:202-204`: `messageerror` is reported as `malformed_message`/`not_an_object`, and loading has no time limit.

**MINOR** `e2e/runtime.spec.ts`:
- Loop end by `str(chain) != 'jsnull'`.
- `navigator.sendBeacon` never exists in a worker, so that check proves nothing.
- Any exception counts as "refused".
- The policy test's second navigation may get a revalidation response.
- Expect timeouts sit inside the 30 s test timeout.

**MINOR** `playwright.config.ts`: both web servers start for any project, and both run `build-runtime.mjs`, which deletes and rewrites `public/_runtime/` while the other may be serving it.

**MINOR** The isolation tests cite `[FR-RUN-01]` and verify FR-RUN-04. `scripts/build-runtime.test.ts:100` sets a 60 s test timeout, which the owner should know about.

**MINOR** ADR-0033 is Proposed, and the owner must accept it before this merges.

## What the reviewer ran

- `pnpm verify`: passed, 27 files, 600 tests.
- `git log --format=fuller`: every author and committer is Fahad. No attribution, suppression, skip, TODO or `.only`.
- Probes in `$TMPDIR`: the run support in CPython 3.9.6, `output.ts` and `protocol.ts` compiled and run in Node 26, `eslint --stdin` and `prettier --file-info` on the generated paths.

## Not checked

- No browser and no Pyodide.
- `pnpm build`.
- `tsc` with Pyodide's files present.
- `next dev`'s `Cache-Control` on `public/` files.
- The development page's states and copy.
