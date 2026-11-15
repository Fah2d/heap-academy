# ADR-0014: UI foundation: tokens, Tailwind CSS, React Aria Components

- Status: Proposed
- Decision due: Day 1 (WP-1.1).
- Date proposed: 2026-11-13
- Decider: the owner
- Relates to: NFR-A11Y-01, NFR-I18N-02, G-4

## Context

The interface must be accessible in depth, ready for right-to-left, good on touch, and must not carry a recognizable default look.

## Decision

Design tokens as CSS custom properties in three tiers. Tailwind CSS configured from those tokens. React Aria Components as the unstyled behavior layer. No pre-styled component kit. Every primitive is shown in every state on a development-only page and has component tests.

## Consequences

- Gain: Accessibility and internationalization behavior from a specialized library.
- Gain: The look comes entirely from `DESIGN.md`.
- Cost: Every component is styled by us.

## Alternatives considered

- **A pre-styled kit.** A look shared with thousands of sites (antislop R-30).
- **Other unstyled primitive libraries.** Good, with a thinner internationalization story.
- **Hand-written behavior.** Accessibility risk.

## Evidence

None needed.

## Revisit when

A blocking defect in the behavior layer.
