# ADR-0005: Interactive input by stack switching with a batch fallback

- Status: Proposed
- Decision due: Day 1 (WP-1.1). Confirmed by evidence on Day 3 (WP-3.2).
- Date proposed: 2026-11-13
- Decider: the owner
- Relates to: FR-WSP-08, NFR-COMPAT-04

## Context

`input()` is taught early. Blocking a worker until the learner answers used to require shared memory, which requires cross-origin isolation headers, which constrain every embed and some sign-in flows on the page.

## Decision

Where the browser supports WebAssembly stack switching, `input()` waits on a promise through Pyodide's `run_sync`. Elsewhere the learner supplies input before Run in a field. Cross-origin isolation is not used. Stopping a run always means terminating the worker.

## Consequences

- Gain: No isolation headers anywhere.
- Gain: Verified working under a strict policy in Chromium (E-05, E-07).
- Gain: The fallback population shrinks without any work from us.
- Cost: Devices on iOS versions before the one that shipped stack switching get the batch path (E-08).
- Cost: Two paths to design and test.

## Alternatives considered

- **Shared memory with blocking waits.** Requires cross-origin isolation on the lesson route.
- **Synchronous requests answered by a service worker.** Works widely but adds a service worker lifecycle and its failure modes.
- **Rewriting learner code to be asynchronous.** Fragile and changes what the learner wrote.

## Evidence

E-05, E-08, E-16. See `docs/spec/09-evidence.md`.

## Revisit when

The share of sessions on the batch path stays high after launch (the `input_strategy` event property).
