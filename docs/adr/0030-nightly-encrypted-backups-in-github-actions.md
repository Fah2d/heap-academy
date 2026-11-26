# ADR-0030: Nightly encrypted backups in GitHub Actions

- Status: Accepted (owner, WP-1.1, 2026-11-15)
- Decision due: Day 1 (WP-1.1). Built and proven by the restore drill in WP-7.3.
- Date proposed: 2026-11-15
- Decider: the owner
- Relates to: NFR-REL-05, T-12, T-17, T-18, T-20, T-24; ADR-0029

## Context

Supabase Free takes no automatic backups (E-24), and the repository is public (ADR-0029). GitHub's documentation does not confirm who can download workflow artifacts in a public repository (E-25), so this record assumes anyone can. Anyone who can open a pull request can also upload an artifact from a workflow run, and `age` proves nothing about who encrypted a file. The database holds learner email addresses and the owner's solutions.

## Decision

**Taking the backup**

- A scheduled workflow, `backup.yml`, runs once a night on `main`. It connects through the Supavisor session pooler, because the direct connection on the free plan is IPv6 only and the pooler is IPv4 (E-24). It connects as a dedicated role, `backup_reader`, not as `postgres`. The role has `SELECT` only, on `public`, `private`, and `auth` and on nothing in `vault`, and `BYPASSRLS`, because a dump must read every row; bypassing row level security is needed and accepted for this role alone. It has no `INSERT`, `UPDATE`, `DELETE`, or `TRUNCATE` anywhere, is not a member of `postgres`, `authenticator`, or `service_role`, has `EXECUTE` revoked on every function in `public` and `private`, and is not reachable through the Data API. A database test pins each of these.
- The dump is made with `pg_dump` (the tool `supabase db dump` wraps), with flags that include the `auth` schema, and is piped straight into `age` (`pg_dump … | age -r "$BACKUP_AGE_RECIPIENT" > backup.age`). Plaintext never touches the runner's disk. The dump includes the `auth` schema (users, identities, authenticator factors), so a restore keeps accounts and the admin's second step.
- The recipient public key is committed to the repository at `ops/backup-recipient.age.pub`. A public key is not secret, and changing it needs a reviewed pull request to `main`. The job encrypts only to that committed key, and checks it against the copy in the `production-backup` environment; a mismatch fails the run. After it encrypts, the job checks that every file starts with `age-encryption.org/v1`. Either check failing fails the run.
- Workflow logs in a public repository are public. The job takes the connection's parts (host, user, password) as separate secrets of `production-backup`, so the log shows each as `***`, from the step's header on, where variables are printed in clear. It never uses `set -x`, and never prints a connection string or `pg_dump`'s messages. A test runs the job against a deliberately wrong password and asserts the log contains no credential.
- Only the ciphertext is uploaded, as an artifact with a 7-day retention. The job writes no cache and uploads nothing else.
- The job attests the artifact with `actions/attest-build-provenance`.

**Who can reach the credentials**

- The database password of `backup_reader` is a secret of the `production-backup` environment. The environment's deployment branch policy allows `main` only.
- A CI check fails any workflow other than `backup.yml` that names `production-backup`.
- `pnpm infra:verify` checks the branch policy of `staging`, `production`, and `production-backup`.

**Restoring**

- The restore script accepts only an artifact whose run is `backup.yml`, `event == schedule`, `head_branch == main`, in this repository, matched by the workflow's file path, not its display name, and whose provenance passes `gh attestation verify --repo OWNER/REPO --signer-workflow OWNER/REPO/.github/workflows/backup.yml --source-ref refs/heads/main --deny-self-hosted-runners`. It checks this before it decrypts. A test shows it refuses an artifact from any other run.
- The owner decrypts with the private key, which never enters the repository, CI, or the implementer's machine. The owner keeps it offline.
- The restore drill runs on a separate machine where Claude Code is not installed, never on the development machine. `age -d` is piped straight into `psql -v ON_ERROR_STOP=1`, between a `BEGIN` the restore script writes first and a `COMMIT` it writes only after `age` exits cleanly, so no plaintext file is written, and a cut-off stream, a failed decryption, or the script dying leaves nothing restored. `--single-transaction` is not used: psql commits whenever its input ends. The key file has mode `0600`, and the database URL holds no password. Afterwards the database volume is destroyed.
- The verification script counts rows in `auth.users`, the content tables, and `admins`, and checks one known lesson and the policies.
- A restore brings back accounts deleted after the dump. Each account deletion therefore emails the owner the deleted user ID and nothing else, through Resend with the server-only `RESEND_API_KEY`, a record that survives the loss of the database. The owner deletes each such email after 8 days, once every backup that could hold the account has expired. The deletion itself never waits on the email: if the send fails, the account is still deleted, the failure is logged by request ID with no personal data, and the runbook says a restore in that window must be checked by hand. The runbook re-applies every deletion dated after the dump.

**Knowing it still runs**

- A failed run emails the owner through GitHub's notifications.
- Scheduled runs can be delayed, dropped, or turned off after 60 days without repository activity (E-25, not verified), all without a failed run. A dead-man's switch covers this: `backup.yml` pings a heartbeat monitor on a free tier (Healthchecks.io, or the uptime service if it offers heartbeats), which emails the owner after 26 hours of silence. The ping URL works like a password, so it is a masked secret of `production-backup`, never written in a file or a log, and it is pinged only as the last step, after the upload and the attestation succeed.

Amendment proposed on 2026-11-26 (WP-7.3 part 6, decisions Q and R; not yet approved by the owner): the connection's parts are secrets rather than masked variables, and the restore writes its own `BEGIN` and `COMMIT` instead of `--single-transaction`. Both follow the part 6 security review; the local rehearsal committed rows from a plaintext dump cut at 6,000 bytes under `--single-transaction`. The dump also leaves out the data of sessions, refresh tokens, sign-in codes, challenges and the audit log, which a restore must not bring back. Still open, decision P: `backup_reader` cannot use the `auth` schema on the local stack, because `postgres` holds `USAGE` on it without the grant option; the role as decided above cannot be made there.

## Consequences

- Gain: A daily backup on a free plan, kept 7 days, as NFR-REL-05 requires.
- Gain: A downloaded artifact is useless without the owner's private key, and a planted artifact is refused before decryption.
- Cost: Retention is not a confidentiality control. Anyone can download each night's ciphertext and keep it forever. Rotating the key does not protect old ciphertext, so the safety of every past backup rests on the private key never leaking.
- Cost: The recovery point is up to 24 hours. There is no point-in-time recovery.
- Cost: Losing the private key makes every backup unreadable. The restore runbook says where the owner keeps it and how to rotate it.
- Cost: Each dump counts against the 5 GB egress allowance, and the artifacts against the 500 MB of free storage. The day check watches both.
- Cost: Not verified: whether GitHub's hosted runners reach the session pooler reliably, and whether a custom role on Supabase Free can be given `BYPASSRLS` and read access to `auth`. WP-7.3 proves both; if the role cannot be made, the owner decides before the backup is built.

## Alternatives considered

- **Supabase Pro backups.** Seven daily backups with no work, for 25 US dollars a month. Declined for zero cost.
- **An encrypted copy in a free object store.** Offered. It needs one more account and one more secret, for more storage than this needs.
- **Unencrypted artifacts.** In a public repository, that would publish learner data.
- **Signing with a private key in `production-backup` instead of provenance attestation.** Works too, at the cost of one more secret.

## Evidence

E-24, E-25 in `docs/spec/09-evidence.md`.

## Revisit when

Production moves to Supabase Pro, the dump passes 50 MB, or a restore drill fails.
