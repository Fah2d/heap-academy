# ADR-0033: The Python worker is compiled by the TypeScript compiler, outside the bundler

- Status: Accepted (owner, on pull request #9 for WP-3.1, 2026-11-24)
- Decision due: WP-3.1
- Date proposed: 2026-11-17
- Decider: the owner
- Relates to: FR-RUN-01, FR-RUN-07, NFR-SEC-01, T-01; ADR-0003, ADR-0004; E-03

## Context

Pyodide 314 loads only in a module worker (E-03; its changelog for 314.0.0: "Classic (non-module) workers: No longer supported"). The usual way to ship a worker with Next.js is `new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })`, which Turbopack bundles.

A production build of that pattern with Next.js 16.4.6 was inspected on 2026-11-17. It shows that Turbopack does not produce a module worker:

- It emits a bootstrap file (`static/chunks/turbopack-worker-<hash>.js`) that loads the worker's chunks with `importScripts`, and `importScripts` exists only in classic workers.
- Its worker factory constructs the worker as `new t(u, n ? { ...n, type: void 0 } : void 0)`, so `type: "module"` is removed.

The worker also needs its own response policy (`06-security-privacy.md` section 5.1), at a path that can be given that header. Turbopack's worker files live among every other chunk under `/_next/static/`.

## Decision

- **The worker** is `src/runtime/worker/python-worker.ts` and the modules it imports. They are compiled by `tsc -p tsconfig.worker.json`, file for file, to `public/_runtime/worker/`.
  - Relative imports are written with `.ts`, and `rewriteRelativeImportExtensions` turns them into `.js`.
  - The `webworker` library is the only DOM typing in that build, so the worker cannot use a page-only API.
- **The worker imports nothing from `node_modules`.** A module worker has no import maps, so a bare package name cannot be resolved without a bundler.
  - The protocol parser in `src/runtime/protocol.ts` is therefore written without a schema library.
  - The page imports the same parser, so both sides share one definition.
- **`scripts/build-runtime.mjs`** compiles the worker and copies the Pyodide files. `pnpm build` and `pnpm dev` run it first.
- **The page starts the worker** with `new Worker("/_runtime/worker/worker/python-worker.js", { type: "module" })`. The plain string keeps the bundler away from it.
- **`next.config.ts` gives `/_runtime/worker/`** its own policy: `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'`. It also sets `Cache-Control: no-cache`, because the path does not change between releases. `proxy.ts` skips `/_runtime/`, so the page policy does not replace the worker's.

## Consequences

- Gain: Pyodide runs in the module worker it requires.
- Gain: the worker's policy is set on its own path, separate from the page's.
- Gain: the worker's code is small, readable files, with nothing a bundler added.
- Cost: the protocol parser is hand-written, not built with the project's schema library. Its tests cover each message and each refusal.
- Cost: a change to the worker needs `pnpm dev` restarted, or `node scripts/build-runtime.mjs` run. Turbopack does not watch these files.
- Cost: one more TypeScript configuration to keep in step with `tsconfig.json`. It extends that file and changes only what emitting needs.

## Alternatives considered

- **Turbopack's worker support.** It produces a classic worker, as described above.
- **A separate bundler (esbuild or Rollup) for the worker.** It would allow the schema library in the worker. But it is another build tool and another dependency, and it was not installable from this session. This option stays open if the hand-written parser grows hard to keep.
- **A classic worker that loads Pyodide with a dynamic `import()`.** Pyodide 314 states that classic workers are not supported, so this would run against its documentation.

## Evidence

- Probe build, 2026-11-17, Next.js 16.4.6 with Turbopack. A client component ran `new Worker(new URL("./probe.worker.ts", import.meta.url), { type: "module" })`. In the output:
  - `.next/static/chunks/turbopack-worker-1hrsqshz0gfey.js` ends in `importScripts.apply(self,l)`.
  - The factory in the page chunk constructs the worker with `{...n,type:void 0}`.
  - The probe files were removed after the build.
- Pyodide changelog, 314.0.0: classic workers are no longer supported (read 2026-11-17).
- `scripts/build-runtime.test.ts`: the compiled worker's static imports are all relative `.js` files.
