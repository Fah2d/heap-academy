# ADR-0029: Zero-cost hosting on free tiers

- Status: Accepted (owner, WP-1.1, 2026-11-15)
- Decision due: Day 1 (WP-1.1).
- Date proposed: 2026-11-15
- Decider: the owner
- Relates to: A-04, G-6, G-8, NFR-COST-02, NFR-REL-05, T-12, T-14; supersedes ADR-0002; ADR-0004, ADR-0017, ADR-0027, ADR-0028, ADR-0030

## Context

The owner wants the project to cost nothing except the domain. The original plan paid for a GitHub plan (branch protection on a private repository), Vercel Pro (the free plan is for non-commercial use), and Supabase Pro in production (no pausing, provider backups). Each free tier has limits, and each limit fails in its own way. The owner was shown the limits on 2026-11-15 and accepted them, together with the triggers below.

## Decision

- **Repository**: public on GitHub Free. Branch protection with required checks is available on public repositories on the free plan (E-14). Actions minutes are free for public repositories (E-25). Workflows triggered by pull requests from forks receive no secrets, and no workflow uses `pull_request_target`.
- **Framework and host**: Next.js with the App Router on Vercel Hobby. Pages render per request (ADR-0028). Mutations are server actions (ADR-0027). The host's automatic production deploy is off. Production deploys from CI with `vercel build` and `vercel deploy --prebuilt --prod`.
- **Database and auth**: Supabase Free for both staging and production. No provider backups exist on this plan, so ADR-0030 provides them.
- **Email**: Resend free, connected to Supabase as the custom sender.
- **Rate limits**: the one WAF rate-limit rule a Hobby project allows covers every `POST`. The Postgres counter table of `07-operations.md` section 7 is built too, in the action wrapper, because one rule cannot cover every limit.
- **Usage alerts** replace spend alerts. Every vendor's usage page is checked in the morning review, and each vendor's usage notification is turned on where it exists.

## Triggers to move off a free tier

| When | Do |
|---|---|
| Anything is sold or advertised through the site, or Vercel says the project is commercial | Move to Vercel Pro |
| Any Vercel Hobby monthly figure passes 50 percent: 100 GB fast data transfer, 1,000,000 function invocations, 4 active CPU-hours | Move to Vercel Pro, or point `RUNTIME_ASSET_BASE_URL` at a host with no egress fees when transfer is the cause |
| The production project ever pauses, the database passes 400 MB, or egress passes 50 percent of 5 GB | Move production to Supabase Pro |
| Email sends pass 80 of the 100 a day | Move to a paid email plan before the next campaign |

## Consequences

- Gain: Running cost is the domain only.
- Gain: GitHub Actions minutes and branch protection cost nothing.
- Cost: The Vercel Hobby terms say "You shall only use the Services under a Hobby plan for your personal or non-commercial use", and they do not define commercial use. Vercel may disable a Hobby project without notice. The owner accepts this risk.
- Cost: When a Hobby limit is exceeded, the feature waits up to 30 days. It is not billed, so a viral video can take the site down instead of raising a bill.
- Cost: About 18,000 new learners a month use the 100 GB transfer allowance on the 5.5 MB runtime alone.
- Cost: Free Supabase projects pause after one week of inactivity, and the documentation does not define activity. A daily health check reads the database, but whether that counts as activity is not verified.
- Cost: There are no provider backups and no point-in-time recovery. The recovery point is the last nightly dump (ADR-0030).
- Cost: Email codes stop after 100 sends in a day. Google sign-in is unaffected. The Supabase custom-sender limit (30 an hour by default) is raised to fit.
- Cost: The specification, the security design, and the code are public. Security rests on the controls, not on secrecy. A leaked secret is exposed to everyone, so the secret scan runs on every pull request and over the full history.

## Alternatives considered

- **The paid plan of ADR-0002.** About 45 US dollars a month plus a GitHub plan. The owner chose zero cost.
- **Vercel Pro only.** Removes the terms risk and the 30-day lockout for 20 US dollars a month. Offered and declined.
- **Cloudflare's free hosting.** Commercial use is allowed for free, but Next.js needs an adapter there, and the nonce policy has not been verified on it.

## Evidence

E-11, E-13, E-14, E-23, E-24, E-25, E-26 in `docs/spec/09-evidence.md`.

## Revisit when

Any trigger in the table above fires.
