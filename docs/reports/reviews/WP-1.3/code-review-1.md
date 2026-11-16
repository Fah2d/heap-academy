# Code review 1, WP-1.3 part 1

Reviewer: `code-reviewer`, fresh context. Reviewed `main..830bc18`. 2026-11-16.

Verdict: **CHANGES REQUIRED**. No BLOCKER.

The reviewer ran `pnpm verify` in a copy (`Test Files 16 passed (16)`, `Tests 432 passed (432)`), applied mutations, checked attribution over `main` and the branch (both exit 0), and read Vercel's rollback and promotion documentation. It did not run `next build`, `infra:verify` against a server, or the e2e spec. It did not check the pinned action SHAs or the gitleaks SHA-256, because GitHub was unreachable from its copy.

## MAJOR

1. **After the first automatic rollback, every later deploy quietly does nothing.** `deploy.yml:79-89, 96-112`, `deploy-and-rollback.md:34`. Vercel: "After a rollback, Vercel turns off auto-assignment of production domains." A later `vercel deploy --prod` stays staged, the smoke checks the old deployment and passes, and the run is green with the new code not live. "Remember the current production deployment" takes the newest READY production deployment, which is not always the one serving. Fix: find the serving deployment from the alias, promote after deploying, make the smoke confirm the new deployment is served, and correct the runbook.
2. **`--repo` does not check the deployment branch policies** that T-18's verification column (`06-security-privacy.md:72`) gives to `pnpm infra:verify`, for `staging`, `production`, and `production-backup`. Can be built now against the injected `api` fake.
3. **No test can fail several smoke checks or the proxy's wiring.** Mutations that survived: health `status === 200` changed to `true`, the HSTS max-age check, the Permissions-Policy check, the 413 check (`Tests 10 passed (10)`); and `proxy.ts` with `development: true, secure: false` (`Tests 6 passed (6)`). Fix: a broken variant of the fake server per check, and a proxy test for the production flags.
4. **The job holding production credentials installs the Vercel CLI without a lockfile.** `deploy.yml:23, 94-111`. `pnpm dlx vercel@65.16.0` resolves Vercel's whole dependency tree fresh on every run (T-13).
5. **Spec deviations are disclosed but the spec is not updated.** (a) `src/features/system` is not in `02-architecture.md` section 4, and its handlers are not in `server/` (section 4.2). (b) `health.ts:6`: section 9.2 says "Liveness, and whether the database answers"; WP-2.1's "Builds" does not carry the database probe. (c) `deploy.yml:53`: approval on every production deploy; `07-operations.md` section 3 step 2 says "Otherwise continue". (d) `security-headers.ts:46`: `upgrade-insecure-requests` only over HTTPS; section 5.2 lists it always. Each needs the owner's decision and a `spec-change`.
6. **Three "Done when" items need no account but are open:** the three-engine run, the try without `style-src-attr`, and no CI job running the e2e spec. A test that has never run is not evidence for NFR-SEC-02.

## MINOR

- `e2e/csp.spec.ts:22-24, 36`: the console filter also catches CSP warnings that are not violations; `waitForLoadState("networkidle")` waits on time; nothing shows a script ran.
- `infra-verify.mjs:49-79`: `script-src-elem`, `script-src-attr`, `wasm-unsafe-eval`, `upgrade-insecure-requests` over HTTPS, the style nonce, `connect-src`, `worker-src`, `form-action`, `img-src`, `font-src`, redirects, and DNS not checked.
- `infra-verify.mjs:157, 197, 228, 271-291`: no fetch timeout, so a hung production hits the job timeout, the job is cancelled, and `if: failure()` skips the rollback. Each smoke posts a fake violation, adding a `csp-violation` line to the real log.
- `check-bundle.mjs:72-82`: passes a folder with no files. The production build in `deploy.yml` is never bundle-checked.
- `csp-report.ts:44, 139-147`: up to 100 log lines per request; `blocked` and `document` keep full paths; `value.slice(0, 64)` to `value` survives the tests.
- `logger.ts:9-19`: no `release` field; `event` and `detail` outside the allowlist; `requestId` not the branded type.
- `next.config.ts` conflicts with WP-1.4. The request ID pattern exists in three places.

## What the implementer did

| Finding | Result |
|---|---|
| MAJOR 1 | Fixed in 0f49d6b and 5a7af8b. The serving deployment comes from `GET /v4/aliases/{host}` (`deploymentId`). Deploy is `--skip-domain`, then `vercel promote`, which restores auto-assignment. `/api/health` reports the release, and the smoke runs with `--release "$GITHUB_SHA"`. Rollback also runs on a cancelled job. Runbook corrected. |
| MAJOR 2 | Fixed in 1bd9fd4: each environment deploys from `main` only, `production` has a required reviewer, and there are no repository-level secrets. Five tests. |
| MAJOR 3 | Fixed in 1bd9fd4 and 3f926b9. Rerun of the mutations: each of health 200, HSTS max-age, Permissions-Policy, 413, the release match, the 400 refusal, `development: true`, and `secure: false` now fails one test. |
| MAJOR 4 | Fixed another way in 0f49d6b. `pnpm add -D vercel` is blocked here (`ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK`), so the CLI has its own npm lockfile in `tools/vercel-cli` (389 packages, each with `integrity`), installed with `npm ci --ignore-scripts`. `npm audit` on that tree: 38 advisories (1 critical `tar`, 21 high), all inside Vercel's own dependencies. Raised to the owner. |
| MAJOR 5 | (a) layout fixed: the handlers are in `server/` (3f926b9). The spec text, and (b), (c), (d), are proposed in the pull request for the owner. No spec file was edited. |
| MAJOR 6 | Open; needs a browser. In the pull request's list for part 2. |
| e2e MINOR | Fixed in 277339e: only `securitypolicyviolation` events count; the test waits until `__next_f` is filled and `window.next.version` is set (set in `next/dist/client/app-bootstrap.js`). Not run. |
| policy MINOR | Fixed in 1bd9fd4: the policy is compared directive by directive with section 5.2; any extra directive fails; `upgrade-insecure-requests` is required over HTTPS. Redirects and DNS not checked. |
| timeout MINOR | Fixed: 15 s per request, a test with a server that never answers, rollback on `cancelled()`. The probe now sends a report with no violation in it and a malformed one; neither is logged. |
| bundle MINOR | Fixed: no files means exit 1, with a test. `deploy.yml` checks `.vercel/output/static` with the pulled production values. |
| report endpoint MINOR | Fixed in 3f926b9: at most 10 lines a request plus one count line; only the directive and a kind of blocked resource (`inline`, `eval`, `self`, `external`, ...) are logged, no address. |
| logger MINOR | Fixed in 3f926b9: fields are request ID (branded), route, outcome, duration, release, and nothing else. |
| merge MINOR | The resolved `next.config.ts` is described in the pull request. The request ID pattern dedupe is a follow-up after both merge. |

Not re-reviewed after the fixes.
