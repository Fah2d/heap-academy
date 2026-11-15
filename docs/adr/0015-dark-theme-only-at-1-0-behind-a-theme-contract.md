# ADR-0015: Dark theme only at 1.0, behind a theme contract

- Status: Accepted (owner, WP-1.1, 2026-11-15)
- Decision due: Day 1 (WP-1.1).
- Date proposed: 2026-11-13
- Decider: the owner
- Relates to: antislop R-21, R-34

## Context

The product is a coding tool whose focal point is the editor, and the owner chose a dark interface on the decision sheet (`docs/reports/decision-sheet.md`). Each additional theme doubles the surface that must be verified.

## Decision

One dark theme. Components use semantic tokens only, enforced by lint, so a second theme is a token file and a verification pass.

## Consequences

- Gain: One theme verified thoroughly.
- Gain: A written, legitimate reason for a fixed theme.
- Cost: Some learners prefer light text backgrounds for long reading.

## Alternatives considered

- **Light and dark with a toggle.** Twice the states to verify before launch.

## Evidence

The measured contrast of every token pair in `DESIGN.md` section 4.3.

## Revisit when

Learner feedback or an accessibility need.
