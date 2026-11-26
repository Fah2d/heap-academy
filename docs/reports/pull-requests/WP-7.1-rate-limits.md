<!-- No AI attribution in this description or in any commit (CLAUDE.md rule 15). -->

**Base: `main` at c8ce780.** WP-7.1 part 3: the per-action rate limits of T-14 in Postgres. It needs nothing from the other open branches, so it can merge first.

## What and why

- `supabase/migrations/20261126120000_action_counters.sql`: `private.action_counters` (RLS on, no policy, no grant) and `private.count_action()`, `security definer` with `search_path = ''`, reached through `public.count_action()`. The server signs action, address, limit and minute with `ACTION_COUNTER_KEY`. The function checks the signature against the Vault secret `action_counter_key`, through a second HMAC, for its own minute and one either side. It stores an HMAC of the address, never the address. Each call prunes at most 100 old rows, `skip locked`.
- The action wrapper counts first, before identity or parsing: 120 a minute by default, 30 for sign-in, Google start and the second step. Sign-out is `uncounted` (FR-AUTH-05). Refused gives `rate_limited`. A counter that does not answer gives `unavailable` and an error log line, and nothing runs.
- `/api/csp-report` is counted the same way before its body is read (429, or 503 when the counter does not answer).
- The address is `x-real-ip`, the header Vercel's `ipAddress()` reads (`@vercel/functions` 3.11.3), checked with `net.isIP`. IPv6 counts by its /64 prefix. No other forwarding header is read.
- `ACTION_COUNTER_KEY` (server only, at least 32 characters) is in `.env.example`, CI and Playwright, with a public local value. `supabase/config.toml` stores it in Vault on `supabase start` (`[db.vault]`). A Vercel deployment refuses the local value. Runbook: `docs/runbooks/rate-limits.md`.

## Work package

WP-7.1 part 3. Covers T-14's Postgres counters and their tests. Not in this part: the firewall rule, the provider settings check, the advisor run and `pnpm infra:verify` against production (all the owner's), and the whole-application review.

## How it was verified

- `pnpm verify` on the fixes: exit 0, `Test Files  56 passed (56)`, `Tests  1046 passed (1046)`. `pnpm build` with the `.env.example` values: exit 0. `check-bundle`: no server variable in 22 files.
- Database tests **on PGlite, not Supabase** (PGlite 0.5.17, pgcrypto, a stub of Vault's `secrets`, `decrypted_secrets`, `create_secret` and `update_secret`): every file passes, with and without the seed. `13_action_counters.test.sql`: 39 of 39. `01_admin_gate` passes with the two new definer functions on its T-20 list.
- Not run: `pnpm test:db` and e2e (Docker refused here, and another session holds the local stack). The first real run is CI's `db` and `e2e` jobs. Not measured: whether the e2e suite stays under 30 sign-in calls a minute. Locally every request shares the `unknown` key.

## Reviews

- code-reviewer: CHANGES REQUIRED, 3 MAJOR, 9 MINOR. Fixed: majors 1 and 2 and five minors. Answered below: major 3 and minors 1, 6, 7 and 8. Report: `docs/reports/reviews/WP-7.1/code-review-3.md`.
- security-reviewer: CHANGES REQUIRED, no blocker, 2 MAJOR, 7 MINOR. All fixed except the deployed check of major 1 (owner action 3) and minor 5 (Vercel sets the header). Report: `security-review-3.md`.

## Owner actions now due

1. Before merging: set the key in staging and production Vault and in Vercel (runbook section 1). Without it every action answers "unavailable" after the deploy.
2. A preview of this branch uses staging, which gets the migration only when `main` deploys, so its actions answer "unavailable" until then. The current app keeps working after the migration.
3. On the first preview after merge: send 31 calls of a sign-in action, each with a different client-set `x-real-ip`. Call 31 must be refused. If it is not, Vercel passes the client's value through, and the key must change.
4. Regenerate `src/infrastructure/db/database.types.ts` with the local stack. The clients are not typed by it, so nothing breaks meanwhile.
5. Check whether CI's `e2e` job hits the 30-a-minute limit on the shared `unknown` key.

## Proposed spec changes (`spec-change`)

1. `02-architecture.md` section 8, 8.2: add `private.action_counters`. Section 8.3: add `private.count_action` and `public.count_action`. The public one runs with the owner's rights, unlike `is_admin`, so callers need no right in `private`. Its signature check is the guard. Section 9.1 and `.claude/rules/server.md`: the wrapper order gains "the per-action rate limit" after the request ID.
2. `06-security-privacy.md` T-14: "never on a raw `x-forwarded-for`" becomes "on `x-real-ip`, never on a forwarding header the client sets". Add: "an IPv6 address by its /64 prefix".
3. `09-evidence.md`: Vercel request headers (`x-forwarded-for` overwritten "to prevent IP spoofing", `x-real-ip` "identical"); `@vercel/functions` `IP_HEADER_NAME = "x-real-ip"`; the Supabase CLI's `[db.vault]` with `env()`.
4. Copy (not changed): when the wrapper refuses, the sign-in code step should say "Too many tries from your network. Wait a minute and try again." instead of asking for a new code.

## Decisions (safe defaults)

1. The counter goes through a client with no session (`src/infrastructure/db/counter-client.ts`), not the caller's: the signature is the authority, and a stale cookie must not block sign-in. It reaches only `public.count_action()`.
2. Fail closed: no answer from the counter means the action does not run.
3. Sign-in limit 30 a minute, above what a person needs and below 120. The provider's own limits stay in force.
