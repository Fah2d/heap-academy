# Security review 2: WP-7.3 part 2

- Reviewer: `security-reviewer`, fresh context.
- Range: 9638f9a..1590d7b on `wp/7.3-operations` (the two runbooks).
- Date: 2026-11-24.

Verdict: CHANGES REQUIRED

1. **MAJOR**: `docs/runbooks/rotate-a-secret.md:19-29` (also line 16). T-08, T-19, T-24.
   - Problem: someone who held the `postgres` password while it was exposed could have left a way back in before the reset. They could add a row to `admins`, add their own authenticator factor to the owner's account in `auth.mfa_factors`, or create a role, a `security definer` function or a policy. They could also read Vault, where the rate-limit secret will live. Resetting the password removes none of this. Section 0 step 4 promises that each section names a log to check, but section 1 names none. The runbook also never mentions the open legal question of `06-security-privacy.md` section 8 item 6 (what must happen, and how fast, after personal data is exposed).
   - Fix: after the reset, in the Supabase dashboard (SQL editor and Logs, never a terminal): check the Postgres connection logs for addresses you do not know during the exposure window; compare `admins`, the owner's rows in `auth.mfa_factors`, `pg_roles`, the policies and the `security definer` functions against the migrations; run the security advisor; sign out every session if anything is wrong. Record that learner data may have been read, and send that to the legal question.

2. **MAJOR**: `rotate-a-secret.md:43`, `:47-55`, `:70-79`, `:93`. T-12, section 5.5.
   - Problem: every procedure follows the order "create, move, check, delete the old one", even after an exposure. Vercel token: the runbook says that without the token "the site keeps serving", yet the exposed token, which can deploy code to the account, stays valid through a production deploy that waits for approval. Supabase secret key (prescribed for later): Supabase's own leaked-key page says "If someone is actively using the leaked key, retire it right away"; account deletion is its only user, so deleting it first costs almost nothing. Resend key: the exposed key, which can send DKIM-signed mail from `mail.<domain>`, stays valid through a whole deploy.
   - Fix: split routine rotation from exposure. On exposure, revoke first wherever that only pauses deploys or account deletion (Vercel token, secret key). For Resend, remove the old key right after the Supabase SMTP switch is checked, and accept that deletion record emails fail until the deploy finishes. Change the general rule at line 93 to match.

3. **MAJOR**: `rotate-a-secret.md:79`, `:81-87`. T-12, T-18.
   - Problem: knock-on exposure is not handled. Whoever holds the Vercel token can deploy code that reads every server variable at runtime (`RESEND_API_KEY` now, later the Supabase secret key and the HMAC secret), and can change env vars, the firewall rules, deployment protection and Git Fork Protection. The implementer's GitHub token can push branches, open pull requests and merge one through the API (`infrastructure-setup.md` section 8); section 7 names no log to check. The takeover of a vendor account, which can read every secret it holds, is not covered.
   - Fix: after a Vercel token exposure, also rotate every Vercel server variable and check the firewall, protection and env settings. For the GitHub token, check the security log and every branch, pull request and merge from the window. Add a short "vendor account compromised" section: change the password, revoke sessions, rotate everything that account can read.

4. **MAJOR**: `rotate-a-secret.md:41-43`, `:89-93`. T-12, T-19.
   - Problem: Supabase's API keys page says the legacy `anon` and `service_role` keys "stay valid until you disable them", and are deprecated only by the end of 2026. `infrastructure-setup.md` never disables them. If they are on, a key that bypasses row level security exists today in both projects, and line 43's "None exists yet" is wrong. The legacy JWT secret is not covered either; whoever holds it can mint an `aal2` token for the owner (T-19).
   - Fix: add a step: Project Settings → API Keys → Legacy API keys, disable them in both projects (the app uses the publishable key), and record it. Add a section for the JWT signing keys, which per Supabase's leaked-key page must also be revoked when the legacy key leaks.

5. **MAJOR**: `docs/runbooks/usage-spike-or-free-tier-limit.md:22-33`, `:13`. T-25, NFR-COST-02.
   - Problem: `vercel.com/docs/plans/hobby` lists Fast Origin Transfer, 10 GB and Provisioned Memory, 360 GB-hrs. Neither is in the table or the first-five-minutes list. Every page renders per request (ADR-0028), so Fast Origin Transfer is likely the first limit reached. 10 GB over 1,000,000 calls is about 10 kB per page.
   - Fix: add both rows and add them to section 0 step 2. Add them to decision D in the pull request description, with the other limits ADR-0029 gives no trigger: CDN requests, artifact storage, Resend's 3,000 a month, and monthly active users (whose trigger is only in `07-operations.md`). NFR-COST-02 requires a trigger for each.

6. **MAJOR**: `rotate-a-secret.md:37-39`, `:53`, `:55`. NFR-REL-04.
   - Problem: on Hobby, Instant Rollback can go only to the previous production deployment (`deploy-and-rollback.md:31`), and that deployment keeps the old value of every variable. After the old publishable key is deleted, a rollback serves a site whose Supabase calls all fail. After a Resend rotation, a rollback breaks email codes. Browser tabs already open keep the old bundle too.
   - Fix: before deleting the old value, make a second deployment, so the previous deployment also carries the new value. Otherwise, state plainly that rollback is broken until the next deploy.

7. **MAJOR**: `rotate-a-secret.md:29`, `:37`, `:76`. Production integrity.
   - Problem: "Re-run the latest Deploy run" redeploys that run's commit. If the owner has rolled production back by hand, the re-run promotes the release that was taken down (`deploy-and-rollback.md:36` says the next deploy ends a rollback). For a staging-only rotation, "Re-run all jobs" queues a production deploy. "Merge any pull request" ships unrelated code just to trigger a deploy.
   - Fix: re-run only when Deployments → Current is the latest run's commit. For staging, re-run only the `staging migrations` job and reject the production approval. Remove "merge any pull request".

8. **MINOR**: `rotate-a-secret.md:72`. "deploys fail at the build step" is wrong. `deploy.yml:91-100` applies the production migrations before the first step that uses the Vercel token. With a deleted or expired token, the migrations run and no app is deployed. `deploy-and-rollback.md:53` has the same error. Fix: correct the sentence, and add: merge no pull request with a migration while the token is invalid.

9. **MINOR**: `rotate-a-secret.md:87` against `:5`. T-18. Line 5 says never paste a secret into a terminal on the Claude Code machine; step 3 says to do exactly that. Also, `--with-token` shows no prompt: it reads standard input. Fix: say this token is the one secret whose home is that machine (the table in `infrastructure-setup.md` section 7); the owner types the command in his own terminal window, never through the Claude Code session (no `!` command, nothing in the chat); paste, press Enter, then Ctrl-D, and clear the scrollback afterwards; add a renewal reminder about 25 days out.

10. **MINOR**: `rotate-a-secret.md:15`. ADR-0029. The step does not say that rewriting history needs a force push. The ruleset blocks force pushes with an empty bypass list, and the implementer cannot do it. The commit also stays reachable through `refs/pull/*`, forks and its SHA. Fix: state that by default history is not rewritten; doing it means the owner changes the ruleset for a while, which weakens a control, and asks GitHub Support to purge cached views. Add: delete the logs of any Actions run that printed the secret, and close the secret-scanning alert as revoked.

11. **MINOR**: `rotate-a-secret.md:27`, `:26`, `:36`, `:52`, `:65`. T-18, section 5.5. Supabase's passwords page says special characters must be percent-encoded in the connection string. The runbook does not say where to assemble the string, so it may end up in an editor on the development machine. No step checks that the right project is open, which risks mixing production and staging. Fix: percent-encode special characters; build the string inside the password manager entry; before each change, check the project reference against `<prod-ref>` or `<staging-ref>`.

12. **MINOR**: `rotate-a-secret.md:23`, `:91`. The `backup_reader` URL, the heartbeat ping URL and the `age` key are WP-7.3's own deliverables, not "later work packages". Fix: say WP-7.3 is not done until their rotation sections exist (the restore runbook for the `age` key), and list them under "left for later parts" in the pull request description.

13. **MINOR**: `usage-spike-or-free-tier-limit.md:61-68`, `:57`. The deploy's smoke step (`deploy.yml:157`) runs from a GitHub runner, and Vercel's Attack Mode page says unrecognised automated services "could be blocked". A deploy while Attack Mode is on would therefore fail its smoke check and roll back. Section 2.3 step 2 asks for a deploy during exactly this kind of spike. Fix: add "while Attack Mode is on, do not merge or re-run Deploy".

14. **MINOR**: `usage-spike-or-free-tier-limit.md:57`. T-01, T-13. The step says moving the runtime needs a pull request. The spec says "no code change" (`02-architecture.md:139`, `07-operations.md:180`). `RUNTIME_ASSET_BASE_URL` is in neither `.env.example` nor `src`. A runtime on another origin changes the page and worker script policies (`'self'`) and the "served by us" part of T-13. Fix: require a `security-reviewer` review, likely an ADR, and a `spec-change` to reconcile the wording.

15. **MINOR**: `usage-spike-or-free-tier-limit.md:48-50`, `:112`. T-14, T-25. There are no limits on what may be blocked. Fix: block single addresses, not wide ranges (mobile carriers put many learners behind one address); never edit or remove the rate-limit rule of WP-7.1 to free one of the 3 custom-rule slots; add no bypass rules (Hobby allows 0 IP bypass rules).

16. **MINOR**: `usage-spike-or-free-tier-limit.md:78-84`. A paused staging project fails `staging migrations` and blocks every production deploy (`deploy.yml:32-55`), and the runbook does not cover it. Fix: add restoring staging (it is not an ADR-0029 trigger). Say that this "restore" is unpausing, not the restore-from-backup runbook.

17. **MINOR**: `usage-spike-or-free-tier-limit.md:104-106`. NFR-REL-05. "Delete old artifacts" shortens the 7-day backups. GitHub's billing page also says storage already counted in the cycle "remains in your total" after deletion, so deleting may not help. Fix: use ADR-0030's earlier trigger (the dump passes 50 MB). If deleting cannot be avoided, delete only the oldest backup, never the newest attested scheduled run.

18. **MINOR**: `usage-spike-or-free-tier-limit.md:96`. ADR-0030. Once the email cap is reached, deletion record emails fail, and ADR-0030 then requires a by-hand check at restore. The step mentions the shared cap but not this. Fix: say to note the dates of any deletions while the cap is reached, for the restore runbook.

## What the reviewer ran

- Read the diff 9638f9a..1590d7b, `08-delivery-plan.md` WP-7.3, `06-security-privacy.md` sections 4 to 8, `07-operations.md` sections 4 to 10, ADR-0029, ADR-0030, `infrastructure-setup.md`, `deploy-and-rollback.md`, `deploy.yml`, `.env.example`, the WP-7.3 part 2 pull request description, and searched for `RUNTIME_ASSET_BASE_URL` and for artifact uploads in `ci.yml` (none).
- Fetched these vendor pages on 2026-11-24: Vercel WAF pricing, Hobby and Attack Mode; Google's OAuth client page; Supabase's passwords, API keys and leaked-key pages; GitHub's Actions billing page.
- Confirmed: Vercel denied, challenged and rate-limited traffic does not count toward CDN requests or transfer; Hobby allows 3 custom rules and 10 IP blocks; Attack Mode offers 1, 6 and 24 hours, is free, and lets known bots through. Google allows two client secrets at once; disable, then delete; a new secret is shown only once. A Supabase password reset does not interrupt Supabase's own services or the pooler.
- `pnpm verify` and tests not run: no code changed.

Could not check: whether the legacy keys are enabled in either Supabase project; the Free-plan disk size and how long a paused project can be restored; whether Resend key removal and the password reset take effect at once; whether GitHub counts artifacts of a public repository against the 500 MB; every dashboard label and provider setting outside the repository.
