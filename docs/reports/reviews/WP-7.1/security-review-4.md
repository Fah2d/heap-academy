# WP-7.1 security review 4 (condensed): the whole application

- Reviewer: security-reviewer subagent, fresh context, read-only. It returned the report in its reply and did not write files; this file records it.
- Range: the whole application at 3337f89 on `wp/7.1-security-canary` (`main` at 23cfb4b with WP-7.1, WP-7.2 and T-14's counters). The four e2e files then uncommitted (73fc465) were not reviewed.
- Verdict: CHANGES REQUIRED, no blocker (no way found for a non-admin to change content or read a solution). 1 MAJOR, 3 MINOR.
- Reviewer ran: `pnpm verify`; format, lint, types and attribution passed; unit tests 2770 passed, 1 failed: `[NFR-PERF-06]` in `src/grader/node-runner/runner.test.ts` (963 ms against 500 ms) while the machine also ran e2e. Alone, that file passed 23 of 23.

| # | Finding | Resolution |
|---|---|---|
| MAJOR 1 | `infra:verify --auth` checks only the email limit, not the code-check and sign-in limits, and not that anonymous sign-ins are off. `/auth/v1/verify` is called with the publishable key, so the provider's limit is the only one in front of code guessing. | Fixed: `rate_limit_verify` at most 30, `rate_limit_otp` at most 30, `rate_limit_token_refresh` at most 150 (the provider's defaults, which the runbook keeps; Supabase "Rate limits", read 2026-11-26), and `external_anonymous_users_enabled` false, with tests. |
| MINOR 1 | Session cookies are set without `httpOnly` or `Secure` (`@supabase/ssr` defaults), in `src/infrastructure/db/session-client.ts` and `src/proxy.ts`. Defence in depth behind the script policy; the browser holds no database client (ADR-0027). | Open, for the owner (description, "Owner actions"). |
| MINOR 2 | The staging redirect pattern `heap-academy-*-<account>.vercel.app` also matches a project someone else names `heap-academy-x-<account>`, which could receive a staging Google sign-in code. Staging has no admin row. | Open; needs a `spec-change` (one fixed staging address, or no Google on previews). |
| MINOR 3 | Counter rows hold an HMAC of a network address and are pruned only by later calls; `06-security-privacy.md` section 7.1 has no row for them. | Open; needs a `spec-change` (an inventory row with its retention, or scheduled pruning). |

Checked and holding, per the reviewer: the wrapper's order on every exported action, the counter's Vault-checked HMAC and its grants and four-caller tests, `x-real-ip` as the only address, the return path, PKCE, the recent sign-in rule, the privileged client lint, both script policies and the header set, the worker lock-down, the Markdown renderer, the logger allowlist, session-free content reads, the T-21 canary, the admin guard, and the workflows.
