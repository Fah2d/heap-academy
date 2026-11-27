**Part 2 of WP-7.3.** Two owner runbooks: rotating a secret, and a usage spike or a free-tier limit reached. Analytics is not turned on: it needs a package this run may not install, so it is decision C below. Same branch as part 1 (`wp/7.3-operations`, from `main` at 0efe863); it depends on nothing that is not merged.

## What and why

`07-operations.md` section 8.1 assigns four runbooks to WP-7.3. Two of them cover things that exist on `main` today: the secrets of `infrastructure-setup.md` section 7, and the free-tier limits of ADR-0029. This part writes those two. The restore runbook needs the backup workflow (after WP-2.1), and the deletion request runbook needs account deletion (WP-6.3 part 2, after WP-2.1 and WP-2.2).

## Work package

- Work package: WP-7.3 Operations, part 2.
- Requirements and threats covered: `06-security-privacy.md` section 5.5 ("Keys are rotated after any suspected exposure. The runbook has the steps."), T-12 and T-18 for the rotation steps; NFR-COST-02, T-25, RISK-13 and the triggers of ADR-0029 for the usage runbook.
- Time box 2.5 hours for the whole package. Part 1 took about 20 minutes; part 2 from 00:25 to about 00:55 on 2026-11-24, with three review rounds. About 0.8 hours of the 2.5 hour box so far.

## What changed

| Item | Where |
|---|---|
| Rotate a secret. Section 0: routine and exposure orders, what counts as exposed, Actions logs, committed secrets (history not rewritten by default, and why), the legal question of `06-security-privacy.md` section 8 item 6. Section 1: how to make a new production deployment without shipping code (gated on the commit production serves; the 30-day re-run limit and a documents-only fallback; never from a working machine; deploy twice so the rollback target holds the new value). Sections 2 to 8: the database password and URL (with, after an exposure, logs, the security advisor, read-only catalog checks compared between projects, Vault, and ending every session), the publishable key, the legacy keys and JWT signing keys, the Resend key, the Google client secret, the Vercel token (other tokens, unknown deployments, every server variable, settings), and the implementer's GitHub token. Section 9: a compromised vendor account, mailbox first. Section 10: the secrets later packages add. | `docs/runbooks/rotate-a-secret.md` |
| Usage spike or a free-tier limit: the first five minutes; one table of every figure, its free amount, its trigger and what stops; Vercel (attack or learners, IP blocking and custom rules with limits on what to block, Attack Mode and no deploys while it is on, a limit reached); Supabase (production or staging paused, size, egress, users, the read-only disk rule); Resend; analytics collection; GitHub artifact storage. Steps that depend on an unbuilt package name it. | `docs/runbooks/usage-spike-or-free-tier-limit.md` |
| The token rows of the deploy failure table: an expired token fails at **Remember the deployment production serves**, after the production migrations. | `docs/runbooks/deploy-and-rollback.md` |
| Deactivate the legacy Supabase keys at setup; account deletion is WP-6.3, not WP-6.2. | `docs/runbooks/infrastructure-setup.md` section 2 |

Every vendor step was checked against the vendor's current documentation on 2026-11-24. Each runbook ends with its sources and a list of what the documentation did not confirm.

## How it was verified

Documentation only; no code changed. `pnpm verify` after each fix round (1590d7b, abe78e3, 2ce4040, and the tree of e4638f2), each exit 0 (with `--config.verify-deps-before-run=false`, as in part 1, because pnpm cannot take the store lock in the sandbox):

```
$ prettier --check .
All matched files use Prettier code style!
$ eslint --max-warnings=0 .
$ tsc --noEmit
$ node scripts/check-attribution.mjs --branch && node scripts/check-attribution.mjs --files
$ vitest run --coverage
 Test Files  31 passed (31)
      Tests  722 passed (722)
```

The pre-commit hook's secret scan on each of the four commits: `no leaks found`.

The code reviewer ran `pnpm verify` five times on 2ce4040: the first exited 1 with a vitest stack trace whose cause it did not keep; the other four exited 0. Three further `pnpm test` runs on e4638f2 here all exited 0 (31 files, 722 tests). The commits change only documents; the one failure is not explained.

Not run, because nothing they cover changed: `next build`, e2e, axe.

## Screens

None. No interface change.

## Reviews

Rounds are numbered on from part 1's round 1. Each round reviewed the fixes of the round before, in a fresh context. Reports in `docs/reports/reviews/WP-7.3/`.

- Round 2 (the first of this part), on 1590d7b: `code-review-2.md` CHANGES REQUIRED (4 majors, 9 minors); `security-review-2.md` CHANGES REQUIRED (7 majors, 11 minors). Fixed in abe78e3.
- Round 3, on abe78e3: `code-review-3.md` CHANGES REQUIRED (1 major: the 30-day re-run limit; 7 minors); `security-review-3.md` CHANGES REQUIRED (4 majors: sessions survive a password reset, name-only catalog checks, a Vercel token can mint tokens, gaps for a compromised vendor account; 5 minors). Fixed in 2ce4040, and the re-run limit became decision E.
- Round 4, on 2ce4040: every earlier finding FIXED. `code-review-4.md` CHANGES REQUIRED (2 majors: the re-run case too broad, no path when two attacker deployments are on top; 4 minors); `security-review-4.md` CHANGES REQUIRED (1 major: a password set on an account survives; 3 minors). All fixed in e4638f2. **The fixes in e4638f2 were not reviewed again.**
- design-reviewer: not asked. No screen, style, or product text changed; the runbooks are for the owner.

Open MAJOR findings for the owner to waive: none known; e4638f2 is unreviewed.

Not verified by anyone, and listed in each runbook's "Not confirmed": dashboard labels; whether `postgres` may delete from `auth.sessions` in the SQL editor; the project's access token lifetime; whether Resend's key removal and the password reset are immediate.

## Try it on the preview

Nothing to try on a preview. Read the two runbooks; walk section 6 of the rotation runbook (the Vercel token) at its next 90-day renewal.

## Owner actions now due

1. **Now, in both Supabase projects**: deactivate the legacy `anon` and `service_role` keys (`rotate-a-secret.md` section 4 steps 1 to 3). The infrastructure runbook did not say to until this branch (it does now, section 2 step 6), and Supabase keeps them valid until you do; a `service_role` key skips row level security. Record the date.
2. Read the runbooks. Correct any menu name that differs on your screens, in this branch or a later pull request.
3. Decide C, D and E below.
4. The owner actions of part 1 are still due.

## Decisions for the owner

**Approved by the owner on 2026-11-24:** C option (a), every item of D, and E option (a). D is applied in part 4; C waits for the owner to add the two packages; E is a patch the owner applies (`WP-7.3-part-4.md`).

**C. How analytics is turned on.** `07-operations.md` section 4.3 asks for the host's cookie-free analytics: page views and Core Web Vitals. Vercel's current documentation (checked 2026-11-24) offers two ways:

- The packages `@vercel/analytics` and `@vercel/speed-insights`, with their Next.js components. They know the per-deployment script path, follow client-side navigation, and accept `beforeSend`, which can strip anything from a URL before it is sent (T-16).
- A plain HTML snippet: an inline `window.va` stub and `<script defer src="/<unique-path>/script.js">`. The documentation says this path has "no route support", and since version 2 the `<unique-path>` comes from "a random seed at build time" passed through dynamic configuration, which a hand-written tag cannot know. The older fixed path `/_vercel/insights/script.js` is no longer documented.

Installing packages is not allowed in these unattended runs. Options:
- (a) You add the two packages (`pnpm add @vercel/analytics @vercel/speed-insights` at their current versions); the next part mounts them in the root layout with the request's nonce, a `beforeSend` that sends the path without its query, and tests that the page still runs under the script policy. **Recommended.**
- (b) Page views only, through the HTML snippet with the undocumented fixed path. Not recommended: it depends on a path Vercel no longer documents and counts client-side navigations wrong.
- (c) No analytics in this release: a `spec-change` to section 4.3 and WP-7.3.

Also needed for (a) or (b): **Analytics → Enable** in the Vercel project, before the deploy that adds the script (otherwise its `script.js` answers 404). Hobby includes 50,000 Web Analytics events a month and 10,000 Speed Insights events per rolling 30 days; past them collection pauses and the site is unaffected.

Default: nothing is built, and nothing in the spec changes, until you choose.

**D. Spec drift found while writing the runbooks**, for one `spec-change` pull request when you approve it. Default: no spec or ADR file is edited on this branch (rule 11); the runbooks name each gap where it matters.
- Vercel renamed Attack Challenge Mode to **Attack Mode**. ADR-0029 and T-25 use the old name.
- Free amounts with no trigger, which NFR-COST-02 requires: Vercel **fast origin transfer** (10 GB a month, in E-23; every page response counts, so it may be the first Hobby limit reached), **provisioned memory** (360 GB-hours, in E-23), **CDN requests** (1,000,000 a month, new on Vercel's Hobby page), Resend's **3,000 a month**, and GitHub **artifact storage** (500 MB). The monthly active users trigger (40,000) is in `07-operations.md` section 9.2 but not in ADR-0029. Until you set them, the runbook says to act at half the free amount.
- **`RUNTIME_ASSET_BASE_URL`**: `02-architecture.md` section 5 (line 139), `07-operations.md` section 9.2 and ADR-0029 say moving the runtime files to another host needs "no code change". A runtime on another origin changes the page and worker script policies (`'self'` today) and T-13's "served by us", so it needs code, a `security-reviewer` review and probably an ADR. The variable does not exist yet, and no work package names it: WP-3.1 builds the runtime files at `/_runtime/pyodide/<version>/`. The spec-change should say which package adds it.
- A new `09-evidence.md` entry (E-27, checked 2026-11-24) for the facts the runbooks rely on that the spec does not hold: the Vercel figures above, 3 custom rules and 10 IP blocks on Hobby, Attack Mode and its durations, the analytics and Speed Insights limits, Supabase's 2 GB disk with read-only at 95 % and the 402 restrictions, Resend's 00:00 UTC reset, Google's two secrets per client, and Supabase's legacy keys staying valid until disabled.
- Vercel says usage notifications are on for every plan and cannot be customised on Hobby; `infrastructure-setup.md` section 5 step 9 tells you to turn them on. The step can say "check they are on".

**E. A manual trigger for the Deploy workflow.** `deploy.yml` runs only on a push to `main`. GitHub allows a re-run only up to 30 days after a run, so after a quiet month a rotation has no way to make a new production deployment except merging a documents-only pull request (the fallback the runbook names). Options:
- (a) Add `workflow_dispatch` to `deploy.yml`, limited to `main` by the environments' branch policies as today. A workflow change: the implementer cannot push it (no Workflows permission), so you push it after reading the diff, with a `security-reviewer` review. **Recommended.**
- (b) Keep the documents-only pull request as the only route.
Default: (b), as written in the runbook, until you choose.

## Deviations from the plan or the spec

- **Analytics is not turned on** (decision C).
- **Two of the four runbooks only.** Restore and deletion request wait for what they describe.
- The rotation runbook says how secrets added later get their section, instead of describing secrets that do not exist yet.

## What is left for later parts of WP-7.3

- Analytics, after decision C.
- With the backup workflow: rotation sections for the `backup_reader` password and the heartbeat ping address in `rotate-a-secret.md` section 10 (WP-7.3 is not done until they exist), and the backup key's rotation in the restore runbook.
- After WP-2.1 merges: the nightly encrypted backup workflow with the `backup_reader` role, the recipient key check, provenance attestation, the heartbeat ping, the deletion email and their tests; the restore script and its verification script; the restore and deletion request runbooks.
- The owner's drills, monitors and notifications.

## Risks and rollback

Documentation only. A wrong menu name costs time during an incident, which is why each runbook lists its sources and what was not confirmed. Rollback: revert the commits.

## Definition of Done

- [ ] Every "Done when" line is met. **Not met for the package**: the drills, the backup run and the monitors are later parts and owner actions.
- [x] No requirement in this part needs a test: both items are runbooks, verified by review and by the owner's use.
- [x] `pnpm verify` passes.
- [x] No interface change.
- [x] No stub, placeholder, or invented number. Every figure is from a vendor page cited in the runbook.
- [x] No new tables. No new server actions.
- [x] Every reviewer blocker is fixed. There were none; every major is fixed, and the last fixes are unreviewed.
- [x] No AI attribution in any commit or in this description.

## Opening or updating the pull request

`gh` cannot reach GitHub from the sandbox. From your terminal in the repository root, after part 1's owner actions:

If the pull request is not open yet, open it with both parts:

```sh
cat docs/reports/pull-requests/WP-7.3-part-1.md docs/reports/pull-requests/WP-7.3-part-2.md > "$TMPDIR/wp-7.3.md"
gh pr create --draft --base main --head wp/7.3-operations \
  --title "feat(system): WP-7.3 client error report and operations runbooks" \
  --body-file "$TMPDIR/wp-7.3.md"
```

If it is already open, replace its description the same way:

```sh
cat docs/reports/pull-requests/WP-7.3-part-1.md docs/reports/pull-requests/WP-7.3-part-2.md > "$TMPDIR/wp-7.3.md"
gh pr edit wp/7.3-operations --body-file "$TMPDIR/wp-7.3.md"
```
