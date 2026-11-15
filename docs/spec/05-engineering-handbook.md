# 05 Engineering Handbook

How the work is done. Eight days is short, so the process is small. What it keeps is the part that makes software trustworthy: tests written with the code, independent review, checks nobody can skip, and honest reporting.

## 1. Principles

1. **Evidence over claims.** A statement about the system comes with the tool output that shows it.
2. **Cut scope, never quality.** When a day runs late, a Should item leaves the plan. Tests, security controls, and states never do.
3. **Small steps.** One work package, one branch, one pull request, reviewable in fifteen minutes.
4. **Checks are not negotiable.** A failing check is fixed at its cause or raised with the owner. It is never weakened.
5. **Nothing half-present.** A feature is complete with its states and tests, or it is absent.
6. **Read the current documentation.** The frameworks here move fast. The versions this plan was checked against are in `09-evidence.md`.
7. **One author.** The repository credits the owner and no tool (section 4.1).

## 2. Three layers of enforcement

Instructions can be forgotten. So each rule that matters is enforced at more than one layer.

| Layer | Where | What |
|---|---|---|
| 1. Instructions | `CLAUDE.md`, `.claude/rules/`, this spec | What to do and why. |
| 2. The working machine | `.claude/settings.json`, Git hooks | Blocks before a mistake leaves the machine. |
| 3. The pipeline | GitHub Actions, branch protection | Blocks before a mistake reaches `main`. Cannot be bypassed from a session. |

Layer 2. The kit ships `.claude/settings.json` with Claude Code's commit and pull request attribution turned off, so that holds from the first session. WP-1.2 adds the rest:

- Permission rules deny reading secret files and deny destructive or policy-bypassing commands (force push, pushing to `main`, skipping Git hooks, deleting branches on the remote, disabling checks).
- A pre-tool hook blocks the same commands when they arrive in forms a pattern rule misses. It also blocks any `git commit`, `gh pr`, `gh issue`, or `gh api` command whose text carries AI attribution (section 4.1).
- A commit-message Git hook runs the same attribution check on every commit, including messages written to a file.
- A pre-commit Git hook formats and lints staged files.

Layer 3. Set up in WP-1.3:

- `main` is protected: pull request required, required checks must pass, no force push, no direct push.
- The required checks are in section 10.

If a control blocks the implementer, the control is right until the owner says otherwise.

## 3. Work package lifecycle

The unit of work is a work package from `08-delivery-plan.md`. It is run with `/work-package WP-x.y`.

### 3.1 Ready

A work package starts only when: the packages it depends on are merged; `main` is green; every account, key, and brand file it needs exists; and nothing in it is ambiguous in a way that is expensive to get wrong. Otherwise the implementer stops and asks, with the options and a recommendation.

### 3.2 Steps

1. **Preflight.** Clean tree on an up-to-date `main`. Read the work package, the requirements it cites, and the spec sections and ADRs those point to. Read `DESIGN.md` for interface work.
2. **Plan.** Ten lines or fewer, printed in the session: scope, what is out of scope, files, the tests that will be written first, anything to look up.
3. **Branch.** `wp/<id>-<short-slug>`.
4. **Build.** Test first in `src/domain`, `src/grader`, `src/runtime`, and use cases. Small commits.
5. **Verify.** `pnpm verify`, then whichever of the database tests and end-to-end tests the change touches.
6. **Self-review** against section 3.3.
7. **Independent review** (section 4.4). Fix every blocker.
8. **Pull request** from `docs/templates/pull-request.md`, with real output as evidence and steps for the owner to try on the preview.
9. **Stop.** The owner reviews and merges.

### 3.3 Definition of Done

- [ ] Every "Done when" line of the work package is met, with evidence.
- [ ] Every requirement the package cites has a passing test that names its ID.
- [ ] `pnpm verify` passes locally; all required checks pass on the pull request.
- [ ] Every state of every changed view exists: loading, empty, error, and the ones in `03-experience.md` section 8.
- [ ] No stub, dead control, placeholder text, commented-out code, or invented number.
- [ ] New tables have policies and policy tests in the same migration. New server actions use the wrapper.
- [ ] Interface work carries screenshots, an axe result, and the antislop Delivery Gate report.
- [ ] The reviewers' blockers are fixed; anything waived is listed for the owner.
- [ ] The pull request states what changed, why, how it was verified, and how to roll it back.
- [ ] No commit, and nothing in the pull request, carries AI attribution (section 4.1).

### 3.4 Time boxes

Each work package has a time box in the plan. It is a signal, not a deadline to hit by cutting corners.

- At one and a half times the box with no end in sight, the implementer stops and reports: what is done, what is left, and a proposal. The proposal is one of: finish (with the reason it ran over), split, or cut a Should item from the cut order in `08-delivery-plan.md` section 1.4.
- The owner decides. The implementer never shrinks a package silently, and never drops a test, a state, or a control to fit a box.

## 4. Version control

### 4.1 Branches and commits

- Trunk-based. Short-lived branches from `main`, one per work package.
- Conventional Commits: `feat(workspace): show failing test output`. Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `ci`, `build`.
- Commits build and pass tests individually where practical. No "wip" commits in a pull request at review time.
- **No AI attribution** (owner's instruction, 2026-11-14). Every commit is made under the owner's Git identity. Commit messages, pull request titles and descriptions, issues, and comments never contain:
  - a `Co-Authored-By` trailer naming Claude or Anthropic, or any `noreply@anthropic.com` address
  - a "Generated with" or "Generated by" line naming Claude or Claude Code
  - a `Claude-Session` trailer or a claude.ai session link
  - a commit author or committer named Claude, or with an `anthropic.com` address

  One script, `scripts/check-attribution.mjs`, holds these patterns, and every layer calls it: the pre-tool hook and the commit-message hook (WP-1.2), and the `static` job, which checks every commit in the pull request and the pull request's title and description (WP-1.3). Mentioning Claude Code as a tool, as these documents do, is not attribution.

### 4.2 Pull requests

- Title: `WP-x.y: what changed`. One work package per pull request.
- The description follows the template. Evidence is pasted tool output, not a summary of it.
- A pull request that changes a file in `docs/spec/` or `docs/adr/` carries the `spec-change` label and says which requirement IDs it touches.

### 4.3 Merging and releasing

- The owner merges, by squash. The implementer never merges and never pushes to `main`.
- Every merge to `main` deploys (`07-operations.md` section 3). There is no release branch.
- The launch is tagged `v1.0.0`.

### 4.4 Independent review

Reviewers are subagents in `.claude/agents/`. Each starts with a fresh context, is read-only, and reports findings without fixing them.

| The change touches | Reviewers |
|---|---|
| Any code | `code-reviewer` |
| Sign-in, the database, server actions, the runtime, headers, the admin area, pipelines, configuration, dependencies | also `security-reviewer` |
| Interface, styles, or words a person reads | also `design-reviewer` |

Every blocker is fixed before the pull request opens. Each major finding is fixed or listed for the owner to waive. The reports are pasted into the pull request description.

## 5. Code standards

- TypeScript strict mode plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`.
- No `any`. No non-null assertion outside tests. No suppression comment without a reason on the same line and the owner's approval in the pull request.
- Data crossing a boundary (network, worker, database, environment, storage) is parsed by a schema. Inside the boundary, trust the types.
- IDs are branded types. States and messages are discriminated unions with exhaustive switches.
- Expected failures are typed results at boundaries. Unexpected ones throw. Nothing is caught and ignored.
- `src/domain` is pure. Time and randomness are passed in.
- Module dependency rules of `02-architecture.md` section 4.1 hold.
- Names follow the glossary in `00-charter.md` section 10. Comments explain why.
- No user-facing string in a component. No raw HTML injection anywhere.

The path-scoped files in `.claude/rules/` restate these where they apply.

## 6. Dependencies

- Add a dependency only when writing the thing would be larger or riskier than depending on it. The pull request names each new runtime dependency and why.
- Versions are pinned by the lockfile. Installs use the frozen lockfile. Install scripts are denied unless allowlisted.
- `pnpm audit` runs on every pull request. A high or critical finding in a runtime dependency blocks the merge.
- The Python runtime comes from the pinned `pyodide` package and is served from our own origin.

## 7. Interface work

- No interface work before `DESIGN.md` is signed (WP-1.1).
- Direction comes from `DESIGN.md`. antislop is the filter, in `during` mode. `03-experience.md` gives structure and behavior.
- Before calling a screen done: run the app, drive every control, capture screenshots at 375, 768, and 1280 px for every state into `docs/reports/screens/<id>/`, look at each one, run axe, and write the antislop Delivery Gate report line by line.
- The dashboard is captured at 1280 px only.

## 8. Testing

### 8.1 Levels

| Level | Covers | Tool | Runs |
|---|---|---|---|
| Unit | Rules in `src/domain`, comparison in `src/grader`, the statechart, schemas | Vitest | Every pull request |
| Harness | The Python harness, executed in Pyodide under Node. Includes the parity suite. | Vitest | Every pull request |
| Component | Components with their states and accessible roles | Vitest with Testing Library | Every pull request |
| Database | Policies, triggers, functions, from an empty database | pgTAP through the Supabase CLI | Every pull request that touches `supabase/` or server code |
| Integration | Server actions against the local Supabase stack | Vitest | Same |
| End to end | Journeys J-1 to J-13 that exist so far, with axe on every screen | Playwright | Chromium on every pull request; Firefox and WebKit on `main` and before launch |

### 8.2 What a good test looks like here

- It tests behavior through the public surface, has one reason to fail, and reads as arrange, act, assert.
- It is deterministic: injected clock, seeded randomness, no real network, no sleeps. It waits for a condition, never for time.
- Rules with large input spaces (streak, merge, normalization) have property-based tests.
- A capability fallback is tested by removing the capability, not by faking a user agent.
- A bug fix begins with a test that fails because of the bug.

### 8.3 Thresholds

Line and branch coverage of 90 percent or higher in `src/domain` and `src/grader` (NFR-MAINT-02). Elsewhere coverage is reported, not gated. Coverage is a floor, not a goal: a test with no meaningful assertion is a finding in review.

### 8.4 Never

- Weaken, skip, or delete a test to get a green run.
- Raise a timeout or add a retry to hide a race.
- Replace assertions with a large snapshot.
- Mock the unit under test.
- Lower a threshold.

### 8.5 Flaky tests

A test that fails without a code change is a defect. It is fixed in the same day or reported to the owner with what is known. It is never rerun until it passes, and never quarantined silently.

### 8.6 Requirement IDs in tests

A test title starts with the requirement IDs it verifies: `[FR-WSP-07] stops a runaway program and recovers`. The reviewer checks that every Must requirement a work package cites has at least one such test.

## 9. Evidence

- Paste real tool output. Do not paraphrase numbers.
- Say "not verified" or "not measured" when that is the truth.
- A performance or size number comes from a tool run on the preview deployment or in CI, with the command.
- A claim about a browser names the engine and version it was seen in.

## 10. Required checks

Every pull request must pass these before it can merge. The jobs are defined in `07-operations.md` section 2.

| Check | Fails when |
|---|---|
| `static` | Formatting, lint (including import rules and the no-raw-HTML rule), types, the attribution check, the secret scan, or the dependency audit fails |
| `unit` | A unit, harness, or component test fails, or coverage in `src/domain` or `src/grader` is under the threshold |
| `db` | A policy, trigger, function, or integration test fails from an empty database |
| `build` | The production build fails, a server secret appears in a client bundle, or the runtime files exceed their size limit |
| `e2e` | A journey or an axe check fails on Chromium |

Changing a required check is a spec change that needs the owner.

## 11. Day check

At the end of each day the owner runs `/day-check <day>`. It is an audit, not a formality.

1. List the day's work packages with their pull requests. Name any that did not merge.
2. Run every check on `main`, including the three-engine end-to-end run. Keep the output.
3. Walk the day's exit line in `08-delivery-plan.md` and give the evidence for each part: MET, NOT MET, or MOVED.
4. Say what was cut or moved, and what that does to the remaining days.
5. Update the risk register.
6. Write `docs/reports/day-<n>.md` and stop. The owner decides how the next day starts.

## 12. Operating rules for the implementer

### 12.1 Sessions

- One work package per session. A new session starts by reading the work package and what it cites. Nothing is assumed from an earlier session.
- State lives in the repository: the plan, the merged pull requests, and the day reports.

### 12.2 Two sessions at once

The plan marks pairs of work packages that can run side by side. To do that:

- Each session works in its own Git worktree and its own branch.
- Only one session at a time touches `supabase/migrations`.
- Each rebases on `main` before opening its pull request.
- More than two sessions is not worth the review load on one owner.

### 12.3 Stop and ask

Stop, and ask the owner with options and a recommendation:

- before anything irreversible or visible outside the repository
- after three failed attempts at one problem
- when a work package passes one and a half times its time box
- when a requirement is ambiguous in a way that is expensive to get wrong
- when the spec and an ADR disagree
- when a needed account, key, or brand file is missing

### 12.4 Honesty

- Report bad news at once and plainly.
- Never say a thing works without having run it.
- Never present a number that was not measured.
- If a check was not run, say so and say why.
