# Code review 5: WP-7.3 part 4

- Reviewer: `code-reviewer`, fresh context.
- Range: `fa683b7..024c6d3`, plus the uncommitted draft `WP-7.3-part-4.md` and the patch revision made after security review 7.
- Date: 2026-11-24.

Verdict: CHANGES REQUIRED (no BLOCKER; two MAJOR)

The decision A code is correct and well tested. The spec text for decisions B and D matches the proposals in parts 1 and 2 and is marked approved by the owner on 2026-11-24. Every E-27 fact was traced to the two runbooks. Leaving out the runtime base path (decision K) is justified: commit `01a141a` on `wp/3.1-python-worker` rewrites the same lines, approved on 2026-11-24.

## Findings

1. **MAJOR**, `.env.example:12-14` and decision I. `HEAP_RELEASE` stays in the server list, which departs from decision A (a) as approved ("taken out of the server list in `.env.example`"). `scripts/check-bundle.mjs` treats every name without `NEXT_PUBLIC_` as secret, while the code puts its value in the bundle on purpose. The check passes only because the SHA is set in the `Build` step alone; if it reaches the check step (moved to the job's `env`, or set as a Vercel variable that `vercel pull` writes into the file the check reads), the production deploy fails after its migrations ran. The owner already applies a workflow patch by hand (decision E), so "cannot push a workflow file" is no reason to skip it. Fix: put the rename into the patch, or get a written waiver.
2. **MAJOR**, the description, owner action 3. `gh pr create` has no `--label spec-change`, which `docs/spec/05-engineering-handbook.md:98` requires for a pull request that changes `docs/spec/` or `docs/adr/`; no CI job enforces it. Fix: add the label to both commands and list the IDs touched.
3. **MINOR**, `report-client-error.ts:36-39` and `next.config.ts:43`. No test covers how the real release reaches the reporter: if `NEXT_PUBLIC_HEAP_RELEASE` were dropped from `env`, the reporter would send `local` and every test would pass. Fix: a unit test of `config(phase).env`.
4. **MINOR**, the patch's runbook hunk for `rotate-a-secret.md` section 1 step 4: it says not to use the manual run while `main` holds an undeployed commit, but not what to do then.
5. **MINOR**, `docs/runbooks/rotate-a-secret.md:226` still says the new figures are "proposed in the pull request", though E-27 exists; ADR-0029's amendment note does not mention the Attack Mode rename.
6. **MINOR**, the description lists NFR-REL-04 as covered, but nothing changes until the patch is applied.
7. **MINOR**, NFR-COST-02: Web Analytics and Speed Insights (E-27) and the firewall's 1,000,000 allowed rate-limit requests (E-23) have no trigger in ADR-0029. Fix: list them as left for WP-7.3.

## Checked and sound

- The pattern lives in the pure `src/domain/release.ts`; the relative import from `schema.ts` is still checked by the boundaries rule.
- The endpoint's schema is strict and requires `release`; the logger checks it again and writes `rejected` otherwise. Three imagined wrong implementations (not passing the release on, an optional `release`, an unchecked logger field) are each caught by a test.
- The built chunk holds `release:"local"` inlined.
- `git log --format=fuller fa683b7..024c6d3`: author and committer Fahad on all three commits. `node scripts/check-attribution.mjs` with `--range`, `--branch`, `--files`, and `--stdin` on the description and the patch: exit 0.
- `npm_config_verify_deps_before_run=false pnpm verify`: exit 0, `Test Files  33 passed (33)`, `Tests  743 passed (743)`. The flag form `pnpm verify --config.verify-deps-before-run=false` exits 1 in vitest's argument parser.
- `git apply --check` on both patch revisions: applies.

## Not checked

The end-to-end suite, `pnpm test:db`, `next build`, `scripts/workflows.test.ts` with the patch applied, the `curl` run, and the vendor documentation behind E-27.

## Resolution

1. Fixed in the patch, not on the branch: the patch now renames `HEAP_RELEASE` to `NEXT_PUBLIC_HEAP_RELEASE` in `deploy.yml`, `.env.example`, the environment schema (moved to the public schema), `next.config.ts`, `health.ts`, `logger.ts`, `process-env.d.ts` and their tests, so code and workflow change in one owner-pushed commit. A branch-only rename would build production with `local` until the patch lands. With the patch applied: `npm_config_verify_deps_before_run=false pnpm verify` exit 0, `Test Files  34 passed (34)`, `Tests  747 passed (747)`. `next build` not run on the patched tree. Decision I in the description is rewritten.
2. Fixed: `--label spec-change` and `--add-label spec-change`, and a line with the IDs.
3. Fixed: `scripts/next-config.test.ts` (3 tests: the SHA reaches both names, `local` without one, a malformed one fails). The patch moves it to the new name.
4. Fixed in the patch: finish or revert the pending commit's Deploy run first.
5. Fixed: the runbook line points at E-27 (which holds the 30-day limit; the 50-run limit is not in it), and the ADR note names the Attack Mode rename.
6. Fixed: marked "proposed".
7. Listed under "What is left for WP-7.3". Not added to ADR-0029: no proposal for them was approved.

Not reviewed again after these fixes.
