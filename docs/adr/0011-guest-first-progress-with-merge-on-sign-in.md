# ADR-0011: Guest-first progress with merge on sign-in

- Status: Accepted (owner, WP-1.1, 2026-11-15)
- Decision due: Day 1 (WP-1.1).
- Date proposed: 2026-11-13
- Decider: the owner
- Relates to: G-1, FR-PRG-01 to FR-PRG-03, FR-AUTH-07

## Context

A viewer arriving from a video must be able to learn at once. Asking for an account first loses them. But progress must not be lost when they later sign in.

## Decision

One progress store on the device for everyone: the browser's database with a memory fallback. A pass is written there first. For a signed-in learner the store sends unsynced completions to the server through one idempotent merge, on sign-in, on load, and when the tab becomes visible, and marks them synced only after the server confirms. The merge rule is a pure function.

## Consequences

- Gain: No account needed to start.
- Gain: No server rows for anonymous traffic.
- Gain: One interface for the UI.
- Cost: Guest progress can be lost if the browser clears storage.
- Cost: Merge logic must be exactly right; it is property-tested.

## Alternatives considered

- **Anonymous server accounts.** A row for every visitor and bot, counted as active users, with an abuse surface.
- **Sign-up before the first lesson.** Fails G-1.

## Evidence

None needed.

## Revisit when

Field data shows meaningful guest loss.
