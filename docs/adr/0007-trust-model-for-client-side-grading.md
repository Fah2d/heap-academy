# ADR-0007: Trust model for client-side grading

- Status: Proposed
- Decision due: Day 1 (WP-1.1).
- Date proposed: 2026-11-13
- Decider: the owner
- Relates to: FR-PRG-04, T-10

## Context

Tests run in the learner's browser (ADR-0003). Anyone can call the API directly and claim a completion.

## Decision

The client reports completions. The database enforces verified identity, that the lesson is published, and one completion per learner and lesson, and it copies XP from the lesson. It does not verify that the code was correct. Every test case is visible to the learner; none is secret. Nothing of monetary or competitive value depends on XP in this release. A future verified completion requires server-side execution and a new ADR.

## Consequences

- Gain: Honest about what a completion means.
- Gain: No wasted effort on obfuscation.
- Cost: A learner can forge progress for themselves.

## Alternatives considered

- **Re-run tests on the server.** Reintroduces the cost and risk ADR-0003 avoids.
- **Obfuscate tests and requests.** Theatre; slows honest debugging and stops no one.

## Evidence

None needed.

## Revisit when

Certificates, competitions, leaderboards, or rewards.
