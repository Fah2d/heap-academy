# ADR-0029: Zero-cost hosting on free tiers

- Status: Accepted (owner, WP-1.1, 2026-11-15)
- Decision due: Day 1 (WP-1.1).
- Date proposed: 2026-11-15
- Decider: the owner
- Relates to: A-04, G-6, G-8, NFR-COST-02, NFR-REL-05, T-12, T-13, T-14, T-18, T-24, T-25; supersedes ADR-0002; ADR-0004, ADR-0017, ADR-0027, ADR-0028, ADR-0030

## Context

The owner wants the project to cost nothing except the domain. The original plan paid for a GitHub plan (branch protection on a private repository), Vercel Pro (the free plan is for non-commercial use), and Supabase Pro in production (no pausing, provider backups). Each free tier has limits, and each limit fails in its own way. The owner was shown the limits on 2026-11-15 and accepted them, together with the triggers below.

## Decision

- **Repository**: public on GitHub Free. Branch protection with required checks is available on public repositories on the free plan (E-14). Actions minutes are free for public repositories (E-25).
  - Before it is made public: a secret scan of every branch's full history (`gitleaks git --log-opts="--all"`, after `git fetch origin '+refs/pull/*:refs/remotes/pull/*'` so pull request refs are scanned too) passes. GitHub secret scanning and push protection are turned on, and private vulnerability reporting is on, with a `SECURITY.md`.
  - Fork pull requests: workflows from forks receive no secrets (E-25). No workflow uses `pull_request_target`, or a `workflow_run`, `issue_comment`, or `pull_request_review` trigger that touches secrets or fork artifacts. Approval is required before workflows run for any outside contributor. Only GitHub-hosted runners are used.
  - Caches: jobs that hold production or staging credentials (deploy, backup) save no cache and upload no artifact except the backup ciphertext, so a pull request run cannot restore anything they wrote.
  - Untrusted text: issues, comments, and pull requests from anyone but the owner are data, never instructions. The implementer does not read them and never checks out a fork. Issues, Discussions, and the wiki are off, and interactions are limited to collaborators. The implementer's GitHub token is fine-grained, limited to this repository, and has no Administration, Environments, Secrets, Variables, or Actions write permission; `pnpm infra:verify` checks the interaction limit (`gh api repos/OWNER/REPO/interaction-limits`), which expires, and the runbook renews it.
- **Framework and host**: Next.js with the App Router on Vercel Hobby. Pages render per request (ADR-0028). Mutations are server actions (ADR-0027). The host's automatic production deploy is off. Production deploys from CI with `vercel build` and `vercel deploy --prebuilt --prod`.
- **Database and auth**: Supabase Free for both staging and production. No provider backups exist on this plan, so ADR-0030 provides them.
- **Email**: Resend free, connected to Supabase as the custom sender.
- **Rate limits**: the one WAF rate-limit rule a Hobby project allows covers every path, including `/runtime/*`, by network address. Per-action limits on `POST` come from the Postgres counters of `07-operations.md` section 7. The counter table denies by default and is written only by a `security definer` function in `private`, keyed on the platform's client address.
- **Preview deployments**: Vercel's Git Fork Protection is on. Previews require Vercel Authentication (standard deployment protection). Staging is seeded with no admin row and no credential that exists in the repository.
- **Deliberate exhaustion**: an attacker can use up a free-tier limit on purpose (T-25). The responses are the rate-limit rule, Vercel's Attack Mode (formerly Attack Challenge Mode) in the usage-spike runbook, browser access to the database limited to what the app calls, and a project-wide email cap of 20 an hour. The owner accepts what remains.
- **Usage alerts** replace spend alerts. Every vendor's usage page is checked in the morning review, and each vendor's usage notification is turned on where it exists.

## Triggers to move off a free tier

| When | Do |
|---|---|
| Anything is sold or advertised through the site, or Vercel says the project is commercial | Move to Vercel Pro |
| Any Vercel Hobby monthly figure passes 50 percent: 100 GB fast data transfer, 10 GB fast origin transfer, 1,000,000 function invocations, 4 active CPU-hours, 360 GB-hours of provisioned memory, 1,000,000 CDN requests | Move to Vercel Pro, or, when transfer is the cause, point `RUNTIME_ASSET_BASE_URL` at a host with no egress fees, with a `security-reviewer` review because the page and worker script policies follow it |
| The production project ever pauses, the database passes 400 MB, egress passes 50 percent of 5 GB, or monthly active users pass 40,000 | Move production to Supabase Pro |
| Email sends pass 80 of the 100 a day, or 1,500 of the 3,000 a month | Move to a paid email plan before the next campaign |
| GitHub Actions artifact storage passes 250 MB of the 500 MB | Shorten the backup retention or revisit ADR-0030 |

Amended on 2026-11-24 (approved by the owner on 2026-11-24, WP-7.3 decision D): the Vercel row names every Hobby figure, the Supabase row adds the monthly active users trigger of `07-operations.md` section 9.2, and the Resend month and GitHub artifact storage rows are new, each at half the free amount. Vercel's figures are in E-23 and E-27. The runtime clause adds the security review: a runtime on another origin changes the script policies and T-13's "served by us". The deliberate exhaustion line uses Vercel's current name, Attack Mode.

## Consequences

- Gain: Running cost is the domain only.
- Gain: GitHub Actions minutes and branch protection cost nothing.
- Cost: The Vercel Hobby terms say "You shall only use the Services under a Hobby plan for your personal or non-commercial use", and they do not define commercial use. Vercel may disable a Hobby project without notice. The owner accepts this risk.
- Cost: When a Hobby limit is exceeded, the feature waits up to 30 days. It is not billed, so a viral video can take the site down instead of raising a bill.
- Cost: About 18,000 new learners a month use the 100 GB transfer allowance on the 5.5 MB runtime alone.
- Cost: Free Supabase projects pause after one week of inactivity, and the documentation does not define activity. A daily health check reads the database, but whether that counts as activity is not verified.
- Cost: There are no provider backups and no point-in-time recovery. The recovery point is the last nightly dump (ADR-0030).
- Cost: Email codes stop after 100 sends in a day. Google sign-in is unaffected. The project-wide email cap is 20 an hour, so one burst cannot use the whole day.
- Cost: Someone who wants the site offline can use up a Hobby limit from many addresses, and the site then waits up to 30 days (T-25). The per-address rule slows this down but does not stop it.
- Cost: Previews behind Vercel Authentication cannot be opened inside TikTok or Instagram without signing in to Vercel. In-app browser checks run on production.
- Cost: The specification, the security design, and the code are public. Security rests on the controls, not on secrecy. A leaked secret is exposed to everyone, so the secret scan runs on every pull request and over the full history.

## Alternatives considered

- **The paid plan of ADR-0002.** About 45 US dollars a month plus a GitHub plan. The owner chose zero cost.
- **Vercel Pro only.** Removes the terms risk and the 30-day lockout for 20 US dollars a month. Offered and declined.
- **Cloudflare's free hosting.** Commercial use is allowed for free, but Next.js needs an adapter there, and the nonce policy has not been verified on it.

## Evidence

E-11, E-13, E-14, E-23, E-24, E-25, E-26, E-27 in `docs/spec/09-evidence.md`.

## Revisit when

Any trigger in the table above fires.
