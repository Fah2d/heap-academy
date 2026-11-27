# Security review 7: WP-7.3 part 4

- Reviewer: `security-reviewer`, fresh context.
- Range: `fa683b7..024c6d3` (decision A code, decisions B and D spec text, runbooks and the Deploy manual-run patch), plus the uncommitted draft `WP-7.3-part-4.md`.
- Date: 2026-11-24.

Verdict: APPROVE

No BLOCKER or MAJOR. The new `release` field is checked twice: by the endpoint's strict schema and again by the logger. The release value in the bundle is already public through `/api/health`.

## Findings

1. **MINOR**, `.env.example:14`, `scripts/check-bundle.mjs:76-83`, `.github/workflows/deploy.yml:131-138` (T-12). `HEAP_RELEASE` stays in the server list, and its value (the commit SHA) is now in the bundle on purpose. The bundle check passes only because the SHA is in the `Build` step's environment, not the check step's. If someone moves `HEAP_RELEASE: ${{ github.sha }}` to the job's `env`, the production deploy fails at the bundle check, after "Apply migrations to production". Fix: rename the variable as decision A intended (an owner-pushed workflow change), or add a named, tested exemption to `check-bundle.mjs` that searches for the name but not the value.
2. **MINOR**, the patch, `deploy.yml` `on:` block (T-18). With `workflow_dispatch`, anyone with Actions write access can pick any branch. Only the environment branch policies outside the repository stop a run from another branch; `staging-migrations` has no required reviewer and seeds staging. The policies are documented (`infrastructure-setup.md:104-113`) and checked by `scripts/infra-verify.mjs:558-571`; the implementer's token has no Actions write permission. Fix (defense in depth): add `github.ref == 'refs/heads/main'` to `staging-migrations`'s `if:` and pin it in `scripts/workflows.test.ts`.
3. **MINOR**, the draft description, "How it was verified". `pnpm verify --config.verify-deps-before-run=false` passes the flag on to vitest, which crashes (`TypeError: Cannot create property 'verify-deps-before-run' on string '[object Object]'`, exit 1). `npm_config_verify_deps_before_run=false pnpm verify` gave exit 0, `Test Files 33 passed (33)`, `Tests 743 passed (743)`. Fix: write the exact command.

## Attacks checked that hold

- Forging the log line through `release` (T-16, NFR-PRIV-03): the schema in `src/features/system/server/client-error.ts:32-36` is strict, and the pattern `^(?:[0-9a-f]{40}|local)$` is anchored without the `m` flag, so `"local\n"` and a SHA followed by a newline are refused (tested). The logger checks again at `src/infrastructure/logging/logger.ts:51-53`. Anyone can send any well-formed SHA, so `clientRelease` is a diagnostic hint only, the same trust level as `code`.
- Secret in the bundle (T-12): `next.config.ts` sets `NEXT_PUBLIC_HEAP_RELEASE` from the parsed value; a malformed value fails the build. A grep of the existing `.next/static` for `HEAP_RELEASE`, `RESEND_API_KEY` and `re_example` found nothing.
- Oversized body (T-14): the 8 kB cap and the 415 are unchanged.
- Wording: T-25 only renames Attack Challenge Mode to Attack Mode. ADR-0029's amendment adds a `security-reviewer` review before the runtime moves host, which is stricter.

## What was run

- `git diff fa683b7..024c6d3` and the full handler, logger, environment schema, `check-bundle.mjs` and its test, `ci.yml`, `deploy.yml`.
- `npm_config_verify_deps_before_run=false pnpm verify`: exit 0, 33 files, 743 tests.
- `git apply --check` on the patch: applies. The trigger test fails on the current `deploy.yml` and passes on the patched copy.

## Not checked

- `next build` from HEAD and `check-bundle` on fresh output (the reviewer did not rebuild; the implementer did, see the description).
- The end-to-end suite and `pnpm test:db`.
- `pnpm infra:verify` against the live environment branch policies.

## Resolution

1. Not changed. Changing `check-bundle.mjs` would loosen a check, and renaming the variable needs a workflow change the implementer cannot push. Recorded as decision I in the description, with the trap spelled out, for the owner.
2. Fixed in the patch: `staging-migrations` now runs only when `vars.DEPLOY_ENABLED == 'true' && github.ref == 'refs/heads/main'`, and the existing T-18 test pins the whole condition. With the guard removed, that test fails (`1 failed | 29 passed (30)`); with it, `30 passed (30)`. Not reviewed again.
3. Fixed in the description.
