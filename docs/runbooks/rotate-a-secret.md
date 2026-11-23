# Runbook: rotate a secret

Owner only. Use it after any suspected exposure of a secret (`06-security-privacy.md` section 5.5), when a token expires, and when a person or machine that held a secret should no longer hold it.

Every step is done in a vendor's dashboard, in GitHub's web settings, or in your password manager. Never paste a secret into a terminal on a machine where Claude Code runs, into a chat, an issue, a pull request, a commit, or a file in the repository: shell history and the session transcript keep it (T-18). The one exception is the implementer's own GitHub token, whose home is that machine (section 8). Each secret's home is in the table at the end of section 7 of `infrastructure-setup.md`; this runbook does not move any secret to a new place.

Vendor screens change. The menu names below were checked against each vendor's documentation on 2026-11-24 and are listed with their sources at the end. Where a label has moved, look for the same setting nearby and correct this file in a pull request.

Throughout, `<prod-ref>` and `<staging-ref>` are the two Supabase project references, as in `infrastructure-setup.md`.

## 0. Routine rotation or exposure

Each section below has two orders.

- **Routine** (a token expires, a person leaves, a scheduled change): create the new value, put it in its home, make whatever reads it pick it up, check, then remove the old value. Nothing breaks on the way.
- **Exposure**: the old value may be in someone else's hands. Remove it as early as the section allows, even if a feature pauses until the new value is in place. A paused deploy or a paused email is cheaper than a secret that keeps working for an attacker.

Treat a secret as exposed if it was pasted anywhere outside its home, printed in a log or a CI run, committed (even on a branch, even if the commit was then removed), sent in an email, or held by a machine or vendor account that is lost or compromised. The repository is public (ADR-0029), so a committed secret is exposed to everyone the moment it is pushed.

On an exposure:

1. [ ] Note the time. An exposed production secret is an S1 (`07-operations.md` section 8): data is at risk.
2. [ ] Rotate first, investigate second. Find the secret's section below and follow its exposure order now.
3. [ ] If it was printed in a GitHub Actions run: open the run → **⋯ → Delete all logs**.
4. [ ] If it was committed:
   - Rotate it first. Removing it from history does not undo the exposure; rotating does.
   - Run the scan from section 11 of `infrastructure-setup.md` to find every place it appears.
   - If GitHub secret scanning opened an alert, close it as **Revoked** once the rotation is done.
   - By default, history is **not** rewritten. Rewriting needs a force push, which the `main` ruleset blocks with an empty bypass list; doing it means you change the ruleset for a while, which weakens a control, and the commit stays reachable through `refs/pull/*`, forks, and its SHA until GitHub Support purges cached views. Decide that separately, after the rotation.
5. [ ] Check the vendor's own log for use you do not recognise in the time it was exposed. Each section names where.
6. [ ] If learner data may have been read (a database password, a Supabase secret key, a vendor account), record that in the incident report. What must happen, and how fast, after personal data is exposed is open question 6 of `06-security-privacy.md` section 8; take it to the qualified person named there.
7. [ ] Note the time again. Write the short incident report in `docs/reports/incidents/` (`07-operations.md` section 8).

## 1. Make a new deployment without shipping anything new

Vercel variables reach only deployments made after the change (Vercel: changes "are not applied to previous deployments"). Several sections need a new deployment of the code production already serves.

1. [ ] Vercel → the project → **Deployments**: note the commit of the deployment marked **Current** under Production.
2. [ ] GitHub → **Actions → Deploy**: open the latest run.
   - Its commit is the one from step 1: go on.
   - It failed at **Remember the deployment production serves** (an expired or deleted Vercel token): its production migrations already ran but its app was never deployed. Go on: re-running it is how that commit reaches production.
   - It failed anywhere else, or you rejected its `production` approval: stop. Re-running it would ship a commit that was declined or broken.
   - Otherwise production was rolled back by hand (`deploy-and-rollback.md`), and a re-run would promote the release you took down. Stop, and deal with the rollback first.
3. [ ] That run → **Re-run all jobs**. The staging migrations job skips migrations already applied. Approve the `production` job when it asks. It builds the commit again, deploys it, promotes it, and smoke-tests it.
4. [ ] GitHub allows a re-run only up to 30 days after the run started, and at most 50 times. If the latest run is older, there is nothing to re-run: open a pull request that changes only a document (the incident report, or the day report's line for this rotation), and merge it when its checks pass. Its Deploy run deploys the same code. Never merge a pull request that changes code only to cause a deploy, and never deploy from your machine (`vercel deploy`): the token lives only in GitHub (`deploy-and-rollback.md`, CLAUDE.md rule 10). A manual trigger for the Deploy workflow is proposed in the pull request of this runbook (decision E).

For a **staging** value (the Preview variables of Vercel), push a commit to an open pull request's branch, or use **Redeploy** on that branch's preview in Vercel; there is no staging deploy in the Deploy workflow.

**Rollback after a rotation.** On Hobby, Instant Rollback can go only to the previous production deployment (`deploy-and-rollback.md`), and that deployment still holds the old value. In the routine order, make the new deployment **twice** (steps 1 to 4, then again) before you remove the old value, so the rollback target holds the new value too. In the exposure order there is no time for that: until the next deploy, a rollback serves the old value, which no longer works.

## 2. Database password and URL (staging or production)

The URL holds the project's database password. A reset breaks every connection that uses the old password at once; Supabase's own services, including its pooler, take the new one by themselves, with no downtime. Today only the Deploy workflow connects with it. Routine and exposure use the same order: the reset is the removal.

Where it lives: the GitHub environment `production` or `staging`, secret `SUPABASE_DB_URL`, and your password manager.

1. [ ] Check that no Deploy run is in progress (**Actions → Deploy**). A run that starts during the swap fails at its migration step and changes nothing.
2. [ ] Supabase dashboard → open the project and check that its reference in the address bar is `<prod-ref>` (or `<staging-ref>`).
3. [ ] **Database → Settings** (also reachable from the **Connect** dialog) → **Reset database password**. Generate a new one. Save it in the password manager entry `production database password` (or `staging ...`) in place of the old one.
4. [ ] Build the new session pooler string inside the password manager entry `production database URL` (or `staging ...`), never in an editor or a terminal: the string from the **Connect** dialog, the new password in it with any special character percent-encoded (Supabase's password guide), and `?sslmode=require` at the end, as in `infrastructure-setup.md` section 2 step 4.
5. [ ] GitHub → **Settings → Environments →** `production` (or `staging`) **→ Environment secrets →** `SUPABASE_DB_URL` → edit (pencil) → paste the new string → **Update secret**. If the page offers no edit, remove the secret and add it again under the same name.
6. [ ] Check, production: section 1; the `production` job's migration step connects with the new string. Check, staging: open the latest Deploy run, re-run only the `staging migrations` job (the re-run control on that job), and **Reject** the `production` approval at once: an unanswered approval holds the Deploy workflow's concurrency group and every later deploy waits behind it.

After an exposure, also, in the Supabase dashboard (SQL editor and **Logs**, never a terminal on your machine). Someone with the `postgres` password could have left a way back in that a password reset does not remove. The SQL editor runs as `postgres`; every query below only reads, except step 11.

7. [ ] **Logs**: the Postgres and the connection pooler sources, for the exposure window. The stored URL goes through the session pooler, so GitHub's runners are the only expected client in the pooler's log; the password also works on the direct connection, so any direct connection you did not make is a finding.
8. [ ] **Advisors → Security Advisor**: run it and read every finding.
9. [ ] Compare the database with what the migrations in `supabase/migrations` create. Production and staging get the same migrations, so run each query in both projects and compare; if both may be compromised (section 9), compare with the migration files. Until WP-2.1 merges there are no tables of ours, and each result should be empty or identical:
   - Schemas: `select nspname from pg_namespace order by 1;`
   - Function bodies, not only names (`create or replace` keeps a name), in every schema that is not Postgres's own: `select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid), p.prosecdef, md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg\_%' and p.prokind in ('f', 'p') order by 1, 2, 3;`
   - Tables without row level security: `select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'private') and c.relkind = 'r' and not c.relrowsecurity;` (expected: none).
   - Grants to the browser roles and to everyone: `select grantee, table_schema, table_name, privilege_type from information_schema.role_table_grants where grantee in ('anon', 'authenticated', 'PUBLIC') order by 1, 2, 3, 4;`, `select grantee, routine_schema, routine_name from information_schema.role_routine_grants where grantee in ('anon', 'authenticated', 'PUBLIC') order by 1, 2, 3;`, and `select nspname, nspacl from pg_namespace order by 1;` (who may use each schema).
   - Policies: `select schemaname, tablename, policyname, roles, cmd, qual, with_check from pg_policies order by 1, 2, 3;`
   - Roles and who is a member of which: `select rolname, rolsuper, rolcanlogin, rolbypassrls from pg_roles order by 1;` and `select roleid::regrole, member::regrole from pg_auth_members order by 1, 2;`
   - Triggers and event triggers: `select tgrelid::regclass, tgname from pg_trigger where not tgisinternal order by 1, 2;` and `select evtname, evtevent, evtfoid::regproc from pg_event_trigger order by 1;`
   - Extensions and outside connections: `select extname, extversion from pg_extension order by 1;` and `select srvname from pg_foreign_server;`. If `pg_cron` is listed: `select * from cron.job;`. If `pg_net` is listed, read its record of recent outgoing requests early, because it keeps only recent ones: `select * from net._http_response order by created desc;`.
   - Your own account: `select id, email, updated_at from auth.users where email = '<your address>';` and, with that id, `select provider, identity_data->>'email', created_at from auth.identities where user_id = '<id>';` (only your Google and email identities). The product has no password sign-in, so no account should have a password: `select id, email from auth.users where coalesce(encrypted_password, '') <> '';` (expected: no rows).
   - Once WP-2.1 and WP-2.3 are merged: every row of the admin allow-list, and your rows in `auth.mfa_factors` (one factor, the one you enrolled).
10. [ ] Rotate every secret in Supabase Vault: they could be read. None exists until WP-7.1 adds the rate-limit HMAC secret.
11. [ ] End every session, whatever steps 7 to 9 found: a stolen refresh token keeps a session alive after the reset (Supabase: refresh tokens "never expire"), including your own admin session. In the SQL editor: `delete from auth.sessions;`. Supabase's auth schema deletes each session's refresh tokens with it (`on delete cascade`). Try it on staging first, after signing in there so there is a session to delete (from WP-2.2), and check that `select count(*) from auth.refresh_tokens;` drops to 0; if it does not, also `delete from auth.refresh_tokens;`. Every learner has to sign in again. Access tokens already issued keep working until they expire, because the app checks their signature without asking Supabase (`02-architecture.md`, `getClaims()`); to cut them at once, also do section 4 step 7.
12. [ ] Anything in step 9 you did not create: it is an S1. Remove it through a migration in a pull request (clear any password found on an account), and rotate the JWT signing keys as well (section 4 steps 4 to 7). Rotating or revoking a signing key does not sign anyone out; step 11 does.

## 3. Supabase publishable key

Not a secret: it is in every browser (`.env.example`), and row level security decides what it can do. Rotate it only when Supabase asks you to or when you replace a project. Supabase's documentation describes rotation for secret keys only, so check the current **API Keys** page first.

1. [ ] Supabase → the project (check the reference) → **Project Settings → API Keys**. Create a new publishable key.
2. [ ] Vercel → the project → **Settings → Environment Variables** → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → edit the value for **Production** (production project) or **Preview** (staging project).
3. [ ] This variable is built into the browser files, so make the new deployment twice (section 1). Tabs that are already open keep the old files until they reload.
4. [ ] `pnpm infra:verify --url https://<domain>` passes, and a page loads with no error in the browser console.
5. [ ] Delete the old publishable key in **API Keys**.
6. [ ] Check again: reload the site in a private window; no error in the console. The pages that call Supabase arrive with WP-2.x and WP-5.x; until then this check shows nothing about the key.

## 4. Supabase legacy keys and the JWT signing key

Supabase's legacy `anon` and `service_role` keys "stay valid until you disable them". Before 2026-11-24 the infrastructure runbook did not disable them; it does now (section 2 step 6), but projects set up earlier still need steps 1 to 3 below. The app uses only the publishable key. A `service_role` key skips row level security, and whoever holds the legacy JWT secret can mint a token for any user, at any assurance level (T-19).

**Do this once in both projects now**, not only after an exposure:

1. [ ] Supabase → the project (check the reference) → **Settings → API Keys**. Read the "last used" indicators of the legacy keys: they should show no use.
2. [ ] Deactivate the legacy API keys on that page. It can be undone, but never re-activate a key that leaked: that restores it.
3. [ ] Record the date in the day report.

After a leak of the legacy `service_role` key or the JWT secret (Supabase's leaked-key guide):

4. [ ] Deactivate the legacy keys (step 2), if not done.
5. [ ] **JWT signing keys** page (`settings/jwt` in the dashboard): if the project still signs with the legacy JWT secret, press **Migrate JWT secret**, then **Rotate keys**, so the new standby key signs new tokens and the legacy secret becomes "previously used". Only a previously used key can be revoked.
6. [ ] Revoke the legacy JWT secret. Supabase advises waiting until issued tokens expire, but allows revoking at once in an incident; do it at once.
7. [ ] If the leak was of a current signing key, or after section 2 step 12: **Rotate keys** again, then revoke the previously used key. Access tokens it signed then fail. It does not end sessions: refresh tokens still work, so also do section 2 step 11.

## 5. Resend API key (staging or production)

Resend allows several keys at once. Where it lives: Vercel `RESEND_API_KEY` (Production for the production key, Preview for the staging key, marked **Sensitive**) and the Supabase project's custom SMTP password. Today only Supabase's SMTP uses it, for sign-in emails; the app reads `RESEND_API_KEY` when the deletion record email exists (ADR-0030, later parts of WP-7.3 and WP-6.3).

Routine:

1. [ ] Resend → **API Keys → Create API key**: name `heap-academy-production-<yyyy-mm-dd>` (or `staging`), permission **Sending access**, limited to the sending domain. Resend shows the value once; save it in the password manager as `production Resend key`.
2. [ ] Supabase → the matching project (check the reference) → **Authentication → Emails → SMTP Settings** (the documentation calls it the authentication settings page, `.../auth/smtp`). Password: the new key. Save.
3. [ ] Check the SMTP side: request a sign-in code for your own address on that environment (from WP-2.2; before that, Supabase sends no email at all, and there is nothing to check).
4. [ ] Vercel → **Settings → Environment Variables** → `RESEND_API_KEY` → edit the **Production** (or **Preview**) value. Make the new deployment twice (section 1).
5. [ ] Resend → **API Keys** → the old key → **More options → Remove API key**.
6. [ ] Check again after the removal: step 3 once more. The Vercel side has no check until the deletion record email exists; that work package adds one here.

Exposure:

1. [ ] Routine steps 1 and 2.
2. [ ] Routine step 5 at once: remove the old key.
3. [ ] Routine step 3, then step 4 with the new deployment made once. Until that deploy, anything in the app that sends through `RESEND_API_KEY` fails (nothing does today).
4. [ ] Routine step 6.
5. [ ] Resend → **Emails**, for the exposure window: sends you did not make mean the key was used. The key can send signed mail from your sending domain. If it sent anything in your name, tell learners on Heap's channels.

## 6. Google sign-in client secret (staging or production)

Google allows two secrets per client, and both work until you disable one. Where it lives: the Supabase project's Google provider only. Nothing uses Google sign-in until WP-2.2 merges; before that, rotate in any order and skip the checks.

1. [ ] Google Cloud console → **Google Auth Platform → Clients** → `heap-academy-production` (or `heap-academy-staging`) → **Add Secret**. Google shows it once; save it in the password manager as `production Google client secret`.
2. [ ] Supabase → the matching project (check the reference) → **Authentication → Sign In / Providers → Google** → **Client Secret**: the new one. Save.
3. [ ] Check: sign in with Google on that environment, in a private window.
4. [ ] **Clients**, next to the old secret: **Disable**. Google says it stops working shortly after. Sign in with Google once more.
5. [ ] Delete the disabled secret (this cannot be undone). In the routine order, if step 4's sign-in failed, **Enable** the old secret instead, put it back in Supabase, and find the cause first.

Exposure:

1. [ ] Routine steps 1 and 2.
2. [ ] Routine step 4 at once: disable the old secret. Never re-enable a leaked secret.
3. [ ] Routine step 3: sign in with Google.
4. [ ] Delete the disabled secret.

## 7. Vercel token (`VERCEL_TOKEN`)

Used only by the Deploy workflow, from the GitHub `production` environment. It expires every 90 days (`infrastructure-setup.md` section 5 step 7). With an expired or deleted token, a Deploy run still applies the production migrations, then fails at **Remember the deployment production serves**: the site keeps serving the old app against the new schema. So while the token is invalid, merge no pull request that carries a migration.

Routine:

1. [ ] Vercel → **Account Settings → Tokens → Create**: name `heap-academy-deploy-<yyyy-mm-dd>`, scope your Hobby account, expiration 90 days. Vercel shows it once.
2. [ ] GitHub → **Settings → Environments →** `production` **→ Environment secrets →** `VERCEL_TOKEN` → edit → paste → **Update secret**.
3. [ ] Check: make a new deployment (section 1) and see the run green.
4. [ ] Vercel → **Account Settings → Tokens** → delete the old token.
5. [ ] Put the next renewal reminder in your calendar, 80 days from today.

Exposure: the token can deploy any code to your account, create more tokens, and change variables, firewall rules, deployment protection, and Git Fork Protection. Code it deploys can read every server variable.

1. [ ] **Account Settings → Tokens**: delete the exposed token and every token you did not create. Deploys pause; the site keeps serving.
2. [ ] The project → **Deployments**: if **Current** is a deployment you did not make, **Instant Rollback** before anything else. Hobby can roll back only to the previous production deployment; if that one is not yours either, roll back anyway (it stops the newest), and step 4 replaces it.
3. [ ] Record each deployment you did not make in the incident report: its source and its build and function logs, which show what it read. Then delete it, once it is no longer **Current**.
4. [ ] Routine steps 1 and 2, then the new deployment: if **Current** is now yours, section 1. If it is not, re-run the Deploy run of the commit you last shipped yourself (section 1 steps 3 and 4), without section 1 step 2's commit check.
5. [ ] Rotate every server variable the project holds, because a deployment made with the token could have read them: today `RESEND_API_KEY`, both Production and Preview (section 5).
6. [ ] Check the project's settings: environment variables against `infrastructure-setup.md` section 5 step 3; **Deployment Protection**, **Git Fork Protection**, and the domain against sections 5 and 6; **Firewall** rules against `usage-spike-or-free-tier-limit.md` section 2.2 (the rate-limit rule exists from WP-7.1); deploy hooks, log drains, webhooks, and integrations: there should be none you did not add.
7. [ ] The account's activity log for the window: changes you did not make.

## 8. The implementer's GitHub token

The fine-grained token of `infrastructure-setup.md` section 8. It expires every 30 days. GitHub's documentation describes creating and deleting fine-grained tokens; a deleted token stops working and cannot be restored. Routine and exposure use the same order: delete first.

1. [ ] GitHub → **your avatar → Settings → Developer settings → Personal access tokens → Fine-grained tokens** → delete the old `heap-academy-implementer` token.
2. [ ] Generate a new one with exactly the settings of `infrastructure-setup.md` section 8 steps 1 to 3: name, 30 days, this repository only, and the permission table. Check the permissions against that table before you press **Generate**.
3. [ ] In your own terminal window on the implementer's machine, never through the Claude Code session (no `!` command, nothing in the chat): run `gh auth login --with-token`, paste the token, press Enter, then Ctrl-D (it reads standard input; there is no prompt). Then `gh auth setup-git` and `gh auth status`. Clear the terminal's scrollback.
4. [ ] Put the next renewal reminder in your calendar, 25 days from today.

After an exposure, also:

5. [ ] GitHub → **your avatar → Settings → Security log**: actions by the token in the window.
6. [ ] The repository's branches, pull requests, and merged pull requests in the window. The token can push branches, open pull requests, and merge one through the API once its checks pass (`infrastructure-setup.md` section 8). Revert anything you did not approve.

## 9. A vendor account is compromised

Someone signed in to your GitHub, Vercel, Supabase, Resend, Google, or registrar account can read or replace every secret that account holds, and can leave a way back in.

1. [ ] Your mailbox first: every one of these accounts can be reset through it. Change its password, sign out every other session, check its two-factor settings, its forwarding rules, and its recovery address and phone.
2. [ ] The compromised account: change its password and sign out every other session (each vendor's security settings). Check that two-factor authentication is still yours: no new authenticator, recovery email, or passkey.
3. [ ] Rotate and check everything that account can read or replace, in the exposure order of each section:
   - GitHub: every environment secret (`SUPABASE_DB_URL` in both environments, `VERCEL_TOKEN`), the implementer's token (section 8), the ruleset and environment settings of `infrastructure-setup.md` sections 7 and 9, and, on your account and the repository, SSH keys, personal access tokens, authorized OAuth apps and GitHub Apps, deploy keys, webhooks, and **Settings → Actions**. Remove anything you did not add.
   - Vercel: section 7's exposure order in full, which covers tokens, deployments, variables, settings, hooks, and drains.
   - Supabase, both projects: section 2 steps 7 to 12 (logs, catalog, Vault, every session); the database passwords; the legacy keys and signing keys (section 4); and the auth settings an attacker can change to stay in: **Authentication → URL Configuration** (Site URL and redirect URLs against `infrastructure-setup.md` section 10 step 1), **SMTP Settings** (host, sender, password: section 5), providers (section 6), auth hooks, and multi-factor settings. Also the organization's members and your Supabase personal access tokens.
   - Resend: both keys (section 5), the sending domain's settings, and the team's members.
   - Google: both client secrets (section 6), and the client's redirect URIs against `infrastructure-setup.md` section 4.
   - Registrar: the domain's DNS records against `infrastructure-setup.md` sections 3 and 6, the registrar lock, and the contact email.
4. [ ] It is an S1. Write the incident report.

## 10. A secret that is not listed here

Each work package that adds a secret adds its section here, with both orders. Still to come:

- WP-7.3, later parts: the `backup_reader` password and the heartbeat ping address in `production-backup` (ADR-0030). WP-7.3 is not done until they have their sections. The backup encryption key goes in the restore runbook, because rotating it changes which backups you can read.
- Account deletion (WP-6.3 part 2): the Supabase secret key. That work package writes its section with this exposure order, from Supabase's leaked-key guide ("If someone is actively using the leaked key, retire it right away"): (1) delete the old key in **Settings → API Keys**, which cannot be undone; (2) create a new one; (3) put it in Vercel and make a new deployment; until then account deletion fails.
- WP-2.2: the bot challenge's secret key. WP-7.1: the rate-limit HMAC secret.

Until such a section exists, rotate in the orders of section 0.

## After every rotation

- [ ] The password manager holds only the new value.
- [ ] Nothing that held the old value is left: no note, no draft email, no file, no terminal scrollback.
- [ ] If the rotation was for an exposure, the incident report names the secret (by name, never its value), when it was exposed, when it was rotated, and what the vendor's log showed.

## Sources, checked on 2026-11-24

- Supabase database password: [managing passwords](https://supabase.com/docs/guides/database/managing-passwords), [connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres).
- Supabase keys: [API keys](https://supabase.com/docs/guides/api/api-keys), [rotating leaked API keys](https://supabase.com/docs/guides/security/rotate-leaked-api-keys), [JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys), [sessions](https://supabase.com/docs/guides/auth/sessions).
- Supabase SMTP: [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
- Resend: [API keys](https://resend.com/docs/dashboard/api-keys/introduction).
- Google client secrets: [manage OAuth clients](https://support.google.com/cloud/answer/15549257).
- Vercel: [environment variables](https://vercel.com/docs/environment-variables), [creating a token](https://vercel.com/docs/rest-api/authentication/create-an-auth-token).
- GitHub: [re-running workflows and jobs](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/re-running-workflows-and-jobs) (the 30-day and 50-run limits, read by the security reviewer on 2026-11-24), [personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens), [token revocation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/token-expiration-and-revocation), [secrets in Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions).

Not confirmed in the documentation read: whether Resend's removal of a key and Supabase's password reset take effect at once (both are treated as immediate here); the labels of Vercel's token page, of the legacy keys control, and of GitHub's edit control for an existing environment secret; what revoking a signing key does to refresh tokens; whether these new figures belong in `09-evidence.md` (proposed in the pull request).
