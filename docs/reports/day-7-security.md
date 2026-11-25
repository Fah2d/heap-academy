# Day 7 security results (WP-7.1)

Each row of the threat table in `docs/spec/06-security-privacy.md` section 4, and the test or recorded check that verifies it. A test is named by the files whose titles cite the threat (`[T-xx]`, `.claude/rules/testing.md`), or, where the spec names a journey or a fixture, by that test. "And N more" counts the other files whose titles cite the threat. Started in WP-7.1 part 2 on `wp/7.1-security-canary` (based on `wp/7.2-a11y-perf`, which holds the 2.2 to 5.4 line). Rows that name another branch hold tests that are not merged into this line yet.

## Recorded checks, 2026-11-25

| Check | Command | Result |
|---|---|---|
| Secret scan over the whole history, every local and remote branch, at be19f9b | `gitleaks git --redact --no-banner --config .gitleaks.toml --log-opts="--all" .` (gitleaks 8.30.1) | exit 0; `1189 commits scanned.`; `no leaks found` |
| Dependency audit | `pnpm audit` | `1 vulnerabilities found`, `Severity: 1 moderate`: `minimatch` (GHSA-g3hv-75wg-m249), only under `typescript-eslint`, a development dependency. CI's `pnpm audit --audit-level high` passes it; the handbook (section 6) blocks only high or critical in a runtime dependency. |

## Threats

| ID | Verified by | State on this branch |
|---|---|---|
| T-01 | `src/runtime/lockdown.test.ts`, `src/runtime/worker/core.test.ts`, `src/proxy.test.ts`, `src/infrastructure/http/security-headers.test.ts` and six more. The recent sign-in action test belongs to account deletion (WP-6.3). | Tests present. Recent sign-in: not built (account deletion waits for the owner). |
| T-02 | J-4 (`e2e/workspace-runtime.spec.ts`), the loop, print flood and memory bomb fixtures (`e2e/runtime.spec.ts`), the time limit (`e2e/statechart-runtime.spec.ts`); tagged `[T-02]` in part 2. Unit level, untagged: `src/runtime/controller.test.ts`, `output.test.ts`, `workspace-driver.test.ts`. | Tests present. |
| T-06 | `src/content/markdown/parse.test.ts`, `src/features/workspace/components/lesson-content.test.tsx`, `e2e/lesson-editor-journey.spec.ts`, `scripts/eslint/rules.test.ts`. | Tests present. |
| T-07 | `src/grader/console-text.test.ts`, `src/features/workspace/components/workspace-output.test.tsx` and six more. | Tests present. Display name: WP-6.3. |
| T-08 | `supabase/tests/database/03_learner_policies.test.sql`; action tests with another user's IDs on `wp/6.1-sync-wiring` and `wp/6.3-profile-page`. | Policy tests present; action tests on the 6.x branches. |
| T-10 | `supabase/tests/database/03_learner_policies.test.sql`; more on the 6.x branches. | Tests present. |
| T-11 | `src/features/auth/server/email-code.test.ts`, `google.test.ts`, `google-flow.test.ts`, `src/infrastructure/auth/sign-in-provider.test.ts` and five more. | Tests present. Provider settings check: not done (needs the owner's provider dashboard). |
| T-12 | `scripts/secret-scan.test.ts`, `scripts/check-bundle.test.ts`, `scripts/workflows.test.ts`, `scripts/apply-migrations.test.ts`; the whole-history scan above. | Tests present; scan recorded. |
| T-13 | `scripts/workflows.test.ts` (pinned actions, frozen lockfile); CI's audit; the audit above. | Tests present; audit recorded. |
| T-14 | Size limits: `src/infrastructure/actions/define-action.test.ts`, `src/features/auth/server/email-code.test.ts`, the database constraints in `supabase/tests/database/05_limits.test.sql`. Bounded work: `src/content/published.test.ts`, `src/content/markdown/parse.test.ts`. The client error route's limits: `e2e/client-error.spec.ts`, `src/features/system/server/client-error.test.ts` on `wp/7.3-operations`. | **Gap.** The Postgres counters of ADR-0029 and their policy, header and Data API tests are not built on any branch; they need a migration and `pnpm test:db` (Docker). The firewall rule needs the owner. |
| T-15 | `src/proxy.test.ts`, `src/infrastructure/http/security-headers.test.ts`, `e2e/csp.spec.ts`, `e2e/runtime-headers.spec.ts` and two more. | Tests present. |
| T-16 | `src/infrastructure/logging/logger.test.ts`, `route.test.ts`, `src/features/system/server/system.test.ts`, `src/proxy.test.ts`; more on `wp/7.3-operations`. | Tests present. Review: WP-7.3. |
| T-17 | J-10 with database assertions (WP-6.3). The privacy text on retention: `src/messages/legal.test.ts` on `wp/6.3-legal-pages-footer`. | **Gap.** J-10 is not built on any branch: account deletion waits for the owner (the privileged secret, the notice address, the recent sign-in rule). |
| T-18 | `scripts/claude-guard.test.ts`, `scripts/pre-push.test.ts`, `scripts/infra-verify.test.ts`, `scripts/workflows.test.ts`. | Tests present. `pnpm infra:verify` against production: the owner. |
| T-19 | `e2e/admin-gate-journey.spec.ts`, `e2e/admin-gate.spec.ts`, `supabase/tests/database/08_admin_list_check.test.sql`, `09_reorder.test.sql` and one more. | Tests present. |
| T-20 | `supabase/tests/database/01_admin_gate.test.sql`, `07_password_on_confirm.test.sql`, `10_course_versions.test.sql`, `e2e/admin-gate-journey.spec.ts` and seven more. | Tests present. |
| T-21 | The canary, `e2e/canary-journey.spec.ts` (part 1); `src/content/published.test.ts`, `src/infrastructure/db/public-client.test.ts`, `src/features/catalog/reads-only-content.test.ts`, `e2e/catalog-journey.spec.ts`, `supabase/tests/database/02_content_policies.test.sql`, `scripts/eslint/rules.test.ts`. | Tests present. The canary's walks first run in CI's `stack` job. |
| T-22 | J-13 (`e2e/j13-publish-journey.spec.ts`, tagged `[T-22]` in part 2), `src/features/admin/server/lesson-actions.test.ts`, `src/features/admin/components/lesson-editor.test.tsx`, `scripts/apply-migrations.test.ts` and four more. | Tests present. |
| T-23 | `src/features/admin/components/lesson-editor.test.tsx`, `src/runtime/controller.test.ts`. The import test belongs to WP-6.4. | Lock-down tests present. Import: not built (WP-6.4). |
| T-24 | The backup tests on `wp/7.3-operations`. | On `wp/7.3-operations`. |
| T-25 | `src/content/published.test.ts`; the `anon` grants test in `supabase/tests/database/05_limits.test.sql` (tagged `[T-25]` in part 2). | Tests present. Firewall rule: the owner. |

## Not done in this part

- The firewall rate limit rule, the provider settings check, the production advisor run and `pnpm infra:verify` against production: each needs the owner's accounts.
- The whole-application review by `security-reviewer`: once the 6.x branches merge, so it reviews the whole application.
