---
name: work-package
description: Run one work package from the eight-day plan end to end, from preflight to an open pull request. Use when the owner says to start, continue, or do a work package such as WP-3.2.
argument-hint: "[WP-id]"
---

Run work package **$ARGUMENTS** under `docs/spec/05-engineering-handbook.md` section 3. Do the steps in order. Do not skip one because it seems unnecessary this time.

## 1. Preflight

- `git status` is clean and you are on an up-to-date `main`. CI on `main` is green. If not, stop and report. Before WP-1.3 there is no CI; say so and continue.
- If another session is running a work package beside this one, work in your own Git worktree, and only one session at a time touches `supabase/migrations` (handbook section 12.2).
- Read the work package in `docs/spec/08-delivery-plan.md`, including its time box and its "Owner" line.
- Read every requirement and threat it cites in `docs/spec/01-requirements.md` and `docs/spec/06-security-privacy.md`, and the spec sections and ADRs those point to. Read `DESIGN.md` if the work touches the interface.
- Check readiness (handbook section 3.1). If a dependency is unmerged, a requirement is ambiguous, or an account, key, or brand file is missing, stop and ask: the question, the options, your recommendation, and what happens by default.

## 2. Plan

Print a plan of ten lines or fewer:

- Scope, and what is explicitly out of scope
- Files you expect to touch
- Tests you will write first, each with the requirement ID it will cite
- Anything to look up in current documentation
- Open questions

If a question is expensive to get wrong, stop for the answer. Otherwise continue. Note the time you start.

## 3. Branch

`git switch -c wp/<id>-<short-slug>`

## 4. Build

- Test first in `src/domain`, `src/grader`, `src/runtime`, and use cases.
- Small commits in Conventional Commits form, with no AI attribution: no co-author trailer, no "Generated with" line, no session link (`CLAUDE.md` rule 15).
- Check current documentation before using an API of a fast-moving dependency.
- Interface work follows `.claude/rules/ui-design.md`: read `DESIGN.md`, load the antislop skills, state the Design Read.
- If the work grows beyond the work package, stop and say so. Do not widen scope silently.
- If you fail at the same problem three times, stop and ask.
- At one and a half times the time box, stop and report what is done, what is left, and a proposal (handbook section 3.4).

## 5. Verify

Run the gate and keep the output. Before WP-1.2 the toolchain does not exist: run the checks the work package itself names, and say which of the commands below were not available.

- `pnpm verify`
- Tests for what changed, with coverage where it is gated
- Whichever apply: `pnpm test:db`, `pnpm test:e2e`
- Interface work: run the app, drive every control, capture screenshots of every state at 375, 768, and 1280 px (the dashboard at 1280 px) into `docs/reports/screens/<id>/`, look at each one, run axe, and write the antislop Delivery Gate report.

Fix causes. Never weaken a check, skip a test, or work around a hook.

## 6. Self-review

Walk the Definition of Done in handbook section 3.3, line by line. Anything not met is fixed now or stated plainly in the pull request.

## 7. Independent review

Ask the reviewers this change requires (handbook section 4.4), each with the work package ID and the commit range:

- Any code: `code-reviewer`
- Sign-in, the database, server actions, the runtime, headers, the admin area, pipelines, configuration, dependencies: also `security-reviewer`
- Interface, styles, or words a person reads: also `design-reviewer`, with the screenshot folder

Fix every BLOCKER. Fix each MAJOR or list it for the owner to waive. Run the reviewer again after substantial fixes. Save the reports under `docs/reports/reviews/<id>/`.

## 8. Pull request

Push the branch and open a pull request from `docs/templates/pull-request.md`. Paste real tool output as evidence. Say what to try on the preview deployment, and name any "Owner" action that is now due. The description carries no AI attribution.

Do not merge.

## 9. Report and stop

Tell the owner, in five lines or fewer: what was built; the evidence; any deviation from the plan or the spec; the time taken against the time box; what to look at on the preview and what he needs to do. Then stop.
