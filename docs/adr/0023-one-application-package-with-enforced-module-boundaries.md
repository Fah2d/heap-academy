# ADR-0023: One application package with enforced module boundaries

- Status: Proposed
- Decision due: Day 1 (WP-1.1).
- Date proposed: 2026-11-15
- Decider: the owner
- Relates to: NFR-MAINT-05; supersedes ADR-0001

## Context

ADR-0001 chose a monorepo of six packages and an app. That gives hard boundaries, and costs workspace wiring, per-package build and test configuration, and export maps. In eight days that cost comes out of the product.

## Decision

One package: a Next.js application at the repository root. The boundaries of `docs/spec/02-architecture.md` section 4.1 are kept as folders under `src/` and enforced by lint import rules, which fail the build. `src/domain` and `src/grader` stay free of framework and I/O imports so they can become packages later by moving folders.

## Consequences

- Gain: One build, one test configuration, one lockfile entry point.
- Gain: The boundaries that matter are still checked on every pull request.
- Cost: A lint rule is easier to weaken than a package boundary. Changing the import rules is a spec change that needs the owner.

## Alternatives considered

- **The monorepo of ADR-0001.** Stronger isolation, more setup than eight days can spare.
- **One package with no enforced boundaries.** Rules in routes and components within a week.

## Evidence

None needed.

## Revisit when

A second application, or a second team, needs to consume `domain` or `grader`.
