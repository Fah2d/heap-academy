# ADR-0015: Dark theme only at 1.0, behind a theme contract

- Status: Proposed
- Decision due: Day 1 (WP-1.1).
- Date proposed: 2026-11-13
- Decider: the owner
- Relates to: antislop R-21, R-34

## Context

The brand is a CRT phosphor display and the product is a coding tool. Each additional theme doubles the surface that must be verified.

## Decision

One dark theme. Components use semantic tokens only, enforced by lint, so a second theme is a token file and a verification pass.

## Consequences

- Gain: One theme verified thoroughly.
- Gain: A written, legitimate reason for a fixed theme.
- Cost: Some learners prefer light text backgrounds for long reading.

## Alternatives considered

- **Light and dark with a toggle.** Twice the states to verify before launch.

## Evidence

E-19. See `docs/spec/09-evidence.md`.

## Revisit when

Learner feedback or an accessibility need.
