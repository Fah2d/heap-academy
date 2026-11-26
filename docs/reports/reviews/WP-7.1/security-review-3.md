# WP-7.1 security review 3 (condensed): per-action rate limits (T-14)

- Reviewer: security-reviewer subagent, fresh context, read-only. It returned the report in its reply and did not write files; this file records it.
- Range: `origin/main...39f258d` on `wp/7.1-rate-limits`.
- Verdict: CHANGES REQUIRED, no blocker (nothing lets a non-admin change content or read a solution). 2 MAJOR, 7 MINOR.
- Reviewer ran: `pnpm verify` at 39f258d, exit 0, 56 files, 1035 tests.

| # | Finding | Resolution (commit after 39f258d) |
|---|---|---|
| MAJOR 1 | Only `x-real-ip` is trusted, and nothing shows Vercel overwrites a client-sent value. Loose address regex accepts `::::`. | Regex replaced by `net.isIP`, with tests for `::::`, `...`, `999.1.1.1`, zone IDs. The deployed check is an owner action in the pull request (31 sign-in calls on the preview, each with its own client `x-real-ip`; call 31 must be refused). |
| MAJOR 2 | `/api/csp-report` has no counter, against section 7. | Counted first, 120 a minute, before the body is read: 429 when refused, 503 and an error line when the counter does not answer. Tests in `system.test.ts`. |
| MINOR 3 | Counting over the caller's session lets a stale or forged cookie make every action "unavailable". | Counted through `src/infrastructure/db/counter-client.ts`, a client with no session (decision in the pull request). |
| MINOR 4 | The signature has no time and is compared with `<>`. | The signed text ends with the minute; the database accepts its own minute and one either side, and compares through a second HMAC. Tests: previous minute accepted, two minutes old refused. |
| MINOR 5 | A missing `x-real-ip` in production puts everyone in one `unknown` bucket, unlogged. | Not changed: Vercel sets the header on every request; answered in the pull request. |
| MINOR 6 | IPv6 keyed per /128. | Keyed by /64 prefix; IPv4-mapped addresses count as IPv4. Proposed as a spec clarification. |
| MINOR 7 | Nothing stops the public example key in staging or production. | Refused at start when `VERCEL_ENV` is `preview` or `production`. The `infra:verify` probe is proposed, not built. |
| MINOR 8 | Per-role insert, update, delete only partly covered; no fixed test vector shared by Node and pgcrypto. | Added anonymous insert, learner update, admin `aal1` delete, admin `aal2` update; one fixed vector asserted in both `13_action_counters.test.sql` and `action-counter.test.ts`. |
| MINOR 9 | `client-address.ts` lacks `server-only`. | Added. |

Not checked by the reviewer: `pnpm test:db` on Supabase's Postgres (Vault read by the function owner, `[db.vault]` seeding), Vercel's handling of a client-sent `x-real-ip`, whether Supabase logs RPC parameters, the firewall rule.
