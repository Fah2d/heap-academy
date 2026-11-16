CHANGES REQUIRED

# Security review 2, WP-1.3 part 1

Reviewer: `security-reviewer`, fresh context. Reviewed `main..1a129a9` on `wp/1.3-pipeline-deploy-csp`.

There is no BLOCKER. This change has no tables, no server actions, no admin routes, no lesson content and no runtime code, so the checklist items for policies, the admin area, T-06, T-21 and the worker do not apply. I found no way for a non-admin to change content or read a solution. Two MAJOR findings remain: the logger still lets any field through at run time, and the rollback runbook puts a production credential on the development machine.

**Something you should know first.** While probing the logger I copied a test file into `src/infrastructure/logging/zz-probe.test.ts`. That breaks the read-only rule. I deleted it at once, before anything ran. `git status --porcelain` then showed only the `.claude/settings.json` change that was already there. I ran the probe again from `$TMPDIR` instead.

## MAJOR

1. **The logger's field allowlist exists only in the types, and the proxy logs the raw path the client sends.** `src/infrastructure/logging/logger.ts:34`, `src/proxy.ts:39`. Threat T-16.
   - **Attack:** someone requests `GET /ada@example.com`. Separately, any future caller that passes an object variable with an extra field gets that field written to the log. TypeScript only rejects extra fields on object literals, so it does not stop this.
   - **Evidence:**
     - Live on `next start`: `{"...","route":"GET /ada@example.com","outcome":"request"}`.
     - The logger's own code, run with an extra field, wrote `"email":"ada@example.com"`, because `{ time, release, ...entry }` copies every property.
     - `logger.test.ts` only passes allowed fields. Nothing tests that an unknown field is dropped. T-16 names "unit tests on the logger" as its proof, so a missing test here is at least MAJOR.
   - **Fix:**
     - Build the line from named fields: `{ time, release, level, requestId, route, outcome, durationMs }`.
     - Make `route` a bounded value. Log the method plus a path pattern or a capped, normalized path; Next.js does not give the proxy a route name.
     - Add tests that an extra field and an email-shaped path segment never reach the line.
   - **Round 1:** finding 5 is partly fixed. `detail` is gone and the report endpoint now reduces reports to codes.

2. **The rollback runbook puts the production Vercel token on the development machine, typed inline into a command.** `docs/runbooks/deploy-and-rollback.md:33`. Threat T-18.
   - **The line:** "`VERCEL_TOKEN=<Vercel token> tools/vercel-cli/node_modules/.bin/vercel rollback ...`" "from your machine".
   - **Attack:** the token ends up in `~/.zsh_history` on the machine where the implementer runs. The sandbox's read deny list covers `.env` files, not shell history. That token can deploy anything to production.
   - **Conflicts:**
     - It breaks "Production credentials are never on the development machine" in T-18 and section 5.5.
     - It breaks CLAUDE.md rule 10.
     - It contradicts the runbook's own table: "Vercel token | GitHub `production` environment | Anywhere else" (`infrastructure-setup.md:124`).
   - **Fix:** remove the CLI option, or limit it to a machine without Claude Code, with the token read from a prompt rather than typed into the command. The dashboard's Instant Rollback (step 3) is enough.

## MINOR

3. **A pull request can still loosen the secret scan.** `.github/workflows/ci.yml:94-101`. Threat T-12.
   - **Attack:** add `# gitleaks:allow` to the line holding the secret, or commit a `.gitleaksignore` with the finding's fingerprint. Gitleaks reads that file from the working directory, which is the pull request's checkout. A third route: `scripts/install-gitleaks.sh` is also run from the pull request's head.
   - **Evidence:** tested in scratch repositories with the repository's `.gitleaks.toml` and gitleaks 8.30.1.
     - A `sb_secret_…` line marked `gitleaks:allow` gave "no leaks found". The same scan with `--ignore-gitleaks-allow` gave "leaks found: 1".
     - A `.gitleaksignore` holding the fingerprint gave "no leaks found".
   - **Fix:**
     - Add `--ignore-gitleaks-allow --gitleaks-ignore-path "$RUNNER_TEMP/checks"`, and copy the base commit's `.gitleaksignore` there if one exists.
     - Take `install-gitleaks.sh` from the base commit as well.
     - Assert these in `workflows.test.ts`.
     - Correct the pull request's claim that "a pull request cannot loosen them".
   - **Round 1:** finding 9 is partly fixed.

4. **Holding the token out of the Build step does not isolate it from the build.** `deploy.yml:10-11,106-128`. Threat T-13.
   - **Attack:** a compromised build-time dependency run by `vercel build` adds a folder to `$GITHUB_PATH` with a fake `vercel` in it, or edits `tools/vercel-cli/node_modules/vercel/…`. The Deploy, Promote or Rollback step then runs that code with `VERCEL_TOKEN` set. All these steps run on one runner and share its file system.
   - **What it adds:** not much. Such a dependency already writes the production bundle and sees the pulled production variables. But the comment "never to the build" and the pull request text claim a boundary that does not exist.
   - **Fix:** reword the claim and record the residual risk. A real separation needs a build job without credentials that hands its output to the deploy job.
   - **Owner decision:** the Vercel CLI's `npm audit` result (1 critical, 21 high) is still open (pull request choice 12).
   - **Round 1:** finding 4 is partly fixed. The tools are now locked: 389 of 389 entries in `tools/vercel-cli/package-lock.json` carry `integrity`, and the Supabase CLI is checked by SHA-256.

5. **The lookup of the deployment production serves fails open.** `deploy.yml:96-99`. Threat NFR-REL-04.
   - **Problem:** `|| id=""` treats any API error (403, a missing `teamId`, a timeout) the same as "nothing deployed yet". The deploy then goes ahead with no rollback target, and a failed smoke leaves the broken deployment live. The run does go red.
   - **Fix:** fail the step unless the response is 404, which is the first-deploy case.
   - **Round 1:** finding 1 is otherwise fixed: explicit `promote`, the release check in the smoke, rollback on failure or cancel.

6. **The report endpoint differs from the operations spec, and its directive filter is not a closed set.** `src/features/system/server/csp-report.ts:15,55`. Threat T-16.
   - **Size:** `07-operations.md` section 7 says report bodies are at most 8 kB. The code allows 16 KiB, and the pull request does not list this as a choice. Live, a 9,129-byte report got 204.
   - **Directive:** `/^[a-z][a-z-]{0,39}$/` accepts any lowercase word. Live, the log got `"outcome":"csp-violation:fatima-alharbi:other"`.
   - **Fix:**
     - Use 8 KiB, or open a `spec-change`.
     - Map the directive against a fixed list of policy directive names, and log `unknown` for anything else.

7. **There is still no check that fails on a static HTML route.** Threats NFR-SEC-02, ADR-0028.
   - **Evidence:** on this branch alone, `infra:verify` gives "FAIL every script carries the nonce: 0 of 12 scripts", and the build lists `○ /_not-found`.
   - **Dependency:** WP-1.4 must merge first, as the pull request says.
   - **Round 1:** finding 7 is still open.

8. **`infra:verify --repo` reads neither the fork-approval setting nor Dependabot secrets.** `scripts/infra-verify.mjs:412-441`. Threat T-18, ADR-0029.
   - **Fix:** add `repos/R/actions/permissions/fork-pr-contributor-approval` and `repos/R/dependabot/secrets` (`total_count === 0`).
   - **Round 1:** finding 2 is fixed apart from this; the tests at `infra-verify.test.ts:316-357` cover the rest.

9. **The production bundle check only searches the values of variables named in `.env.example`.** `scripts/check-bundle.mjs:45-54`, `deploy.yml:111`. Threat T-12.
   - **Problem:** `.vercel/.env.production.local` holds every production variable. A variable set in Vercel but missing from `.env.example` would not be searched for.
   - **Fix:** in the deploy step, also search the value of every variable in the pulled file that is not `NEXT_PUBLIC_`.

10. **The ruleset step does not tie the required checks to GitHub Actions.** `docs/runbooks/infrastructure-setup.md:162`.
    - **Risk:** low, because the implementer's token has Commit statuses read only.
    - **Fix:** when adding `static`, `unit` and `build`, choose GitHub Actions as their source. Then a status posted by any other integration cannot satisfy them.

11. **The implementer's token can still merge a pull request through the API.** `gh api -X PUT repos/R/pulls/N/merge` is not blocked. This needs a deny rule in `.claude/settings.json`, which is for the owner to add.
    - **Round 1:** finding 13 is still open.

## Round 1 findings

| # | Status | Evidence |
|---|---|---|
| 1 | Mostly fixed | Promote, smoke with `--release`, rollback to the served deployment (`deploy.yml:90-139`). Fails open on API errors (MINOR 5). |
| 2 | Partly fixed | Environment branch policies, the production reviewer and repository secrets are checked and tested. Fork approval is not (MINOR 8). |
| 3 | Fixed in the runbook | `infrastructure-setup.md:133-146`: no Workflows permission, Commit statuses read only. The token itself cannot be checked from here. |
| 4 | Partly fixed | Tools locked and checksummed; setup-cli and setup-bun are gone. The token "isolation" is not a boundary (MINOR 4). |
| 5 | Partly fixed | `detail` removed; reports reduced to codes. The allowlist is not enforced at run time and the raw path is logged (MAJOR 1). |
| 6 | Fixed | `git ls-remote`: `pnpm/action-setup` v6.1.1 peels to `73e46992…`; checkout `3d3c42e5…` and setup-node `949feb24…` match their tags. |
| 7 | Open | 0 of 12 scripts carry the nonce on this branch alone (MINOR 7). |
| 8 | Fixed | `policyProblems` requires an exact set per directive and rejects unknown directives. Tests at `infra-verify.test.ts:61-93`. |
| 9 | Partly fixed | The two rule files come from the base commit, but the scan can be suppressed from the pull request (MINOR 3). |
| 10 | Fixed | `MAX_LOGGED_VIOLATIONS = 10` plus one count line; tested at `system.test.ts:116`. |
| 11 | Fixed | `apply-migrations.sh` masks the password and refuses a URL without `sslmode=require` or `verify-full`. |
| 12 | Fixed | `workflows.test.ts` covers expressions in `run:`, `persist-credentials: false`, no cache or artifact actions, and no `production-backup`. |
| 13 | Open | For the owner (MINOR 11). |

## What I ran

- `pnpm verify` at `1a129a9`: exit 0. 16 test files and 463 tests passed; format, lint, types and attribution were clean.
- A production build of `git archive 1a129a9` under `$TMPDIR`, with `HEAP_RELEASE` set to a fake SHA and the marker `RESEND_API_KEY`.
  - Build output: `○ /_not-found`, `ƒ /api/csp-report`, `ƒ /api/health`.
  - `check-bundle.mjs .next/static`: "No server variable (RESEND_API_KEY, HEAP_RELEASE) in 9 files", exit 0.
- `next start` on 127.0.0.1:3209, started and stopped within one command, so nothing is left running.
  - `infra:verify --page /no-such-page --release <sha>`: 17 of 18 pass. The one failure is the nonce check (finding 7).
  - Probes: an email in a report directive (204, logged as `unknown:external`); a name in a directive (logged as is); an email in the path (logged as is); a 9,129-byte report (204); a forged Host (`Reporting-Endpoints` stays on the server's own origin).
  - Static chunks carry HSTS, nosniff, the referrer policy and the permissions policy.
- Gitleaks 8.30.1 in scratch repositories: both suppressions in finding 3 are reproduced.
- The logger's spread run under Node from `$TMPDIR` (finding 1).
- `git ls-remote` on the three pinned actions.
- I read every file in the diff, sections 4 and 5 of the security spec, sections 1 to 8 of the operations spec, ADR-0028, ADR-0029 and `.claude/rules/ci.md`.

## What I could not check from here

- `e2e/csp.spec.ts` in Chromium, Firefox and WebKit: no browser runs in this sandbox.
- The workflows on a real runner, and `actionlint`.
- GitHub settings: environments, rulesets, the token's real permissions, fork approval, secret scanning, interaction limits. `gh` cannot reach GitHub.
- Vercel behavior:
  - whether `vercel build` works without a token after `vercel pull`;
  - whether `GET /v4/aliases/{host}` works on Hobby without a `teamId`;
  - whether `vercel pull` writes the token or `VERCEL_OIDC_TOKEN` to disk, and whether sensitive variables are pulled;
  - Git Fork Protection and deployment protection;
  - whether `nextUrl.protocol` is `https:` on Vercel. If it is not, `upgrade-insecure-requests` would be missing. The HTTPS smoke would catch that.
- Supabase TLS on the session pooler, and whether `sslmode=require` checks the certificate. It does not: that needs `verify-full`.
