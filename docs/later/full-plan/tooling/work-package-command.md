> Archived. Not in force. This file belongs to the original ten-phase plan and is kept for work after the first release. Do not build from it unless the owner says so. The plan in force is in `docs/spec/`.

---
name: work-package
description: Run one work package from the delivery plan end to end, from preflight to an open pull request. Use when the owner says to start, continue, or do a work package such as WP-3.2.
argument-hint: "[WP-id]"
---

Run work package **$ARGUMENTS** under `docs/spec/05-engineering-handbook.md` section 3. Do the steps in order. Do not skip one because it seems unnecessary this time.

## 1. Preflight

- `git status` is clean and you are on an up-to-date `main`. CI on `main` is green. If not, stop and report. (Before WP-1.2 there is no CI; say so and continue.)
- Read the work package in `docs/spec/08-delivery-plan.md`.
- Read every requirement it cites in `docs/spec/01-requirements.md`, and the spec sections and ADRs those point to. Read `DESIGN.md` if the work touches the interface.
- Check the Definition of Ready. If a predecessor is unmerged, a requirement is ambiguous, or an account, secret, or asset is missing, stop and ask. State the question, the options, your recommendation, and the default.

## 2. Plan

Post the plan as a comment on the work package's issue (or print it if the tracker is unavailable):

- Scope, and what is explicitly out of scope
- Modules and files you expect to touch
- Tests you will write first, each with the requirement ID it will cite
- Risks and anything you need to look up in current documentation
- Open questions

If a question is expensive to get wrong, stop for the answer. Otherwise continue.

## 3. Branch

`git switch -c wp/<id>-<short-slug>`

## 4. Build

- Test first in `domain`, `grader`, `runner`, and use cases.
- Small commits in Conventional Commits form, with no AI attribution: no co-author trailer, no "Generated with" line, no session link (`CLAUDE.md` rule 15).
- Check current documentation before using an API of a fast-moving dependency.
- Interface work follows `.claude/rules/ui-design.md`: read `DESIGN.md`, load the antislop skills, state the Design Read.
- If the work grows beyond the plan, stop and say so. Do not widen scope silently.
- If you fail at the same problem three times, stop and ask.

## 5. Verify

Run the full local gate and keep the output. Before WP-1.1 the toolchain does not exist: run the checks the work package itself names, and say which of the commands below were not available.

- `pnpm verify`
- Tests for touched packages, with coverage
- Whichever apply: `pnpm content:check`, database tests, end-to-end smoke, `pnpm trace`
- Interface work: run the app, drive every control, capture screenshots at 375, 768, and 1280 px for every state into `docs/reports/screens/<id>/`, look at each one, run axe, and write the antislop Delivery Gate report.

Fix causes. Never weaken a check, skip a test, or work around a hook.

## 6. Self-review

Walk the Definition of Done in the handbook, line by line. Anything not met is either fixed now or stated plainly in the pull request.

## 7. Independent review

Invoke the reviewers this change requires (handbook section 4.4), each with the work package ID and the commit range, and for design-reviewer the screenshot paths:

- Any code: `code-reviewer` and `quality-auditor`
- Interface, styles, copy: also `design-reviewer`
- Auth, API, database, runtimes, sandbox, CI, configuration, dependencies: also `security-reviewer`
- Lesson content: `content-editor`

Fix every BLOCKER. Fix each MAJOR or list it for the owner to waive. Fix or ticket each MINOR. Re-run the reviewer after substantial fixes. Save the reports under `docs/reports/reviews/<id>/`.

## 8. Pull request

Push the branch and open a pull request from `docs/templates/pull-request.md`, linked to the issue. Paste real tool output as evidence. Say what to try on the preview deployment. The description carries no AI attribution.

Do not merge.

## 9. Report and stop

Tell the owner, in five lines or fewer: what was built; the evidence; any deviation from the plan or spec; remaining risks; what to look at on the preview. Then stop.
