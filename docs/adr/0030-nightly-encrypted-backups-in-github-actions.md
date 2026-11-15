# ADR-0030: Nightly encrypted backups in GitHub Actions

- Status: Accepted (owner, WP-1.1, 2026-11-15)
- Decision due: Day 1 (WP-1.1). Built and proven by the restore drill in WP-7.3.
- Date proposed: 2026-11-15
- Decider: the owner
- Relates to: NFR-REL-05, T-12, T-17, T-24; ADR-0029

## Context

Supabase Free takes no automatic backups (E-24), and the repository is public (ADR-0029). GitHub's documentation does not confirm who can download workflow artifacts in a public repository (E-25). This record therefore assumes that anyone can. The database holds learner email addresses and the owner's solutions.

## Decision

- A scheduled workflow runs once a night. It dumps the production database with `supabase db dump` (pg_dump) through the Supavisor session pooler, because the direct connection on the free plan is IPv6 only and the pooler is IPv4 (E-24). It produces a schema dump and a data dump.
- The dumps are encrypted with `age` to the owner's public key on the runner, before any upload. Only the ciphertext is uploaded, as a workflow artifact with a 7-day retention. The plaintext never leaves the runner, and the job never prints it.
- The owner's private key never enters the repository, CI, or the implementer's machine. The owner keeps it offline.
- The database password is a secret of a protected `production-backup` environment, which only the scheduled workflow on `main` may use.
- The job fails loudly: a failed run emails the owner through GitHub's notifications.
- The restore drill in WP-7.3 decrypts the latest artifact, restores it into the local stack, and runs the verification script. A backup that has never been restored is not a backup.

## Consequences

- Gain: A daily backup on a free plan, kept 7 days, as NFR-REL-05 requires.
- Gain: A downloaded artifact is useless without the owner's private key.
- Cost: The recovery point is up to 24 hours. There is no point-in-time recovery.
- Cost: Losing the private key makes every backup unreadable. The restore runbook says where the owner keeps it and how to rotate it.
- Cost: Each dump counts against the 5 GB egress allowance, and the artifacts against the 500 MB of free storage. The day check watches both.
- Cost: Whether GitHub's hosted runners reach the session pooler reliably is not verified. WP-7.3 proves it.

## Alternatives considered

- **Supabase Pro backups.** Seven daily backups with no work, for 25 US dollars a month. Declined for zero cost.
- **An encrypted copy in a free object store.** Offered. It needs one more account and one more secret, for more storage than this needs.
- **Unencrypted artifacts.** In a public repository, that would publish learner data.

## Evidence

E-24, E-25 in `docs/spec/09-evidence.md`.

## Revisit when

Production moves to Supabase Pro, the dump passes 50 MB, or a restore drill fails.
