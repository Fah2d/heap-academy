# ADR-0012: Derive XP and streak; store no aggregates

- Status: Accepted (owner, WP-1.1, 2026-11-15)
- Decision due: Day 1 (WP-1.1).
- Date proposed: 2026-11-13
- Decider: the owner
- Relates to: FR-PRG-04, FR-PRG-05

## Context

Stored counters drift from the facts they summarize, and keeping them right needs the same rule written in two languages.

## Decision

XP is the sum of the XP recorded on a learner's completion rows, which the database copies from the lesson at the moment of completion. Streak is computed by one pure function from completion times and the learner's time zone, used for guests and accounts alike. No totals are stored.

## Consequences

- Gain: Cannot drift.
- Gain: One implementation of each rule.
- Cost: A small query on each read.
- Cost: Rankings across learners would need aggregates later.

## Alternatives considered

- **Counters updated in transactions or triggers.** Drift, and duplicate logic in SQL.

## Evidence

None needed.

## Revisit when

Leaderboards.
