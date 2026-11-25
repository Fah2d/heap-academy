**Base: `main`.** #3 and #4 are merged, and `main` is merged into this branch (f617391). This is a **draft** until the browser tests run: no browser can start in the sandbox that built it. `pyodide@314.0.7` is now installed, `pnpm build` passes, and the worker core has run against real Pyodide under Node. See "Owner actions now due".

## What and why

The Python worker of architecture section 5: learner code runs in a module worker, never on the page. The page owns the clock and replaces the worker to stop a run. The network is removed from the worker before any learner code runs.

1. **A build step** copies the pinned Pyodide files to `/_runtime/pyodide/<version>/` with a size manifest. It fails over NFR-PERF-04's 6.5 MB with Brotli, and compiles the worker.
2. **Schemas for every protocol message**, in both directions. Null is never valid (pitfall 2).
3. **The module worker.** It loads Pyodide, reports real download progress against the manifest, locks the network down, then says ready. Each run has section 5.5's isolation.
4. **The controller with the watchdog.** It enforces the 5 second limit from the page, and terminates and replaces the worker after a time limit, a Stop, a crash, a `fatal` message or a memory error.
5. **Output** sent as it is written, batched only in a flood, and the 64,000-character cap, which is reported.
6. **The network lock-down**, over the global scope and its whole prototype chain.
7. **The worker's own response policy**, and immutable caching for the runtime files.
8. **A development-only page** that drives the worker.

**Found while building it:** Turbopack builds every worker as a classic worker, and Pyodide 314 loads only in a module worker. So the worker is compiled by the TypeScript compiler, outside the bundler. **ADR-0033 is proposed for your decision.**

## Work package

- Work package: WP-3.1 The Python worker.
- Requirements and threats: FR-RUN-01, FR-RUN-02, FR-RUN-03, FR-RUN-06, FR-RUN-07, NFR-SEC-01, NFR-PERF-04, NFR-REL-03, NFR-COMPAT-04, NFR-COST-01; T-01, T-02.
- Commits: c792dd8..a06e244 for the code, 3d2bfe6 with this description and the first review reports, be2c7c0 the dependency (the owner's), then 7cf1ce6..2d94ead for the third review round and one commit with this update.
- Time box 3.5 hours. Time taken: about 1 hour of wall-clock time on 2026-11-17, from the branch (04:48) to the last fix (05:46), including four reviews; then about 40 minutes on 2026-11-20 (06:13 to about 06:55) for the dependency checks, the build, the Node run, the third review round and its fixes. The time box was not reached.

## What changed

| Item | Where |
|---|---|
| Protocol version 1: page to worker `init`, `run`, `input`, `input_end`; worker to page `progress`, `ready`, `output`, `input_request`, `run_done`, `fatal`. Each field is checked, unknown fields are refused, and there are size limits (program 100,000 characters, 1,000 input lines of 10,000 characters). A refusal returns a code, never the value. `check`, `test_result`, `check_done` and `init.harnessVersion` come with the harness in WP-3.3. | `src/runtime/protocol.ts` |
| Output: every decision to send is made inside a write, because a running program leaves the worker no turn for a timer. Up to 8 sends go out at once in each 50 ms window, so a program that prints a few lines and then computes shows them while it computes. In a flood, writes are held for the next window or the end of the run. Python's streams are line-buffered with write-through, so each printed line reaches the collector at once. The 64,000-character cap counts characters, not UTF-16 units, and never splits one. Past the cap a write fails, so the program stops at its next print. | `src/runtime/output.ts`, `run-support.ts` |
| Lock-down: `fetch`, `XMLHttpRequest`, `WebSocket`, `WebSocketStream`, `EventSource`, `WebTransport`, `Worker`, `SharedWorker`, `importScripts`, `BroadcastChannel`, `caches`, `indexedDB` and `postMessage` are deleted from every object on the global's prototype chain, as are `navigator.sendBeacon`, `navigator.serviceWorker`, `navigator.storage` and `navigator.locks`. The last three are shared with every page of the origin. The worker keeps a bound `postMessage` of its own. If any name can still be reached, the worker refuses to become ready. | `src/runtime/lockdown.ts` |
| Worker core: load, progress, version check against the manifest, lock-down, `ready`. A run gets batch input line by line, output to the collector, and an outcome. The worker gives up (`fatal`) on a malformed or unexpected message, and when the runtime itself throws. | `src/runtime/worker/core.ts`, `python-worker.ts` |
| Run support (section 5.5): a fresh `__main__` namespace per run. The builtins, `sys.modules`, `sys.stdin`, `sys.stdout` and `sys.stderr` are restored by Python that holds every reference it needs and looks up no builtin by name (pitfall 3).<br>Learner code can still run after its program ends, in a `__str__` while its error is formatted or a `__del__` when its objects are freed. So the state is restored after the program, again after a garbage-collection pass, and before each run.<br>The report is built without `json`, which a program can replace. The summary is cut to 1,000 characters. The source is registered with `linecache`, and the traceback shows only the learner's frames. Outcomes: `syntax`, `runtime`, `input_ended`, `memory`; `exit(0)` counts as ok. | `src/runtime/worker/run-support.ts` |
| Controller: `start`, `run`, `stop`, `dispose`. The time limit is enforced from the page. A new worker starts after `time_limit`, `stopped`, `crashed` (an `error` event or a `fatal` message, while running or idle), `memory` and `output_limit`; after the cap, text left in Python's buffers could otherwise reach the next run. A run that reached the cap and then ran into the time limit is still reported as cut. Late messages from a terminated worker are ignored. Malformed messages, and messages for another run, are dropped and reported. A run the worker would refuse is refused before sending. | `src/runtime/controller.ts` |
| Build: `scripts/build-runtime.mjs` runs first in `pnpm build` and `pnpm dev`. It copies `pyodide.mjs`, `pyodide.asm.mjs`, `pyodide.asm.wasm`, `python_stdlib.zip` and `pyodide-lock.json`, and refuses any version but `RUNTIME_VERSION` (314.0.7). It writes `manifest.json` with raw, gzip and Brotli sizes, fails over 6,500,000 Brotli bytes, and compiles the worker with `tsc -p tsconfig.worker.json`.<br>Each folder is built in `node_modules/.cache/heap-runtime` and moved into place with two renames, so the two test servers building at once never serve half of one, and nothing half-built is ever under `public/`. It refuses an output folder that is not strictly inside `public/`, because the output is deleted first. Both folders are ignored by Git, ESLint and the type check. | `scripts/build-runtime.mjs`, `tsconfig.worker.json`, `package.json`, `.gitignore`, `eslint.config.mjs`, `tsconfig.json` |
| Headers. The proxy skips `/_runtime/`, so the page policy cannot replace the worker's. The rules, in order:<br>1. Every response under `/_runtime/` gets `default-src 'none'; frame-ancestors 'none'; sandbox`, so a miss there is not a page without a policy (T-15).<br>2. `/_runtime/pyodide/` gets `public, max-age=31536000, immutable`.<br>3. `/_runtime/worker/` gets `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; frame-ancestors 'none'; report-uri /api/csp-report` and `Cache-Control: no-cache`. It comes last, because Next.js uses the later rule when two set the same header ("the last header key will override the first", headers documentation, read 2026-11-17).<br>The page policy is unchanged: no `'wasm-unsafe-eval'`. `pnpm infra:verify` now checks the worker's policy and revalidation, the immutable runtime files, and a miss. | `src/infrastructure/http/security-headers.ts`, `next.config.ts`, `src/proxy.ts`, `scripts/infra-verify.mjs` |
| One base path: `RUNTIME_ASSET_BASE_URL` in `src/runtime/assets.ts`, with the worker URL and the pinned version. The worker policy adds the runtime's host if the base becomes an `https://` URL. | `src/runtime/assets.ts` |
| Development-only page `/dev/runtime`. It has a program, an input field, Run, Stop, a status line, the output, the outcome, and counts of restarts and dropped messages. Copy is in `src/messages/runtime-dev.ts`. | `src/app/dev/runtime/page.dev.tsx`, `src/features/workspace/` |
| Browser tests for the "Done when" lines: 15 tests in each of three projects, `runtime-chromium`, `runtime-firefox` and `runtime-webkit`, against the development server on port 3101. Also 4 header tests on the production server, in the existing `chromium`, `firefox` and `webkit` projects. | `e2e/runtime.spec.ts`, `e2e/runtime-headers.spec.ts`, `playwright.config.ts` |
| ADR-0033, proposed, with the probe that found the classic-worker behavior. | `docs/adr/0033-python-worker-compiled-outside-the-bundler.md` |

## Up to date with main

`main` at 037c4ad (#3 and #4) is merged in f617391. Four files conflicted:

- `next.config.ts`: `main`'s function form (`agentRules`, the `.dev.tsx` page extensions, the poll option), with this branch's `runtimeHeaders` added to `headers()`.
- `playwright.config.ts`: one development server on port 3101, as the deviation below asks. It keeps `main`'s `environment` and this branch's 180 s start budget, and waits for `/dev/runtime`. The three engine projects ignore both the gallery and the runtime tests; the `gallery` project and the `runtime-*` projects run against port 3101.
- `package.json`: `main`'s dependencies plus `pyodide`.
- `pnpm-lock.yaml`: `main`'s lockfile plus this branch's pyodide entries (`pyodide`, `@types/emscripten`, `ws`), the same added lines as before. `pnpm install --frozen-lockfile` accepts it.

`pnpm verify` on f617391, exit 0:

```
$ prettier --check .
All matched files use Prettier code style!
$ eslint --max-warnings=0 .
$ tsc --noEmit
$ node scripts/check-attribution.mjs --branch && node scripts/check-attribution.mjs --files
$ vitest run --coverage
 Test Files  32 passed (32)
      Tests  788 passed (788)
```

Not run on the merge: `pnpm build` and the browser tests.

## How it was verified

`pnpm verify` at 2d94ead:

```
$ pnpm format:check && pnpm lint && pnpm typecheck && pnpm attribution && pnpm test
$ prettier --check .
All matched files use Prettier code style!
$ eslint --max-warnings=0 .
$ tsc --noEmit
$ node scripts/check-attribution.mjs --branch && node scripts/check-attribution.mjs --files
$ vitest run --coverage
 Test Files  27 passed (27)
      Tests  639 passed (639)
   Duration  4.27s (tests 89%, import 8%, worker 2%, transform 1%)
```

**Tests added**, each title carrying its requirement or threat:

- `src/runtime/protocol.test.ts`:
  - every message in both directions accepted;
  - 23 refusals: null, arrays, class instances, unknown type, extra field, missing or undefined field, a null field, bad mode, bad run ID, program over the limit, too many input lines, a newline in a line, a page-side outcome from the worker, line 0, negative or fractional numbers, output or an error summary over its limit, unknown stream, unknown fatal reason, an extra capability, and asset bases that are not a path or an https URL.
  - Accepted at the limit, in the worker's units: 64,000 characters outside the basic plane, and the longest error summary.
- `src/runtime/output.test.ts`:
  - a write sent at once, while the program then computes for 2 s;
  - a few quick lines each sent at once;
  - past the burst, writes held until the next 50 ms window;
  - stream order;
  - the cap and its refusal;
  - characters outside the basic plane;
  - a 100,000-print flood that stays at 64,000 characters, in at most 9 sends.
- `src/runtime/lockdown.test.ts`:
  - removal from the scope and its prototype chain, and from the navigator;
  - what stays;
  - a name that cannot be removed is reported;
  - a copy of Node's real global chain.
- `src/runtime/worker/run-support.test.ts`, run in **CPython 3.9.6** on this machine:
  - `__main__`;
  - a syntax error with its line;
  - a runtime error with its line and source text and no run-support frames;
  - a fresh namespace per run;
  - builtins deleted or replaced, then restored;
  - streams and the module table restored;
  - `input()` past the end gives `input_ended`;
  - `bytearray(1 << 62)` gives `memory`, and the next run works;
  - `exit(0)` and `exit(3)`;
  - review fixes, each confirmed to fail before its fix by the reviewer's probe or by the old code:
    - a `__del__` that breaks `abs` or `len` after the program;
    - an error whose `__str__` breaks `print`;
    - `del builtins.BaseException`;
    - a program that replaces `json.dumps` and `json._default_encoder`;
    - a 100,000-character error summary cut to 1,000;
    - a `SyntaxError` with a non-integer line;
    - a printed line that reaches a real buffered stream before the program ends.
- `src/runtime/worker/core.test.ts`, with a fake runtime:
  - the load order (manifest, loader, counting stopped, lock-down, ready) and progress from 0 to the total;
  - a failed lock-down, a wrong version and a bad manifest each give up;
  - a malformed message, and a run before ready, each give up;
  - output and the outcome;
  - batch input line by line, then end of input;
  - a flood stopped after 64 writes;
  - memory;
  - a runtime that throws;
  - an interactive run refused;
  - a character split across two writes;
  - two runs in a row on one worker;
  - an error summary cut to what the page accepts.
- `src/runtime/controller.test.ts`, with a fake worker and clock:
  - start and ready;
  - a run refused before ready;
  - a run with its output and result;
  - the time limit at exactly 5,000 ms, and the next worker runs;
  - Stop;
  - a crash during a run and while idle;
  - memory, and the output cap, each start a new worker;
  - the cap reached and then the time limit, reported as cut; a run under the cap is not;
  - a new worker that dies before it is ready fails, without starting another;
  - a `messageerror` reported as its own code;
  - a failed start, and starting again;
  - malformed and foreign messages dropped and reported;
  - a terminated worker's late messages;
  - an oversized run refused before sending;
  - `dispose`.
- `src/runtime/manifest.test.ts`, `scripts/build-runtime.test.ts`:
  - the copy and the manifest;
  - the wrong version;
  - a missing package or file;
  - over the budget;
  - a rebuild leaves only this release, and a failed build keeps the previous output, with no half-built folder;
  - an output folder outside the repository is refused;
  - the worker compiles to ES modules whose static imports are all relative `.js` files;
  - the output folder is ignored by Git.
- `src/infrastructure/http/security-headers.test.ts`, `src/proxy.test.ts`:
  - the worker policy and the runtime headers;
  - the static policy for a miss under `/_runtime/`, and the worker's rule last;
  - the matcher skips `/_runtime/` and still runs for pages.
- `scripts/infra-verify.test.ts`: a deployment whose worker has the page policy, whose worker is cached, whose runtime files are not immutable, or whose miss under `/_runtime/` has no policy, each fails.
- `src/features/workspace/client/runtime-view.test.ts`: the development page's view.

**Dependency.** After be2c7c0:

```
$ pnpm why ws
ws@8.23.0
└─┬ pyodide@314.0.7
  └── heap-academy@0.0.0 (dependencies)

Found 1 version of ws
$ pnpm audit --prod
No known vulnerabilities found
```

8.23.0 is past the CVE-2024-37890 fix in 8.17.1. Security review 3 checked the lockfile's sha512 for `pyodide`, `ws` and `@types/emscripten` against the registry, and found no install scripts.

**Build.** `node scripts/build-runtime.mjs`:

```
runtime: pyodide 314.0.7, 13531207 bytes, 5464072 with Brotli (budget 6500000)
  pyodide.mjs: 17931 bytes, gzip 7152, Brotli 6453
  pyodide.asm.mjs: 1250344 bytes, gzip 259957, Brotli 207390
  pyodide.asm.wasm: 9598218 bytes, gzip 3528803, Brotli 2741061
  python_stdlib.zip: 2545637 bytes, gzip 2503129, Brotli 2487479
  pyodide-lock.json: 119077 bytes, gzip 26335, Brotli 21689
runtime: worker compiled
```

`pnpm build` with the `.env.example` values, as CI sets them: exit 0, routes `/_not-found`, `/api/csp-report`, `/api/health`. `node scripts/check-bundle.mjs .next/static`: "No server variable (RESEND_API_KEY, HEAP_RELEASE) in 9 files under .next/static." The development page has no route on this branch; it routes once #3's development-only page mechanism is merged.

**Real Pyodide under Node.** The compiled worker core (`public/_runtime/worker/worker/core.js`) driven with Pyodide 314.0.7 under Node 26.13.1, through a fake host: files read from disk, and a lock-down that does nothing. This is not the browser: no lock-down, no worker policy, no page. Load to `ready`: 592 to 744 ms. Each line is the program, the `output` messages, and the outcome:

| Program | Output | Outcome |
|---|---|---|
| `name = input()` then `print("Hello,", name)`, input `Ada` | `Hello, Ada` | `ok` |
| two `input()` calls, one input line | `a`, then the traceback on stderr | `input_ended`, line 2 |
| `1/0` | traceback on stderr | `runtime`, `ZeroDivisionError: division by zero`, line 1 |
| `def f(:` | syntax error on stderr | `syntax`, `SyntaxError: invalid syntax`, line 1 |
| `del builtins.print`, `len = None`, `abs = 1`, then the next run `print(len("abc"), abs(-2))` | `3 2` | `ok` both |
| an error whose `__str__` deletes `print`, then `print("ok after E")` | `ok after E` | `runtime` `E: boom` line 4, then `ok` |
| `exit(False)`; `exit(3)` | none | `ok`; `runtime` `SystemExit: 3` |
| `write("a")`, `write("b\n")`, `print("c", end="")` | two sends: `ab\n`, then `c` at the end | `ok` |
| three emoji | `😀😀😀` | `ok` |
| `print("one")`, `print("two")`, 0.3 s busy loop, `print("three")` | three sends, the first two before the loop ended | `ok` |
| `[bytearray(1 << 28) for _ in range(20)]`, then `print("after list")` | `after list` | `memory`, then `ok` |
| `bytearray(1 << 31)` | traceback | `runtime`, `OverflowError: cannot fit 'int' into an index-sized integer` |
| `print("x" * 70000)` | 64,000 characters in one send | `output_limit`, truncated |
| `while True: print("flood")` | 9 sends | `output_limit`, truncated |

On a 32-bit WebAssembly build, a single allocation of 2 GiB or more is an `OverflowError`, not a `MemoryError`. The browser test's memory bomb grows a list, which gives `memory`. A second run on the same worker after the cap printed 64,000 leftover characters, which is why the controller replaces the worker after `output_limit`; both reviewers confirmed it always does.

**The classic-worker probe** is in ADR-0033's Evidence section.

**Not verified:**

- **No browser test has run.** No browser can start in this sandbox. Real Pyodide has run only under Node (above).
  - Not run, owner to run: `e2e/runtime.spec.ts`, 15 tests in each of `runtime-chromium`, `runtime-firefox` and `runtime-webkit`; and `e2e/runtime-headers.spec.ts`, 4 tests in each of `chromium`, `firefox` and `webkit`.
  - On this branch alone they cannot run: `/dev/runtime` is a page only once #3's `pageExtensions` setting is merged.
  - They cover every line of "Done when", with the limits below.
- **The page policy without `'wasm-unsafe-eval'`** is checked on the production server's headers (`runtime-headers.spec.ts`), but the runtime itself loads only on the development server, whose page policy has `'unsafe-eval'`. What the browser tests do prove: evaluation inside the worker is refused and the violation names the worker's policy, so the worker does not run under the page's policy in any engine that passes. A production run of the runtime needs the development page in a test build, a decision for you with #3's mechanism.
- **"A second visit loads the runtime from cache"** (FR-RUN-07) is checked as `transferSize` 0 for `pyodide.asm.wasm` after a reload, read from the worker's own resource timing. Not run. WebKit's support for `transferSize` in workers is not verified.
- **Main-thread long tasks under 50 ms** (FR-RUN-01) are measured as the longest gap between animation frames over 2 seconds of a busy loop, in all three engines. Chromium's Long Tasks API is not used.
- **Pyodide API details, now seen under Node, not in a browser:** `setStdin`'s `stdin()` gives one line per call; an error thrown in a `write` handler surfaces in Python and stops the program at its next print; the runner `runPython` returns is a JavaScript function; `pyodide.version` is `"314.0.7"`; the line-buffered streams pass each line on as it is printed. Each is also exercised by a browser test.
- **Whether deleting `postMessage` from the worker's scope breaks anything inside Pyodide.** The browser tests would show it.
- **The `.mjs` and `.wasm` media types** from the production server are checked by `runtime-headers.spec.ts` (not run), and from Vercel by no check yet. Module scripts need a JavaScript type under `nosniff`, and `instantiateStreaming` needs `application/wasm`.
- **Whether Playwright reports a dedicated worker's requests** in every engine. The loader test has a control for it (the manifest request must appear). It checks the request log, that neither loader resolved with anything loaded, and that `importlib.util.find_spec("micropip")` is `None`. The lock-down test requires `open_url` to fail with `NameError` (what Pyodide 314.0.7 raises without `XMLHttpRequest`, seen under Node) and `/api/health` to stay out of the request log.
- **Whether `securitypolicyviolation` fires on a worker's global** in Firefox and WebKit. If one does not, that test fails there, and the engine should be recorded.
- **Line-buffered Python streams in a browser.** Tested in CPython, and seen in Pyodide under Node (above); in a browser the streaming test shows it.

## Screens

None. The only page is development-only and plain on purpose; the workspace's interface is WP-5.2's. antislop Delivery Gate: not applicable. No learner-facing screen or copy changes. The development page's words are in `src/messages/runtime-dev.ts`.

## Reviews

Four reviews, each by a reviewer with a fresh context. The reports are in `docs/reports/reviews/WP-3.1/`.

- **code-reviewer, round 1** (`code-review-1.md`, at f4d093b): CHANGES REQUIRED, 3 BLOCKER, 6 MAJOR. Every BLOCKER and every MAJOR but two is fixed in 5850337..17facd4:
  - output did not stream;
  - learner code ran after the restore;
  - the page refused valid messages;
  - `BaseException` was looked up by name;
  - the worker was reused after the output cap;
  - the generated files were linted and type-checked;
  - several tests would not have caught likely bugs.
  The two not fixed: the runtime e2e runs on the development server, and the base path is a constant. Both are under Deviations.
- **security-reviewer, round 1** (`security-review-1.md`, at f4d093b): CHANGES REQUIRED, 3 MAJOR, 4 MINOR. Fixed:
  - a policy for every response under `/_runtime/`;
  - the lock-down and the worker policy proven from inside the worker;
  - header checks on the production server and in `infra:verify`;
  - the error summary cut;
  - the report built without `json`;
  - IndexedDB, storage and locks removed;
  - `--out` restricted.
  Validate isolation is deferred (see "Not fixed").
- **security-reviewer, round 2** (`security-review-2.md`, at 17facd4): **APPROVE** after the merge gate (the dependency and both e2e files run, and ADR-0033 accepted), 7 MINOR.
  - Fixed in 24bceee..cd42ab1: the report's escaping no longer depends on `json`'s module state; the error's real class decides the outcome; odd error attributes no longer stop the worker; `navigator.storageBuckets` is removed; the loader test has a control; the build is staged outside `public/`.
  - Not fixed:
    - MINOR 3, a miss under `/_runtime/worker/` gets the worker policy, not the static one. Defence in depth only.
    - MINOR 7, the proxy matcher's exclusions are prefixes (`/favicon.icoX`, `/_next/imageX`). This is from WP-1.3, so it belongs to #4; listed under "Not fixed".
- **code-reviewer, round 2** (`code-review-2.md`, at 17facd4): CHANGES REQUIRED, 1 BLOCKER, 2 MAJOR, 6 MINOR. Fixed in ce59773..a06e244, with the round-2 security fixes above:
  - a run of exactly 64,000 characters was reported as cut;
  - error attributes the program controls could stop the worker;
  - the garbage-collection pass had no test;
  - `exit(False)` was reported as an error;
  - a silent fallback when the streams cannot stream;
  - `--out` could name a source folder;
  - the `pyodide.http` test tested the wrong thing.
  MAJOR 1 (the burst departs from section 5.2) is recorded under Deviations as a proposed spec change.
- **code-reviewer, round 3** (`code-review-3.md`, at be2c7c0): CHANGES REQUIRED, 1 MAJOR, 6 MINOR. Fixed in 7cf1ce6..2d94ead, each new test checked to fail without its fix where the fix is code:
  - MAJOR 1: the `micropip` check could never fail. It now asks `importlib.util.find_spec`, and notes what each loader resolved with.
  - MINOR 2: the `+ 1` line allowance is tested with a raised `SyntaxError` (line 4 of 3 kept, line 5 dropped).
  - MINOR 3: the refused source path no longer exists, so a broken guard would delete nothing.
  - MINOR 4: `replaceFolder` is exported and tested to build in the staging folder while the served folder stays empty; `storageBuckets` has a literal assertion.
  - MINOR 5: a `MemoryError` whose attributes raise is still `memory`, so the worker is replaced.
  - MINOR 6: this description is brought up to date.
  - MINOR 1 is recorded under Deviations: a program that prints exactly 64,000 characters and then reaches the time limit, or is stopped, is reported as cut.
- **security-reviewer, round 3** (`security-review-3.md`, at be2c7c0): CHANGES REQUIRED, 1 MAJOR (this description), 3 MINOR. The dependency checks out. Fixed:
  - MAJOR 1: this description said the report could no longer be forged. It can: a program can reach the runner's closure through `sys._getframe` and `gc`, and rewrite it, so every later run on that worker reports what the program chose. Corrected under "Not fixed".
  - MINOR 1: the same as code review 3, MAJOR 1.
  - MINOR 2: the lock-down test requires `NameError` from `open_url` and no `/api/health` request.
  - MINOR 3: this description is brought up to date.
- **No reviewer has seen the round-3 fixes** (7cf1ce6..2d94ead). They are tests, one three-line classification change, and one exported function.
- design-reviewer: not required. The only page is development-only, with no learner-facing screen or copy.

Open MAJOR findings for you to waive:
- Code review 1: the runtime e2e runs on the development server only. The worker's policy is proven from inside the worker; the page policy without `'wasm-unsafe-eval'` is not, until a production page loads the runtime.
- Code review 1: the base path is a constant (a proposed spec change).
- Code review 2, MAJOR 1: the burst departs from section 5.2 (a proposed spec change).

## Try it

On the development server, once #3's development-only page mechanism is merged:

1. Open `/dev/runtime`. The status goes from "Starting Python" to "Ready".
2. Run the sample with `Ada` in the input. The output is `Hello, Ada`.
3. Run `while True: pass`. After 5 seconds the outcome is "Time limit reached", the restarts count is 1, and Run works again.

## Owner actions now due

1. Done: the dependency (be2c7c0), `pnpm why ws`, `pnpm audit --prod`, and the size lines (above).
2. After #3 and #4 are merged, run the browser tests and paste the output:

   ```sh
   pnpm test:e2e --project=runtime-chromium --project=runtime-firefox --project=runtime-webkit
   pnpm test:e2e e2e/runtime-headers.spec.ts --project=chromium --project=firefox --project=webkit
   ```

3. Decide ADR-0033.
4. Decide the deviations below.

## Deviations from the plan or the spec

- **The worker is not bundled** (ADR-0033, proposed). Its protocol parser is hand-written, because the worker cannot import a package. The page uses the same parser.
- **The base path is a constant**, `RUNTIME_ASSET_BASE_URL` in `src/runtime/assets.ts`, not an environment variable. `07-operations.md` section 9 says moving the files needs "no code change". Here it needs that one line, and the worker policy follows it.
  - An environment variable would have to carry the `NEXT_PUBLIC_` prefix: the browser reads it, and `.env.example`'s rule makes any other name a server secret, which `scripts/check-bundle.mjs` would then flag in the bundle.
  - **Proposed spec change, pending owner decision:** section 5.1 names the value `RUNTIME_ASSET_BASE_URL` "in `src/runtime/assets.ts`", and 07 section 9 says "one line".
- **Every run gets section 5.5's isolation**, not only each test case of a Check (WP-3.3). `.claude/rules/runtimes.md` says "Isolation per run is exactly section 5.5".
- **Output is sent at once up to 8 times in each 50 ms window, then batched.** Section 5.2 says "Batched at most every 50 ms".
  - Inside a running program the worker has no turn for a timer. Under that rule, the second of two quick lines would wait until the program printed again or ended, so "output streams while the program runs" would fail for a program that prints and then computes.
  - The 8 is a choice, not a measurement. It bounds a slow flood at 160 messages a second, and a fast flood sends 8 messages and then one batch per window.
  - **Proposed spec change, pending owner decision:** in section 5.2, "Sent at once up to 8 times per 50 ms window, then batched until the next window or the end of the run".
  - Python's streams are line-buffered, so a partial line (`print("working", end="")`) waits for its newline or the end of the run.
- **A memory error, and the output cap, also start a new worker.** The program's outcome is still `memory` or `output_limit`. A worker whose WebAssembly memory grew cannot give it back. After the cap, Python's stream buffers may still hold the program's text, which the next run would print. A new worker is ready in about 1.7 s (E-04).
- **The worker gives up on a malformed message, and ignores `input` and `input_end`, without reporting either.** Section 5.2 says "dropped and reported". The page parses every message before it sends it, so a malformed one means the page is broken, and the worker cannot trust what follows. `input` and `input_end` belong to WP-3.2. **Proposed spec change, pending owner decision:** in section 5.2, "the page drops and reports; the worker ends itself with `fatal malformed_message`".
- **`postMessage` is removed from the worker's scope**, beyond T-01's list, so a program cannot post messages the page would read as the worker's. The page parses them anyway; this closes forged `run_done` messages before WP-3.3's results depend on them.
- **The development page waits for #3.** It uses #3's root layout and `.dev.tsx` page mechanism rather than copying them, which would conflict with #3. Its `page.dev.tsx` default-export exemption is the same line #3 adds to `eslint.config.mjs`.
- **Test budgets.** `e2e/runtime.spec.ts` sets a 120 s budget for its own tests, not the default 30 s. Loading Pyodide takes seconds, and several tests wait for the 5 s limit and then a new worker. `scripts/build-runtime.test.ts` gives its worker compile test 60 s, because it runs `tsc`. Both are new tests; no existing limit was raised.
- **Exactly 64,000 characters, then the time limit or Stop, is reported as cut** (code review 3, MINOR 1). The page cannot tell this from a program that reached the cap and caught the write error, because the worker never sends more than 64,000 characters. A run the worker ends itself is reported correctly. Telling the two apart needs a protocol field on the output message that carries the cut; proposed for a later package.
- **`playwright.config.ts` adds a development server** on port 3101 and the `runtime-*` projects. #3 adds a development server on the same port for its gallery. When the branches meet, keep one `webServer` entry for port 3101.

## Not fixed, for later packages or for you

- **Validate isolation** (security review 1, MINOR 2; security review 3, MAJOR 1). A callback set from Python with `js.setTimeout` runs after the run. Modules other than the module table, such as `json`'s attributes, keep a program's changes, as ADR-0004 accepts for learners. **The report can be forged by the running program**: it can reach the runner's closure through `sys._getframe` and `gc.get_referrers` and rewrite it, and the change lasts for every later run on that worker until the worker is replaced. For a learner that only touches their own results, which section 6 accepts. For Validate (T-22, T-23), code in an imported lesson could fake the results of every lesson validated after it on the same worker. The only fix that holds is **a fresh worker for each Validate case**: WP-3.3's check protocol, used by WP-4.3.
- **No time limit on loading.** A stalled download leaves the status at "Starting Python". The workspace's statechart (WP-3.4) owns the loading states and their recovery.
- **A miss under `/_runtime/pyodide/`** gets `immutable` too, so a cache in between could keep a 404 for a year. A deployment's pages only ever ask for their own release's files, so this needs a request for a file the release does not have.
- **The runtime base path is a constant** (see Deviations).
- **A miss under `/_runtime/worker/`** gets the worker policy, which has no `sandbox`, instead of the static one (security review 2, MINOR 3). No way to put content there is known. The fix is a worker rule that matches only the compiled `.js` files, once Next.js's path syntax for that is confirmed.
- **The proxy matcher's exclusions are prefixes** (security review 2, MINOR 7, from WP-1.3). `/favicon.icoX` and `/_next/imageX` skip the proxy, so their not-found page has no policy. Anchor the exclusions in #4 or a follow-up.

## Risks and rollback

- **The browser tests have not run.** That is why this is a draft.
- The runtime is loaded only by the development page. No learner page uses it yet, so a revert of the merge rolls everything back.
- The lock-down is hardening, not a boundary (section 5.6). The worker policy is the second layer, and the residual risks are in `06-security-privacy.md` section 6.

## Definition of Done

- [ ] Every "Done when" line is met, with evidence above. **Not met:** no browser run. Real Pyodide ran under Node only.
- [x] Every cited Must requirement has a test that names its ID. The browser tests have not run.
- [x] `pnpm verify` passes, and `pnpm build` passes.
- [x] Every state of every changed view exists. The development page shows every controller status and outcome.
- [x] No stub, dead control, placeholder, commented-out code, or invented number.
- [x] No new tables. No new server actions.
- [x] Every reviewer blocker is fixed. See Reviews. The round-3 fixes (7cf1ce6..2d94ead) have not had their own review round.
- [x] No AI attribution in any commit or in this description.

## Opening this pull request

`gh` cannot reach GitHub from the sandbox. From your terminal in the repository root:

```sh
gh pr create --draft --base main --head wp/3.1-python-worker \
  --title "feat(runtime): WP-3.1 the Python worker" \
  --body-file docs/reports/pull-requests/WP-3.1.md
```
