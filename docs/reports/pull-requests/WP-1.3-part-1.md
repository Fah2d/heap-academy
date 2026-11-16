## What and why

The parts of WP-1.3 that need no accounts or secrets:

- the pull request pipeline and the deploy workflow;
- the nonce script policy and the other response headers;
- request IDs, `/api/health` and `/api/csp-report`;
- `pnpm infra:verify` and the bundle secret check;
- `SECURITY.md` and the two runbooks.

Everything that needs Vercel, Supabase, Resend, Google, the domain, or repository settings waits for you. `docs/runbooks/infrastructure-setup.md` is your checklist, in order.

This is a **draft**. The work package is done only when one real page is live through the pipeline with every check green.

## Work package

- Work package: WP-1.3 Pipeline, first deploy, and the script policy. Part 1 of 2.
- Requirements and threats: NFR-SEC-02, NFR-SEC-04, NFR-SEC-05, NFR-MAINT-06, NFR-MAINT-08, NFR-OBS-01, NFR-REL-04, FR-SYS-04; T-12, T-13, T-15, T-18; ADR-0028, ADR-0029.
- Time box 3 hours. By commit times, the first commit was at 19:06 and the review fixes ended at 19:32. Planning and reading before the first commit are not counted, so the real time is not measured.

## Done

| Item | Where |
|---|---|
| `static`, `unit`, `build` jobs. Actions pinned by commit, `permissions: {}`, a timeout on every job, frozen lockfile, no secrets, runs on `edited` | `.github/workflows/ci.yml` |
| `static`: attribution in the commits, the title and description, and the files; gitleaks over the range; then format, lint, types and `pnpm audit --audit-level high`. The attribution script, the gitleaks rules, its ignore file and its installer come from the base commit, and they run before any step runs the pull request's code. `gitleaks:allow` comments are ignored. What a pull request can still change is the workflow file itself; a change to it is pushed by you (choice 8) | same |
| `build`: production build, then the bundle secret check | same, `scripts/check-bundle.mjs` |
| Deploy: staging migrations, approval, production migrations, note the served deployment, `vercel build`, the bundle check on the production build, `deploy --prebuilt --prod --skip-domain`, `promote`, smoke that the address serves this commit, rollback on failure or cancel. Only a 404 for the alias means "nothing to roll back to"; any other answer stops the deploy. One concurrency group; no cache in credentialed jobs; the token is in the environment of the steps that talk to Vercel only, which is not a boundary (see Risks) | `.github/workflows/deploy.yml`, `scripts/apply-migrations.sh` |
| Every deploy tool locked: the Vercel CLI from its own npm lockfile, the Supabase CLI from its release archive checked by SHA-256 | `tools/vercel-cli/`, `scripts/install-supabase.sh` |
| Vercel's own production deploy from Git turned off | `vercel.json` |
| The nonce policy of `06-security-privacy.md` section 5.2, set on the request (where Next.js reads the nonce) and on the response | `src/proxy.ts`, `src/infrastructure/http/security-headers.ts` |
| HSTS, nosniff, referrer policy and permissions policy on every response, static files included | `next.config.ts` |
| Request IDs on every request. A client-sent ID is replaced, which closes WP-1.4's security MINOR 3. JSON logs with a closed set of fields: request ID, route, outcome code, duration, release. The line is built from those fields and each is checked at run time; the route is the method and a path pattern (`GET /:param`), so a path the client chose never reaches the log. Each server error is logged with its digest next to the request ID (WP-1.4 decision 3) | `src/infrastructure/http/request-id.ts`, `src/infrastructure/logging/`, `src/instrumentation.ts` |
| `GET /api/health` (liveness and the release) and `POST /api/csp-report` (both report formats, 8 kB cap as `07-operations.md` section 7 says, at most 10 log lines a request, only a known directive name and a kind code logged, no address) | `src/features/system/server`, `src/app/api` |
| `pnpm infra:verify --url <base> [--page <path>] [--release <sha>] [--repo OWNER/REPO]`. The page policy is compared with section 5.2 directive by directive. `--repo` checks the repository settings and that each environment deploys from `main` only | `scripts/infra-verify.mjs` |
| The rules of `.claude/rules/ci.md`, tested on the workflow files | `scripts/workflows.test.ts` |
| Policy enforced and no violation, in Chromium, Firefox and WebKit (written, not run) | `e2e/csp.spec.ts` |
| `SECURITY.md`; the infrastructure-setup runbook; the deploy-and-rollback runbook | repository root, `docs/runbooks/` |

## How it was verified

`pnpm verify`:

```
$ pnpm format:check && pnpm lint && pnpm typecheck && pnpm attribution && pnpm test
All matched files use Prettier code style!
$ eslint --max-warnings=0 .
$ tsc --noEmit
$ node scripts/check-attribution.mjs --branch && node scripts/check-attribution.mjs --files
$ vitest run --coverage
 Test Files  18 passed (18)
      Tests  501 passed (501)
```

Exit 0. Every `pnpm` run here also prints `ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK` from the sandbox's store lock; the scripts run regardless.

**Mutations.** Each of these changes to `scripts/infra-verify.mjs` or `src/proxy.ts`, applied one at a time, makes exactly one test fail. Before the review, the first four and the last two failed none:

- health `status === 200` changed to `true`;
- the HSTS max-age check;
- the Permissions-Policy check;
- the 413 check;
- the release match;
- the 400 refusal;
- `development: true`;
- `secure: false`.

After the second reviews, the mutations they found surviving each fail a test too, and the fake server has a broken variant for every smoke check: no policy, a widened policy, no script, a fixed request ID, health without nosniff, a report endpoint answering 200, a GET answering 200, a page that is not HTML, and a static file without the headers. `scripts/workflows.test.ts` now pins the exact rollback condition, the deploy and promote lines, the alias lookup's 404 branch, each job's environment, and the order of the base-commit checks before `pnpm install`.

**`pnpm infra:verify` on this branch alone, at 53e8ab0.** Built with `HEAP_RELEASE=0123456789abcdef0123456789abcdef01234567` and the fake `.env.example` values, then `next start` on 127.0.0.1:3141. Main has no page yet: the only page is Next's built-in not-found, which is prerendered static, so it cannot carry a nonce (E-21). **Merge WP-1.4 first**, or the first deploy's smoke fails on this line.

```
$ node scripts/infra-verify.mjs --url http://127.0.0.1:3141 --page /no-such-page --release 0123456789abcdef0123456789abcdef01234567
PASS  page /no-such-page is HTML: 404 text/html; charset=utf-8
PASS  Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-O/IFjo/90gm0AEJTfwfmrQ==' 'strict-dynamic'; style-src 'self' 'nonce-O/IFjo/90gm0AEJTfwfmrQ=='; style-src-attr 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; report-uri /api/csp-report; report-to csp
FAIL  every script carries the nonce: 0 of 12 scripts; without: <script src="/_next/static/chunks/2bg3w5buoxyi3.js" async=""> <script src="/_next/static/chunks/2tryakn-yp90k.js" async=""> <script src="/_next/static/chunks/turbopack-2u1d16houkiyo.js" async="">
PASS  a new nonce per request: O/IFjo/90gm0AEJTfwfmrQ== then ERDj3GbAWiiaU+7smjvcLg==
PASS  X-Content-Type-Options: nosniff
PASS  Referrer-Policy: strict-origin-when-cross-origin
PASS  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=(), browsing-topics=()
SKIP  Strict-Transport-Security: not applicable over plain HTTP (sent: max-age=63072000; includeSubDomains)
PASS  a static file carries the security headers: 200 /_next/static/chunks/2bg3w5buoxyi3.js
PASS  a request ID per request: 11eb2766-af6e-4cb6-90c0-dc6339f5e6e3 then 9a397e5e-fdcd-4b12-819f-b9fb116af8b8
PASS  a client-sent request ID is replaced: 11eb2766-af6e-4cb6-90c0-dc6339f5e6e3
PASS  /api/health answers ok: 200 {"status":"ok","release":"0123456789abcdef0123456789abcdef01234567"}
PASS  the address serves the expected release: 0123456789abcdef0123456789abcdef01234567, expected 0123456789abcdef0123456789abcdef01234567
PASS  /api/health is not cached: no-store
PASS  /api/health carries nosniff: nosniff
PASS  /api/csp-report accepts a report: 204
PASS  /api/csp-report refuses a malformed report: 400
PASS  /api/csp-report caps the size: 413
PASS  /api/csp-report refuses GET: 405

1 of 19 checks failed.
```

Then `curl http://127.0.0.1:3141/ada@example.com/x`. The server log has 0 lines containing `ada@`; the request is logged as `"route":"GET /:param/:param"`.

**That server is still running.** `pkill` answered "Cannot get process list" inside the sandbox, which hides processes from later commands. Stop it from your terminal: `pkill -f "next start --hostname 127.0.0.1 --port 3141"`.

**`pnpm infra:verify` on a throwaway merge of this branch with `wp/1.4-tokens-primitives-shell`, at 1a129a9, before the second reviews' fixes; not run again since.** WP-1.4's root layout reads the request headers, so every page renders per request (`ƒ /_not-found` in the build output). The merge was made in a separate clone under `$TMPDIR`, with the `next.config.ts` resolution described under "Merge note". Nothing was committed. On the merge: `tsc` and `eslint` clean, `vitest run` `Test Files 20 passed (20)`, `Tests 602 passed (602)`.

```
$ node scripts/infra-verify.mjs --url http://127.0.0.1:3132 --page /no-such-page --release 0123456789abcdef0123456789abcdef01234567
PASS  page /no-such-page is HTML: 404 text/html; charset=utf-8
PASS  Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-6DQQEJeSWa+TWJD0y+QLkQ==' 'strict-dynamic'; style-src 'self' 'nonce-6DQQEJeSWa+TWJD0y+QLkQ=='; style-src-attr 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; report-uri /api/csp-report; report-to csp
PASS  every script carries the nonce: 17 of 17 scripts
PASS  a new nonce per request: 6DQQEJeSWa+TWJD0y+QLkQ== then bEjPVUl9LrGWaiIpGrWIVQ==
PASS  X-Content-Type-Options: nosniff
PASS  Referrer-Policy: strict-origin-when-cross-origin
PASS  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=(), browsing-topics=()
SKIP  Strict-Transport-Security: not applicable over plain HTTP (sent: max-age=63072000; includeSubDomains)
PASS  a request ID per request: a36ed4ca-112f-4822-910c-03cd02564d5f then 513dee26-6d8d-4037-9c1b-e2471f0b7813
PASS  a client-sent request ID is replaced: a36ed4ca-112f-4822-910c-03cd02564d5f
PASS  /api/health answers ok: 200 {"status":"ok","release":"0123456789abcdef0123456789abcdef01234567"}
PASS  the address serves the expected release: 0123456789abcdef0123456789abcdef01234567, expected 0123456789abcdef0123456789abcdef01234567
PASS  /api/health is not cached: no-store
PASS  /api/health carries nosniff: nosniff
PASS  /api/csp-report accepts a report: 204
PASS  /api/csp-report refuses a malformed report: 400
PASS  /api/csp-report caps the size: 413
PASS  /api/csp-report refuses GET: 405

All 18 checks passed or do not apply.
```

The same page has 0 inline `style=` attributes in its server HTML. The server log holds no `csp-violation` line after the run, so the smoke adds nothing to the violation log.

**Bundle secret check.** `build` with `RESEND_API_KEY=re_ci_marker_not_a_real_key`:

- this branch: `No server variable (RESEND_API_KEY, HEAP_RELEASE) in 9 files under .next/static.`
- merged: `No server variable (RESEND_API_KEY, HEAP_RELEASE) in 20 files under .next/static.`

**Attribution over the whole history of `main`**: `node scripts/check-attribution.mjs --range main`, which covers 38 commits, exit 0.

**Secret scan before going public.** I ran it in a clone, after `git fetch https://github.com/Fah2d/heap-academy.git '+refs/pull/*:refs/remotes/pull/*' '+refs/heads/*:refs/remotes/github/*'`. That covers every branch, `refs/pull/1/head` and `refs/pull/2/head`.

```
$ gitleaks git --log-opts="--all" --redact --no-banner --config .gitleaks.toml <clone>
INF 67 commits scanned.
INF scanned ~1474074 bytes (1.47 MB) in 114ms
INF no leaks found
```

Run it once more yourself just before you make the repository public (runbook step 11), because commits made after this scan are not covered.

**Not verified:**

- **The e2e policy test** (`e2e/csp.spec.ts`) has not run. No browser can start in this machine's sandbox; the details are in the WP-1.4 pull request.
- **The policy without `style-src-attr 'unsafe-inline'`.** This needs a browser. What I could measure: the server-rendered not-found page has no inline `style` attribute. The WP-1.4 progress bar sets one, and React Aria's overlays set them at run time. Try it in WP-1.3 part 2 with the e2e suite.
- **Pipeline duration**: there is no CI run yet.
- **The workflows themselves** have not run: no runner, and no `actionlint` on this machine. `scripts/workflows.test.ts` checks the rules from `.claude/rules/ci.md` as text.
- **Vercel behavior the docs leave open:** that `vercel build` needs no token after `vercel pull`; that `GET /v4/aliases/{host}` works for a Hobby account without a `teamId`; and that `npm ci --ignore-scripts` leaves the Vercel CLI working (2 packages in its tree declare install scripts). The first deploy shows each one.
- **The e2e wait on `window.next.version`**: confirmed in `next/dist/client/app-bootstrap.js`, not in a browser.
- **The digest log line on a running server.** No route on this branch throws, so `onRequestError` is unit-tested only. Whether Next.js passes the proxy's replaced `x-request-id` in the request headers it gives `onRequestError` is not verified; if it does not, the line has `requestId: "none"` and the digest still finds it.
- **The fork-approval mapping.** GitHub's REST reference gives `approval_policy` with `first_time_contributors_new_to_github`, `first_time_contributors` and `all_external_contributors`. That the last one is the screen's "Require approval for all external contributors" is my reading of the name; the reference does not say.

## Reviews

Two rounds each of `code-reviewer` and `security-reviewer`, fresh contexts. Reports in `docs/reports/reviews/WP-1.3/`.

- **Round 1** on `main..830bc18`: both CHANGES REQUIRED, no BLOCKER. Fixed in 3f926b9..5a7af8b: the rollback that left later deploys staged; the environment branch-policy checks; smoke checks that could not fail; deploy tools outside a lockfile; the logger allowlist; the token's Workflows permission; CI rules read from the pull request; the tag-object pin; migration TLS; report fan-out; the e2e wait; the empty-folder bundle check.
- **Round 2** on `main..1a129a9`: both CHANGES REQUIRED, no BLOCKER. Not run again after these fixes.

Round 2, fixed in 4c09c2e..fc9aef9:

- **The route in the log was client text** (code MAJOR 3, security MAJOR 1). An email in the path reached the log, and the logger copied any extra field. The line is now built from the named fields, each checked at run time, and the route is a pattern. Tests with an email in the path and an extra field.
- **The rollback runbook typed the Vercel token into a terminal** (security MAJOR 2). The command-line rollback is gone; the dashboard's Instant Rollback needs no token.
- **A pull request could loosen its own checks** (code MAJOR 1, security MINOR 3). The base-commit checks run before `pnpm install`; the gitleaks installer and ignore file come from the base; `--ignore-gitleaks-allow`.
- **The alias lookup failed open** (code MAJOR 2, security MINOR 5). Only a 404 means no target, with a warning; anything else stops the deploy before it starts. The runbook has a row for it.
- **Surviving mutations** (code MAJOR 4): see "Mutations" above.
- **The report endpoint** (security MINOR 6, code MINOR): 8 kB cap from the spec, a closed list of directive names, tests for report-only, precedence and the 100-report limit.
- **The token "isolation" claim** (security MINOR 4): reworded in `deploy.yml`, and under Risks.
- **The bundle check's coverage** (security MINOR 9, code MINOR): `--env-file` adds every server variable the pull wrote; the comment says Sensitive variables arrive as placeholders.
- **`--repo`** (security MINOR 8, code MINOR): fork approval and Dependabot secrets; `gh` errors are printed.
- **Static-file headers** (code MINOR): checked by the smoke.
- **Required checks tied to GitHub Actions** (security MINOR 10): in the ruleset step.
- **The promotion timeout race** (code MINOR): the runbook says to check which deployment is Current after a timed-out promotion. The workflow itself does not wait on `vercel promote status`: not built, because I could not check the CLI's options here.
- **The server error digest** (WP-1.4 decision 3): logged with the request ID.

Open, for you:

- **The spec text** (choices 1, 2, 5 and 7, and the 8 kB report cap now matches the spec). Proposed in the `spec-change` pull request, `wp/spec-change-shell-nav-errors`, each marked "pending owner decision".
- **The Vercel CLI's audit result** (choice 12; code MAJOR 5c, security MINOR 4).
- **A deny rule for `gh api -X PUT .../merge`** (security MINOR 11). `.claude/settings.json` is yours.

Open, for part 2 or later:

- **The three-engine run and the trial without `style-src-attr`** (code MAJOR 5b). Needs a browser.
- **A build check that fails on any static page** (security MINOR 7). Not built: on this branch alone it would fail `build` until WP-1.4 merges.
- **Hobby rollback eligibility after an earlier rollback** (code MINOR). The first deploys show it.
- **A rate limit on `/api/csp-report`** (code MINOR). The spec sets none; noted for WP-7.x.
- **The duplicated request ID helper** (code MINOR). Follow-up after both merge.

## Choices I made while you were away

1. **A new module `src/features/system`** (`spec-change`). `src/app` may import only `features` and `messages`, and neither route belongs to an existing feature.
2. **Approval on every production deploy, not only those with a migration.** A GitHub environment's required reviewer applies to every job that names it. Approving only when there is a migration would need a fourth environment. This is stricter than the spec; say if you want the fourth environment instead.
3. **Migrations use a database URL per environment** (`SUPABASE_DB_URL` in `staging` and in `production`), not a Supabase access token. A Supabase personal access token reaches every project on the account, which would mix staging and production credentials.
4. **Deploy, promote, roll back.** Before deploying, the workflow asks `GET /v4/aliases/{host}` which deployment the production address serves (`deploymentId`). It deploys with `--skip-domain`, then runs `vercel promote`. The two steps are the same whether or not an earlier rollback turned off the automatic domain assignment, and promoting turns it back on. If the promotion or the smoke fails, or the run is cancelled, it runs `vercel rollback <that id>`. On Hobby, only the previous deployment is eligible.
5. **`upgrade-insecure-requests` is left out over plain HTTP.** It applies on `https:` only, so `next start` on 127.0.0.1 and the e2e servers still load their files.
6. **`report-uri` and `report-to`.** Firefox only implements `report-uri`.
7. **`/api/health` reports liveness and the release.** "Whether the database answers" joins it with the database client in WP-2.1.
8. **The implementer's token has no Workflows permission.** With it, a pushed branch could carry a workflow that grants itself `checks: write` and posts a passing `static` check (security review MAJOR 3). So when a work package changes `.github/workflows/`, I commit the change and stop, and you push that branch with your own login. **This pull request is such a branch**, but it was pushed before the token exists.
9. **gitleaks is downloaded in CI and checked against its published SHA-256** (`scripts/install-gitleaks.sh`), because the unit tests run the real binary too.
10. **The request ID helpers are in `src/infrastructure/http/request-id.ts`.** They duplicate the header name and format in WP-1.4's `src/features/shell/request-id.ts`. When both are merged, a follow-up can make one import the other.
11. **CI runs all three jobs on every event, `edited` included.** A job skipped on `edited` would report success for the same commit and could hide an earlier failure.
12. **The Vercel CLI has its own npm lockfile** (`tools/vercel-cli`), because `pnpm add` is blocked in this sandbox. It is installed with `npm ci --ignore-scripts`, outside the app's dependency tree. `npm audit` on it reports 38 advisories: 1 critical (`tar`), 21 high (`undici`, `path-to-regexp`, `minimatch`, `js-yaml`, `zod`, `smol-toml`, and Vercel's own packages that pin them), 16 moderate. All of them sit inside Vercel's dependencies of `vercel@65.16.0`, which is the latest release (published 2026-11-14). Nothing passes untrusted input to them; they process our own build. `pnpm dlx` would resolve the same pinned versions without a lock. No audit gate runs on this lockfile, because it would fail every run. Your choice: accept it as is (recommended), or move the CLI into `devDependencies` from your machine with `pnpm add -D --save-exact vercel@65.16.0`, which puts it under `pnpm audit --audit-level high` and fails `static` today.
13. **The release is the commit SHA**, set by the deploy workflow as `HEAP_RELEASE` at build, parsed by the environment schema (a full SHA or `local`), and inlined by `next.config.ts`. A prebuilt deployment does not see the build's environment at run time.

**Spec changes to approve** (the reviewers asked for them). They are written into the `spec-change` pull request on `wp/spec-change-shell-nav-errors`, each marked "pending owner decision"; this branch does not edit the spec:

- `02-architecture.md` section 4: add `features/system`, which holds the platform routes: health and the policy report.
- `08-delivery-plan.md` WP-2.1 "Builds": add "the database check in `/api/health`".
- `07-operations.md` section 3 step 2 and `.claude/rules/ci.md`: the owner approves every production deploy, or you choose a fourth environment.
- `06-security-privacy.md` section 5.2: "`upgrade-insecure-requests` over HTTPS".

## What waits on your setup

Do these in order, from `docs/runbooks/infrastructure-setup.md`. Steps 1, 3 and 4 are marked START FIRST.

1. The domain, and Resend domain verification. Start both first; they can take hours.
2. Two Supabase Free projects, and the Google sign-in client.
3. The Vercel Hobby project: variables, deployment protection, Git Fork Protection, the deploy token. The Supabase session-pooler URLs end with `?sslmode=require`. Also try a shareable link on one preview and record whether it works. Vercel's documentation says shareable links are on all plans, with one link per Hobby account.
4. The GitHub environments `staging`, `production` and `production-backup`, each with its secrets, and `main` only.
5. The fine-grained token for me, without Workflows. Then branch protection with `static`, `unit` and `build`.
6. The history scan again, then make the repository public, with the settings in runbook step 11. Check them with `pnpm infra:verify --url https://<domain> --repo Fah2d/heap-academy`.

After that, WP-1.3 part 2 can do the rest of the "Done when":

- the first live deploy;
- a pull request with a failing check that cannot merge, and one with attribution that fails `static`;
- the pipeline duration;
- the three-engine policy run, and the try without the style attribute line;
- `infra:verify` against the production address;
- the environment branch policies.

## Merge note

**Merge WP-1.4 first.** On `main` alone the only page is static, so the first deploy's smoke would fail the nonce check and roll back.

This branch and WP-1.4 both change `next.config.ts`, so this one will conflict after WP-1.4 merges. The resolution keeps WP-1.4's function form (`agentRules`, the `.dev.tsx` page extensions, the poll option). Inside it, it adds this branch's release parsing at the top, `env: { HEAP_RELEASE: release }` after `reactStrictMode`, and `headers()`. That resolved file passed `prettier`, `tsc` and `eslint`, built, and passed all 18 `infra:verify` checks.

## Risks and rollback

Nothing is deployed. Once the owner steps are done, the first merge deploys through `deploy.yml`, and rollback is the runbook.

The policy is enforced from the first deploy, as the spec asks, so a missing nonce would block scripts. `infra:verify` in the smoke step catches that and rolls back.

The Vercel token is in the environment of the Vercel steps only, but that is not a boundary. Every step of the production job shares one runner, so a build-time dependency run by `vercel build` could change what a later step runs. Such a dependency already writes the production bundle. The stronger form is a build job without credentials that hands its output to the deploy job; it is not built.

## Definition of Done

- [ ] Every "Done when" line is met. **Not met:** most lines need accounts (see above). This is part 1.
- [x] Every cited Must requirement has a passing test that names its ID, apart from the e2e lines, which have not run.
- [x] `pnpm verify` passes. CI has not run yet.
- [x] No stub, dead control, placeholder or invented number. `/api/health` reports what exists today.
- [x] No new tables. No new server actions.
- [x] Every reviewer blocker is fixed: there were none in either round. The MAJORs are fixed or listed as open under Reviews. The reviewers have not seen the round-2 fixes.
- [x] No AI attribution in any commit or in this description. `git log --format=fuller main..HEAD` shows author and committer `Fahad <Fah2d@users.noreply.github.com>` on every commit.

## Updating this pull request

`gh` cannot reach GitHub from the sandbox. From your terminal, in the repository root:

```sh
gh pr edit 4 --body-file docs/reports/pull-requests/WP-1.3-part-1.md
```
