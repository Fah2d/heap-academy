# ADR-0009: Supabase; server-mediated writes; deny by default

- Status: Superseded by ADR-0027
- Decision due: not applicable.
- Date proposed: 2026-11-13
- Decider: the owner
- Relates to: NFR-SEC-03, T-08

## Context

The product needs sign-in, a relational store, and strong per-user isolation, operated by one person.

## Decision

Supabase for Postgres and authentication. Row level security on every table, default deny. The browser never queries the database. The server reads with the user-scoped client so policies apply. Writes go through repositories that require a verified user ID and use the privileged client, which is created in one module. Migrations are forward-only and tested from zero. Policies are tested with pgTAP.

## Consequences

- Gain: Business rules live once, in TypeScript.
- Gain: Policies are a second line of defense behind server code.
- Gain: Rate limiting and observability sit in one place.
- Cost: A privileged key on the server demands discipline: one module, a lint rule, tests.
- Cost: Free projects pause when idle (E-11).

## Alternatives considered

- **Browser talks to the database under policies alone.** Business rules duplicated in SQL; hard to rate limit.
- **All writes as database functions.** Logic split across two languages.
- **Separate database and auth vendors.** More integration work for no gain at this size.

## Evidence

E-09, E-11. See `docs/spec/09-evidence.md`.

## Revisit when

Vendor limits or cost at scale.
