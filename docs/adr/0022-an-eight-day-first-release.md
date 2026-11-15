# ADR-0022: An eight-day first release: what ships and what waits

- Status: Accepted (owner, WP-1.1, 2026-11-15)
- Decision due: Day 1 (WP-1.1).
- Date proposed: 2026-11-15
- Decider: the owner
- Relates to: G-8, A-01, A-02, A-08, A-11; ADR-0006, ADR-0016, ADR-0018, ADR-0019

## Context

The original plan had ten phases and 63 work packages. The owner has eight days, wants Python only, and wants to write lessons himself in a dashboard. A plan sized for months cannot be run in days by doing everything faster; it has to be a smaller plan.

## Decision

The first release is the scope in `docs/spec/00-charter.md` section 5, delivered by the eight days in `docs/spec/08-delivery-plan.md`. The original plan is archived in `docs/later/full-plan/` and is not in force.

- Deferred: the HTML and CSS course and its sandbox (ADR-0006), the paid tier (ADR-0018), and everything else in section 4 of the charter.
- Reduced: readiness for Arabic keeps message modules, logical properties, and one direction setting, without an internationalization library or locale routing (ADR-0016). Observability keeps the ports, with console and host adapters and no custom product events (ADR-0019).
- Process: one reviewer pass per pull request by change type, a day check instead of phase gates, no component gallery, no visual comparison tests, no mutation tests, no requirement tracing tool.
- Kept in full: tests written with the code, policy tests for every table, the script policy, the publish rule, the antislop Delivery Gate, the no-attribution rule.

## Consequences

- Gain: A live product in eight days that the owner can fill with lessons.
- Gain: Every cut item has a written design to return to.
- Cost: One course, no paid content, fewer conveniences for learners.
- Cost: Less automated regression protection for the look of the interface.

## Alternatives considered

- **Run the ten-phase plan faster.** The process weight alone would use the eight days.
- **Skip the spec and build directly.** Fast for two days, then slow and untrustworthy. The owner asked for the opposite.

## Evidence

None needed. This is a scope decision.

## Revisit when

The first release is live. Each deferred item returns with its own ADR.
