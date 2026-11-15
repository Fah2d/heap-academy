# ADR-0027: Server actions behind one wrapper; row level security is the authority

- Status: Accepted (owner, WP-1.1, 2026-11-15)
- Decision due: Day 1 (WP-1.1).
- Date proposed: 2026-11-15
- Decider: the owner
- Relates to: NFR-SEC-03, T-08, T-11, T-14, T-20; supersedes ADR-0009 and ADR-0010

## Context

ADR-0010 chose a versioned HTTP API with a generated contract and client. ADR-0009 chose writes through a privileged database client inside repositories. Both are sound and both are a lot of machinery for eight days and one client application.

## Decision

- Database and auth are Supabase. Every table has row level security and denies by default.
- Every mutation is a Next.js server action built with one wrapper that supplies the request ID, verified identity, schema parsing with limits, a typed result, and logging.
- Reads and writes use the caller's own session, so the policies decide. Insert and update policies exist for exactly what a learner may write: their own completion for a published lesson, and their own profile.
- The privileged key is used by one use case, account deletion, in one module.
- Route handlers exist only for the health check, the two report endpoints, and the sign-in callback.

## Consequences

- Gain: One enforcement point that a server bug cannot bypass, with a test per policy.
- Gain: End-to-end types without a generated client.
- Cost: No documented public API. A mobile app later would need one.
- Cost: A learner can write their own completion row through the database interface directly, bypassing the action. The same bounds apply, because the bounds are in the database.

## Alternatives considered

- **The API of ADR-0010.** Better contracts, more to build.
- **Privileged writes as in ADR-0009.** A second line of defense, but every write path then depends on server code being right.

## Evidence

E-09 for verified claims on the server.

## Revisit when

A second client needs the same operations.
