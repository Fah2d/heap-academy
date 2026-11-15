# ADR-0028: One nonce-based script policy; pages render per request

- Status: Proposed
- Decision due: Day 1 (WP-1.1). Confirmed by evidence in WP-1.3.
- Date proposed: 2026-11-15
- Decider: the owner
- Relates to: NFR-SEC-02, NFR-PERF-01, A-12, FR-ADM-11; supersedes ADR-0021

## Context

In the current Next.js, a per-request nonce requires dynamic rendering; static pages and partial prerendering cannot carry one (E-21). ADR-0021 answered with two policies by route class and left the static one to a later spike. Lessons now come from a database and change without a deploy, which already moves public pages away from build-time generation.

## Decision

- One content security policy on every page, with a per-request nonce and `strict-dynamic`, set in `proxy.ts`. No `unsafe-inline` and no `unsafe-eval` for scripts.
- Every page is rendered per request. Cache Components stays off.
- Published content is cached as data with a tag and invalidated when the admin changes it.

## Consequences

- Gain: The strongest script policy the framework supports, with one mechanism to build and test.
- Gain: A signed-in learner's progress can be rendered on the server.
- Cost: Every page view runs a function. No page is served from the CDN as a static file.
- Cost: If the data cache is cold and the database is down, a page fails.

## Alternatives considered

- **Policy by route class (ADR-0021).** Static public pages, at the price of a weaker or experimental policy on exactly the pages strangers land on, and two mechanisms.
- **Static pages with inline scripts allowed.** Fast, and it gives up the main protection against injected script.
- **The experimental build-time integrity option.** May change or be removed.

## Evidence

E-21. Documentation only until WP-1.3 runs it.

## Revisit when

Function usage passes half of the plan's included amount, or page response time is slow in the field. The route is then static public pages with a hash-based policy, decided by a spike.
