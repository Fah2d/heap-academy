# ADR-0003: Learner code executes only in the browser

- Status: Proposed
- Decision due: Day 1 (WP-1.1).
- Date proposed: 2026-11-13
- Decider: the owner
- Relates to: G-6, NFR-COST-01, NFR-SEC-01

## Context

Running untrusted code on servers is a product in its own right: sandboxing, queues, abuse, and cost per run. The goal is near-zero marginal cost and an instant feel.

## Decision

Python runs as WebAssembly in a worker. No server evaluates learner code in this release. An HTML and CSS course, when it comes, renders in a sandboxed document (ADR-0006).

## Consequences

- Gain: No execution infrastructure, no queue, no cost per run.
- Gain: Works without a connection once loaded.
- Gain: Scales with the CDN.
- Cost: A 5.5 MB runtime download on first use (E-02).
- Cost: Grading can be forged (ADR-0007).
- Cost: Only languages with a browser runtime are possible.
- Cost: Behavior varies with the learner's device.

## Alternatives considered

- **Server-side sandboxed execution.** Cost per run, abuse surface, and operations load that one person cannot carry.

## Evidence

E-02, E-04. See `docs/spec/09-evidence.md`.

## Revisit when

Competitions, certificates, or a language with no browser runtime.
