# Code review 2: WP-7.3 part 2

- Reviewer: `code-reviewer`, fresh context.
- Range: 9638f9a..1590d7b on `wp/7.3-operations` (the two runbooks).
- Date: 2026-11-24.

Verdict: CHANGES REQUIRED

1. **MAJOR**, `docs/runbooks/usage-spike-or-free-tier-limit.md:89`: Section 3.2 step 2 says "the browser reads the database directly for progress". That contradicts `docs/spec/02-architecture.md:332`, which says "The browser never talks to the database" (ADR-0027). It also points the diagnosis the wrong way. Because the browser never calls the Data API, any Data API traffic that does not come from the app server is suspect: the publishable key is public, so someone can call the API directly (T-25). **Fix:** delete the parenthesis. Say that progress reads go through the app server. Then tell the owner to look in the API logs for Data API calls from addresses that are not Vercel's.

2. **MAJOR**, `docs/runbooks/usage-spike-or-free-tier-limit.md:22-33` and `:13`: The figures table and the first-five-minutes list leave out Fast Origin Transfer. E-23 records it as 10 GB a month on Hobby. Every page renders per request (ADR-0028), and every page response counts toward origin transfer. The limit is a tenth of the 100 GB transfer allowance, so it may be the first Hobby limit reached. The table does include CDN requests, which E-23 does not mention. ADR-0029 and `07-operations.md` section 9 also have no trigger for origin transfer, and decision D in the part-2 description does not mention it. **Fix:** add the row (10 GB, E-23, "Not in ADR-0029", every page) and the figure to section 0 step 2. Add it to the spec-change list so a trigger can be set. 360 GB-hours of provisioned memory (E-23) is also missing; either list it or say why it is left out.

3. **MAJOR**, `docs/runbooks/usage-spike-or-free-tier-limit.md:57`: "That needs a pull request and a deploy" contradicts two spec lines. `02-architecture.md:139` says the files can move "without a code change", and `07-operations.md:180` says "No code change." The drift is real, not a typo: moving runtime files to another origin probably needs a script policy change (ADR-0021/0028: `worker-src`, `script-src 'self'`), which is code. Decision D does not mention it. Also, `RUNTIME_ASSET_BASE_URL` does not exist yet: `src/runtime/` is empty, and the name is not in `.env.example` or `src/infrastructure/env/schema.ts`. The runbook does not say which package adds it. **Fix:** add this to the spec-change list (ADR-0029, 02 section 6, 07 section 9.2), and say which work package adds the variable.

4. **MAJOR**, the check steps cannot be done today, and nothing marks them as later. The part-2 description says both runbooks cover things that exist on `main`. These checks depend on things that are not built:
   - `docs/runbooks/rotate-a-secret.md:54` (request a sign-in code) and `:66-67` (sign in with Google). `src/features/auth/` holds only `.gitkeep`, so sign-in arrives in WP-2.2.
   - `docs/runbooks/rotate-a-secret.md:47` and `docs/runbooks/usage-spike-or-free-tier-limit.md:96`: "the deletion record emails" do not exist yet. Nothing in `src` uses `RESEND_API_KEY` except the env schema. They come with account deletion (WP-6.3) and the email in a later part of WP-7.3.
   - `docs/runbooks/usage-spike-or-free-tier-limit.md:83` (and the `/api/health` line at `:15`): `pnpm infra:verify` passing does not show that the database is back. `src/features/system/server/health.ts:6-8` says the database check joins in WP-2.1. "You can sign in" is not possible yet either.
   - `docs/runbooks/usage-spike-or-free-tier-limit.md:42,49`: the WP-7.1 rate-limit rule is described as if it already runs ("what the rate-limit rule (WP-7.1) is already stopping"). WP-7.1 is not done, and `vercel.json` holds only the Git setting.
   - `docs/runbooks/usage-spike-or-free-tier-limit.md:15`: "the uptime monitor" is an owner action still due in WP-7.3.

   **Fix:** mark each of these with the work package that brings it. Where a rotation can be needed today, give a check that works today, or say plainly that none exists until that package.

5. **MINOR**, `docs/runbooks/usage-spike-or-free-tier-limit.md:31` with `:18`: The pause row says what stops is "sign-in, progress, the dashboard". Lessons and the catalog live in the database (ADR-0024, `02-architecture.md:45`), so any lesson that is not cached also fails. That makes a pause an S1 under section 0 step 4, not an S2. **Fix:** list lessons in the "what stops" column, and say a pause is an S1.

6. **MINOR**, `docs/runbooks/rotate-a-secret.md:72`: "Without it, deploys fail at the build step" is wrong. In `.github/workflows/deploy.yml:96-122`, the token is first used in "Remember the deployment production serves", which runs after "Apply migrations to production". An expired token therefore fails there, with production migrations already applied. **Fix:** name the right step and say the migrations will already have been applied. This matches the `deploy-and-rollback.md` table row for that step.

7. **MINOR**, `docs/runbooks/rotate-a-secret.md:29`: "the re-run changes nothing else" is not true. Re-running Deploy builds the app, promotes a new production deployment and waits for the owner's approval. Section 6 step 3 says "approve"; section 1 step 5 does not. **Fix:** say the re-run builds and promotes the same commit again after approval. For a staging-only rotation, say the owner may reject the production job.

8. **MINOR**, `docs/runbooks/rotate-a-secret.md:23`: "`production-backup` holds its own read-only role's URL" does not match ADR-0030. The ADR stores the `backup_reader` password as the secret, and the job "builds the connection settings from separate parts". **Fix:** say "the `backup_reader` password", or drop the forward description and leave it to section 8.

9. **MINOR**, `docs/runbooks/rotate-a-secret.md:5` against `:87`: Line 5 says never paste a secret into a terminal on a machine where Claude Code runs. Section 7 step 3 tells the owner to paste the token into exactly that terminal. Section 7 of `infrastructure-setup.md` puts the token there on purpose, so this is a planned exception, but the runbook never says so. **Fix:** name the GitHub token as the one exception in line 5.

10. **MINOR**, `docs/runbooks/rotate-a-secret.md:38-39` and `:53-55`: The checks run while the old key still works, so they do not show the new key is in use. For the publishable key, no check follows the deletion in step 5. For Resend, the sign-in code checks the Supabase SMTP side only; the Vercel `RESEND_API_KEY` side is never checked, and after the old key is removed a failure would show only in a log. **Fix:** add a check after each removal, or state what is left unchecked.

11. **MINOR**, `docs/runbooks/rotate-a-secret.md:41-43`: Section 3 covers a secret that does not exist. It is only a note, not a procedure, and section 8 already says the same thing. That is close to the "nothing half-present" rule (CLAUDE.md rule 3). **Fix:** fold it into section 8.

12. **MINOR**, `docs/runbooks/usage-spike-or-free-tier-limit.md:100-106`, and section 2.4 steps 2-3 (`:66-67`): Sections 5 and 6 are prose. Section 6 contains an action (delete artifacts) with no numbered step, and 2.4 steps 2-3 are notes written as checkbox steps. `07-operations.md` section 8.1 requires numbered procedures. Also, `:106` says "a failed backup run is the first sign" of full storage, but `:121` says the documentation does not say what GitHub does at 500 MB. Deleting artifacts also removes restore points, and the step does not warn about that. **Fix:** number the steps. Drop or qualify the "first sign" claim. Add "never delete the newest successful backup".

13. **MINOR**, both runbooks: New vendor facts dated 2026-11-24 appear only in the runbooks, not in `docs/spec/09-evidence.md`. They are: CDN requests, 10 IP blocks, the Attack Mode name and its durations, the analytics and Speed Insights limits, the 2 GB disk and its 95 % read-only rule, the 402 restrictions, Resend's 00:00 UTC reset, and Google's two secrets per client. `07-operations.md` section 9 says the limits the day check compares against are in 09-evidence. **Fix:** add a new 09-evidence entry (e.g. E-27) in the spec-change pull request of decision D, and cite it from the runbooks. Note that decision D lives only in the untracked `docs/reports/pull-requests/WP-7.3-part-2.md`. The Attack Mode rename is flagged there, not drifting silently, but findings 2 and 3 are missing from it.

## What the reviewer ran

- `git log --format=fuller 9638f9a..1590d7b`: one commit, author and committer Fahad, no attribution.
- `git diff --stat`: two files, 232 insertions.
- `pnpm --config.verify-deps-before-run=false verify`: exit 0. Prettier clean, 31 test files and 722 tests passed.
- Searches for placeholder and attribution patterns.
- Every cross-reference in `infrastructure-setup.md` (sections 2.4, 2.5, 5.7, 7, 8.3, 10.3, 11): all resolve.
- `.github/workflows/deploy.yml`, `.env.example`, `src/infrastructure/env/schema.ts`, `health.ts` and `vercel.json`, to check which named things exist.

Read: WP-7.3 in `docs/spec/08-delivery-plan.md`; `07-operations.md` sections 8 to 10; ADR-0029; ADR-0030; `06-security-privacy.md` section 5.5 and T-12, T-14, T-18, T-25; E-22 to E-26; `02-architecture.md` section 9; the glossary in `00-charter.md` section 10; both existing runbooks.

Not checked: no vendor documentation page was opened, so the menu labels and the new figures dated 2026-11-24 are not verified by this reviewer. No e2e tests or build; there is no code change.
