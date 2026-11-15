# ADR-0010: Explicit versioned HTTP API for mutations

- Status: Superseded by ADR-0027
- Decision due: not applicable.
- Date proposed: 2026-11-13
- Decider: the owner
- Relates to: NFR-OBS-01, T-11, T-14

## Context

Mutations need documented contracts, rate limits, logging, and tests, and may one day serve another client.

## Decision

Route handlers under `/api/v1` with request and response schemas, a generated OpenAPI document checked for drift, problem responses, same-origin checks, and a typed client. Framework server actions are not used for mutations.

## Consequences

- Gain: Contracts are visible and testable.
- Gain: Limits and logging attach to named routes.
- Gain: Reusable by a future client.
- Cost: More code than server actions.

## Alternatives considered

- **Server actions.** Implicit endpoints that are harder to limit, observe, document, and reuse.
- **An RPC library.** Good types, non-standard contract.
- **GraphQL.** Far more than this API needs.

## Evidence

None needed.

## Revisit when

Never expected.
