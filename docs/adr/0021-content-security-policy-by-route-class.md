# ADR-0021: Content security policy by route class

- Status: Superseded by ADR-0028
- Decision due: not applicable.
- Date proposed: 2026-11-13
- Decider: the owner
- Relates to: NFR-SEC-02

## Context

In the current framework version a per-request script nonce requires dynamic rendering and disables static generation. Static public pages are central to cost and to surviving traffic spikes. An experimental build-time integrity option exists (E-01).

## Decision

Directives that do not depend on rendering are fixed for every route (`06-security-privacy.md` section 5.2). Per-user and sensitive routes use a nonce with `strict-dynamic`. For static public routes the first choice is build-time hashes or integrity if WP-2.5 of the archived plan shows it is reliable; the fallback allows inline scripts, compensated by the absence of HTML injection sinks, strict values elsewhere, and Trusted Types where supported, and is recorded as an accepted risk signed by the owner. The policy runs report-only from Phase 1 and is enforced in Phase 8.

## Consequences

- Gain: Static pages stay static.
- Gain: The strongest policy where personal data is on screen.
- Cost: Two policies to maintain.
- Cost: The fallback weakens script injection defense on public pages.

## Alternatives considered

- **Nonces on every page.** Every page becomes dynamic: slower, costlier, and exposed to traffic spikes.
- **No policy.** Not acceptable.

## Evidence

E-01, E-07. See `docs/spec/09-evidence.md`.

## Revisit when

The framework supports strict policies on static pages.
