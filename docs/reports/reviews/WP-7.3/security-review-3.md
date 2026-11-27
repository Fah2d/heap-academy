# Security review 3: WP-7.3 part 2, after the round 2 fixes

- Reviewer: `security-reviewer`, fresh context.
- Range: 1590d7b..abe78e3 on `wp/7.3-operations`.
- Date: 2026-11-24.

Verdict: CHANGES REQUIRED

## Round 2 findings

1. PARTLY: logs, advisor, roles, policies, functions, MFA rows and the legal question present; no step ends the attacker's sessions, and the catalog checks miss the likeliest backdoors (A, B).
2. FIXED. 3. FIXED (new gaps C, D). 4. PARTLY: legacy keys fixed; revoking the legacy JWT secret cannot be done as written (E). 5. to 18. FIXED (side effects of 7 in F, G, H).

## New findings

**A. MAJOR**, `rotate-a-secret.md:60-65` (also `:91-92`, `:163`). T-19, T-20, T-08. Whoever held the `postgres` password or the Supabase account could read `auth.refresh_tokens` and `auth.sessions`; with the owner's refresh token they keep his `aal2` session after the reset. Supabase: "refresh tokens never expire"; after a key rotation "no users will be forcefully signed out". Revoking a key only fails the access tokens it signed. Line 65 presents key rotation as signing people out, which is wrong. **Fix:** after every exposure of a database password or the Supabase account, end every session (`delete from auth.sessions;` in the SQL editor, tried on staging first to confirm it cascades to `auth.refresh_tokens`). Correct line 65.

**B. MAJOR**, `rotate-a-secret.md:64`. T-08, T-20, T-14. With `postgres` an attacker can `create or replace` an existing `security definer` function (same name), disable row level security on a table (policies still listed), grant table rights to `anon`, add a trigger, event trigger or `pg_cron` job that sends data out through `pg_net`, change the owner's email in `auth.users` or link an `auth.identities` row to his account, or read Vault secrets. The query as written returns names only, with no schema filter. **Fix:** compare `md5(pg_get_functiondef(oid))` for the non-system schemas between production and staging; check `pg_class.relrowsecurity`, `information_schema.role_table_grants` for `anon` and `authenticated`, `pg_trigger` (non-internal), `pg_event_trigger`, `pg_extension`, `cron.job`, `pg_foreign_server`, the owner's rows in `auth.users` and `auth.identities`; rotate every Vault secret.

**C. MAJOR**, `rotate-a-secret.md:133-139`. T-12, T-08. The exposed Vercel token can create more tokens (`POST https://api.vercel.com/v3/user/tokens`). Deleting the known token leaves the others. The check for unknown deployments is last, so an attacker's deployment can serve learners and the owner's admin session meanwhile. **Fix:** delete every token you did not create; next, roll back anything under **Deployments → Current** you did not deploy, before any other step; add deploy hooks, log drains, webhooks and integrations to the checks.

**D. MAJOR**, `rotate-a-secret.md:155-167`. T-12, T-19. For a compromised Supabase account, section 9 only rotates keys: no persistence checks (section 2 steps 7 to 10 and A); no check of auth settings an attacker can change (Site URL and redirect allow-list, SMTP host and sender, providers, auth hooks, MFA settings); no check of Supabase personal access tokens and organization members. Missing for GitHub: SSH keys, personal access tokens, OAuth and GitHub Apps, deploy keys, webhooks, Actions settings. For Vercel: other tokens, hooks, drains. And the owner's mailbox, which can reset every account. **Fix:** add these per vendor, with the mailbox first.

**E. MINOR**, `rotate-a-secret.md:91`. T-19. Supabase's signing-keys guide starts with **Migrate JWT secret**, then **Rotate keys**; only a "previously used" key can be revoked. **Fix:** add those two steps before revoking the legacy secret.

**F. MINOR**, `rotate-a-secret.md:39` with `:123`, `:129`, `deploy-and-rollback.md:52`. After the token expires, the latest Deploy run has failed after its migrations, so its commit is not Current, and section 1 step 2 says stop. **Fix:** tell apart a run that failed before **Deploy** (re-run it) from a manual rollback (stop).

**G. MINOR**, `rotate-a-secret.md:38-43`. GitHub allows a re-run only "up to 30 days after its initial run", at most 50 times. After a quiet month section 1 has no route, which invites `vercel deploy --prod` from a working machine (forbidden by `deploy-and-rollback.md` and CLAUDE.md rule 10). **Fix:** a `workflow_dispatch` trigger as a reviewed workflow change, or a documented fallback; say "never deploy from a working machine".

**H. MINOR**, `rotate-a-secret.md:58`. Leaving the `production` approval unanswered holds the `deploy-main` concurrency group (`deploy.yml:24-26`) for up to 30 days. **Fix:** reject at once.

**I. MINOR**, `rotate-a-secret.md:62`. Through the session pooler, Postgres logs likely show the pooler as the client; the password also works on the direct connection. **Fix:** read both the Postgres and the pooler log sources; the "GitHub runners only" expectation applies to the pooler logs.

## What the reviewer ran

- `git diff 1590d7b..abe78e3`; read both runbooks, `deploy.yml`, `vercel.json`, `apply-migrations.sh`, `infrastructure-setup.md` sections 3, 5, 7, 8, 10, 11, `06-security-privacy.md` section 5.5 and the threat table, `.env.example`, the part 2 description.
- Fetched on 2026-11-24: Supabase signing keys, sessions, database size, upgrading, rotating a leaked key; GitHub re-running workflows; Vercel "Create an Auth Token".
- Confirmed: the 2 GB Free disk with read-only at 95 %; a restored Free project moves to the latest minor Postgres; the leaked-key steps.
- `pnpm verify`: exit 0, 31 files, 722 tests.

Could not check: whether the legacy keys are on; whether deleting from `auth.sessions` cascades to `auth.refresh_tokens`; the Supabase log source labels and whether pooler connections log the client address; whether Vercel's activity log records token creation; dashboard labels.
