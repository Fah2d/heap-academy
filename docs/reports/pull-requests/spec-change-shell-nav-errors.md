Label: `spec-change`. Documentation only: no code, no test, no configuration. **Base: `main`.** #3 and #4 are merged, and `main` at 037c4ad is merged into this branch (803943e) with no conflict.

## What and why

The spec changes that WP-1.3 and WP-1.4 asked for, in one place, so the spec says what the code does.

Accepted by you on 2026-11-16 (WP-1.4 decisions 2 and 3, and its `shell` deviation):

1. **The `shell` module.** `src/features/shell` is added to the module list in `02-architecture.md` section 4 and in `CLAUDE.md`, with one sentence on what it holds. The lint table needs no change: `features/*` is already allowed.
2. **The header nav in WP-5.1, the footer element in WP-6.3.** WP-1.4 built the header, skip link, and the `header` and `main` landmarks. A `nav` or `footer` with no destination would be a dead control, so each comes with the package that gives it destinations. WP-1.4's own "Builds" line now says what it built.
3. **The error reference.** A server error is logged with its digest next to the request ID, and the error page shows the digest. A browser error shows no reference until `/api/client-error` exists (WP-7.3). Changed in `01-requirements.md` FR-SYS-01 and NFR-OBS-01, `03-experience.md` section 5.6 and the `crashed` row of section 6.5, and `07-operations.md` section 4.1.

Approved by you on 2026-11-20 (proposed in WP-1.3, pull request #4; recorded under "Your decisions" in `docs/reports/pull-requests/WP-1.3-part-1.md`). Each is written into the spec as a quoted note that starts **"Approved by the owner on 2026-11-20"**:

4. `02-architecture.md` section 4: add `features/system` for `/api/health` and `/api/csp-report`.
5. `08-delivery-plan.md` WP-2.1: "Builds" also the database check in `/api/health`.
6. `07-operations.md` section 3: the owner approves every production deploy, not only one with a migration. No fourth environment.
7. `06-security-privacy.md` section 5.2: `upgrade-insecure-requests` over HTTPS only.

Only the marks changed. The notes keep their wording, and the lines they name are not rewritten: the `features` line in section 4 and in `CLAUDE.md` does not yet list `system`, and step 2 of `07-operations.md` section 3, its diagram, and two lines of `.claude/rules/ci.md` still say approval is for a migration.

## Work package

- Work package: none. A `spec-change` pull request, as `CLAUDE.md` ("Where truth lives") asks when the spec and the code disagree.
- Requirements touched: FR-SYS-01, NFR-OBS-01; the plan lines of WP-1.4, WP-2.1, WP-5.1, WP-6.3.
- Time taken: about 20 minutes.

## How it was verified

`pnpm verify` after the merge with `main` and the approval marks, exit 0:

```
$ prettier --check .
All matched files use Prettier code style!
$ eslint --max-warnings=0 .
$ tsc --noEmit
$ node scripts/check-attribution.mjs --branch && node scripts/check-attribution.mjs --files
$ vitest run --coverage
 Test Files  23 passed (23)
      Tests  650 passed (650)
```

Before the merge:

`pnpm verify` on this branch:

```
$ pnpm format:check && pnpm lint && pnpm typecheck && pnpm attribution && pnpm test
$ prettier --check .
All matched files use Prettier code style!
$ eslint --max-warnings=0 .
$ tsc --noEmit
$ node scripts/check-attribution.mjs --branch && node scripts/check-attribution.mjs --files
$ vitest run --coverage
 Test Files  8 passed (8)
      Tests  382 passed (382)
```

Exit 0. The sandbox's `ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK` warnings are left out.

Every place in the repository that restates a changed line was searched, outside `docs/later/` (archived, never a source of truth) and `docs/reports/` (history):

```
$ git grep -n "catalog, workspace, progress\|reference ID\|request ID is shown\|on error pages" -- . ':!docs/later' ':!docs/reports'
CLAUDE.md:72:src/features/        catalog, workspace, progress, auth, profile, admin, shell
docs/spec/02-architecture.md:66:  features/          catalog, workspace, progress, auth, profile, admin, shell
```

The only lines left are the two module lists, which now include `shell`. No restatement of the old error reference is left.

## Reviews

None required: no code changes (`05-engineering-handbook.md` section 4.4).

## Owner actions now due

1. Say whether the lines that items 4 and 6 name should be rewritten to match, in this pull request or a later one. By default they stay as they are, and each note states the approved rule.
2. Make sure the `spec-change` label exists. If it does not, `gh label create spec-change` first.

## Deviations from the plan or the spec

- **"Keep `docs/spec/` in sync with the copies the repo keeps of the project spec."** I read the copies as every file in the repository that restates a spec line: `CLAUDE.md`'s module list, `.claude/rules/`, the ADRs, and the plan lines of finished packages.
  - Changed: `CLAUDE.md` and WP-1.4's plan line.
  - Not changed: `.claude/rules/ci.md`. It restates the approval rule. Item 6 is approved; whether to rewrite these lines is under Owner actions.
  - `docs/later/` is not touched: it is archived.
  - If you meant something else, such as a copy outside the repository, say where.
- **`CLAUDE.md` was writable**, so its line is edited here rather than sent to you as text.

## Risks and rollback

Text only. Revert the merge to roll back.

## Definition of Done

- [x] Every "Done when" line is met: not applicable, no work package.
- [x] `pnpm verify` passes. CI has not run on this branch.
- [x] No stub, placeholder or invented number.
- [x] No AI attribution in any commit or in this description.

## Opening this pull request

`gh` cannot reach GitHub from the sandbox. From your terminal, in the repository root:

```sh
gh pr create --base main --head wp/spec-change-shell-nav-errors --label spec-change \
  --title "docs(spec): add the shell module, place the nav and the footer, and reword the error reference" \
  --body-file docs/reports/pull-requests/spec-change-shell-nav-errors.md
```
