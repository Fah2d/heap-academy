# Runbook: infrastructure setup from zero

Owner only. Every step below needs an account, a payment, or a secret, so the implementer cannot do it. Do the steps in order. Steps marked **START FIRST** wait on someone else (DNS propagation, domain verification, Google's review), so begin them before anything else and come back to them.

Free plans only (ADR-0029). The domain is the only purchase.

Vendor screens change. The menu names below were current on 2026-11-16 where `docs/spec/09-evidence.md` or the vendor's documentation confirmed them; where a label has moved, look for the same setting nearby and correct this file in a pull request.

Throughout, `<domain>` is the domain you buy in step 1, `<prod-ref>` and `<staging-ref>` are the two Supabase project references from step 2, and `OWNER/REPO` is `Fah2d/heap-academy`.

Keep a password manager entry for every value marked **secret**. Never paste a secret into a chat, an issue, a pull request, a commit, or a file in the repository. `.env.example` lists every application variable with a fake value.

## 0. Before you start

- [ ] A password manager is open, with a folder for this project.
- [ ] You are signed in to GitHub as the owner of `OWNER/REPO`.
- [ ] Two-factor authentication is on for GitHub, Vercel, Supabase, Resend, the Google account, and the domain registrar. Each of these can take the site over.

## 1. Buy the domain (START FIRST, paid)

1. [ ] Buy `<domain>` at a registrar you trust. Turn on registrar lock and auto-renew. Turn off any "parking" page.
2. [ ] Do not change its DNS yet. Steps 3 and 6 add records.

DNS changes can take from minutes to a day to be seen everywhere. That is why this step is first.

## 2. Supabase: two Free projects (production and staging)

The Free plan allows two active projects (E-11, E-24). Both are needed: previews sign in against staging, the live site against production, and their credentials never mix (`06-security-privacy.md` section 5.5).

1. [ ] Sign up at supabase.com with GitHub or email. Choose the Free plan for the organization.
2. [ ] **New project**: name `heap-academy-production`, plan Free, region closest to most learners. Generate a database password and save it as **secret** `production database password`. Create.
3. [ ] **New project**: name `heap-academy-staging`, same region, a different generated password, saved as **secret** `staging database password`.
4. [ ] For each project, note:
   - The project reference (the `<ref>` in `https://<ref>.supabase.co`, shown in **Project Settings → General**).
   - **Project URL** and the **publishable key** (`sb_publishable_...`) from **Project Settings → API Keys**. Neither is secret; both go to the browser.
   - The **Session pooler** connection string from the project's **Connect** dialog (it is IPv4; the direct connection on Free is IPv6 only, E-24). Put the project's password into it, and add `?sslmode=require` at the end: `scripts/apply-migrations.sh` refuses a connection without TLS. The whole string is **secret**: `production database URL` and `staging database URL`.
5. [ ] Do not create a secret key (`sb_secret_...`) yet. Only account deletion uses one (WP-6.2), and only in production.

Not yet: the auth settings (Google, the email sender, redirect addresses). They come in step 10 once the pieces they point at exist.

## 3. Resend: the email sender and its domain (START FIRST)

Supabase's built-in sender allows 2 emails an hour (E-11), so sign-in codes go through Resend (ADR-0029). Domain verification can take hours.

1. [ ] Sign up at resend.com. Stay on the Free plan (3,000 a month, 100 a day, E-26).
2. [ ] **Domains → Add domain**: enter a sending subdomain such as `mail.<domain>`, so the sender's records do not touch the root domain's mail. Pick the region closest to the Supabase projects.
3. [ ] Resend shows DNS records (a DKIM `TXT` record, and an `MX` and `TXT` record for the return path). Add each one at your registrar exactly as shown.
4. [ ] Back in Resend, press **Verify**. If it is not verified yet, carry on with the next steps and check again later.
5. [ ] **API Keys → Create API key**, permission **Sending access**, limited to the domain from step 2. Create two:
   - `heap-academy-production`: **secret** `production Resend key`.
   - `heap-academy-staging`: **secret** `staging Resend key`.

   Resend shows each key once.

## 4. Google sign-in client (START FIRST)

Google's consent screen review can take days if it is needed. Basic sign-in scopes (`openid`, email, profile) without a logo usually need no review, but start early in case.

1. [ ] Go to console.cloud.google.com and create a project named `heap-academy`.
2. [ ] Open **Google Auth Platform** (formerly "OAuth consent screen"). **Get started**: app name `Heap Academy`, a support email you read, audience **External**, a developer contact email. Agree and create.
3. [ ] **Branding**: add `<domain>` under **Authorized domains**, and the home, privacy, and terms addresses of `<domain>` (the privacy and terms pages arrive in WP-6.3). Do not upload a logo now; a logo starts a brand review.
4. [ ] **Data access**: add only the scopes `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
5. [ ] **Clients → Create client**, type **Web application**, name `heap-academy-production`:
   - Authorized JavaScript origins: `https://<domain>`.
   - Authorized redirect URIs: `https://<prod-ref>.supabase.co/auth/v1/callback`.
   - Save the **Client ID** (not secret) and the **Client secret** (**secret** `Google client secret`).
6. [ ] For now one client serves both projects (the owner's decision, 2026-11-21). Add the staging redirect URI `https://<staging-ref>.supabase.co/auth/v1/callback` to the same client, so it lists both. Use the same client ID and secret in both projects in step 10. A separate staging client can replace it later without a code change.
7. [ ] Leave the app in **Testing** for now, with yourself as a test user. Publishing it to production is a WP-8.1 launch step.

## 5. Vercel: the Hobby project

A Hobby project cannot connect to a repository owned by a GitHub organization (E-23). `OWNER/REPO` belongs to a personal account, so it can.

1. [ ] Sign up at vercel.com with GitHub, plan **Hobby**.
2. [ ] **Add New → Project → Import** `OWNER/REPO`. Framework preset: Next.js. Do not add variables on this screen. Deploy. The first deployment fails or shows a 404; that is expected.
3. [ ] **Project → Settings → Environment Variables**. Add, each to the environment named:

   | Name | Production | Preview |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | production Project URL | staging Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | production publishable key | staging publishable key |
   | `RESEND_API_KEY` (mark **Sensitive**) | production Resend key | staging Resend key |

   Do not tick **Development**; local development uses the local stack.
4. [ ] **Settings → Deployment Protection → Vercel Authentication**: on, **Standard Protection** (available on all plans). Previews then need a Vercel sign-in.
5. [ ] **Settings → Security**: **Git Fork Protection** on. Vercel then waits for your approval before it builds a pull request from a fork.
6. [ ] Automatic production deploys are turned off by `vercel.json` in the repository (`git.deploymentEnabled.main: false`), so a merge to `main` only goes live through the deploy workflow. Check after the first merge: no deployment appears under **Deployments** from the merge commit itself, only the one the workflow makes.
7. [ ] **Account Settings → Tokens → Create**: name `heap-academy-deploy`, scope your Hobby account, expiration 90 days (put a renewal reminder in your calendar). **Secret** `Vercel token`.
8. [ ] On your own machine, in the repository: `pnpm dlx vercel@65.16.0 link`, choose the project, then read `.vercel/project.json`. Note `orgId` and `projectId`. Neither is secret. `.vercel/` is ignored by Git.
9. [ ] **Settings → Notifications** (or account **Settings → Notifications**): turn on usage notifications (NFR-COST-02).
10. [ ] Whether a Hobby project can share one protected preview by link: Vercel's documentation says Shareable Links are on all plans, and a Hobby account can create one in total. WP-3.4 needs it. Try it once on any preview (**Share** on the deployment page) and record what you saw in the pull request of WP-1.3.

## 6. Point the domain at Vercel

1. [ ] **Project → Settings → Domains → Add** `<domain>`. Choose to redirect `www.<domain>` to `<domain>`.
2. [ ] Vercel shows the records to add (an `A` record for the root and a `CNAME` for `www`). Add them at the registrar. Remove any old `A` or `AAAA` records on the root.
3. [ ] Wait until Vercel shows the domain as valid and the certificate as issued. `dig +short <domain>` on your machine shows the address Vercel gave.

## 7. GitHub: environments and where each secret goes

No credential is a repository-level secret (ADR-0029, ADR-0030). Each lives in exactly one environment, and every environment deploys from `main` only.

1. [ ] **Settings → Environments → New environment** `staging`.
   - **Deployment branches and tags → Selected branches and tags → Add rule** `main`.
   - **Environment secrets → Add**: `SUPABASE_DB_URL` = `staging database URL`.
   - **Environment variables → Add**: `STAGING_PROJECT_REF` = the staging project's reference (`<staging-ref>`, the part before `.supabase.co`). The deploy seeds the sample course only into a database whose URL contains it, so a production URL pasted here by mistake is never seeded.
2. [ ] **New environment** `production`.
   - Deployment branches: `main` only, as above.
   - **Required reviewers**: yourself. Tick **Prevent self-review** off (you are the only reviewer). See the note under "Choices" in the WP-1.3 pull request: every production deploy waits for your approval, not only those with a migration.
   - **Environment secrets**: `SUPABASE_DB_URL` = `production database URL`; `VERCEL_TOKEN` = `Vercel token`.
   - **Environment variables** (not secrets): `VERCEL_ORG_ID` = `orgId`; `VERCEL_PROJECT_ID` = `projectId`; `PRODUCTION_URL` = `https://<domain>`.
3. [ ] **New environment** `production-backup`. Deployment branches: `main` only. Leave it empty; WP-7.3 fills it (ADR-0030).
4. [ ] Repository **Settings → Secrets and variables → Actions → Repository secrets** stays empty.
5. [ ] Last, once steps 1 to 4 of this section and sections 1 to 6 are done: set DEPLOY_ENABLED=true. **Settings → Secrets and variables → Actions → Variables → New repository variable**, name `DEPLOY_ENABLED`, value `true`. It is a variable, not a secret. Until it exists, the deploy workflow skips both of its jobs on every push to `main`.

Where every secret lives, in one table:

| Secret | Lives in | Never in |
|---|---|---|
| Production database URL and password | GitHub `production` environment; your password manager | Vercel, staging, any file |
| Staging database URL and password | GitHub `staging` environment; your password manager | production, any file |
| Production Resend key | Vercel Production variables; Supabase production SMTP (step 10) | Preview, GitHub |
| Staging Resend key | Vercel Preview variables; Supabase staging SMTP (step 10) | Production, GitHub |
| Google client secret (one client for both projects for now) | Supabase production and staging, Google provider (step 10) | Vercel, GitHub |
| Turnstile secret key | Supabase production and staging, Attack Protection (step 10) | Vercel, GitHub |
| Vercel token | GitHub `production` environment | Anywhere else |
| GitHub fine-grained token (step 8) | The implementer's `gh` login on your machine | Any file, any environment |

## 8. A fine-grained token for the implementer

The implementer pushes branches and opens pull requests. It must not be able to change settings, environments, secrets, or protection rules (ADR-0029).

1. [ ] **Your avatar → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. [ ] Name `heap-academy-implementer`. Expiration 30 days. Resource owner: your account. **Repository access → Only select repositories** → `OWNER/REPO`.
3. [ ] **Repository permissions**, exactly these and nothing else:

   | Permission | Access | Why |
   |---|---|---|
   | Metadata | Read | Required by GitHub for every token |
   | Contents | Read and write | Push work package branches |
   | Pull requests | Read and write | Open and update pull requests |
   | Actions | Read | Read check results and logs |
   | Commit statuses | Read | Read check results |

   Leave **Administration, Environments, Secrets, Variables, Deployments, Pages, Webhooks** and every other permission at **No access**. Leave every **Account permission** at **No access**.
4. [ ] Generate. On your machine, in a terminal where the implementer runs: `gh auth login --with-token` and paste the token, then `gh auth setup-git`. Check with `gh auth status`.

**No Workflows permission, on purpose.** With Contents write and Workflows write together, a pushed branch could carry a new workflow that runs on `push`, grants itself `checks: write`, and posts a passing `static` check on any pull request. That would satisfy branch protection. Without Workflows write, GitHub refuses any push by this token that touches `.github/workflows/`. When a work package changes a workflow, the implementer commits it on the branch and stops. You push that branch with your own login (`git push origin <branch>`) after reading the workflow diff.

**What this token can still do.** Contents and Pull requests write together can merge a pull request through the API (`gh api -X PUT repos/OWNER/REPO/pulls/N/merge`) once its checks pass, because required approvals are 0. The repository's permission rules deny `gh pr merge`, and should deny the API form too (see the WP-1.3 pull request). The ruleset still requires every check to pass.

The repository checks of `pnpm infra:verify --repo OWNER/REPO` need Administration and Secrets read, which this token does not have, so you run them with your own login.

## 9. Branch protection with the required checks

Do this after the WP-1.3 pull request has run its checks once, so the check names exist to pick from.

1. [ ] **Settings → Rules → Rulesets → New ruleset → New branch ruleset**. Name `main`. Enforcement **Active**.
2. [ ] **Bypass list**: empty. Not even you; a change to `main` goes through a pull request.
3. [ ] **Target branches → Add target → Include default branch**.
4. [ ] Tick:
   - **Restrict deletions**.
   - **Require a pull request before merging**. Required approvals: 0 (you are the only person; GitHub does not let an author approve their own pull request, and the implementer's pull requests are opened under your account). Tick **Require conversation resolution before merging**.
   - **Require status checks to pass**, tick **Require branches to be up to date before merging**, and add `static`, `unit`, `build`. For each, choose **GitHub Actions** as the source, so a status posted by any other integration or token cannot satisfy it. Add `db` when WP-2.1 adds it and `e2e` when its job exists, with the same source.
   - **Block force pushes**.
5. [ ] Create. Check: open a test pull request that changes one word in a document, push a commit that fails formatting, and see **Merge** blocked. Close it without merging.

## 10. Supabase auth settings (needed by WP-2.2)

Do this for each project, with that project's own values.

1. [ ] **Authentication → URL Configuration**: Site URL `https://<domain>` (production) or the preview address pattern (staging). Redirect URLs: production `https://<domain>/auth/callback`; staging the Vercel preview pattern for this project only, `https://heap-academy-*-<your-vercel-account-slug>.vercel.app/auth/callback`, never a wildcard over all of `vercel.app` (`07-operations.md` section 1).
2. [ ] **Authentication → Emails → SMTP Settings**: enable custom SMTP. Host `smtp.resend.com`, port `465`, username `resend`, password that project's Resend key, sender name `Heap Academy`, sender address `signin@heapacademy.dev`. The Resend domain is `heapacademy.dev` (the owner's decision, 2026-11-21).
3. [ ] **Authentication → Rate Limits**: email sends per hour 20 (ADR-0029). Leave the other limits at their defaults.
4. [ ] **Authentication → Sign In / Providers → Google**: on, with the Google client ID and secret of step 4 (one client for both projects for now).
5. [ ] **Authentication → Sign In / Providers → Email**: email provider on, **Allow new users to sign up** on (an unknown address must get the same answer as a known one, T-11), **Confirm email** on (a password sign-up through the public endpoint then stays unconfirmed and cannot sign in; a person who signs in with a code confirms the address by typing it), **Email OTP expiration** `600` seconds, **Email OTP length** `6`.
6. [ ] **Authentication → Emails → Templates**: in both **Magic link** and **Confirm signup**, set the subject to `Your Heap Academy sign-in code` and replace the body with the contents of `supabase/templates/sign-in-code.html`. The body must show `{{ .Token }}` and no link (FR-AUTH-02).
7. [ ] **Bot challenge**: at dash.cloudflare.com, **Turnstile → Add widget**, name `heap-academy`, hostnames `heapacademy.dev`, `localhost`, and `vercel.app`, mode **Managed**. Copy the **site key** (not secret) and the **secret key** (**secret** `Turnstile secret key`). Then in each Supabase project, **Authentication → Attack Protection → Enable Captcha protection**: provider **Turnstile by Cloudflare**, the secret key. Put the site key in Vercel as `NEXT_PUBLIC_TURNSTILE_SITE_KEY` for Production and Preview once WP-2.2 part 2 adds that variable.

Check: request a code for your own address on the staging project with **Authentication → Users → Send magic link**, and see a six-digit code from `signin@heapacademy.dev`, not a link.

## 11. Make the repository public (only after the history scan)

ADR-0029. The order matters: once public, anything in the history is public.

1. [ ] On your machine, in the repository:

   ```sh
   git fetch origin '+refs/pull/*:refs/remotes/pull/*'
   gitleaks git --log-opts="--all" --redact --config .gitleaks.toml
   ```

   It must print `no leaks found`. If it finds anything, stop: rotate that secret first, then decide with the implementer how to remove it from history.
2. [ ] **Settings → General → Danger Zone → Change visibility → Public**.
3. [ ] **Settings → General → Features**: untick **Issues**, **Discussions**, **Wikis**.
4. [ ] **Settings → Moderation options → Interaction limits → Limit to prior contributors... ** choose **Limit to repository collaborators**, for the longest period offered. It expires; the renewal is in the morning review.
5. [ ] **Settings → Actions → General → Approval for running fork pull request workflows from contributors → Require approval for all external contributors**.
6. [ ] **Settings → Code security**: turn on **Secret Protection** (secret scanning), **Push protection**, and **Private vulnerability reporting**.
7. [ ] Check with your own login, and paste the output into the WP-1.3 pull request. It reads secret scanning, push protection, private reporting, the interaction limit, that no secret sits at repository level, and that each of `staging`, `production`, and `production-backup` deploys from `main` only, with your approval on `production`:

   ```sh
   pnpm infra:verify --url https://<domain> --repo OWNER/REPO
   ```

## 12. First deploy

1. [ ] Merge the WP-1.3 pull request when every check is green.
2. [ ] **Actions → Deploy** shows a run for the merge. Approve the `production` job when it asks.
3. [ ] When it finishes: `pnpm infra:verify --url https://<domain>` on your machine. Paste the output into the day report.
4. [ ] Note the duration of the pull request workflow and of the deploy, from the Actions page, for NFR-MAINT-06.
