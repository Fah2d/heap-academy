# ADR-0001: Monorepo with pnpm workspaces and Turborepo

- Status: Superseded by ADR-0023
- Decision due: not applicable.
- Date proposed: 2026-11-13
- Decider: the owner
- Relates to: NFR-MAINT-05

## Context

The system has parts with different runtimes and consumers: a web app, a Python harness that must run in CI and in browsers, a browser runtime layer, a content toolchain with a command line, and a design system. They share schemas. Most of the code will be written by an agent, and boundaries kept only by convention erode fastest under automated authorship.

## Decision

One private repository using pnpm workspaces, with Turborepo for task orchestration and caching. Six packages and one app, as laid out in `02-architecture.md` section 4. The app consumes packages as TypeScript source; nothing is published. Dependency rules between packages and layers are checked in CI and fail the build.

## Consequences

- Gain: A change that crosses packages is one pull request.
- Gain: Each package is testable alone.
- Gain: Boundaries are physical and enforced, not conventional.
- Cost: More configuration than a single package.
- Cost: Bundler-specific entry points (workers, asset URLs) must stay in the app.
- Cost: CI needs path filtering to stay fast.

## Alternatives considered

- **One package with folders.** Boundaries would rest on convention.
- **Several repositories.** Coordination cost with one owner; no atomic changes.

## Evidence

None needed beyond WP-1.1.

## Revisit when

Tooling friction outweighs the benefit at Gate 1.
