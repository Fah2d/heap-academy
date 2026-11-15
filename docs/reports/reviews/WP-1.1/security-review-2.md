# security-reviewer, pass 2 (WP-1.1)

Range: `9ec972d..127f523`. Result: **CHANGES REQUIRED**. No BLOCKER, 4 new MAJOR, 9 MINOR.

Of the eleven findings from pass 1, seven are resolved and three are partly fixed (3, 6, 7). Finding 5 is resolved except for two wording leftovers, which MINOR 1 below covers.

## MAJOR

1. The counter function could be reached through the Data API with a key the caller chooses, which bypasses the firewall. **Fixed**: the client address is sent with an HMAC made from a server-only secret and checked against Supabase Vault. Tests cover a direct call as anonymous and as a learner, and policy tests cover four roles.
2. The recipient fingerprint was compared with a value from the same environment, so the check compared the key with itself. **Fixed**: the recipient key is committed at `ops/backup-recipient.age.pub` and compared with the environment's copy. The implementer's token permissions are listed.
3. The freshness check needed a person to run it. **Fixed**: a heartbeat monitor on a free tier emails the owner after 26 hours of silence.
4. `backup_reader` was untested. **Fixed**: the role has `SELECT` and `BYPASSRLS`, which are accepted and stated, no write rights, no role membership, and no Data API access. A database test pins each of these.

## MINOR

1. Restore drill wording. **Fixed**: the drill runs on a separate machine only, and `age -d` is piped into `psql`.
2. Deletions had no durable record to replay. **Fixed**: each deletion emails the owner the deleted user ID and nothing else.
3. Attestation flags. **Fixed**: `--signer-workflow`, `--source-ref`, `--deny-self-hosted-runners`, and a match on the workflow's file path.
4. Staging credentials had no defined home. **Fixed**: a `staging` environment limited to `main`, and no repository-level secrets.
5. Interaction limits expire. **Fixed**: `infra:verify` checks the limit, and the runbook renews it.
6. The scan did not cover `refs/pull/*`. **Fixed.**
7. Two values for the email cap. **Fixed**: 20 an hour.
8. Contradictory wording in T-14. **Fixed.**
9. `pg_dump` and `supabase db dump` were both named. **Fixed**: `pg_dump` is named, with the `auth` schema included.
