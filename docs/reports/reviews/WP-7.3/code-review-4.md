# Code review 4: WP-7.3 part 2, after the round 3 fixes

- Reviewer: `code-reviewer`, fresh context.
- Range: abe78e3..2ce4040 on `wp/7.3-operations`.
- Date: 2026-11-24.

Verdict: CHANGES REQUIRED

## Round 3 findings

1 to 8: all FIXED. The outside-range note (WP-6.2 for account deletion) is also fixed.

## New findings (2ce4040 only)

- **MAJOR**, `rotate-a-secret.md:41`: the case "failed before its **Deploy** step" also covers a `production` approval rejected on purpose and a failed migration. In the rejected case the re-run ships a commit you declined, against the section's title. Only a failure at **Remember the deployment production serves** has to ship, because the production migrations already ran (`deploy.yml:91-97`). **Fix:** limit the case to that step; stop for any other failure.
- **MAJOR**, `rotate-a-secret.md:162`: "**Instant Rollback** to the last one you did" contradicts `:48` (Hobby rolls back only to the previous production deployment). If the attacker deployed twice, yours cannot be reached, and section 1 step 2 then stops because **Current** is the attacker's commit, so there is no working path while attacker code serves production. **Fix:** state the limit and name the path, e.g. re-run the Deploy run of the commit you last shipped, skipping section 1 step 2's check in this case.
- **MINOR**, `rotate-a-secret.md:94`: "the infrastructure runbook never disabled them" is now false (`infrastructure-setup.md:38`); the description line 57 says the same. **Fix:** "before 2026-11-24 ... did not"; earlier projects still need section 4 steps 1 to 3.
- **MINOR**, `rotate-a-secret.md:78`: identity comes from `getClaims()` (`02-architecture.md:353`), which verifies the signature locally, so a stolen access token keeps working until it expires. **Fix:** say so; to cut them at once, also do section 4 step 7.
- **MINOR**, `rotate-a-secret.md:68-74`: the function and RLS queries look only at `public` and `private`. **Fix:** add `select nspname from pg_namespace order by 1;`.
- **MINOR**, `rotate-a-secret.md:44`: the 30-day and 50-run limits have no source and are not under "Not confirmed". **Fix:** cite GitHub's page on re-running workflows, or list them as not confirmed.

Cross-references: every "section N step M" reference inside `rotate-a-secret.md`, into `infrastructure-setup.md`, and from other files into `rotate-a-secret.md` checks out; the step names and the concurrency group match `deploy.yml`.

## What the reviewer ran

`git log --format=fuller abe78e3..2ce4040` (one commit, Fahad, no attribution); the diff; `rotate-a-secret.md` in full; `deploy.yml`, `infrastructure-setup.md`, ADR-0029 lines 30-36, WP-4.1, 5.1, 5.2, `02-architecture.md:353` and `:413`. `pnpm --config.verify-deps-before-run=false verify` at 2ce4040 five times: the first exited 1 with a vitest CLI stack trace whose cause was not kept; the other four exited 0 (31 files, 722 tests). The commit changes only documents; the failure is not explained.

Not checked: vendor or GitHub documentation; no SQL was run.
