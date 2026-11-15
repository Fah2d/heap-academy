# ADR-0019: Observability through ports

- Status: Proposed. Reduced for the first release by ADR-0022.
- Decision due: Day 1 (WP-1.1).
- Date proposed: 2026-11-13
- Decider: the owner
- Relates to: NFR-OBS-01, 02, 04, NFR-PRIV-03, T-16

## Context

Error and analytics vendors change, their scripts are a privacy and policy risk, and tests should not talk to them.

## Decision

Product code calls an `ErrorReporter` port and a typed `track()` function. Adapters exist for the console, for tests, and for the hosting provider's logs and analytics. Log fields are an allowlist in code. Custom product events wait (ADR-0022).

## Consequences

- Gain: Vendors can be swapped.
- Gain: No personal data can be attached by accident.
- Gain: Tests stay offline.
- Cost: A thin layer to maintain.

## Alternatives considered

- **Call vendor libraries directly.** Lock-in, leaks, and harder tests.

## Evidence

None needed.

## Revisit when

Never expected.
