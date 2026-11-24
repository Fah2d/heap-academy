# WP-3.1 code review 5

- Reviewer: code-reviewer subagent, fresh context
- Range: 547b394, the fix for `security-review-7.md` MINOR 3 (the development page's `dropped` list had no size limit)
- Date: 2026-11-24
- Verdict: **APPROVE**. No blockers, no majors, two minors.

## Findings

**MINOR 1** `docs/reports/pull-requests/WP-3.1.md`: the description still said the `dropped` list has no size limit and listed it under "Not fixed". **Fixed** in the docs commit that records this review.

**MINOR 2** `src/features/workspace/client/runtime-view.ts`: the field's comment said "messages the controller dropped", but `addReport`'s comment said "dropped or acted on". The second matches `ControllerReport` (`src/runtime/controller.ts:60`): `fatal` and `worker_error` are reports the controller acts on, not drops. **Fixed** in dece44f. The page label "Messages dropped" (`src/messages/runtime-dev.ts:35`) has the same imprecision; it predates this commit and is left as it is.

## Checks that passed

- The count matches the old length. The old `addReport` added exactly one entry per call, and `runtime-console.tsx` only read `.length`. Every `report(...)` call in `controller.ts` still reaches `addReport` once.
- `setView(addReport)` behaves like the old arrow function. React calls a function passed to a state setter with only the pending state; `addReport` takes one argument and has no side effects, so the development-mode double call is harmless.
- Nothing else reads the codes. In `src`, `e2e`, `docs` and `.claude`, the only readers are the console, the tests, and `e2e/runtime.spec.ts:306`, which expects the text "0". The number 0 renders as "0".
- The tests are strong enough. Returning `view.dropped` unchanged, or adding 2, fails the one-report test. A cap at 50 fails the 10,000-report test (run by the implementer).
- Rules: no suppressions, skipped tests or stubs; no attribution lines.

## What the reviewer ran

- `git show 547b394`, `git log --format=fuller`, the searches above, `pnpm verify` (exit 0, 37 files, 859 tests).
- Not run: `pnpm build`, the Playwright tests, the page in a browser. Each stale message still causes one React update; that cost is not measured, and it was there before this commit.
