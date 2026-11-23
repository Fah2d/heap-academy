# Runbook: rotate a secret

Owner only. Use it after any suspected exposure of a secret (`06-security-privacy.md` section 5.5), when a token expires, and when a person or machine that held a secret should no longer hold it.

Every step is done in a vendor's dashboard or in GitHub's web settings. Never paste a secret into a terminal on a machine where Claude Code runs, into a chat, an issue, a pull request, a commit, or a file in the repository: shell history and the session transcript keep it (T-18). Each secret's home is in the table at the end of section 7 of `infrastructure-setup.md`; this runbook does not move any secret to a new place.

Vendor screens change. The menu names below were checked against each vendor's documentation on 2026-11-24 and are listed with their sources at the end. Where a label has moved, look for the same setting nearby and correct this file in a pull request.

## 0. When a secret may be exposed

Treat it as exposed if it was pasted anywhere outside its home, printed in a log or a CI run, committed (even on a branch, even if the commit was then removed), sent in an email, or held by a machine that is lost or compromised. The repository is public (ADR-0029), so a committed secret is exposed to everyone the moment it is pushed.

1. [ ] Note the time. An exposed production secret is an S1 (`07-operations.md` section 8): data is at risk.
2. [ ] Rotate first, investigate second. Find the secret's section below and do it now.
3. [ ] If it was committed: rotate it first, then run the scan from section 11 of `infrastructure-setup.md` to find every place it appears. Removing it from history does not undo the exposure; rotating does. Decide with the implementer, in a pull request, whether the history is rewritten.
4. [ ] Check the vendor's own log for use you do not recognise in the time it was exposed (sections below name where).
5. [ ] Note the time again. Write the short incident report in `docs/reports/incidents/` (`07-operations.md` section 8).

## 1. Database password and URL (staging or production)

The database URL holds the project's database password. A reset breaks every connection that uses the old password at once; Supabase's own services, including its pooler, take the new one by themselves.

Where the URL lives: the GitHub environment `production` or `staging`, secret `SUPABASE_DB_URL`, and your password manager. Nothing else uses it today. When WP-7.3's backup workflow exists, `production-backup` holds its own read-only role's URL, whose password is separate.

1. [ ] Check that no deploy is running: **Actions → Deploy**. A run that starts during the swap fails at its migration step and changes nothing.
2. [ ] Supabase dashboard → the project → **Database → Settings** (also reachable from the **Connect** dialog) → **Reset database password**. Generate a new one. Save it in the password manager entry `production database password` (or `staging ...`) in place of the old one.
3. [ ] Build the new session pooler string the same way as in `infrastructure-setup.md` section 2 step 4: the string from the **Connect** dialog, the new password in it, `?sslmode=require` at the end. Save it as `production database URL` (or `staging ...`).
4. [ ] GitHub → **Settings → Environments →** `production` (or `staging`) **→ Environment secrets →** `SUPABASE_DB_URL` → edit (pencil) → paste the new string → **Update secret**. If the page offers no edit, remove the secret and add it again under the same name.
5. [ ] Check: **Actions → Deploy → the latest run → Re-run all jobs**. The migration job connects with the new string; `supabase db push` skips migrations already applied, so the re-run changes nothing else (`deploy-and-rollback.md`).

## 2. Supabase publishable key

Not a secret: it is in every browser (`.env.example`), and row level security decides what it can do. Rotate it only when Supabase asks you to, or when you replace a project. The documentation read on 2026-11-24 describes rotation for secret keys only, so check the current **API Keys** page first.

1. [ ] Supabase → the project → **Project Settings → API Keys**. Create a new publishable key.
2. [ ] Vercel → the project → **Settings → Environment Variables** → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → edit the value for **Production** (production project) or **Preview** (staging project).
3. [ ] A changed variable reaches only new deployments, and this one is built into the browser files. Production: merge any pull request or re-run the latest **Deploy** run, so the workflow builds and promotes a new deployment. Preview: push a commit to the branch.
4. [ ] `pnpm infra:verify --url https://<domain>` passes, and a page loads with no error in the browser console.
5. [ ] Only then delete the old publishable key in **API Keys**.

## 3. Supabase secret key (`sb_secret_...`)

None exists yet. The infrastructure runbook creates none (section 2 step 5); account deletion adds one in production. The work package that adds it writes its rotation steps here, in this order: create the new key in **Project Settings → API Keys**, move its one user to it, check, then delete the old key. Deleting a secret key cannot be undone.

## 4. Resend API key (staging or production)

Resend allows several keys at once, so make the new one, move both users to it, then remove the old one. Until step 5, sign-in codes and the deletion record emails keep working on the old key.

Where it lives: Vercel `RESEND_API_KEY` (Production for the production key, Preview for the staging key, marked **Sensitive**) and the Supabase project's custom SMTP password.

1. [ ] Resend → **API Keys → Create API key**: name `heap-academy-production-<yyyy-mm-dd>` (or `staging`), permission **Sending access**, limited to the sending domain. Resend shows the value once; save it in the password manager as `production Resend key`.
2. [ ] Supabase → the matching project → **Authentication → Emails → SMTP Settings** (the documentation calls it the authentication settings page, `.../auth/smtp`). Password: the new key. Save.
3. [ ] Vercel → **Settings → Environment Variables** → `RESEND_API_KEY` → edit the **Production** (or **Preview**) value. Then make a new deployment as in section 2 step 3: an existing deployment keeps the old value.
4. [ ] Check: request a sign-in code for your own address on that environment; it arrives.
5. [ ] Resend → **API Keys** → the old key → **More options → Remove API key**.
6. [ ] Resend's logs (**Emails**) for the exposure window: sends you did not make mean the key was used. Each counts toward the 100 a day (E-26).

## 5. Google sign-in client secret (staging or production)

Google allows two secrets per client, and both work until you disable one, so this swap has no gap.

Where it lives: the Supabase project's Google provider only.

1. [ ] Google Cloud console → **Google Auth Platform → Clients** → `heap-academy-production` (or `heap-academy-staging`) → **Add Secret**. Copy the new secret into the password manager as `production Google client secret`.
2. [ ] Supabase → the matching project → **Authentication → Sign In / Providers → Google** → **Client Secret**: the new one. Save.
3. [ ] Check: sign in with Google on that environment, in a private window.
4. [ ] Back in **Clients**, next to the old secret: **Disable**. Google says it stops working shortly after. Sign in with Google once more.
5. [ ] Then delete the disabled secret (this cannot be undone). If step 4's sign-in failed, **Enable** the old secret instead, put it back in Supabase, and find the cause before you try again.

## 6. Vercel token (`VERCEL_TOKEN`)

Used only by the deploy workflow, from the GitHub `production` environment. It expires every 90 days (`infrastructure-setup.md` section 5 step 7). Without it, deploys fail at the build step; the site keeps serving.

1. [ ] Vercel → **Account Settings → Tokens → Create**: name `heap-academy-deploy-<yyyy-mm-dd>`, scope your Hobby account, expiration 90 days. Vercel shows it once.
2. [ ] GitHub → **Settings → Environments →** `production` **→ Environment secrets →** `VERCEL_TOKEN` → edit → paste → **Update secret**.
3. [ ] Check: **Actions → Deploy → the latest run → Re-run all jobs**, approve, and see it green.
4. [ ] Vercel → **Account Settings → Tokens** → delete the old token.
5. [ ] Move the renewal reminder in your calendar to 80 days from today.
6. [ ] After an exposure: Vercel → the project → **Deployments** and the account's activity log for deployments or changes you did not make.

## 7. The implementer's GitHub token

The fine-grained token of `infrastructure-setup.md` section 8. It expires every 30 days. GitHub's documentation describes creating and deleting fine-grained tokens; a deleted token stops working and cannot be restored.

1. [ ] GitHub → **your avatar → Settings → Developer settings → Personal access tokens → Fine-grained tokens** → delete the old `heap-academy-implementer` token.
2. [ ] Generate a new one with exactly the settings of `infrastructure-setup.md` section 8 step 3. Check the permission list against that table before you press **Generate**.
3. [ ] In the terminal where the implementer runs: `gh auth login --with-token` and paste it (it reads the token from the prompt, not from the command line, so it stays out of shell history), then `gh auth setup-git` and `gh auth status`.

## 8. A secret that is not listed here

The secrets of later work packages get their own section here, written by the work package that adds them: the Supabase secret key for account deletion, the bot challenge's secret key, the rate-limit HMAC secret, the backup workflow's database role and heartbeat ping address. The backup encryption key is in the restore runbook (ADR-0030), because rotating it changes which backups you can read.

Until such a section exists, rotate in the same order as above: create the new value, put it in its home, make whatever reads it pick it up (a new deployment for Vercel variables), check that it works, then remove the old one.

## After every rotation

- [ ] The password manager holds only the new value.
- [ ] Nothing that held the old value is left: no note, no draft email, no file.
- [ ] If the rotation was for an exposure, the incident report names the secret (by name, never its value), when it was exposed, when it was rotated, and what the vendor's log showed.

## Sources, checked on 2026-11-24

- Supabase database password: [managing passwords](https://supabase.com/docs/guides/database/managing-passwords), [connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres).
- Supabase keys: [API keys](https://supabase.com/docs/guides/api/api-keys), [rotating leaked API keys](https://supabase.com/docs/guides/security/rotate-leaked-api-keys).
- Supabase SMTP: [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
- Resend: [API keys](https://resend.com/docs/dashboard/api-keys/introduction).
- Google client secrets: [manage OAuth clients](https://support.google.com/cloud/answer/15549257).
- Vercel: [environment variables](https://vercel.com/docs/environment-variables) ("not applied to previous deployments"), [creating a token](https://vercel.com/docs/rest-api/authentication/create-an-auth-token).
- GitHub: [personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens), [token revocation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/token-expiration-and-revocation), [secrets in Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions).

Not confirmed in the documentation read: whether Resend's removal of a key and Supabase's password reset take effect at once (both are treated as immediate here), the label of Vercel's token page, and the edit control for an existing environment secret in GitHub.
