# security-reviewer, pass 1 (WP-1.1)

Range: `main..9ec972d`. Result: **CHANGES REQUIRED**. 1 BLOCKER, 10 MAJOR, 7 MINOR.

## BLOCKER

1. ADR-0030:20 and 07:106. The restore loaded "the latest artifact". A fork pull request can upload an artifact encrypted to the public key, and `age` proves nothing about who encrypted a file, so a planted dump could add an `admins` row. **Fixed**: the restore accepts only an attested artifact from a scheduled run of `backup.yml` on `main`, checked before decryption, with a test that it refuses any other run.

## MAJOR

2. Deliberate free-tier exhaustion was missing from T-14. **Fixed**: T-25. The rate-limit rule covers every path, Attack Challenge Mode is in the runbook, `anon` grants are limited, and email is capped at 20 an hour. The owner accepted the remaining risk in writing.
3. The Postgres counters had no policy or test. **Fixed** in T-14: deny by default, a `security definer` function, keyed on the platform's client address, pruned, and policy tests.
4. Production credentials in `production-backup` contradicted T-18, section 5.5, and `ci.md`, and the branch rule could not be enforced. **Fixed**: both environments allow `main` only, a CI check limits who names `production-backup`, the backup uses a read-only role, and `infra:verify` checks the policies.
5. The restore drill decrypted onto the development machine. **Fixed**: the drill runs on a machine or user without Claude Code, and the plaintext is destroyed afterwards.
6. T-24 left out recipient integrity, public logs, and retention. **Fixed**: the recipient is pinned with a fingerprint check, `pg_dump | age` writes nothing in plaintext, credentials are masked with a test, and the text states that retention is not a confidentiality control.
7. Backups could stop without a failed run. **Fixed**: a freshness check for 26 hours. The 60-day rule is noted in E-25 as not verified.
8. The repository would go public before a scan of its history. **Fixed**: WP-1.3 scans with `gitleaks` over all branches first, and secret scanning, push protection, private vulnerability reporting, and `SECURITY.md` are on.
9. Fork pull request controls stopped at `pull_request_target`. **Fixed**: banned triggers, no caches or artifacts from credentialed jobs, approval for outside contributors, and GitHub-hosted runners only.
10. Previews and staging were public. **Fixed**, by the owner's choice: Vercel Authentication on previews, Fork Protection, and a staging seed with no admin row. In-app checks move to production or to a shareable link.
11. Untrusted text could reach an agent that holds the owner's token. **Fixed**: the implementer reads only the owner's content, Issues, Discussions, and the wiki are off, and the token is fine-grained.

## MINOR

- E-14 title, and the stale E-22 note. **Fixed.**
- The dump might not include `auth`. **Fixed**: the dump scope includes `auth`, and the verification script counts `auth.users`.
- A restore brings back deleted accounts. **Fixed**: the runbook re-applies deletions.
- Log retention on Hobby and on Supabase Free, and over-quota behavior. **Not addressed**: not verified, and left for WP-1.3 and WP-7.1.
- A wildcard preview redirect pattern. **Fixed**: pinned to the project prefix.
- `SECURITY.md` and private vulnerability reporting. **Fixed** (WP-1.3).
- ADR-0029 "Relates to". **Fixed.**
