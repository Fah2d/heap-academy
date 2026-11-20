# Security review 1, WP-1.3 part 1

Reviewer: `security-reviewer`, fresh context. Reviewed `main..830bc18`. 2026-11-16.

Verdict: **CHANGES REQUIRED**. No BLOCKER. The reviewer found no path for a non-admin to change content or read a solution, and no script injection path: every event field reaches the shell through an environment variable, the `pull_request` trigger has no secrets, `permissions: {}` is at the top of both workflows, and `persist-credentials: false` is set everywhere.

The reviewer read the diff, sections 4 to 7 of the security spec, sections 1 to 4 of operations, ADR-0028, ADR-0029, and `.claude/rules/ci.md`. In a copy, it ran the eight affected test files (50 tests passed), the logger and report-endpoint probes, `tsc`, `next build`, the bundle check (clean), and `next start` probed with curl. A forged Host header did not change `Reporting-Endpoints`. A chunked oversize body got 413. infra:verify gave 15 of 16. It also ran `git ls-remote` on all four actions and read the `action.yml` of setup-cli, setup-bun, and action-setup at the pinned commits.

## MAJOR

1. **After one automatic rollback, later deploys stop going live while the workflow stays green.** `deploy.yml:79-112`, `deploy-and-rollback.md:34`. Same as code review MAJOR 1. Also: the "previous" lookup takes the newest READY production deployment, which is not the served one after a manual rollback.
2. **The T-18 check is missing.** `infra-verify.mjs:310-338`. Nothing checks that each environment deploys from `main` only, that `production` has a required reviewer, that there are no repository-level secrets, or that fork workflows need approval. Combined with Workflows write (finding 3), a branch push with a new workflow naming `environment: staging` could read `SUPABASE_DB_URL`, unnoticed.
3. **The implementer token's Workflows write grants more than ADR-0029 allows.** `infrastructure-setup.md:140,147`. Contents write plus Workflows write lets the implementer push a branch with a workflow that runs on `push` and declares `checks: write`. That workflow can post a check named `static` with conclusion `success` on a pull request's head commit, from the same GitHub Actions app, and branch protection accepts it. Fix: no Workflows write; the owner pushes workflow commits.
4. **Tools in the credentialed jobs are installed outside a lockfile, and one writes to the Actions cache.** `deploy.yml:23,39,71,90-111`. `pnpm dlx vercel@65.16.0` resolves its tree fresh with `VERCEL_TOKEN` present. `supabase/setup-cli` installs Bun and then the CLI from npm at run time; it calls `oven-sh/setup-bun`, whose post step saves to the Actions cache. The Build step holds `VERCEL_TOKEN` while `vercel build` runs every build-time dependency.
5. **The logger has no allowlist of fields.** `logger.ts:9-19,31`. `...entry` writes any object, and `detail` takes any string. Live: `curl -X POST -H 'content-type: application/csp-report' --data '{"csp-report":{"effective-directive":"ada@example.com"}}'` returned 204 and logged the address. `csp-report.ts:20-44` keeps free text in `directive`, `disposition`, `blocked`, and paths.

## MINOR

6. `pnpm/action-setup` is pinned to the annotated tag object `9bbca1e9…`; the commit is `73e46992e05b19abd31f2f3c20e0e7370d762115`.
7. On this branch alone the only page is the static `/_not-found` (0 of 12 scripts carry the nonce). If this merges before WP-1.4, the first deploy's smoke fails. ADR-0028 has no check of its own; suggest a build check that fails on any static HTML route.
8. The policy check in `infra-verify` is partial: `connect-src *` would pass.
9. `ci.yml:70-86`: the secret scan and the attribution check read their rules from the pull request's head, so a pull request can loosen them.
10. One 3,501-byte report produced 100 log lines.
11. `apply-migrations.sh:18`: TLS is not required, and the password is not masked on its own.
12. `workflows.test.ts` does not check expressions in `run:`, cache or artifact actions in the deploy workflow, `persist-credentials: false`, or that only `backup.yml` names `production-backup`.
13. With 0 required approvals and Contents plus Pull requests write, `gh api -X PUT repos/R/pulls/N/merge` merges; the deny list blocks only `gh pr merge *`.

The reviewer left a `next start` on 127.0.0.1:3191 that the sandbox would not let it stop.

## What the implementer did

| Finding | Result |
|---|---|
| 1 | Fixed in 0f49d6b: previous deployment from `GET /v4/aliases/{host}`; `deploy --skip-domain`, then `promote`; smoke with `--release`; rollback on failure or cancel. |
| 2 | Fixed in 1bd9fd4, apart from fork workflow approval, which `--repo` does not read yet. |
| 3 | Fixed in the runbook (5a7af8b): the token has no Workflows permission, and the owner pushes branches that change `.github/workflows/`. |
| 4 | Fixed in 0f49d6b. The Vercel CLI comes from `tools/vercel-cli/package-lock.json` (`npm ci --ignore-scripts`). The Supabase CLI comes from its release archive, checked against the published SHA-256 `3e54b98e…738ea` (`scripts/install-supabase.sh`; the hash was checked here by download and `shasum`). setup-cli and setup-bun are gone. The token is given to pull, deploy, promote, and rollback only, through `VERCEL_TOKEN` (the CLI's documented variable), and `--token` appears nowhere. The npm audit of the locked Vercel tree (1 critical, 21 high) is raised to the owner. |
| 5 | Fixed in 3f926b9: closed field set; violation logs carry only a validated directive name and a kind code. |
| 6 | Fixed: all four uses pinned to `73e46992…`. |
| 7 | Open. Merge WP-1.4 first. The static-route build check is not built. |
| 8 | Fixed in 1bd9fd4. |
| 9 | Fixed in 0f49d6b: both files come from the base commit. |
| 10 | Fixed: 10 lines and one count line at most. |
| 11 | Fixed: `sslmode=require` enforced by the script; the password is masked with `::add-mask::`. |
| 12 | Fixed: four new rules, plus no `pnpm dlx`, `npx`, setup-cli, or setup-bun in the deploy workflow. |
| 13 | For the owner: `.claude/settings.json` is not writable by the implementer. Suggested deny patterns are in the pull request. |

Not re-reviewed after the fixes.
