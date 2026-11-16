# ADR-0032: Module table additions and a test-only grader runner

- Status: Accepted (owner, on pull request #2 for WP-1.2, 2026-11-16)
- Decision due: WP-1.2
- Date proposed: 2026-11-16
- Decider: the owner
- Relates to: NFR-MAINT-05, NFR-I18N-01, FR-GRD-04; ADR-0023, ADR-0026

## Context

The lint rule for module boundaries (NFR-MAINT-05) needs a complete table of which module may import which. The graph in `02-architecture.md` section 4.1 leaves out some edges. It has no edge to `messages`, although every user-facing string lives there (NFR-I18N-01). It has no edge for the root layout's global stylesheet in `ui`. And it says nothing about files directly in `src/`, such as `instrumentation.ts`. Separately, `04-content-system.md` section 3.2 puts a Node worker-thread runner in `src/grader`. But section 4.1 says `grader` imports nothing else from the project and performs no I/O, and a runner that starts worker threads and loads Pyodide from disk does I/O.

## Decision

- **The module table** in `scripts/eslint/module-boundaries.mjs` (`ALLOWED`) is the source of truth, and section 4.1 matches it:
  - `app` may import `features` and `messages`. It may import from `ui` only stylesheets (`.css`).
  - `features` may import `features` (through `index.ts`), `runtime`, `content`, `ui`, `infrastructure`, `domain`, `grader`, and `messages`.
  - A file directly in `src/` (the `root` area) may import `features`, `infrastructure`, and `messages`.
  - `messages`, like `domain`, `grader`, and `ui`, imports nothing else from the project.
  - The other edges are as section 4.1 drew them.
- **The Node runner** of section 3.2 lives in `src/grader/node-runner/`.
  - It is a test tool, exempt from the purity rule, and only tests and scripts import it.
  - The lint rule enforces this: nothing outside `src/grader/node-runner/`, tests, and `scripts/` may import it, and the rest of `src/grader` stays pure.
  - The folder, the exemption, and that lint rule are built in WP-3.3, the package that builds the runner. Until then the folder does not exist and `src/grader` has no exemption.

## Consequences

- Gain: the lint table and the specification say the same thing, so a lint failure points at a real rule.
- Gain: `src/grader` keeps one pure core that the browser and the Node runner share, and the runner's I/O is visible in one folder.
- Cost: a component can import `messages` directly. String keys become an import, not a lookup through a feature.
- Cost: the purity rule gets one named exception, which a reviewer must keep from growing.

## Alternatives considered

- **Leave section 4.1 as drawn and route strings through features.** Every page and the root layout would need a feature module only to pass strings through. That adds code with no rule behind it.
- **Put the Node runner in `scripts/`.** It would sit apart from the harness and result types it tests against. It would also lose the `@/` path aliases and the TypeScript checks of `src`.
- **Make all of `src/grader` exempt from purity.** That gives up the guarantee the grader's own tests and the browser path rely on.

## Evidence

None needed. The table is `scripts/eslint/module-boundaries.mjs` at pull request #2, and its tests are in `scripts/eslint/rules.test.ts`.

## Revisit when

A second module needs an exception to the purity rule, or WP-3.3 finds that the runner cannot share the pure grader core without importing outside `src/grader`.
