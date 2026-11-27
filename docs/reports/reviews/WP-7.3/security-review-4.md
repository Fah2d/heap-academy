# Security review 4: WP-7.3 part 2, after the round 3 fixes

- Reviewer: `security-reviewer`, fresh context.
- Range: abe78e3..2ce4040 on `wp/7.3-operations`.
- Date: 2026-11-24.

Verdict: CHANGES REQUIRED

## Round 3 findings

A to I: all FIXED (sessions ended at step 11 and the key rotation sentence corrected; the catalog checks and Vault; Vercel tokens, rollback first, hooks and drains; the vendor account list with the mailbox first; Migrate JWT secret then Rotate keys; the two failed-run cases; the 30-day fallback; reject the approval at once; both log sources).

## New findings (2ce4040 only)

**N1. MAJOR**, `rotate-a-secret.md:75`, T-19, T-08. With `postgres`, an attacker can set `auth.users.encrypted_password` on any account, including the owner's, and later sign in through Supabase's password sign-in with the public publishable key (the Email provider is on for sign-in codes). Step 11 deletes sessions, not passwords; step 9 never looks at `encrypted_password`. This gives `aal1` only; the admin area also needs the second factor. Not tested against a live project. **Fix:** add `select id, email from auth.users where coalesce(encrypted_password, '') <> '';` to step 9 (expected: no rows, the product has no password sign-in); clear any found as part of step 12.

**N2. MINOR**, `:78`. Checked in the Supabase auth source: `auth.refresh_tokens.session_id` references `auth.sessions(id) on delete cascade` (migration `20220811173540_add_sessions_table`), so `delete from auth.sessions;` also clears refresh tokens and `auth.mfa_amr_claims`; the fallback is correctly hedged. Problem 1: the staging check proves nothing if staging has no sessions (none before WP-2.2); sign in on staging first. Problem 2: access tokens issued before the delete keep working until they expire (default 1 hour, not checked for this project); say so, and point to section 4 step 7 if that hour matters.

**N3. MINOR**, step 9 queries (`:68-74`). All valid Postgres and read-only; `prokind in ('f','p')` keeps aggregates out of `pg_get_functiondef`; the `cron.job` query is guarded. Gaps: (1) overloaded functions can sort differently, and a function in a new schema is skipped: add `pg_get_function_identity_arguments(p.oid)` to output and sort, and widen the filter to every non-system schema; (2) grants to `PUBLIC`, `EXECUTE` on functions (`information_schema.role_routine_grants`) and schema `USAGE` are not checked; (3) role membership is not checked: add `select roleid::regrole, member::regrole from pg_auth_members order by 1, 2;`; (4) if `pg_net` is listed, read `net._http_response` early (it keeps only recent requests).

**N4. MINOR**, `:162`. Deleting an attacker's deployment before investigating destroys its build logs, source and function logs. **Fix:** roll back, record source and logs in the incident report, then delete.

Asked about: the documents-only pull request fallback is acceptable (Deploy runs on every push to `main` with no path filter; the manual-rollback stop still comes first). No production command from a working machine was added; the SQL is in the dashboard's editor, and the only command line against production is the existing `pnpm infra:verify`.

## What the reviewer ran

Read the old report, `git diff abe78e3..2ce4040`, `rotate-a-secret.md` in full, `deploy.yml:1-60`, `infrastructure-setup.md` section 2 and lines 173-175; fetched the Supabase auth migrations from GitHub to confirm the cascade; `pnpm verify` exit 0.

Could not check: whether the project accepts password sign-in for users who only have codes; whether `postgres` may delete from `auth.sessions` in the SQL editor; the access token lifetime; whether `role_table_grants` shows `anon` grants to `postgres`; dashboard labels.
