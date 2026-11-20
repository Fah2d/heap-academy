CHANGES REQUIRED

# Code review 2, WP-1.3 part 1

Reviewer: `code-reviewer`, fresh context. Reviewed `main..1a129a9` on `wp/1.3-pipeline-deploy-csp`, 2026-11-17.

No BLOCKER. Five MAJOR findings: two new (1 and 2), one that reopens a fixed round-1 finding (3), and two still open from round 1 (4 and 5). Nine MINOR findings.

`pnpm verify` exits 0 with `Test Files 16 passed (16)` and `Tests 463 passed (463)`, which matches the pull request. The eight round-1 mutations now fail a test each. These checks also pass: attribution, the action pins, and both checksums.

What remains is in three places:
- The CI checks that are meant to come from the base commit can still be bypassed by the pull request being checked.
- The deploy keeps going with no rollback target when the alias lookup fails for any reason.
- Some smoke checks and the deploy and rollback logic still have no test that fails when they are broken.

## MAJOR

1. **`.github/workflows/ci.yml:48-101`: a pull request can still loosen the checks that are meant to come from the base commit.** Only `scripts/check-attribution.mjs` and `.gitleaks.toml` are taken from the base. Three routes remain:
   - `scripts/install-gitleaks.sh` runs from the pull request (line 96), so a branch can swap it for a stub `gitleaks` that always exits 0.
   - gitleaks reads `.gitleaksignore` from the working directory (its `--gitleaks-ignore-path` default is `.`), so a branch can add fingerprints to ignore.
   - `pnpm install` and `pnpm lint` (line 50, which runs the branch's own `eslint.config`) execute pull-request code before the attribution steps (lines 82-92). That code can append a folder to `$GITHUB_PATH` and put a fake `node` or `gitleaks` ahead of the real ones for every later step.

   None of this needs Workflows permission, so the implementer's planned token can do all three. Security round-1 MINOR 9 is therefore **partly fixed**. The pull request's line "a pull request cannot loosen them" is not true as written.

   The mutation test confirms the gap: changing line 79 to `source=HEAD; else source=HEAD` gives `Tests 20 passed (20)` in `scripts/workflows.test.ts`. That test only greps for the `git show "$source:$file"` text.

   Fix:
   - Run the base-commit checks before any step that runs pull-request code: right after checkout and setup-node, before `pnpm install`. Taking the checks from the base copy is unchanged.
   - Take `install-gitleaks.sh` from the base too.
   - Pass `--gitleaks-ignore-path` pointing at an empty folder, or at the base's copy of the file.
   - Correct the pull request's wording to say what remains: the workflow file itself still comes from the branch, and the owner's push of workflow changes covers that.

2. **`.github/workflows/deploy.yml:90-101`: every failure of the alias lookup is silently turned into "no rollback target".**
   ```
   id=$(curl --fail ... "https://api.vercel.com/v4/aliases/$host" | jq --raw-output '.deploymentId // empty') || id=""
   echo "Production serves: ${id:-nothing yet}"
   ```
   A 401 or 403 (wrong token scope), a 5xx, a timeout, or a change in the response shape all become `id=""`. The log then reads "nothing yet", and the rollback step is skipped because of `steps.previous.outputs.id != ''`. Production then stays on a deployment that failed its smoke check.

   Meanwhile `docs/runbooks/deploy-and-rollback.md` (the "Smoke" row of the failure table) tells the owner "The job has already rolled back". The pull request itself lists "`GET /v4/aliases/{host}` works for a Hobby account without a `teamId`" as not verified, which is exactly the case where this fallback would fire on every deploy. Vercel's reference marks `teamId` optional and lists one error case, "404: The alias was not found".

   This is the silent catch the checklist forbids, and it sits in the NFR-REL-04 control. Fix:
   - Treat only HTTP 404 as "first deploy, nothing to roll back to"; fail the job on any other error.
   - Emit `::warning::` when there is no rollback target.

3. **`src/proxy.ts:924-929`, `src/infrastructure/logging/logger.ts:746-750`: the request path is client-controlled free text, so an email can still reach the log.** This reopens security round-1 MAJOR 5 through a different field.

   The proxy logs `route: \`${request.method} ${request.nextUrl.pathname}\`` for every request, including 404s. The logger comment says "No field takes free text, so no email ... can reach a log line (NFR-PRIV-03)". A probe in a throwaway copy, `proxy(new NextRequest("https://heap.test/ada@example.com/" + "x".repeat(3000)))`, wrote a line containing `ada@example.com`, and nothing limits its length (the probe's assertion `toContain("ada@example.com")` passed). The existing test only checks that the query string is dropped.

   Fix: log a bounded, known shape. For example:
   - match the path against the app's route patterns and log the pattern; otherwise
   - log a fixed code such as `unmatched`; or at least
   - cap the length and replace any segment that is not a safe slug.

   Add a test with an email in the path.

4. **No test fails on several broken smoke checks or on broken deploy logic.** Round-1 MAJOR 3 is **partly fixed**. Each change below was applied alone in a throwaway copy; every one still passes all tests.

   In `scripts/infra-verify.mjs`, run against `scripts/infra-verify.test.ts` (`Tests 27 passed (27)` each):

   | Mutation | What it means |
   |---|---|
   | `check("Content-Security-Policy", problems.length === 0, …)` changed to `true` | `policyProblems` is unit-tested, but its wiring into the smoke is not. A deployment with no or a wrong policy passes `verifyDeployment`. This is the NFR-SEC-02 check. |
   | `scripts.total > 0 &&` removed | A page with no scripts passes the nonce check. |
   | the request-ID-per-request condition changed to `true` | |
   | `/api/health` `nosniff` changed to `true` | |
   | `accepted.status === 204` changed to `true` | |
   | `get.status === 405` changed to `true` | |
   | `page … is HTML` changed to `true` | |

   In `.github/workflows/deploy.yml`, run against `scripts/workflows.test.ts` (`Tests 20 passed (20)` each):

   | Mutation | What it means |
   |---|---|
   | `(failure() \|\| cancelled()) &&` removed | Every successful deploy is rolled back. |
   | `\|\| cancelled()` removed | |
   | `!= 'skipped'` changed to `== 'success'` | No rollback when the promotion fails. |
   | `--skip-domain` removed | |
   | the Promote step replaced with `run: echo skipped` | |
   | `environment: name: production` changed to `staging` | The approval gate is gone. |

   In real use the smoke step would catch some of these, but no test does, and part 2's first deploy is the only other evidence.

   Fix:
   - Add broken variants to the fake server: no policy, a widened policy, no script tag, a fixed request ID, health without nosniff, a report endpoint that returns 200, and a GET that returns 200.
   - In `workflows.test.ts`, assert the exact `if:` of the rollback step, the `deploy` and `promote` command lines, and each job's `environment` name.

5. **Still open from round 1, unchanged on this branch:**
   - (a) MAJOR 5: the spec deviations. They are proposed in the pull request but no `spec-change` exists yet: `features/system` in `02-architecture.md` section 4, the database probe in section 9.2 (`/api/health`), approval on every production deploy (`07-operations.md` section 3 step 2 and `.claude/rules/ci.md`), and `upgrade-insecure-requests` over HTTPS only. Owner decision.
   - (b) MAJOR 6: the three-engine run of `e2e/csp.spec.ts`, the trial without `style-src-attr`, and no CI job that runs the spec. **Not fixed**; part 2.
   - (c) NFR-SEC-05 ("audited on every pull request"): it is not met for `tools/vercel-cli/package-lock.json`. That tree runs in the job holding `VERCEL_TOKEN`, and `npm audit` reports 1 critical and 21 high advisories in it. Owner's choice 12.

## MINOR

- **`deploy.yml:113`: on Vercel, the "production values" in the bundle check are placeholders for every Secret variable.** The comment says "the values are real". Vercel's `cli/env` documentation: "For Secret variables whose values cannot be read from Vercel, the CLI keeps the real value already in your local file. If your local file has no real value for that key, the CLI writes a placeholder". The runbook marks `RESEND_API_KEY` **Sensitive** (`infrastructure-setup.md:82`). So the deploy check covers names plus a placeholder. The CI marker build still covers the code path. Round-1 bundle MINOR is **partly fixed**. Correct the comment and the pull request claim, or drop the step.
- **`deploy.yml:126-139`: a promotion timeout can race the rollback.** Vercel: "When a timeout occurs, it does not affect the actual promotion which will continue to proceed" (default 3 minutes). The rollback can finish first, and the late promotion then puts the failed deployment back live. Wait on `vercel promote status` before rolling back, or roll back only after confirming which deployment is served.
- **`deploy.yml:136`: Hobby rollback eligibility after an earlier rollback is unverified.** Vercel: on Hobby "you can only roll back to the previous production deployment". After an earlier rollback, the served deployment may not be the "previous" one. The first deploys will show it; record it in part 2.
- **`src/features/system/server/csp-report.ts`: four changes survive `system.test.ts` (`Tests 9 passed (9)`):** `enforced: true` (disposition ignored), a fixed `warn` level, `effective-directive` and `violated-directive` precedence swapped, and `.max(100)` removed. Add a report-only case and a case with both directive fields.
- **`scripts/infra-verify.mjs`: the smoke never checks the static-file headers.** The pull request says the security headers cover every response, "static files included", but `infra-verify` never requests a `/_next/static/` file. Redirects and DNS are still unchecked (disclosed).
- **`infra-verify.mjs:387-393` `ghApi`: every error becomes `undefined`.** Each check then fails, so nothing passes by mistake. But the cause (auth, 404, rate limit) is lost: "could not be read" and "absent" look alike. Print the `gh` error.
- **`csp-report.ts`: no rate limit.** Each request can write 11 log lines, and nothing limits requests per client. A note for WP-7.x is enough if the spec has no limit here.
- **`e2e/csp.spec.ts:8`: the spec targets `/no-such-page` and only passes once WP-1.4 is merged.** Disclosed; keep the merge order.
- **`src/infrastructure/http/request-id.ts`: duplicates WP-1.4's helper.** Follow-up disclosed.

## Round-1 findings, one by one

| Round 1 | Status | Evidence |
|---|---|---|
| MAJOR 1, rollback leaves later deploys staged | **Fixed in design, untested** | `--skip-domain`, then `promote`; served deployment from `/v4/aliases/{host}` (endpoint and `deploymentId` field confirmed in Vercel's reference); smoke with `--release "$GITHUB_SHA"`; runbook corrected. Removing the promote step or `--skip-domain` survives the tests (MAJOR 4); the lookup fallback is MAJOR 2. |
| MAJOR 2, `--repo` misses branch policies | **Fixed** | `verifyRepository` checks main-only for all three environments, a required reviewer on `production`, and no repository secrets; five tests. Fork-approval read is still missing (disclosed). |
| MAJOR 3, smoke and proxy mutations survive | **Partly fixed** | All eight listed mutations now fail one test each (rerun: `1 failed \| 26 passed (27)` for the six `infra-verify.mjs` mutations, `1 failed \| 7 passed (8)` for the two proxy ones). Seven others in `infra-verify.mjs` and six in `deploy.yml` survive (MAJOR 4). |
| MAJOR 4, Vercel CLI without a lockfile | **Fixed; audit open** | `tools/vercel-cli/package-lock.json`: lockfileVersion 3, 389 packages, 0 without `integrity`; install scripts only in `esbuild` and `fsevents`; `npm ci --ignore-scripts`. Supabase CLI SHA-256 `3e54b98e…738ea` matches the GitHub release asset digest. gitleaks `551f6fc8…70eb` matches the published checksums file. Audit gap is MAJOR 5(c). |
| MAJOR 5, spec deviations | **Not fixed (proposed; owner)** | No `spec-change`; the four changes are listed in the pull request. |
| MAJOR 6, e2e and style trial open | **Not fixed (part 2)** | No browser; no CI e2e job. |
| MINOR, e2e filter and wait | **Fixed, not run** | `securitypolicyviolation` events; waits on `__next_f` and `window.next.version`. |
| MINOR, partial policy check | **Fixed in the unit, not in the smoke wiring** | Directive-by-directive comparison with tests; the `verifyDeployment` wiring survives a mutation (MAJOR 4). |
| MINOR, no fetch timeout, rollback skipped on cancel | **Fixed** | 15 s `AbortSignal.timeout`; a "hangs" test; `cancelled()` in the rollback `if` (untested, MAJOR 4). The probe report is ignored, not logged. |
| MINOR, bundle check | **Partly fixed** | An empty folder exits 1, with a test; the deploy check sees placeholders (MINOR above). |
| MINOR, report endpoint fan-out and paths | **Fixed** | At most 10 lines plus one count line; directive regex; kind codes only. |
| MINOR, logger fields | **Partly fixed** | Closed type, `release`, branded `RequestId`; `route` is still free text from the client (MAJOR 3). |
| MINOR, `next.config.ts` merge and duplicated ID pattern | **Disclosed** | Resolution described; dedupe is a follow-up. |
| Security MINOR 6, tag-object pin | **Fixed** | `git ls-remote`: `pnpm/action-setup` `refs/tags/v6.1.1^{}` = `73e46992e05b19abd31f2f3c20e0e7370d762115`. `actions/checkout` v7.0.1 = `3d3c42e5…`, `actions/setup-node` v7.1.0 = `949feb24…`, both as pinned. |
| Security MINOR 9, rules from the pull request head | **Partly fixed** | MAJOR 1. |

## Attribution

`git log --format=fuller main..1a129a9`: all 16 commits have author and committer `Fahad <Fah2d@users.noreply.github.com>`. The only Claude-related text in any commit message is the path `.claude/rules/ci.md`, which credits nothing. These all exit 0:
- `node scripts/check-attribution.mjs --range main..1a129a9`
- `node scripts/check-attribution.mjs --range main`
- `--stdin` on `docs/reports/pull-requests/WP-1.3-part-1.md`

## What I ran

- `pnpm verify`: exit 0; `Test Files 16 passed (16)`, `Tests 463 passed (463)`. It printed the sandbox's `ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK`.
- 38 single mutations, each in a throwaway `git archive` copy under `$TMPDIR` (since deleted), running the affected test files. The repository was not modified; `git status` shows only the pre-existing `.claude/settings.json`.
- A proxy probe with an email in the path.
- Attribution checks as above.
- `git ls-remote` on the three actions.
- The gitleaks checksums file and the Supabase release asset digests, from GitHub.
- Inspection of the Vercel CLI lockfile.
- Vercel documentation: Secret variables, `cli/env`, `cli/rollback`, `cli/promote`, and REST `GET /v4/aliases/{idOrAlias}`.

## What I did not check

- `next build`, `next start`, or `pnpm infra:verify` against a running server. I relied on the pull request's pasted output.
- The e2e spec (no browser).
- `actionlint`, or any real run of either workflow.
- Whether `vercel build` passes `HEAP_RELEASE` from the step's environment into the build.
- Whether `npm ci --ignore-scripts` leaves `esbuild` working for the Vercel CLI.
- Hobby rollback eligibility after an earlier rollback.
- `pnpm/action-setup` cache behavior in the credentialed job.
- The full `docs/runbooks/infrastructure-setup.md`. I read only the token, TLS, Sensitive, fork and shareable-link lines.
