# Runbook: deploy and roll back

How a change reaches production, and how to take it back. The workflow is `.github/workflows/deploy.yml`; the order is in `docs/spec/07-operations.md` section 3. Rollback target: within 5 minutes (NFR-REL-04).

## How a deploy runs

A merge to `main` starts **Deploy**. Nothing else deploys production: Vercel's own production deploy from Git is off (`vercel.json`), so the database always moves first.

1. **Staging migrations.** Applies `supabase/migrations` to the staging project (`supabase db push`, environment `staging`). A failure stops the run here; production is untouched.
2. **Approval.** The `production` job waits for your approval (environment `production`, required reviewer). Open the run, check what changed, press **Review deployments → Approve and deploy**. If the merge carries a migration, read the pull request's note on whether the previous app version still works with it (`07-operations.md` section 3.1) before you approve.
3. **Production migrations**, then **build and deploy the app** with the Vercel CLI (`vercel build --prod`, `vercel deploy --prebuilt --prod`).
4. **Smoke.** `pnpm infra:verify --url <production URL>`: the health endpoint, the response headers, the script policy with its nonce, a page's scripts carrying that nonce, request IDs, the report endpoint. Lesson and runtime-file checks join it when those exist (WP-3.1, WP-5.1).
5. **On a smoke failure**, the job promotes the previous production deployment (`vercel rollback`) and fails. GitHub emails you that the run failed. That email is the alert.

Two deploys never run at once: the workflow has one concurrency group, and a second merge waits for the first run to end.

## Check a deploy

- [ ] **Actions → Deploy**: every job green.
- [ ] `pnpm infra:verify --url https://<domain>` from your machine passes.
- [ ] Open `https://<domain>` in a browser with the developer console open. No content security policy violation is logged.

## Roll back the app

Use this when production is broken and the cause is the latest deploy (an S1 in `07-operations.md` section 8: roll back first, investigate second).

1. [ ] Note the time.
2. [ ] Vercel dashboard → the project → **Deployments**. Find the deployment marked **Current** under Production.
3. [ ] Open the menu on the previous production deployment → **Instant Rollback** (Hobby can roll back to the previous production deployment only). Confirm.

   Or from your machine: `pnpm dlx vercel@65.16.0 rollback <previous deployment URL> --token <Vercel token>`. Check with `pnpm dlx vercel@65.16.0 rollback status`.
4. [ ] `pnpm infra:verify --url https://<domain>` passes.
5. [ ] Note the time. More than 5 minutes is a finding for the incident write-up.
6. [ ] While rolled back, Vercel does not move production to a new deployment by itself. The next merge's deploy workflow ends the rollback. If you want to undo the rollback by hand: `vercel promote <deployment URL>`.
7. [ ] S1 and S2 get a short write-up in `docs/reports/incidents/` (`07-operations.md` section 8).

## The database is not rolled back

Migrations go forward only, and each is written so the previous app version still works with it (expand, then contract, `07-operations.md` section 3.1). After an app rollback the old app runs against the new schema. A bad migration is fixed by a new migration, through a pull request and this same workflow.

Never run a command against the production database from a working machine. The one exception is adding your own admin row, by its own runbook (WP-2.3).

## When the deploy workflow itself fails

| Where | Likely cause | Do |
|---|---|---|
| Staging migrations | A migration is wrong, or `SUPABASE_DB_URL` in `staging` is wrong or expired | Fix forward in a pull request; check the secret against the Supabase Connect dialog |
| Waiting for approval | Waiting for you | Approve or reject |
| Production migrations | The same migration fails on production data | Production is on the old app and the partly applied migration rolled back in its transaction. Fix forward |
| Vercel build or deploy | `VERCEL_TOKEN` expired (90 days), or a Hobby limit was reached | Renew the token in GitHub `production`; check the Vercel usage page |
| Smoke | The new deployment is broken | The job has already rolled back. Read the infra:verify output in the log |

## Re-run a deploy

**Actions → Deploy → the run → Re-run all jobs.** Migrations already applied are skipped by `supabase db push`, so a re-run is safe.
