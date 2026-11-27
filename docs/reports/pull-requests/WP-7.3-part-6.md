**Part 6 of WP-7.3.** The nightly encrypted backup and the checked restore of ADR-0030, the restore and deletion-request runbooks, the backup secrets' rotation, and the drill records. Same branch as parts 1 to 5 (`wp/7.3-operations`), with `main` at 23cfb4b merged in (f33e346).

**Decision P: the owner approved option A on 2026-11-27.** The `backup_reader` role could not use the `auth` schema, so every dump stopped at once. It now reads through `pg_read_all_data` (migration `20261127010000_backup_reader_reads_all_data.sql`), and ADR-0030 is amended to say so.

## Decision P: how the backup reads `auth` (approved: A)

The situation, as the local rehearsal found it. `postgres`, which runs the migrations, holds `USAGE` on `auth` without the right to grant it (`auth` belongs to `supabase_admin`). So the migration's `grant usage on schema ... auth to backup_reader` grants nothing. `pg_dump` then stops with `permission denied for schema auth`. The same holds for the auth service's sequences and for the tables it adds after the migrations run (11 on the local stack today).

| Option | What it means | Cost |
|---|---|---|
| **A (recommended).** Grant `pg_read_all_data` to `backup_reader` `with inherit true`, in a migration. `postgres` holds that role with the admin option, on the local stack. | Read access to every table and sequence in every schema, now and later. Locally: the dump worked, 9,825 bytes. Database tests 6 to 8 then pass. | The role can also read `vault.secrets`, though not decrypt it: `permission denied for function _crypto_aead_det_decrypt`, tried locally. It reads every other schema too. It becomes a member of a role. That breaks ADR-0030's "nothing in `vault`" and "not a member" (database tests 15, 16 and 18 of the file as it was then failed when tried). ADR-0030 needs an amendment, labeled `spec-change`. |
| B. Dump as `postgres`. | Works. | The `postgres` password would sit in the `production-backup` environment: it can write everything. Worse than A. |
| C. Leave `auth` out of the dump. | The role stays as ADR-0030 says. | A restore loses every account and the admin's second step. Learners would sign in as new users, and their progress would be orphaned. It fails NFR-REL-05's intent. |
| D. Supabase Pro backups. | No work. | 25 US dollars a month (ADR-0029). |

Not verified for any option: that hosted Supabase gives `postgres` the same rights as the local stack. Approved: A, with tests that pin what stays true: no write anywhere, no decryption of Vault, membership in `pg_read_all_data` only.

What changed for it:

- `supabase/migrations/20261127010000_backup_reader_reads_all_data.sql`: `grant pg_read_all_data to backup_reader with inherit true`, without the admin option. The role is `NOINHERIT`, so the grant names `INHERIT TRUE`.
- `06_backup_reader.test.sql`, now 24 tests:
  - The two Vault tests (no table, no schema) are replaced by one: the role can run no function in `vault`.
  - The membership test now wants exactly `pg_read_all_data`, directly or through another role. A new test pins that grant at `inherit=true admin=false`.
  - Four new tests run as the role. A read of `auth`, `public` and `vault.secrets` runs. `vault.decrypted_secrets` is refused with `permission denied for function _crypto_aead_det_decrypt`. A write to `public.admins` and to `auth.users` is refused (42501). The transaction gives `postgres` `SET` on the role for this, and the rollback takes it back.
- ADR-0030: the role's bullet, an amendment note for P, two costs, and options B and C as alternatives. T-24 in `06-security-privacy.md`, `restore.md` section 2, and `rotate-a-secret.md` section 10 match it.

## What

- `.github/workflows/backup.yml`:
  - Runs on the schedule only (02:17 UTC), on `main`, in `production-backup`.
  - Its permissions are `contents: read`, `id-token: write` and `attestations: write`.
  - Its steps, in order: check the recipient key, dump and encrypt, upload only the ciphertext (7 days), attest it, then ping the heartbeat monitor.
- `scripts/backup.sh`:
  - The recipient key must match `ops/backup-recipient.age.pub` and the environment's copy.
  - `pg_dump` of the data of `public`, `private` and `auth` is piped straight into `age`, and the output must start with the age header.
  - It never prints the password, the host, the user, or `pg_dump`'s own words.
  - The dump leaves out sessions, refresh tokens, codes, challenges and the audit log, and it refuses a `pg_dump` older than 17.6.
- `scripts/restore.mjs`:
  - It accepts only a successful scheduled run of `backup.yml` on `main` in this repository, matched by file path.
  - It downloads into a new folder and accepts exactly one file. That file must pass `gh attestation verify` for that workflow and ref, and the key must be at mode 0600.
  - Only then does it decrypt. psql gets `BEGIN`, then age's output, and `COMMIT` only after age exits 0.
  - It refuses a target that holds a password, in any form libpq reads.
- `scripts/restore-verify.sql`: the drill's check. It prints the row counts. It fails if there is no account, no admin linked to a restored account, or no published lesson, or if the named lesson is not published with its solution, or if a table lacks row level security or a policy.
- Runbooks:
  - `restore.md`: the key's home, one-time setup, the drill, a real restore, re-applying deletions, rotating the key, failures, and the drill record.
  - `deletion-request.md`: a learner's request by email.
  - `rotate-a-secret.md`: sections 10 and 11, for the role's password and the heartbeat address.
  - `infrastructure-setup.md`: the secrets table.
  - `deploy-and-rollback.md`: the rollback drill record.
- `supabase/tests/database/06_backup_reader.test.sql`: this file never ran before; earlier sessions had no Docker. Its first run found the following:
  - A new test: the role must use the three schemas. It fails (decision P).
  - A new test pins every `auth` table as dumped or left out; a unit test keeps the left-out list equal to the script's.
  - The planner called `has_sequence_privilege` on tables, which stopped the file at test 7. Those calls are now inside a `case`.
  - `pg_catalog.pg_settings` is left out of the write check. Postgres gives every role `UPDATE` on it, and it writes no row.

## Spec and ADR changes on this branch (label `spec-change`)

- ADR-0030: the log, restore and dump clauses, and an amendment note marked as proposed (decisions Q and R).
- ADR-0030, amended for decision P as approved: `backup_reader` reads through `pg_read_all_data`. T-24's test list in `docs/spec/06-security-privacy.md` matches.

## How it was verified

- `pnpm verify` on 4248a57 (the last code commit is 0fafc19): exit 0, `Test Files  160 passed (160)`, `Tests  2810 passed (2810)`.
- e2e as CI runs it (`--project=chromium --project=stack --project=gallery`, after `supabase db reset`): on 5872bc6 and again on b68531d, `169 passed`, `1 skipped`, exit 0. The last code commit changes only scripts the e2e run does not load, the database test and documents.
- `pnpm test:db` after `supabase db reset`: `Files=15, Tests=407`, `Result: FAIL`. The failures are only tests 6 to 8 of `06_backup_reader` (decision P).
- After decision P (2026-11-27), with `main` at 5dcc577 merged in:
  - `pnpm verify`: exit 0, `Test Files  162 passed (162)`, `Tests  2853 passed (2853)`.
  - `pnpm test:db` after a clean `supabase db reset`: `Files=16, Tests=450`, `Result: PASS`.
  - Mutations, each on the local stack and then undone. Without the grant: tests 6 to 8, 18 and 19 fail. With `pg_write_all_data` added: tests 12 to 14, 18, 23 and 24 fail. With `EXECUTE` on `vault._crypto_aead_det_decrypt` granted: tests 16 and 22 fail.
  - The dump as `backup_reader` with the script's flags (`pg_dump` 17.12, a throwaway local login, removed afterwards): exit 0, 7,625 bytes, 14 `auth` tables, no `vault` line.
  - e2e was not run again: the change is one migration, one database test and documents.
- Local rehearsal on the local stack's database container (`pg_dump` and `psql` 17.12), with no `age` (not installed here):
  - With `pg_read_all_data` granted for the rehearsal and then revoked: the dump as `backup_reader`, with the script's flags, exits 0.
  - Into `supabase db reset --no-seed`, as `supabase_admin` with `session_replication_role=replica`: `BEGIN` plus the dump with no `COMMIT` left `auth.users` at 0. With `COMMIT`: 2 accounts, 1 admin, 1 lesson with its solution, and `restore check passed`. On an empty database the check fails with `auth.users is empty`.
  - As `postgres`: `permission denied to set parameter "session_replication_role"`.
  - A plaintext dump cut at 6,000 bytes, run with `--single-transaction`, committed 2 accounts. This is why psql's input never ends without age's success.
- Mutations:
  - A `COMMIT` sent whatever age did fails 2 restore tests.
  - Ending psql's input when age's output ends fails the 2 stream tests.
  - The end-to-end fake-process test did not catch that mutation, because which comes first is a race between two processes. The stream-level tests were added for that reason.
  - Removing `2>/dev/null` fails the credential test.
- Not verified:
  - A real nightly run: there is no key yet, and no environment values.
  - ADR-0030's test that runs the real job with a wrong password and checks its log.
  - `age` on a real ciphertext.
  - Everything on hosted Supabase: the role's rights, `session_replication_role` for `postgres`, and restoring `auth` rows as `postgres`.

## Reviews

Security review 8, two rounds (`docs/reports/reviews/WP-7.3/security-review-8.md`). Round 1: CHANGES REQUIRED, 4 MAJOR, 4 MINOR, all fixed in b68531d. Round 2: every fix correct; CHANGES REQUIRED, 1 MAJOR (ADR-0030 still described the old mechanism) and 4 MINOR, all answered in the last code commit. No round 3. No code review: the security reviewer read every line, and the scripts are operations code.

## Owner actions now due

1. Decision P: approved, option A. Done on this branch.
2. Once the migration is on production, `restore.md` section 2:
   - the age key pair, kept offline, and the public key's pull request;
   - the role's login and password, set with `\password` from the drill machine;
   - the heartbeat check: 1 day, 2 hours' grace;
   - the `production-backup` values: one variable, four secrets.
3. Then one green scheduled run, and its ping on the monitor.
4. The restore drill (`restore.md` section 3) and the rollback drill (`deploy-and-rollback.md`), each recorded with its time.
5. The owner actions of parts 1 to 5 are still due. Add this file to the pull request body: `cat docs/reports/pull-requests/WP-7.3-part-{1,2,3,4,5,6}.md`.

## Decisions taken by default

- **Q. The dump leaves out sessions, refresh tokens, codes, challenges and the audit log.** A restore must not bring back sessions revoked after the dump. Every learner signs in again after a restore anyway. The audit log holds addresses and IP addresses a restore does not need. Cost: after a restore, the audit log starts empty. Alternative: keep the audit log.
- **R. The connection's host and user are secrets, not variables, and the restore writes its own BEGIN and COMMIT.** Variables are printed in clear in the step's log header before any mask runs; psql's `--single-transaction` commits when its input ends for any reason. ADR-0030's text is amended on this branch to match, marked as proposed and not yet approved.

## Deviations from the plan or the spec

- Analytics (decision C) and the Deploy patch (decision E) still wait for the owner, as in parts 4 and 5.
- The plan's "Done when" items are the owner's: the drills, a green scheduled run, the alert after a silence, the uptime check, and usage notifications.

## Risks and rollback

The workflow cannot run until the owner fills `production-backup`. Its first step fails without the committed key, which does not exist yet. Rollback: revert the part 6 commits. The `backup_reader` role keeps no login until the owner gives it one.
