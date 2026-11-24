**Part 4 of WP-7.3.** The owner's decisions of 2026-11-24 for this package, applied: the browser's release on a client error report (decision A), the approved spec text (decisions B and D), and a patch for the Deploy workflow's manual run that the owner applies (decision E). Decision C (analytics) waits for the owner to add two packages. Same branch as parts 1 to 3 (`wp/7.3-operations`), up to date with `main` at 7875ee2.

## What and why

On 2026-11-24 the owner approved every recommended default in every pull request description. For WP-7.3 that is:

| Decision | Approved option | Done here |
|---|---|---|
| A. Where the release on a client error line comes from | (a) the browser sends its bundle's release | Built, with tests |
| B. The browser error's reference | The proposed text | Written into the spec |
| C. How analytics is turned on | (a) the owner adds `@vercel/analytics` and `@vercel/speed-insights` | **Not done**: the packages are not in `package.json`, and these runs may not install packages |
| D. Spec drift found while writing the runbooks | Every item | Written into the spec, ADR-0029 and `09-evidence.md`, except the runtime base path (see below) |
| E. A manual trigger for the Deploy workflow | (a) `workflow_dispatch` | A patch for the owner: the implementer's token cannot push a workflow file |
| F, G, H (part 3) | As built | Nothing to change |

## Work package

- Work package: WP-7.3 Operations, part 4.
- Requirements covered: NFR-OBS-01, NFR-OBS-02, NFR-PRIV-03 and T-16 (decision A); NFR-COST-02 and T-25 (decision D); NFR-REL-04 (decision E, proposed: it takes effect only when the owner applies the patch).
- Spec and ADR changes on this branch (label `spec-change`): FR-SYS-01, NFR-OBS-01, NFR-OBS-02, NFR-COST-02, T-25, E-27, ADR-0029.
- Time box 2.5 hours for the whole package. About 1.0 hour after part 3; part 4 from about 14:09 to about 14:30 on 2026-11-24.

## What changed

| Item | Where |
|---|---|
| The release pattern (a full commit SHA or `local`) in one pure module, used by the environment schema, the logger and the report schema. | `src/domain/release.ts` |
| `next.config.ts` inlines the parsed release into the browser bundle as `NEXT_PUBLIC_HEAP_RELEASE`. | `next.config.ts`, `src/infrastructure/env/process-env.d.ts` |
| The reporter sends `release` with the code and the route. | `src/features/shell/client/report-client-error.ts` |
| The endpoint requires `release` (strict schema, same pattern) and logs it as `clientRelease`; a report without it, or with anything else in it, is refused with 400. | `src/features/system/server/client-error.ts` |
| The logger allowlists `clientRelease`, checked against the pattern at run time like every other field; anything else is written as `rejected`. | `src/infrastructure/logging/logger.ts` |
| The environment schema imports the pattern with a relative path: `next build` failed with `MODULE_NOT_FOUND` on the `@/` alias when `next.config.ts` loaded the file. | `src/infrastructure/env/schema.ts` |
| `next.config.ts` inlines the deploy's release into both names, falls back to `local`, and fails the build on a malformed one (code review 5). | `scripts/next-config.test.ts` |
| Tests: the pattern; the reporter's body; the endpoint's line, `local`, and five refused releases; the logger's field. The end-to-end spec sends `release`. | `*.test.ts`, `e2e/client-error.spec.ts` |
| Decision B: the browser error's reference in FR-SYS-01, NFR-OBS-01, `03-experience.md` section 5.6 and `07-operations.md` section 4.1; decisions A and B in section 4.2. | `docs/spec/` |
| Decision D: Attack Mode in ADR-0029 and T-25; ADR-0029's triggers for every Vercel Hobby figure, monthly active users, Resend's month and GitHub artifact storage, each at half the free amount; E-27 in `09-evidence.md`. | `docs/adr/0029-*.md`, `docs/spec/06-security-privacy.md`, `docs/spec/09-evidence.md` |
| The usage runbook follows the amended triggers and E-27; the infrastructure runbook says to check that Vercel's usage notifications are on. | `docs/runbooks/` |
| Decision E and the rest of decision A, as one patch for the owner: the manual trigger, with a test that pins the triggers; a condition that skips a run from any branch but `main`; the runbook step that uses the manual run; and the rename of `HEAP_RELEASE` to `NEXT_PUBLIC_HEAP_RELEASE` in `deploy.yml`, `.env.example`, the environment schema, `next.config.ts`, the health answer, the logger and their tests. | `docs/reports/pull-requests/WP-7.3-deploy-dispatch.patch` |

## How it was verified

- `npm_config_verify_deps_before_run=false pnpm verify` (pnpm cannot take the store lock in the sandbox; the flag form `pnpm verify --config...` passes the flag on to vitest, which crashes): exit 0, `Test Files  33 passed (33)`, `Tests  743 passed (743)` before the review fixes; `Test Files  34 passed (34)`, `Tests  746 passed (746)` after them.
- `next build`: exit 0. `node scripts/check-bundle.mjs .next/static` with the CI marker: `No server variable (RESEND_API_KEY, HEAP_RELEASE) in 20 files under .next/static.` `node scripts/check-static.mjs .next`: no prerendered page apart from `/_global-error`.
- The built reporter chunk holds `JSON.stringify({code:e.code,route:e.route,release:"local"})`: the release is inlined.
- Against `next start` with `curl`: a report with `release: "local"` got 204, and the server wrote `{"release":"local","level":"error",...,"outcome":"client-error:worker-crashed","clientRelease":"local"}`; a report without `release` got 400; a report with a `message` got 400.
- The patch: with it applied, `vitest run scripts/workflows.test.ts` passed 30 of 30; with only the test applied, the new test failed. After security review 7, the patch also adds `github.ref == 'refs/heads/main'` to the first job's condition; with that guard removed, the T-18 test fails (`1 failed | 29 passed (30)`). Prettier passed on the three patched files; `git apply --check` passes on this branch.
- **Not run: the end-to-end suite.** Its second web server (`next dev`) cannot start in this sandbox (`unable to start FSEvent stream`, then `EMFILE` with polling). The CI `e2e` job is its first run.
- **Not run: `pnpm test:db`** (no Docker here), as in part 3.

## Reviews

Reports in `docs/reports/reviews/WP-7.3/`: `code-review-5.md` and `security-review-7.md`. Verdicts and fixes are in the section "Review results" at the end of this file.

design-reviewer: not asked. No screen, style or product text changed.

## Owner actions now due

1. **Decision C**: run `pnpm add @vercel/analytics @vercel/speed-insights` at their current versions on this branch (or a new one), turn on **Analytics** and **Speed Insights** in the Vercel project, and the next run mounts them with the request's nonce and a `beforeSend` that drops the query.
2. **Decision E**: read `docs/reports/pull-requests/WP-7.3-deploy-dispatch.patch`, then from the repository root on this branch: `git apply docs/reports/pull-requests/WP-7.3-deploy-dispatch.patch && pnpm verify`, commit and push it yourself. The patch also finishes decision A (the rename in decision I), because `deploy.yml` and the code must change in one commit. Until then, `rotate-a-secret.md` section 1 step 4 keeps the documents-only pull request as the route.
3. Open or update the pull request with all four parts, so the CI `db` and `e2e` jobs run:

```sh
cat docs/reports/pull-requests/WP-7.3-part-1.md docs/reports/pull-requests/WP-7.3-part-2.md docs/reports/pull-requests/WP-7.3-part-3.md docs/reports/pull-requests/WP-7.3-part-4.md > "$TMPDIR/wp-7.3.md"
gh pr create --draft --base main --head wp/7.3-operations --label spec-change \
  --title "feat(system): WP-7.3 client error report, backup role and operations runbooks" \
  --body-file "$TMPDIR/wp-7.3.md"
```

If it is already open: `gh pr edit wp/7.3-operations --add-label spec-change --body-file "$TMPDIR/wp-7.3.md"`.

4. The owner actions of parts 1 to 3 are still due.

## Decisions taken by default

- **I. The rename of `HEAP_RELEASE` to `NEXT_PUBLIC_HEAP_RELEASE` is in the owner's patch, not on the branch.** Decision A (a) takes the release out of the server list. The deploy workflow sets the build's variable, and the implementer cannot push a workflow file, so the code and `deploy.yml` must change in one owner-pushed commit; a branch-only rename would build production with `local`. Until the patch is applied the branch keeps `HEAP_RELEASE` as a server variable, and the bundle check passes only because the SHA is in the `Build` step's environment and not the check step's: do not move `HEAP_RELEASE` to the job's `env`, and do not set it as a Vercel variable (`vercel pull` would write it into the file the check reads). With the patch applied, `npm_config_verify_deps_before_run=false pnpm verify` exited 0 (`Test Files  34 passed (34)`, `Tests  747 passed (747)`); `next build` was not run on the patched tree. Alternative: apply only the manual trigger and keep the server name, which the code reviewer marked MAJOR.
- **J. A report without a release is refused**, not logged with a missing field. The reporter and the endpoint ship in the same deployment, so only a tab on a bundle from before this change sends one, for at most one deploy.
- **K. The runtime base path (decision D, third item) is not edited here.** WP-3.1 (pull request #9) carries its own spec change for the same lines of `02-architecture.md` section 5.1 and `07-operations.md` section 9.2, approved by the owner on 2026-11-24: the base path is the constant `RUNTIME_ASSET_BASE_URL` in `src/runtime/assets.ts`, and the worker policy follows it. That answers "which package adds it". Editing the same lines here would conflict; ADR-0029's runtime clause only adds that the move needs a `security-reviewer` review.
- **L. Triggers at half the free amount**, as the usage runbook already said: 5 GB fast origin transfer, 180 GB-hours provisioned memory, 500,000 CDN requests, 1,500 Resend emails a month, 250 MB of artifact storage.
- **M. E-27 is built from the runbooks' sources, checked on 2026-11-24**, not fetched again in this part.

## Deviations from the plan or the spec

- Analytics is still not turned on (decision C, owner action 1).
- The Deploy workflow's manual run is a patch, not a commit (owner action 2).

## What is left for WP-7.3

- Analytics, after owner action 1. With it, ADR-0029 needs triggers for Web Analytics (50,000 events a month) and Speed Insights (10,000 events over 30 days), from E-27.
- A trigger in ADR-0029 for the firewall's 1,000,000 allowed rate-limit requests (E-23), which NFR-COST-02 asks for and no row has yet. Done in part 5 (decision N).
- After the CI `db` job is green: the backup workflow and the rest of the list in part 3. `backup.yml` is a workflow file, so like the patch above it reaches `main` through the owner.
- The deletion email and the deletion request runbook, after account deletion (WP-6.3 part 2).
- The owner's drills, monitors and notifications.

## Risks and rollback

A tab still on a bundle from before this change sends no release, and its report is refused until it reloads: no reference is shown for that error. Rollback: revert the part 4 commits; the spec text goes back with them.

## Definition of Done

- [ ] Every "Done when" line is met. **Not met for the package**: analytics, the backup, the drills and the monitors.
- [x] Every requirement in this part has a passing test that names its ID.
- [x] `pnpm verify` passes; `next build`, `check-bundle` and `check-static` pass.
- [ ] The end-to-end suite passes. **Not run here**; the CI `e2e` job runs it.
- [x] No interface change.
- [x] No stub, placeholder, or invented number.
- [x] No new tables. No new server actions.
- [x] No AI attribution in any commit or in this description.

## Review results

- `code-review-5.md`: CHANGES REQUIRED, no blocker, two majors (the server name of `HEAP_RELEASE`, against decision A (a); the missing `spec-change` label) and five minors. All fixed or listed; the rename is in the owner's patch (decision I). Not reviewed again.
- `security-review-7.md`: APPROVE, three minors. The `main`-only condition is added to the patch, the verify command is corrected, and the bundle-check trap is removed by the rename in the patch. Not reviewed again.

