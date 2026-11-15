# ADR-0026: One test case model, validated in the admin's browser before publishing

- Status: Proposed
- Decision due: Day 1 (WP-1.1). Confirmed by evidence in WP-3.3 and WP-4.3.
- Date proposed: 2026-11-15
- Decider: the owner
- Relates to: G-2, FR-GRD-01, FR-GRD-05, FR-ADM-05 to FR-ADM-07, T-22

## Context

The archived design had five kinds of Python test. The owner will type test cases into a form, so the model has to be something a person can fill in without reading a manual. A pass must still be trustworthy, and no server may run Python.

## Decision

- One model: a name, an input, an expected output, a comparison mode, an optional hint, and optional follow-up code that runs after the learner's program in the same namespace. Follow-up code covers checks on variables and functions.
- Every test case is visible to the learner.
- Before a lesson can be published, the dashboard runs the solution, the starter, and any recorded wrong answers against the test cases in the admin's browser, with the same runtime and harness learners use.
- The database refuses to keep a lesson published unless it was validated after its last change to starter, solution, wrong answers, or test cases. It trusts the dashboard's report that validation passed.

## Consequences

- Gain: One form covers input and output, variables, and functions.
- Gain: The mistake found on the reference product (a wrong answer accepted) cannot be published by accident.
- Gain: No server-side execution.
- Cost: No check on which construct the learner used. A lesson about loops cannot require a loop.
- Cost: Validation is as honest as the browser that reports it. Acceptable while the only admin is the owner.

## Alternatives considered

- **Several test kinds, including syntax tree checks.** More expressive, harder to author in a form, more to build.
- **Validate on the server.** Needs Python on the server, which ADR-0003 rules out.
- **No validation.** The reference product shows where that leads (E-12).

## Evidence

E-06 for the harness and for a wrong answer passing a single test.

## Revisit when

A lesson needs to check how something was done, or a second author is added.
