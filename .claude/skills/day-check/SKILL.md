---
name: day-check
description: Run the end-of-day audit for one day of the eight-day plan and write the day report. Use when the owner asks for a day check, or when the last work package of a day has merged.
argument-hint: "[day-number]"
---

Run the check for **Day $ARGUMENTS** of `docs/spec/08-delivery-plan.md` under `docs/spec/05-engineering-handbook.md` section 11. It is an audit, not a formality. Its purpose is to find what the work packages missed.

## 1. What merged

List each work package of the day with its pull request and state: merged, open, or not started.

## 2. Full run on `main`

Run everything that exists, not only what changed, and keep the output:

- `pnpm verify`
- Unit, harness, and component tests with coverage
- `pnpm test:db` from an empty database
- `pnpm test:e2e` on Chromium, Firefox, and WebKit
- The dependency audit and the secret scan
- `pnpm infra:verify` against production, from WP-1.3 on

Name any check that does not exist yet as "not built yet". Do not substitute another.

## 3. The exit line

Take the day's "Day N is done when" line and the "Done when" lines of every merged work package. For each, give the evidence as it stands now: a test name and result, a measured number, a report, or a screenshot. Mark it MET, NOT MET, or MOVED. Check it again now; do not copy it from the pull request.

## 4. Cuts and moves

Say what moved to another day and what left the plan from the cut order in section 1.4, and what that does to the remaining days. Propose; the owner decides.

## 5. Risks

Update each risk in section 3: open, changed, or closed, with the reason.

## 6. Owner actions

List every "Owner" line due today or tomorrow that is not done yet.

## 7. Report and stop

Write `docs/reports/day-$ARGUMENTS.md` from `docs/templates/day-report.md` and open a pull request with it. Summarize for the owner in five lines or fewer: what is met, what is not, what moved, and which work package to start first tomorrow. Then stop. The owner decides how the next day starts.
