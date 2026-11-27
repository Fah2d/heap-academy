# Security review 5: WP-7.3 part 3, the backup_reader role

- Reviewer: `security-reviewer`, fresh context.
- Range: uncommitted changes on `wp/7.3-operations` after 7e3cd88: `supabase/migrations/20261124120000_backup_reader.sql` and `supabase/tests/database/06_backup_reader.test.sql`.
- Date: 2026-11-24.

Verdict: CHANGES REQUIRED

## Findings

1. **MAJOR**, migration lines 23-24 (T-24). Only a superuser may name `nosuperuser` or `noreplication` in `alter role`, even to keep them false, and `postgres` is not a superuser on Supabase. Likely "permission denied" on `supabase start` and on the production deploy. Fix: state the attributes in the `create` only (`nologin noinherit bypassrls`); a new role already lacks the others, and the test pins them.
2. **MAJOR**, test lines 77-99 (T-24). pgTAP's `plan()` creates its tables and sequences in the session's temp schema with `GRANT ALL ... TO PUBLIC`, and every role with `TEMP` has rights on its own temp schema, so the write checks would list them and fail with nothing wrong. Fix: leave out `^pg_(toast_)?temp_` schemas.
3. **MINOR**, test line 96. `nextval` needs only `USAGE` on a sequence. Fix: check `usage` too.
4. **MINOR**, test lines 83-86. "SELECT only" not fully pinned. Fix: add `references`, `trigger`, `maintain` (Postgres 17) and a no-`CREATE`-on-any-schema check.
5. **MINOR**, test line 64. The later-table probe covers `public` only. Fix: add a table and a sequence probe in `private`.
6. **MINOR**, migration lines 28-29. If `postgres` lacks grant option on `auth` tables, Postgres only warns. The test catches it locally; production is never tested, and the first dump would fail loudly, not leak. Fix: a check in the backup job's preflight or `infra:verify` when the job is built.

## Checked and fine

Idempotence of the guarded `create role`, grants and default privileges; forward-only; the Postgres 16 creator `ADMIN` membership does not trip the membership tests; the `vault` checks pass with or without the extension; every existing function revokes `EXECUTE` from `public`.

## Not run

`pnpm test:db` (no Docker or `psql` in the sandbox). Not checked: how supautils treats `alter role`; whether `postgres` on the hosted project has grant option on `auth`; whether the stack revokes `TEMP` from `PUBLIC`.

## Resolution

1 to 5 fixed before the first commit (round 6 checks them). 6 is carried to the backup workflow part, listed in the part 3 description.
