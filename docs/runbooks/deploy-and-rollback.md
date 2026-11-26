# Runbook: deploy and roll back

How a change reaches production, and how to take it back. The workflow is `.github/workflows/deploy.yml`; the order is in `docs/spec/07-operations.md` section 3. Rollback target: within 5 minutes (NFR-REL-04).

## How a deploy runs

A merge to `main` starts **Deploy**. Nothing else deploys production: Vercel's own production deploy from Git is off (`vercel.json`), so the database always moves first.

1. **Staging migrations.** Applies `supabase/migrations` to the staging project (`supabase db push`, environment `staging`). A failure stops the run here; production is untouched.
2. **Approval.** The `production` job waits for your approval (environment `production`, required reviewer). Open the run, check what changed, press **Review deployments → Approve and deploy**. If the merge carries a migration, read the pull request's note on whether the previous app version still works with it (`07-operations.md` section 3.1) before you approve.
3. **Production migrations.** Then the job notes which deployment the production address serves now (Vercel's alias API).
4. **Build** with the Vercel CLI from `tools/vercel-cli` (`vercel build --prod`, with the commit as the release), then the bundle secret check on the production build's static files.
5. **Deploy and promote.** `vercel deploy --prebuilt --prod --skip-domain`, then `vercel promote <that deployment>`. Promoting assigns the production domain whether or not an earlier rollback turned off the automatic assignment, and turns it back on.
6. **Smoke.** `pnpm infra:verify --url <production URL> --release <commit>`: the address serves this commit (by `/api/health`), the response headers, the script policy with its nonce, a page's scripts carrying that nonce, request IDs, the report endpoint. Lesson and runtime-file checks join it when those exist (WP-3.1, WP-5.1).
7. **On a failure after the deploy**, or a cancelled run, the job rolls back to the deployment noted in step 3 (`vercel rollback <id>`) and fails. GitHub emails you that the run failed. That email is the alert.

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

   There is no command-line rollback in this runbook. The Vercel token lives only in the GitHub `production` environment, and a token typed into a terminal stays in its shell history on a machine where Claude Code runs (T-18, `06-security-privacy.md` section 5.5). The dashboard needs no token.
4. [ ] `pnpm infra:verify --url https://<domain>` passes.
5. [ ] Note the time. More than 5 minutes is a finding for the incident write-up.
6. [ ] While rolled back, Vercel turns off the automatic domain assignment: a plain `vercel deploy --prod` would stay staged. The deploy workflow promotes each deployment explicitly, so the next merge's deploy ends the rollback. To undo the rollback by hand: open that deployment's menu in the dashboard → **Promote**.
7. [ ] S1 and S2 get a short write-up in `docs/reports/incidents/` (`07-operations.md` section 8).

## The rollback drill

NFR-REL-04 needs one rollback drill before launch, on production once it serves at least two deployments. Do "Roll back the app" steps 1 to 6 on a healthy site: roll back, check, then **Promote** the newer deployment again. Note both times; the minutes from step 1 to step 4 must be 5 or fewer. Record the drill here, by a pull request. Newest first.

| Date | Rolled back to (deployment, not its address) | Minutes, steps 1 to 4 | Promoted again | Result |
|---|---|---|---|---|

No drill has been done yet.

## The database is not rolled back

Migrations go forward only, and each is written so the previous app version still works with it (expand, then contract, `07-operations.md` section 3.1). After an app rollback the old app runs against the new schema. A bad migration is fixed by a new migration, through a pull request and this same workflow.

Never run a command against the production database from a working machine. The one exception is adding your own admin row, by its own runbook (WP-2.3).

## When the deploy workflow itself fails

| Where | Likely cause | Do |
|---|---|---|
| Staging migrations | A migration is wrong, or `SUPABASE_DB_URL` in `staging` is wrong or expired | Fix forward in a pull request; check the secret against the Supabase Connect dialog |
| Waiting for approval | Waiting for you | Approve or reject |
| Production migrations | The same migration fails on production data | Production is on the old app and the partly applied migration rolled back in its transaction. Fix forward |
| Remember the deployment production serves | Vercel answered something other than 200 or 404: `VERCEL_TOKEN` expired (90 days), was deleted, or lacks access to the project, or Vercel is down | No app was deployed, but the production migrations above have already run. Renew or fix the token by `rotate-a-secret.md` section 7, then re-run. Merge no pull request with a migration while the token is invalid. A 404 is only a warning: the address serves nothing yet, so this deploy has no rollback target |
| Vercel build or deploy | A Hobby limit was reached | Check the Vercel usage page and `usage-spike-or-free-tier-limit.md` |
| Promote | The promotion timed out (3 minutes) | The job has rolled back. Vercel finishes a timed-out promotion anyway, which can come after the rollback: open **Deployments** and check which one is **Current**. If it is the failed one, use **Instant Rollback** (above). Then re-run |
| Smoke | The new deployment is broken, or the address still serves another release | The job has already rolled back. Read the infra:verify output in the log |

## Re-run a deploy

**Actions → Deploy → the run → Re-run all jobs.** Migrations already applied are skipped by `supabase db push`, so a re-run is safe.
