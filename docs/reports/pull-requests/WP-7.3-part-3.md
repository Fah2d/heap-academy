**Part 3 of WP-7.3.** The `backup_reader` role of ADR-0030 and the database test that pins it. Nothing else: ADR-0030 says WP-7.3 must first prove that a custom role on Supabase Free can be given `BYPASSRLS` and read access to `auth`, and that "if the role cannot be made, the owner decides before the backup is built". This part is that proof, run by the CI `db` job. Same branch as parts 1 and 2 (`wp/7.3-operations`), now up to date with `main` at 7875ee2 (WP-2.1, pull request #12).

## What and why

WP-2.1 merged on 2026-11-24, which the part 2 description named as the condition for the backup work. The backup workflow, the restore script and the restore runbook all depend on this role. Building them before the `db` job shows the role can be made would risk a workflow that cannot work and an ADR that has to change.

## Work package

- Work package: WP-7.3 Operations, part 3.
- Requirements and threats covered: NFR-REL-05 (the role a nightly backup reads with) and T-24 (the role's tests, as listed in `06-security-privacy.md` section 3).
- Time box 2.5 hours for the whole package. About 0.8 hours after part 2; part 3 from about 13:57 to about 14:08 on 2026-11-24, with two security review rounds. About 1.0 hour so far.

## What changed

| Item | Where |
|---|---|
| The role, created `NOLOGIN NOINHERIT BYPASSRLS` only if it does not exist (roles belong to the cluster, so a reset local database may still have it). `USAGE` on `public`, `private` and `auth`; `SELECT` on every table and sequence there; default privileges so later tables and sequences that `postgres` creates in `public` and `private` are readable; `EXECUTE` revoked on every function in `public` and `private`. No password and no login in the repository. | `supabase/migrations/20261124120000_backup_reader.sql` |
| 18 pgTAP tests: the role exists; bypasses row level security; no superuser, create-role, create-database or replication right; cannot sign in after the migrations; reads every table, view and sequence of `public`, `private` and `auth`, including `auth.users`, `auth.identities`, `auth.mfa_factors`, `lesson_solutions` and `admins`; a table or sequence added later to `public` or `private` is readable and not writable; no insert, update, delete, truncate, references, trigger or (on Postgres 17) maintain on any table it can reach; cannot move a sequence; cannot create in any schema; nothing in `vault`; no function in `public` or `private`; a member of no role; no API role (`authenticator`, `anon`, `authenticated`, `service_role`) can switch to it. | `supabase/tests/database/06_backup_reader.test.sql` |

## How it was verified

- `pnpm verify` on the branch with these changes: exit 0, `Test Files  32 passed (32)`, `Tests  739 passed (739)`.
- **Not run: `pnpm test:db`.** This sandbox has no Docker and no `psql`, so neither the migration nor the 18 tests have run anywhere yet. The CI `db` job (`supabase start`, then `supabase test db`) runs both on the pull request. Until it is green, this part is unverified.
- Current Supabase documentation (checked 2026-11-24): "On Supabase the owner is `postgres`, which has `bypassrls`" and `alter role "role_name" with bypassrls;` (row level security guide); a custom role connects through the shared pooler as `[ROLE].[PROJECT-REF]` (connecting guide). **Not found** in any page: whether `postgres` may grant `SELECT` on `auth` tables to a custom role. The `db` job answers that for the local stack; the production answer comes with the backup workflow's first run.

## Reviews

Rounds are numbered on from part 2's round 4. Reports in `docs/reports/reviews/WP-7.3/`.

- Round 5, `security-review-5.md`: CHANGES REQUIRED, 2 majors and 4 minors. Fixed before commit: the `alter role` naming `nosuperuser` and `noreplication`, which a non-superuser may not do (now only the `create`); pgTAP's own temp tables, granted to `PUBLIC`, which would have failed the write checks (temp schemas are now left out); a sequence `USAGE` grant not caught; `references`, `trigger` and `CREATE` not pinned; the probe covering `public` only. The sixth (a production-side check of the `auth` grants) belongs to the backup workflow.
- Round 6, `security-review-6.md`: APPROVE. Every round 5 finding fixed. Two minors: `maintain` unchecked (added after the round, guarded by the server version, so **that one line is unreviewed**), and a note that the `CREATE` check fails if Supabase gives `PUBLIC` the `CREATE` right on a schema, which would be a real finding.
- code-reviewer: not asked. The change is two SQL files, reviewed by `security-reviewer` as the handbook asks for database changes.
- design-reviewer: not asked. No interface change.

## Owner actions now due

1. Let the CI `db` job run on this pull request. If it fails at `supabase start` with a permission error on `create role ... bypassrls` or on the `auth` grants, the role cannot be made as ADR-0030 says, and you decide before the backup is built (ADR-0030, "Consequences").
2. Do **not** turn on login for `backup_reader` yet. That step comes with the backup workflow, which will give the exact command and where the password is kept.
3. The owner actions of parts 1 and 2 are still due.

## Decisions taken by default

- **F. The role is created without login.** Its password is a secret of `production-backup`, so it cannot be in a migration. Default: `NOLOGIN` in the migration; the owner sets `LOGIN PASSWORD` in the SQL editor when the workflow exists. Alternative: a login role with no password, which also cannot sign in, but reads as if it could.
- **G. New `auth` tables are not covered by default privileges.** Only a member of `supabase_auth_admin` could set those, and `postgres` is not one. Default: the test lists every `auth` table without `SELECT`, so a new one fails the `db` job (and the next dump fails loudly, never leaks). A new migration then grants it.
- **H. The `maintain` privilege is checked only on Postgres 17 and later**, where it exists. `supabase/config.toml` pins no major version, so the check is guarded by `server_version_num`.

## What is left for later parts of WP-7.3

- After the `db` job is green: the nightly backup workflow (`backup.yml`), the committed recipient key check (needs your `age` public key at `ops/backup-recipient.age.pub`), provenance attestation, the heartbeat ping, the CI check that only `backup.yml` names `production-backup`, the `infra:verify` branch policy check for `production-backup`, and their tests; the restore script with its run and attestation checks, and the verification script; the restore runbook, with where the backup key lives and how to rotate it; the rotation sections for the `backup_reader` password and the ping address.
- The one-line deletion email and the deletion request runbook: after account deletion exists (WP-6.3 part 2, which needs WP-2.2).
- Analytics, after decision C.
- The owner's drills, monitors and notifications.

## Risks and rollback

The migration creates a role and grants it reads. It changes no table, policy or function, so the current app works the same before and after. If the deploy's production migration step fails on this file, nothing after it runs, and the fix is a new migration (forward-only). To remove the role after it is applied: a new migration with `revoke` and `drop role backup_reader`.

## Definition of Done

- [ ] Every "Done when" line is met. **Not met for the package**: the backup workflow, the drills and the monitors are later parts and owner actions.
- [ ] Every requirement in this part has a test that passes. **Written, not run**: the `db` job runs them.
- [x] `pnpm verify` passes.
- [x] No interface change.
- [x] No stub, placeholder, or invented number.
- [x] No new tables. No new server actions. One new role, with its tests.
- [x] Every reviewer blocker and major is fixed.
- [x] No AI attribution in any commit or in this description.

## Opening or updating the pull request

`gh` cannot reach GitHub from the sandbox. From your terminal in the repository root, use the commands at the end of `WP-7.3-part-2.md` with all three parts:

```sh
cat docs/reports/pull-requests/WP-7.3-part-1.md docs/reports/pull-requests/WP-7.3-part-2.md docs/reports/pull-requests/WP-7.3-part-3.md > "$TMPDIR/wp-7.3.md"
```
