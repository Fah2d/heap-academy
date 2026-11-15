> Archived. Not in force. This file belongs to the original ten-phase plan and is kept for work after the first release. Do not build from it unless the owner says so. The plan in force is in `docs/spec/`.

# 05 Engineering Handbook

How work is done on this project. It applies to the implementer (Claude Code), to reviewer subagents, and to any human contributor. Short operational versions of these rules live in `CLAUDE.md` and `.claude/rules/`, which load automatically; this is the full text they summarize.

## 1. Principles

1. **Evidence over claims.** A statement like "tests pass" or "works on mobile" is backed by command output or an artifact in the pull request. What was not measured is reported as not measured.
2. **Test first where logic lives.** In `domain`, `grader`, `runner`, and use cases, the failing test is written before the code.
3. **Small, reversible steps.** One work package, one branch, one pull request that a person can review in about fifteen minutes.
4. **Boundaries are contracts.** Data crossing a boundary (network, worker, iframe, file, database, environment) is validated against a schema. Inside a boundary, types are trusted.
5. **Functional core, imperative shell.** Rules are pure functions in `domain`. I/O sits at the edges behind ports.
6. **Seams, not speculation.** Build what 1.0 needs. Where the charter names a future change, leave one clean seam and a test that proves it, and build nothing behind it.
7. **Boring where possible.** Prefer the platform and well-known tools. Novelty is spent only on the runtimes, where the product needs it.
8. **Nothing half-present.** A feature is complete with its states and tests, or it is absent. No stubs, no dead controls, no commented-out code.
9. **The spec is changed deliberately.** If the code cannot meet the spec, the spec is changed through a reviewed pull request, not quietly.

## 2. Three layers of enforcement

Instructions are advice. Rules that matter are enforced by something that cannot be talked out of it.

| Layer | What | Strength |
|---|---|---|
| 1. Instructions | `CLAUDE.md`, `.claude/rules/`, skills, this handbook | Advisory. Shapes behavior. |
| 2. Local automation | Claude Code hooks and permission rules in `.claude/settings.json`; Git hooks | Blocks on the working machine. Can be bypassed by a determined actor. |
| 3. Server side | CI required checks, branch protection on `main`, deployment environment approval | Authoritative. Cannot be bypassed from a working copy. |

Rule: **anything in the Definition of Done has a check in layer 3**, or is listed as a manual gate with a named owner. Layer 2 exists to fail fast, not to be the guarantee.

Layer 2. The kit ships `.claude/settings.json` with Claude Code's commit and pull request attribution turned off (section 4.1), so that holds from the first session. The blocking rules are added to the same file in WP-0.2. The formatting and verification hooks are added in WP-1.1, when the toolchain they call exists.

- Permission rules deny reading secret files and deny destructive or policy-bypassing commands (force push, pushing to `main`, skipping Git hooks, deleting branches on the remote, disabling checks).
- A pre-tool hook blocks the same commands when they arrive in forms a pattern rule misses. It also blocks any `git commit`, `gh pr`, `gh issue`, or `gh api` command whose text carries AI attribution (section 4.1).
- A commit-message Git hook runs the same attribution check on every commit, including messages written to a file (WP-1.1).
- A post-edit hook formats and lints the edited file.
- A stop hook runs the fast verification before the implementer may end a work package.

Layer 3, set up in WP-1.2: `main` requires a pull request, passing required checks, linear history, and no force pushes. Branch protection on a private repository needs a paid GitHub plan (E-14).

## 3. Work package lifecycle

A work package (WP) is defined in `08-delivery-plan.md` and tracked as a GitHub issue. `/work-package <id>` runs this lifecycle.

### 3.1 Definition of Ready

A WP may start when: its predecessors are merged; `main` is green; its requirement IDs and acceptance criteria are unambiguous to the implementer; any account, secret, or asset it needs exists. If not, the implementer stops and asks.

### 3.2 Steps

1. **Preflight.** Clean tree, up-to-date `main`, green CI. Read the WP, the requirement IDs it cites, and the spec sections and ADRs they point to.
2. **Plan.** Post a plan on the issue: scope, out of scope, files and modules touched, tests to be written first, risks, open questions. If a question is expensive to get wrong, stop for an answer.
3. **Branch.** `wp/<id>-<slug>`.
4. **Build test-first.** Commit in small steps using Conventional Commits.
5. **Verify.** Run the full local gate. Capture evidence (section 9).
6. **Self-review** against the Definition of Done.
7. **Independent review.** Invoke the reviewer subagents required for this WP type (section 4.4). Fix blockers. Attach the reports.
8. **Open the pull request** with the template filled in. Link the issue.
9. **Stop.** Report in five lines: what was built, evidence, deviations, risks, what the owner should look at on the preview.

The owner reviews, tries the preview, and merges. The implementer does not merge.

### 3.3 Definition of Done

- [ ] Every acceptance criterion of the WP is met and has a test that cites its requirement ID.
- [ ] All required checks pass in CI.
- [ ] No lowered threshold, skipped test, lint suppression, or type suppression was introduced. Any exception has a linked reason and an entry in `docs/TECH_DEBT.md`, approved by the owner.
- [ ] New and changed UI has all its states, works by keyboard, passes axe, and was looked at in screenshots at 375, 768, and 1280 px.
- [ ] UI pull requests include the antislop Delivery Gate report with every line PASS and evidence.
- [ ] New boundaries validate their input. New data access is authorized and covered by a policy test.
- [ ] Public APIs of packages have doc comments. Decisions have ADRs. Runbooks are updated if operations changed.
- [ ] No secret, personal data, or learner code is logged or sent to telemetry.
- [ ] The pull request states what changed, why, how it was verified, and how to roll it back.
- [ ] No commit, and nothing in the pull request, carries AI attribution (section 4.1).
- [ ] Reviewer reports are attached and blockers are resolved.

## 4. Version control

### 4.1 Branches and commits

- Trunk-based. `main` is always releasable. Branches live for days, not weeks.
- Branch names: `wp/<id>-<slug>`, `fix/<slug>`, `content/<course>-<chapter>`, `chore/<slug>`.
- Conventional Commits, checked by a commit lint: `feat`, `fix`, `refactor`, `test`, `docs`, `build`, `ci`, `chore`, `content`. Scopes: `web`, `domain`, `grader`, `runner`, `content`, `ui`, `db`, `api`, `ci`.
- Commits build and pass tests individually where practical. No "wip" commits in a pull request at review time.
- **No AI attribution** (owner's instruction, 2026-11-14). Every commit is made under the owner's Git identity. Commit messages, pull request titles and descriptions, issues, and comments never contain:
  - a `Co-Authored-By` trailer naming Claude or Anthropic, or any `noreply@anthropic.com` address
  - a "Generated with" or "Generated by" line naming Claude or Claude Code
  - a `Claude-Session` trailer or a claude.ai session link
  - a commit author or committer named Claude, or with an `anthropic.com` address

  One script, `scripts/check-attribution.mjs`, holds these patterns, and every layer calls it: the pre-tool hook (WP-0.2), the commit-message hook (WP-1.1), and the `static` job, which checks every commit in the pull request and the pull request's title and description (WP-1.2). Mentioning Claude Code as a tool, as these documents do, is not attribution.

### 4.2 Pull requests

- One purpose. Aim for 400 changed lines or fewer, not counting generated files, lockfiles, snapshots, and lesson content. A larger change explains why it could not be split.
- The template asks for: summary, requirement IDs, screenshots or recordings for UI, test evidence, performance and accessibility evidence when relevant, security considerations, rollback, reviewer reports, and the Delivery Gate report for UI.
- Every pull request gets a preview deployment. The description says what to try on it.

### 4.3 Merging and releasing

- The owner merges by squash. History on `main` is linear.
- Merging to `main` deploys to production through the pipeline in `07-operations.md`. Small merges are the release process.
- A release tool maintains the changelog and version from commit messages. Versions are `0.x` until launch; launch is `1.0.0`.

### 4.4 Independent review

Reviewer subagents start with a fresh context, have read-only tools, and are told to distrust the author's claims and check for themselves.

| Change touches | Required reviewers |
|---|---|
| Any code | `code-reviewer`, `quality-auditor` |
| UI, styles, copy | plus `design-reviewer` |
| Auth, API, database, runtimes, sandbox, CI, configuration, dependencies | plus `security-reviewer` |
| Lesson content | `content-editor` |

Findings are graded **BLOCKER** (must be fixed before the pull request opens), **MAJOR** (fixed, or waived by the owner in writing), **MINOR** (fixed, or ticketed). A reviewer that finds nothing says what it checked.

## 5. Code standards

Path-scoped rule files in `.claude/rules/` carry the detail and load when matching files are edited. The essentials:

- **TypeScript**: `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`. No `any`. No non-null assertions outside tests. No type or lint suppression without a linked reason.
- **Types carry meaning**: branded types for IDs and verified values; discriminated unions for states and messages; exhaustive `switch` with a `never` check.
- **Errors**: expected failures are values at boundaries; unexpected ones throw and are reported once, centrally. Nothing is caught and ignored.
- **Purity**: `domain` has no I/O and no ambient time or randomness.
- **React and Next.js**: server by default; client components only where interaction needs them; no data fetching in effects; no business rules in routes or components.
- **Styling**: tokens only; logical properties only; no raw color, spacing, or radius values in components.
- **Strings**: no user-facing text in components; message catalogs only.
- **Comments**: explain why, not what. Written with `antislop-code` loaded. No commented-out code, no narration, no banners.
- **Names**: the glossary in the charter is the vocabulary. One word per concept.
- **SQL**: forward-only migrations, explicit column lists, policies in the same migration as the table, every table has row level security enabled.

## 6. Dependencies

A dependency is a liability that someone else maintains. Before adding one, record a line in `docs/DEPENDENCIES.md` answering:

1. What need does it meet, and why can the platform or existing code not meet it?
2. Is it maintained (recent releases, responsive issues, more than one maintainer)?
3. License: MIT, Apache-2.0, BSD, or ISC for anything shipped. Others need the owner.
4. Cost: measured effect on bundle size for client code.
5. Does it run install scripts? If so, why is that acceptable?

Rules: exact versions pinned; lockfile committed; installs in CI use the frozen lockfile; a bot proposes updates weekly, grouped, with a minimum release age so brand-new versions are not adopted the day they appear; install scripts are denied unless allowlisted.

## 7. Interface work

- `DESIGN.md` gives direction. antislop filters. Neither is optional for UI work.
- antislop runs in `during` mode for the whole build. A full `after` audit runs in Phase 8.
- For UI: load `antislop`, `antislop-ui`, `antislop-human`, `antislop-layoutmobile`. For any learner-facing text: `antislop-copywriting`. For comments: `antislop-code`.
- Before building a screen, state the Design Read and the dials from `DESIGN.md`.
- Before calling a screen done: run the app, drive every interactive element, capture screenshots at 375, 768, and 1280 px in every state, look at them, and write the Delivery Gate report with evidence per line (antislop R-35).
- No brand asset is created by the implementer. Missing assets are requested from the owner (antislop R-23).
- If `DESIGN.md` asks for something an antislop rule names as a slop pattern, name the element and the rule and ask the owner; do not silently follow or override (antislop R-37).

## 8. Testing strategy

### 8.1 Levels

| Level | Verifies | Tools | Runs |
|---|---|---|---|
| Static | Types, lint, format, dead code, dependency rules, secrets | TypeScript, ESLint, Prettier, dead-code and dependency-rule checkers, secret scanner | Pre-commit (fast subset), every pull request |
| Unit | Pure logic, schemas, state machines, use cases with fakes | Vitest, property-based testing | Every pull request |
| Python unit | The Python harness | pytest on CPython | Every pull request |
| Mutation | That the tests would notice a wrong implementation | Mutation testing on `domain` and grader comparison code | Nightly, and at phase gates |
| Component | Primitives and feature components in every state | Component tests and stories as tests, with axe | Every pull request |
| Contract | API schemas against the OpenAPI file and the client; runner protocol; content schema fixtures | Vitest | Every pull request |
| Database | Migrations from zero, constraints, row level security | Supabase CLI, pgTAP | When `supabase/` changes, and nightly |
| Runtime integration | Python runner and web sandbox in real browsers | Playwright against a minimal harness page | Chromium on pull requests; three engines nightly |
| Parity | Same lessons give the same verdicts in Node and browsers | Node runner plus Playwright | Nightly, and when content or grader changes |
| End to end | Journeys J-1 to J-11 | Playwright | Smoke on pull requests (desktop Chromium, mobile WebKit); full matrix nightly |
| Accessibility | Every page and workspace state | axe through Playwright; manual script | Every pull request; manual at gates |
| Visual | Primitives and key screens do not change by accident | Screenshot comparison in a pinned container | Changed stories on pull requests; all nightly |
| Performance | Budgets in NFR-PERF | Lighthouse CI, bundle budget, runtime timing tests | Every pull request |
| Security | Headers, containment, authorization, dependencies | Playwright security tests, static analysis, dependency audit, baseline scan | Pull request, nightly, gate |
| Load | API under expected launch traffic | A scripted load test | Phase 8 |

### 8.2 What a good test looks like here

- Tests behavior through the public surface, not implementation details.
- One reason to fail. Arrange, act, assert.
- Deterministic: injected clock, seeded randomness, no real network, no sleeps. Wait for conditions, not for time.
- Test data is built with small builder functions, not copied fixtures.
- Property-based tests for rules with large input spaces: streaks, merge, output normalization, unlock rules.
- A bug fix starts with a test that fails for the bug.

### 8.3 Thresholds

Set in NFR-MAINT-02 and NFR-MAINT-03. Coverage is a floor, not a goal: the quality-auditor reviews whether assertions are meaningful, and mutation testing checks it mechanically where it matters most.

### 8.4 Never

- Never weaken, skip, or delete a test to get a green run. If a test is wrong, fix the test in its own commit and explain why.
- Never add a retry or a longer timeout to hide a race.
- Never snapshot large structures in place of assertions that say what matters.
- Never mock the thing under test.

### 8.5 Flaky tests

A test that fails and then passes without a code change is a defect. End-to-end tests may retry once in CI so a flake does not block everyone, and every retry is reported. Each flake gets an issue labeled `flaky`. It is fixed, or quarantined with the owner's approval, within two working days. Quarantined tests are listed in the phase report.

### 8.6 Traceability

- Test titles start with the requirement IDs they verify: `[FR-WSP-07] stops a runaway program and recovers`.
- `pnpm trace` generates `docs/reports/traceability.md`: each requirement, its priority, and the tests that cite it.
- At each phase gate, every Must requirement scheduled for that phase has at least one passing test, or the gate fails.

## 9. Evidence

A pull request carries the evidence a reviewer needs without rerunning everything:

- Output summary of the local gate.
- Coverage change for touched packages.
- For UI: screenshots at three widths for each state, the axe result, and the Delivery Gate report.
- For performance-relevant changes: bundle size change and Lighthouse numbers from CI. Numbers are copied from tool output, never estimated.
- For runtime or security changes: the specific test names that prove the invariant.
- Links to reviewer reports.

Fabricating or paraphrasing evidence is the most serious violation of this handbook.

## 10. Quality gates

| Gate | Threshold | Enforced |
|---|---|---|
| Format, lint, types | Zero errors, zero warnings | Required check |
| Dead code, dependency rules | Zero findings | Required check |
| Unit and component tests | All pass; coverage per NFR-MAINT-02 | Required check |
| Python harness tests | All pass; branch coverage 95 percent | Required check |
| Content check and lint | All lessons pass | Required check when `content/` or `grader` changes |
| Database tests | Migrations apply from zero; all policy tests pass | Required check when `supabase/` changes |
| Build and bundle budget | Within NFR-PERF-02 | Required check |
| End-to-end smoke and axe | All pass; zero serious or critical violations | Required check |
| Lighthouse | Within NFR-PERF-01 | Required check |
| OpenAPI drift | Generated file equals committed file | Required check |
| Secret scan, dependency audit | No secret; no known high or critical vulnerability without a recorded exception | Required check |
| Mutation score | Per NFR-MAINT-03 | Nightly and phase gate |
| Full browser matrix, parity, visual | All pass | Nightly and phase gate |
| antislop Delivery Gate | All PASS with evidence | Pull request review for UI; phase gate |
| Manual accessibility script, device matrix | Signed by the owner | Phase gates 5, 8, 9 |

## 11. Documentation

- **ADRs**: one file per decision in `docs/adr/`, numbered, using the template. Status is Proposed, Accepted, or Superseded. An ADR is never edited after acceptance except to mark it superseded.
- **Diagrams** are Mermaid in Markdown, so they are reviewed like code.
- **Runbooks** in `docs/runbooks/` are written as numbered steps a tired person can follow, and are exercised in drills.
- **Package READMEs** state purpose, public API, and how to test, in under a page.
- **Phase reports** in `docs/reports/` record what shipped, evidence against exit criteria, risks, and what was deferred.

## 12. Technical debt

Debt is recorded, never hidden. `docs/TECH_DEBT.md` lists each item with what, why it was accepted, the risk, and the condition for paying it. The owner approves each entry. The phase gate reviews the list.

## 13. Operating rules for the implementer

### 13.1 Sessions

- One work package per session. Start by reading `CLAUDE.md`, the WP, and the documents it cites. Do not rely on memory of earlier sessions; state lives in the repository and the issue tracker.
- Check current documentation before using an API of a fast-moving dependency (Next.js, Supabase, Pyodide, the CSS framework, the test tools). The versions verified for this plan are in `09-evidence.md`; they will have moved.

### 13.2 Stop and ask

Stop and ask the owner before:

- anything irreversible or visible outside the repository: deleting data, rewriting history, changing DNS or auth providers, sending email, publishing, spending money;
- changing an accepted ADR, a requirement, or a threshold;
- adding a dependency that ships to the browser, or any dependency with an unusual license;
- a third failed attempt at the same problem;
- work that has grown beyond the WP.

When asking: state the situation in two sentences, give the options, recommend one, and say what happens by default if there is no answer.

### 13.3 Honesty

- Report failures and uncertainty plainly. "Not verified in Safari" is a required sentence when it is true.
- Do not describe intended behavior as observed behavior.
- If a hook, check, or reviewer blocks the work, fix the cause. Never work around the control.
