# ADR-0013: CodeMirror 6 as the editor

- Status: Accepted (owner, WP-1.1, 2026-11-15)
- Decision due: Day 1 (WP-1.1). Confirmed by evidence in WP-4.2 and WP-5.3.
- Date proposed: 2026-11-13
- Decider: the owner
- Relates to: FR-WSP-03, FR-WSP-13, NFR-A11Y-03

## Context

The editor must work on phones, be operable by keyboard and screen reader, and stay small.

## Decision

CodeMirror 6 with the Python language package and a theme built from design tokens.

## Consequences

- Gain: Designed for touch devices.
- Gain: Modular and small.
- Gain: Good accessibility foundations.
- Cost: Fewer built-in IDE features than larger editors; none are needed in this release.

## Alternatives considered

- **Monaco.** Larger, and not designed for mobile browsers. The reference product uses it (E-12).
- **A plain text area.** No highlighting or indentation help.

## Evidence

To be gathered on real devices in WP-5.3.

## Revisit when

WP-5.3 finds a blocking defect on a supported device.
