# ADR-0020: Workspace lifecycle as a statechart

- Status: Accepted (owner, WP-1.1, 2026-11-15)
- Decision due: Day 1 (WP-1.1).
- Date proposed: 2026-11-13
- Decider: the owner
- Relates to: FR-WSP-04 to FR-WSP-08, FR-WSP-17, NFR-REL-03

## Context

Run, Stop, time limits, crashes, restarts, pending input, and a runtime that is still loading can interleave in many orders. Interfaces like this break in exactly those interleavings.

## Decision

An explicit statechart in `src/runtime`, independent of the UI framework, with regions for the runtime and the lesson. Every transition has a unit test. End-to-end journeys are derived from paths through the chart. Whether to use a statechart library or a typed reducer is decided in WP-3.4 by which gives transition coverage and path generation for less weight.

## Consequences

- Gain: Impossible states are unrepresentable.
- Gain: The diagram in the architecture document is the implementation.
- Cost: More upfront design than ad hoc state.

## Alternatives considered

- **State spread across components and effects.** Races between run, stop, restart, and input.

## Evidence

None needed.

## Revisit when

Never expected.
