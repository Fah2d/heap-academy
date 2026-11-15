# ADR-0002: Next.js App Router on Vercel

- Status: Superseded by ADR-0029
- Decision due: Day 1 (WP-1.1). Confirmed by evidence in WP-1.3.
- Date proposed: 2026-11-13
- Decider: the owner
- Relates to: NFR-PERF-01, NFR-COST-01, FR-SEO-01

## Context

Most pages are content that should be static, fast, and indexable. One screen is highly interactive. There is a small authenticated API. One person operates everything.

## Decision

Next.js with the App Router. Pages are rendered per request (ADR-0028). Mutations are server actions (ADR-0027). Hosting is Vercel on the Pro plan. The host's automatic production deploy is off; production is deployed from CI in a fixed order.

## Consequences

- Gain: One framework for pages, server actions, and the request proxy.
- Gain: A preview deployment per pull request.
- Gain: One deployable unit.
- Cost: Framework churn; versions are pinned and updated deliberately.
- Cost: A strict script policy needs rendering per request, which gives up static pages for now (ADR-0028).
- Cost: Commercial use requires the paid plan (E-13).
- Cost: Runtime assets add data transfer cost (`07-operations.md` section 9).

## Alternatives considered

- **Single-page app plus a separate API.** No static HTML for discovery; two deployables.
- **Astro.** Strong for content, weaker fit for the authenticated parts.
- **Cloudflare hosting.** Free for commercial use, more adaptation work for this framework.

## Evidence

E-01, E-13. See `docs/spec/09-evidence.md`.

## Revisit when

Hosting cost or framework constraints found in WP-1.3.
