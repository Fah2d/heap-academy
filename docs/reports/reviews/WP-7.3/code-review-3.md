# Code review 3: WP-7.3 part 2, after the round 2 fixes

- Reviewer: `code-reviewer`, fresh context.
- Range: 1590d7b..abe78e3 on `wp/7.3-operations`.
- Date: 2026-11-24.

Verdict: CHANGES REQUIRED

## Round 2 findings

1. FIXED. `usage-spike-or-free-tier-limit.md:101` says the browser never talks to the database (`02-architecture.md` section 9) and treats Data API traffic not from Vercel as suspect.
2. FIXED on the runbook side: fast origin transfer and provisioned memory in section 0 and the table; missing triggers flagged. See new finding 2.
3. FIXED on the runbook side: "no code change" flagged with the reasons. Gaps: `02-architecture.md:139` makes the same claim and is not cited; WP-3.1 in the delivery plan never names `RUNTIME_ASSET_BASE_URL`. Both belong in the spec-change list.
4. PARTLY. Every listed item is marked with its work package; two checks are not (new finding 7).
5. to 13. FIXED (13 as flagged; no 09-evidence entry yet, as expected).

## New findings

1. **MAJOR**, `docs/runbooks/rotate-a-secret.md:40` (also `:58`, `:73`, `:103`, `:129`): section 1 is the only way to make a new production deployment, and it depends on **Re-run all jobs** of the latest Deploy run. GitHub allows a re-run only up to 30 days after the first run (not verified by this reviewer). `deploy.yml:17-19` triggers only on `push` to `main`; no `workflow_dispatch`. Step 4 forbids merging a pull request only to cause a deploy. So after a month with no merge, the routine rotations of the Vercel token, the Resend key and the publishable key, and the production database password check, cannot be finished. **Fix:** state the limit; name the fallback, e.g. propose `workflow_dispatch` for `deploy.yml` in the spec-change list, or say which path is allowed.
2. **MINOR**, `usage-spike-or-free-tier-limit.md:27`, `:30`, `:31`, `:39`: "None in ADR-0029" for origin transfer, provisioned memory and CDN requests, but ADR-0029 line 33 says "Any Vercel Hobby monthly figure passes 50 percent" before listing three. **Fix:** quote the ADR; say it lists three; leave the question to the spec-change list.
3. **MINOR**, `usage-spike-or-free-tier-limit.md:63`: static pages are not "the choice in ADR-0029"; they come from `07-operations.md` section 9.2. **Fix:** cite it.
4. **MINOR**, `rotate-a-secret.md:138`: firewall rules checked "against `infrastructure-setup.md` sections 5 and 6", which do not mention the firewall. **Fix:** check against `usage-spike-or-free-tier-limit.md` section 2.2 and WP-7.1.
5. **MINOR**, `rotate-a-secret.md:146`: the token's name, expiry and repository access are in `infrastructure-setup.md` section 8 step 2, not only step 3. **Fix:** "steps 1 to 3".
6. **MINOR**, `rotate-a-secret.md:82-86`: turning off the legacy keys is recorded only in a day report; a rebuild from `infrastructure-setup.md` would leave them on. **Fix:** add the step to `infrastructure-setup.md` section 2 and list it as an owner action.
7. **MINOR**, `usage-spike-or-free-tier-limit.md:88` and `:103`: "a lesson page loads" and "lessons already in the data cache" describe things that do not exist yet. **Fix:** mark each with its work package.
8. **MINOR**, `rotate-a-secret.md:107`, `:119`, `:174`: the exposure orders of sections 5, 6 and 10 are prose with unnumbered actions; section 5's exposure order never runs the after-removal check. **Fix:** a numbered list for each, including step 6 in section 5.

Outside the range: `infrastructure-setup.md:37` puts account deletion in WP-6.2; the delivery plan puts it in WP-6.3.

## What the reviewer ran

- `git log --format=fuller 1590d7b..abe78e3`: one commit, author and committer Fahad, no attribution.
- `pnpm --config.verify-deps-before-run=false verify` at abe78e3: exit 0, 31 files, 722 tests.
- Checked every job and step name against `.github/workflows/deploy.yml`, every reference into `infrastructure-setup.md`, `02-architecture.md` section 9 and line 139, `07-operations.md` sections 8 to 9.2, ADR-0029, ADR-0030, and the scope of WP-2.1, 2.2, 2.3, 3.1, 6.3 and 7.1.

Not checked: no vendor or GitHub documentation; no build or e2e (no code change).
