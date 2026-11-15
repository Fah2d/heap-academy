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

- A scheduled workflow, `backup.yml`, runs once a night on `main`. It connects through the Supavisor session pooler, because the direct connection on the free plan is IPv6 only and the pooler is IPv4 (E-24). It connects as a dedicated read-only role, `backup_reader`, not as `postgres`.
- The dump is piped straight into `age` (`pg_dump … | age -r "$BACKUP_AGE_RECIPIENT" > backup.age`). Plaintext never touches the runner's disk. The dump includes the `auth` schema (users, identities, authenticator factors), so a restore keeps accounts and the admin's second step.
- The recipient public key is a variable of the `production-backup` environment, not a file in the repository. Before it encrypts, the job checks that the key's SHA-256 fingerprint matches the one recorded in the environment. After it encrypts, the job checks that every file starts with `age-encryption.org/v1`. Either check failing fails the run.
- Workflow logs in a public repository are public. The job builds the connection settings from separate parts, masks each derived value with `::add-mask::`, never uses `set -x`, and never prints a connection string. A test runs the job against a deliberately wrong password and asserts the log contains no credential.
- Only the ciphertext is uploaded, as an artifact with a 7-day retention. The job writes no cache and uploads nothing else.
- The job attests the artifact with `actions/attest-build-provenance`.

**Who can reach the credentials**

- The database password of `backup_reader` is a secret of the `production-backup` environment. The environment's deployment branch policy allows `main` only.
- A CI check fails any workflow other than `backup.yml` that names `production-backup`.
- `pnpm infra:verify` checks the branch policy of both `production` and `production-backup`.

**Restoring**

- The restore script accepts only an artifact whose run is `backup.yml`, `event == schedule`, `head_branch == main`, in this repository, and whose provenance passes `gh attestation verify`. It checks this before it decrypts. A test shows it refuses an artifact from any other run.
- The owner decrypts with the private key, which never enters the repository, CI, or the implementer's machine. The owner keeps it offline.
- The restore drill runs on a machine, or a separate operating-system user, where Claude Code is not installed. Afterwards the plaintext and the database volume are destroyed.
- The verification script counts rows in `auth.users`, the content tables, and `admins`, and checks one known lesson and the policies.
- A restore brings back accounts deleted after the dump. The runbook re-applies deletions made since the dump's date.

**Knowing it still runs**

- A failed run emails the owner through GitHub's notifications.
- Scheduled runs can be delayed or dropped without a failed run. A freshness check alerts when the newest attested artifact from a scheduled run on `main` is more than 26 hours old. It runs in the morning review and in every day check.

## Consequences

- Gain: A daily backup on a free plan, kept 7 days, as NFR-REL-05 requires.
- Gain: A downloaded artifact is useless without the owner's private key, and a planted artifact is refused before decryption.
- Cost: Retention is not a confidentiality control. Anyone can download each night's ciphertext and keep it forever. Rotating the key does not protect old ciphertext, so the safety of every past backup rests on the private key never leaking.
- Cost: The recovery point is up to 24 hours. There is no point-in-time recovery.
- Cost: Losing the private key makes every backup unreadable. The restore runbook says where the owner keeps it and how to rotate it.
- Cost: Each dump counts against the 5 GB egress allowance, and the artifacts against the 500 MB of free storage. The day check watches both.
- Cost: Not verified: whether GitHub's hosted runners reach the session pooler reliably, and whether `supabase db dump` with the chosen flags includes the `auth` schema. WP-7.3 proves both.

## Alternatives considered

- **Supabase Pro backups.** Seven daily backups with no work, for 25 US dollars a month. Declined for zero cost.
- **An encrypted copy in a free object store.** Offered. It needs one more account and one more secret, for more storage than this needs.
- **Unencrypted artifacts.** In a public repository, that would publish learner data.
- **Signing with a private key in `production-backup` instead of provenance attestation.** Works too, at the cost of one more secret.

## Evidence

E-24, E-25 in `docs/spec/09-evidence.md`.

## Revisit when

Production moves to Supabase Pro, the dump passes 50 MB, or a restore drill fails.
