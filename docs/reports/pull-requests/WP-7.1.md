<!-- No AI attribution in this description or in any commit (CLAUDE.md rule 15). -->

**Base: `main`.** This branch holds `main` at 23cfb4b and `wp/7.2-a11y-perf` (its first base), so until WP-7.2 merges its commits show here too. It also holds `wp/7.1-rate-limits` (part 3, T-14's counters); that branch needs no pull request of its own. Description of part 3: `docs/reports/pull-requests/WP-7.1-rate-limits.md`.

## What and why

WP-7.1, the security pass:
- Part 1: `e2e/canary-journey.spec.ts` (`stack`), the T-21 canary. Tokens in a published lesson's solution and wrong answer, in a draft and an archived lesson, and in a draft course. A guest and a learner walk every page and admin address; no browser response, page, router payload, file or Data API table may hold a token, and the client bundles must not hold the seed's wrong answer.
- Part 2: `docs/reports/day-7-security.md`, every threat row with the tests or checks that verify it, the whole-history secret scan and the audit.
- Part 3 (`wp/7.1-rate-limits`): T-14's per-action counters in Postgres, signed with a Vault key, in the action wrapper. Its migration is renamed to `20261126120000_action_counters.sql` so it sorts after `main`'s last migration (a hosted `db push` refuses one inserted before the newest), and its test to `14_action_counters.test.sql`.
- Part 4 (this session): `main` merged in; account deletion, new in `main`, counts at the lower sign-in limit (section 7 of `07-operations.md`); `pnpm infra:verify --auth <project ref>`, the auth provider settings check (redirect list, code length and lifetime, email, code-check, sign-in and token limits, anonymous sign-ins off, bot challenge, sender, sign-up and confirmation, code-only templates, authenticator app), read through the Supabase Management API with the owner's token, printing no secret; the whole-application `security-reviewer` pass.

## Work package

- WP-7.1, parts 1 to 4. Covers NFR-SEC-01 to 07, NFR-PRIV-01, FR-ADM-14, FR-AUTH-06 and the threat table. T-14 and T-21 are built here.
- Left for the owner (each needs his accounts): the firewall rate limit rule, the provider check's run against staging and production, the production security advisor, `pnpm infra:verify` against production, the Vault key `action_counter_key` and `ACTION_COUNTER_KEY` in Vercel before merge (`docs/runbooks/rate-limits.md`).

## How it was verified

- `pnpm verify`: exit 0, `Test Files  155 passed (155)`, `Tests  2773 passed (2773)`.
- `pnpm test:db` on the local stack after `supabase db reset`: `Files=15, Tests=426`, `Result: PASS`.
- e2e as CI's `e2e` job runs it (`--project=chromium --project=stack --project=gallery`, the local stack's keys, `CI=true`), after `supabase db reset`: `218 passed`, `1 skipped` (the `test.fixme` of T-19's hosted MFA limit, from `main`), exit 0.
- Fixed to get there: the canary waited for nothing while the cached course list still lacked its course (404); it now waits as `main`'s journeys do. `catalog-journey` compared the whole cached list with the whole database while other stack journeys add and delete courses; it now compares the seed's course and its own, and still requires its draft course absent. The admin keyboard walk opens `main`'s `?example=` gallery pages.
- gitleaks over every branch's history at f798506: `1260 commits scanned.`, `no leaks found`. `pnpm audit`: 1 moderate, development only.
- Not run: Firefox and WebKit for the stack journeys (CI runs Chromium).

## Reviews

- code-reviewer: parts 1 and 2 (`code-review-1.md`, `code-review-2.md`), part 3 (`code-review-3.md`); all fixed.
- security-reviewer: part 3 (`security-review-3.md`); the whole application (`security-review-4.md`): CHANGES REQUIRED, no blocker, 1 MAJOR fixed, 3 MINOR open below.
- Open MAJOR findings for the owner to waive: none.

## Owner actions now due

1. Before merging: `action_counter_key` in staging and production Vault, `ACTION_COUNTER_KEY` in Vercel (`docs/runbooks/rate-limits.md` section 1). Without them every action answers "unavailable".
2. Run `SUPABASE_ACCESS_TOKEN=<token> pnpm infra:verify --url https://<domain> --auth <ref>` for each project (runbook `infrastructure-setup.md` section 10) and paste the output into `day-7-security.md`.
3. The firewall rule, the production advisor run, and `pnpm infra:verify` against production.
4. Decide the three open MINORs: session cookies with `httpOnly` and `Secure` (recommended: yes, a small change with a header test); the staging redirect pattern (recommended: one fixed staging address, a `spec-change`); the counter rows in the data inventory (recommended: an inventory row with "pruned by later calls", a `spec-change`). Default: left as is.
5. Still open from part 1: the development gallery re-exported from `src/features/admin/index.ts` ships its sample programs in an admin chunk.
6. The four spec points proposed in `WP-7.1-rate-limits.md`.

## Deviations from the plan or the spec

None. The migration rename changes no SQL.
