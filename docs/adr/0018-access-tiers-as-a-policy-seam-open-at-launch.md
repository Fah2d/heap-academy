# ADR-0018: Access tiers as a policy seam, open at launch

- Status: Deferred by ADR-0022. Not in the first release.
- Decision due: not applicable.
- Date proposed: 2026-11-13
- Decider: the owner
- Relates to: the paid tier, which waits. Its requirement and threat IDs are in `docs/later/full-plan/`.

## Context

Launch is free and open. A paid tier tied to the community is planned. Adding a paywall late usually means changing routes, caching, and the data model.

## Decision

Lessons carry an access level and viewers a tier from the start. One pure policy function decides everywhere. A configuration value selects open or tiered mode. Paid material is never emitted to static output in any mode. Delivery of paid material is built in Phase 7; until then the content check rejects paid lessons.

## Consequences

- Gain: Turning tiers on is configuration plus Phase 7, not a redesign.
- Gain: No way to leak paid material by forgetting a rebuild.
- Cost: A little structure that the open launch does not use.

## Alternatives considered

- **Add it later from nothing.** Rework of routes, caching, and data.
- **Build the whole paywall now.** Not needed for launch.

## Evidence

None yet.

## Revisit when

When the paid community launches.
