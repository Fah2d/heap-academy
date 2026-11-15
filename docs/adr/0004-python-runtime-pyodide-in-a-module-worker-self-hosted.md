# ADR-0004: Python runtime: Pyodide in a module worker, self-hosted

- Status: Accepted (owner, WP-1.1, 2026-11-15)
- Decision due: Day 1 (WP-1.1). Confirmed by evidence on Day 3 (WP-3.1).
- Date proposed: 2026-11-13
- Decider: the owner
- Relates to: FR-RUN-01, 02, 03, 04, 06, 07, NFR-PERF-04, NFR-PERF-06

## Context

Learners should meet real Python: the same semantics and the same error messages they will see elsewhere.

## Decision

Pyodide, pinned through npm, copied at build to a versioned path on our origin and served immutable. It runs in a module worker that is disposable: stopping a run terminates the worker. Runs inside one worker are isolated by a soft reset. After start-up the worker removes its network APIs. Standard library only in this release. The asset base URL is a single setting.

## Consequences

- Gain: Real CPython behavior.
- Gain: Integrity through the lockfile; no third-party host on the critical path.
- Gain: Moving the assets to a cheaper host later is a configuration change.
- Cost: Download size.
- Cost: A learner who mutates a preloaded standard library module affects later runs until the worker restarts. Accepted.
- Cost: The worker shares the app's origin; network removal is hardening, not a boundary (`06-security-privacy.md` section 6).

## Alternatives considered

- **Load from a public CDN.** Third-party availability and integrity. Kept only as an emergency fallback through the base URL setting.
- **A smaller interpreter such as MicroPython.** Much smaller download, but different error messages and a partial standard library; weaker for teaching.

## Evidence

E-02, E-03, E-04, E-07. See `docs/spec/09-evidence.md`.

## Revisit when

RISK-02 materializes in field data; or a feature needs to run code not written by the current learner, which requires an opaque-origin host first.
