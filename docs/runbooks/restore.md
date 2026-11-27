# Runbook: backups and the restore drill

Owner only. The nightly backup of ADR-0030 (NFR-REL-05): how to set it up once, where its key lives, how to rotate the key, how to restore, and the drill that proves a restore works. Severity of a lost database follows `docs/spec/07-operations.md` section 8: it is an S1.

What runs each night, at 02:17 UTC on `main` (`.github/workflows/backup.yml`):

1. `scripts/backup.sh recipient` checks that the committed public key `ops/backup-recipient.age.pub` matches the `production-backup` environment's copy.
2. `scripts/backup.sh dump` connects as `backup_reader` through the session pooler and pipes `pg_dump` of the data of `public`, `private` and `auth` straight into `age`. No plaintext touches the runner's disk.
3. Only the ciphertext `backup.age` is uploaded, as the artifact `backup`, kept 7 days, and attested with `actions/attest-build-provenance`.
4. Last, the heartbeat monitor is pinged. If no ping comes for 26 hours, the monitor emails you.

The repository is public, so assume anyone can download every night's ciphertext and keep it forever. Only the private key makes it readable.

Never on the development machine, where Claude Code runs: creating the key, holding the private key, decrypting, restoring. Every step that touches the private key is on a separate machine where Claude Code is not installed (the drill machine).

## 1. Where the key lives

- **Private key** (the age identity file, `AGE-SECRET-KEY-1...`): offline only. Keep two copies: one on a USB stick used only for this, and one printed on paper, in a sealed envelope, in a different place from the stick. Never in a password manager that syncs, a cloud drive, an email, the repository, CI, or the development machine. Do not write where the two copies are in this repository: it is public.
- **Public key** (`age1...`): `ops/backup-recipient.age.pub` in the repository, and the variable `BACKUP_AGE_RECIPIENT` of the `production-backup` environment. Both must hold the same line, or the backup fails its first step.

Losing both copies of the private key makes every backup unreadable. Check once a quarter that the stick still reads (section 3 step 4 does that).

## 2. One-time setup

Do these in order. Until all are done, each nightly run fails at its first missing part, and GitHub emails you that it failed.

Start only once the migration `20261127010000_backup_reader_reads_all_data.sql` is on production (decision P of WP-7.3, ADR-0030). It makes `backup_reader` a member of `pg_read_all_data`. Without it, `pg_dump` stops at once with `permission denied for schema auth`. If the migration fails on production, stop here: `postgres` there lacks the right to grant that role, and ADR-0030 needs a new decision.

1. [ ] On the drill machine, install age (`brew install age` on macOS, `apt install age` on Ubuntu). Then run `age-keygen -o backup.key`. It prints `Public key: age1...`.
2. [ ] Copy `backup.key` to the USB stick, print it, and delete it from the drill machine. Keep the two copies as section 1 says.
3. [ ] Send the public key line to the development machine by any route (it is not secret). Open a pull request that adds it as the only line of `ops/backup-recipient.age.pub`, and merge it.
4. [ ] Generate a long random password in your password manager, saved as `production backup_reader password`. Production Supabase → **SQL Editor**: `alter role backup_reader with login;` (the role exists from the migration `20261124120000_backup_reader.sql`, without login until now, and reads through `20261127010000_backup_reader_reads_all_data.sql`). Then set its password from the drill machine, never in the SQL Editor, which keeps what you run in its history:
   `psql "postgresql://postgres.<prod-ref>@<pooler host>:5432/postgres?sslmode=require"` (psql asks for the `postgres` password; paste it from the password manager), then `\password backup_reader` and paste the new password twice. psql turns it into a hash on your machine before it sends it, and echoes nothing. `\q` to leave.
5. [ ] Production Supabase → **Connect** → **Session pooler**. Note the host (`aws-0-<region>.pooler.supabase.com`, or what the dialog shows) and the user's form, `postgres.<prod-ref>`. The backup's user is the same with the role's name: `backup_reader.<prod-ref>`.
6. [ ] Create the heartbeat check on Healthchecks.io's free plan. Use **Simple** schedule, period **1 day**, grace time **2 hours**: 26 hours of silence then emails you. Copy its ping address.
7. [ ] GitHub → **Settings → Environments →** `production-backup`. Deployment branches: `main` only (from `infrastructure-setup.md` section 7 step 3). Then add:
   - **Environment variables**: `BACKUP_AGE_RECIPIENT` = the public key line. It is public, and the run prints it.
   - **Environment secrets**: `BACKUP_DB_HOST` = the pooler host; `BACKUP_DB_USER` = `backup_reader.<prod-ref>`; `BACKUP_DB_PASSWORD` = the password of step 4; `BACKUP_HEARTBEAT_URL` = the ping address of step 6. The host and the user are secrets so that the public log shows them as `***`: a run prints each step's variables in clear before the step starts. The ping address works like a password: anyone who has it can make a dead backup look alive.
8. [ ] Run `pnpm infra:verify` (`infrastructure-setup.md` section 7 step 7). It checks that `production-backup` deploys from `main` only.
9. [ ] The next morning: **Actions → Backup** shows a green scheduled run, with one artifact, `backup`. The heartbeat check shows a ping from that run's time. Paste both in the WP-7.3 pull request.

The workflow has no manual trigger on purpose: the restore accepts only a scheduled run. To try a change, merge it and wait for the night.

GitHub turns off scheduled workflows in a public repository after 60 days without activity in it (E-25, not verified). The heartbeat monitor tells you when that happens. Turn the workflow on again under **Actions → Backup → Enable workflow**.

## 3. The restore drill

Required once before launch (NFR-REL-05), then once a quarter. It restores a real nightly backup into a throwaway local database, checks it, and destroys it. Record the time each step took.

The drill machine needs: Docker, the Supabase CLI, Node.js 24, the newest `gh` release signed in to your GitHub account (it unpacks the artifact before the provenance check, so take its latest fixes), `age`, and `psql` 17.6 or later (the nightly `pg_dump` comes from the PostgreSQL project's newest 17 release). It must not have Claude Code installed.

1. [ ] Note the start time.
2. [ ] Clone the repository on the drill machine, at `main`. Run `supabase start`, then `supabase db reset --no-seed`. The local database now has every migration and no rows, which is what the restore expects.
3. [ ] Find the newest successful scheduled backup:
   `gh run list -R <owner>/<repo> --workflow backup.yml --event schedule --branch main --status success --limit 1 --json databaseId,createdAt`
   Note its `databaseId` (the run ID) and `createdAt` (the dump's time).
4. [ ] Plug in the USB stick. Copy the key file to the drill machine's home folder and run `chmod 600 ~/backup.key`. The restore refuses a key others can read.
5. [ ] Restore:
   `node scripts/restore.mjs --repo <owner>/<repo> --run <run ID> --key ~/backup.key --target postgresql://supabase_admin@127.0.0.1:54322/postgres`
   psql asks for the password: the local stack's is `postgres`. The script refuses a target that holds a password, because a command line stays in the shell's history. It checks the run (workflow file, scheduled, `main`, this repository, succeeded), downloads the artifact, checks its provenance with `gh attestation verify`, and only then pipes `age -d` into psql, inside a transaction it commits only once age has finished cleanly. Any refusal names its reason and decrypts nothing. A restore that stops, for any reason, commits nothing. The local `supabase_admin` role is used because the restore turns triggers off for its session (`session_replication_role=replica`), which needs it.
   The backup holds no sessions, refresh tokens, sign-in codes or audit log (`scripts/backup.sh`), so the restored database has none.
6. [ ] Verify, with a lesson you know is published:
   `psql -v ON_ERROR_STOP=1 -v lesson=<a published lesson's slug> -f scripts/restore-verify.sql postgresql://postgres@127.0.0.1:54322/postgres` (the password is `postgres` here too)
   It prints the row counts and ends with `restore check passed`, or fails with the reason. Compare the counts with production: Supabase production → **SQL Editor**, the first query of `scripts/restore-verify.sql` (the counts only). Rows made after the dump's time are expected to differ.
7. [ ] Re-apply deletions (section 5) against the local database, as practice.
8. [ ] Destroy it: `supabase stop --no-backup`, which deletes the local database's volumes. Check with `docker volume ls` that no volume of this project is left. Delete `~/backup.key` and the clone. Unplug the stick.
9. [ ] Note the end time. Record the drill in section 8 of this file, by a pull request: the date, the run ID, the counts of `auth.users` and `public.lessons`, and the minutes each of steps 2 to 8 took. Record no row's content.

## 4. A real restore

When production's data is lost or corrupted. It is an S1: write the incident report as you go (`07-operations.md` section 8).

Not rehearsed: only the restore of section 3 into a local database has been run, with the local `supabase_admin`. Two facts this section rests on are not verified on hosted Supabase: that `postgres` may write the `auth` tables' rows, and that it may set `session_replication_role` (Supabase's own migration guide sets it). On the local stack, `postgres` may not: `permission denied to set parameter "session_replication_role"`. If psql refuses either, nothing is committed: stop and ask the implementer to adapt the restore.

1. [ ] Note the time. The site has no maintenance mode: progress learners save from now until the restore ends is lost, and their devices keep it and send it again (ADR-0011).
2. [ ] Find the newest good backup: section 3 steps 1 to 6 on the drill machine, which also proves it restores.
3. [ ] Create a new Supabase project and set it up by `infrastructure-setup.md` sections 2, 4 and 10, so its database is empty. Run the migrations into it: point the `production` environment's `SUPABASE_DB_URL` at it (`rotate-a-secret.md` section 2 steps 4 and 5) and re-run the latest Deploy run. Restoring into the old project's database, over its rows, is not covered here: its rows would collide with the backup's.
4. [ ] On the drill machine, section 3 steps 3 to 5, with `--target` being the new project's session pooler URL as `postgres`, with `?sslmode=require` and no password in it: `postgresql://postgres.<new-ref>@<pooler host>:5432/postgres?sslmode=require`. psql asks for the password; paste it from the password manager.
5. [ ] Section 3 step 6 against the new project, then section 5 against it, which is not practice this time.
6. [ ] Point the site at the new project: Vercel's Supabase variables (`infrastructure-setup.md` section 5), then `rotate-a-secret.md` section 1. Every learner signs in again.
7. [ ] Section 3 step 8: delete the key from the drill machine.

## 5. Re-apply deletions

A restore brings back every account deleted after the dump. Each account deletion emailed you its user ID and nothing else (ADR-0030).

1. [ ] In your inbox, find every deletion email sent after the dump's time (section 3 step 3's `createdAt`).
2. [ ] For each, in the restored database: `delete from auth.users where id = '<user ID>';`. The account's profile, completions and admin row go with it (`on delete cascade`).
3. [ ] Check the app's logs (Vercel → **Logs**) since the dump's time for `POST /actions/delete-account` with `error:deletion-unclear` or `error:deletion-notice`. Each is a deletion whose email may not have been sent. Its time is in the log line; the account is not. Compare `auth.users` in the restored database with production's, if production still answers, to find it. If production does not answer, record in the incident report that such an account may have come back.
4. [ ] Deletions requested by email (`deletion-request.md`) are in your inbox the same way.

## 6. Rotate the backup key

Rotating does not protect backups already taken: anyone who downloaded one keeps it. Rotate when a copy of the private key may have been seen, lost, or copied, and when a person or machine that held it should no longer hold it.

Routine (the key is not exposed):

1. [ ] Section 2 steps 1 and 2 for a new key pair. Label the new copies with the date, so they are never confused with the old ones.
2. [ ] Open the pull request that replaces the line in `ops/backup-recipient.age.pub`. Before 02:17 UTC on the day you merge it, merge it, then at once replace `BACKUP_AGE_RECIPIENT` in `production-backup` with the new line. If the two differ at 02:17, that night's backup fails, and GitHub emails you.
3. [ ] The next morning: a green run, encrypted to the new key. Restore it in a drill (section 3) with the new key.
4. [ ] Keep the old key's two copies for 8 more days, until every backup encrypted to it has expired. Then destroy both: wipe the stick's file and shred the paper.

Exposure (the private key may be in someone else's hands):

1. [ ] It is an S1. Every backup taken with that key, including any copy downloaded earlier, can be read. That is a possible breach of learner data: record it in the incident report and take it to the person of `06-security-privacy.md` section 8 open question 6.
2. [ ] Routine steps 1 and 2 at once, not waiting for the night's run.
3. [ ] **Actions → Backup** → each run of the last 7 days → delete its artifact. This stops new downloads; it does not recall old ones. The newest backup you can restore is now the next night's.
4. [ ] Destroy the old key's copies after the next green run.

## 7. When the backup fails

- **A failed run**: GitHub emails you. Open the run. The step that failed names the cause: the recipient check (the two key copies differ; section 2 step 7), the dump (the password, the host, the user, or Supabase is down; the log never names them), the upload or the attestation (GitHub; it retries the next night), or the heartbeat (the ping address; the backup itself succeeded).
- **The heartbeat monitor emails you**: no run pinged it for 26 hours. Check **Actions → Backup**: no run at all means the schedule is off (section 2, last paragraph) or GitHub dropped it; a failed run is the case above.
- Two nights without a green run: run the drill's steps 3 to 6 on the newest good backup, so you know it is sound, and fix the cause the same day.

Rotate the backup's password and ping address by `rotate-a-secret.md` sections 10 and 11.

## 8. Drill record

NFR-REL-05 needs one drill before launch. Newest first.

| Date | Run ID | `auth.users` | `public.lessons` | Minutes, steps 2 to 8 | Result |
|---|---|---|---|---|---|

No drill has been done yet. The first needs section 2 done and one green scheduled run.
