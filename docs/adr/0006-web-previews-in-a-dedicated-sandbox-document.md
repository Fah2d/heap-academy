# ADR-0006: Web previews in a dedicated sandbox document

- Status: Deferred by ADR-0022. Not in the first release.
- Decision due: not applicable.
- Date proposed: 2026-11-13
- Decider: the owner
- Relates to: the HTML and CSS course, which waits. Its requirement and threat IDs are in `docs/later/full-plan/`.

## Context

Learner HTML and CSS must render faithfully and must not reach the app. The app itself runs under a strict content security policy.

## Decision

A static sandbox document served by us with its own policy, embedded with `sandbox="allow-scripts"`, communicating by validated messages. Its policy begins with the `sandbox` directive so it is an opaque origin however it is opened. A fresh document is used for every Run and Check. The technique for preserving the learner's document structure is chosen in WP-2.2.

## Consequences

- Gain: Opaque origin: no cookies, storage, or parent access (E-06, E-07).
- Gain: Learner styles work because the document has its own policy.
- Gain: Each run starts clean.
- Cost: An extra document and script to maintain and test in three engines.
- Cost: Learner scripts do not run; a JavaScript course needs a second sandbox profile.

## Alternatives considered

- **`srcdoc`.** Inherits the app's policy and blocks learner CSS (E-07).
- **A separate preview domain.** Strong isolation but a second domain and deployment; unnecessary while the origin is opaque.
- **No isolation.** Not acceptable.

## Evidence

E-06, E-07. See `docs/spec/09-evidence.md`.

## Revisit when

A JavaScript course is commissioned.
