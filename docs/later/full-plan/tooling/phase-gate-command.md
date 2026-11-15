> Archived. Not in force. This file belongs to the original ten-phase plan and is kept for work after the first release. Do not build from it unless the owner says so. The plan in force is in `docs/spec/`.

---
name: phase-gate
description: Run the exit review for a phase of the delivery plan and prepare the gate report for the owner. Use when the owner asks for a phase gate or when the last work package of a phase has merged.
argument-hint: "[phase-number]"
---

Run the gate for **Phase $ARGUMENTS** of `docs/spec/08-delivery-plan.md`. A gate is an audit, not a formality. Its purpose is to find what the work packages missed.

## 1. Completeness

- Every work package of the phase is merged. List each with its pull request. An unmerged one ends the gate here.
- `main` is green, including the most recent nightly run.

## 2. Full regression

Run everything, not only what changed, and keep the output:

- `pnpm verify`, all unit and component tests with coverage
- Python harness tests; content check and lint
- Database tests from an empty database
- End-to-end on the full browser matrix; accessibility; visual comparison
- Parity suite; mutation tests for `domain` and grader comparison code
- Lighthouse and bundle budgets
- Dependency audit and secret scan

## 3. Exit criteria

Take the phase's gate line and each work package's "Done when". For each, give the evidence: a test name and result, a measured number, a report, or a screenshot. Mark it MET, NOT MET, or WAIVED BY OWNER. Do not mark something met because it was met when its pull request merged; check it now.

## 4. Traceability

Run `pnpm trace`. Every Must requirement scheduled up to and including this phase has at least one passing test. List any that do not.

## 5. Independent audits

Invoke, on the whole phase's commit range:

- `security-reviewer` to re-walk the threat table against the current code
- `quality-auditor` for test quality across the phase
- `design-reviewer` on every screen that exists so far, with fresh screenshots (from Phase 3 on)

Run the antislop Delivery Gate on every screen (from Phase 3 on).

## 6. Risks, debt, decisions

- Update each risk in section 3 of the delivery plan: still open, changed, closed, with the reason.
- Review `docs/TECH_DEBT.md`. Anything new needs the owner's decision.
- List ADRs accepted, amended, or still proposed.
- List flaky and quarantined tests.

## 7. Report

Write `docs/reports/phase-$ARGUMENTS.md` from `docs/templates/phase-report.md`. Include a short script the owner can follow on the preview or production site to see the phase's outcome for themselves, and the manual checks only the owner can do (devices, accounts, legal).

## 8. Stop

Open a pull request with the report. Summarize for the owner: what is met, what is not, what you recommend. The owner decides whether the gate passes. Do not start the next phase until they say so. If the owner passes it, tag `phase-$ARGUMENTS-complete`.
