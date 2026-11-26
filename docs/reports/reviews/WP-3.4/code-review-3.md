# WP-3.4 code review 3 (condensed)

Reviewer: code-reviewer, of 64bb6c3 (the browser test selector fix). Verdict: APPROVE.

- Correct and complete. In `src/features/workspace/components/runtime-console.tsx`, the Run button's accessible name is exactly "Run" and the Answer field's label is exactly "Answer", with no hint, `aria-label` or extra text, so `exact: true` cannot make either selector miss its element. Every other `getByRole`, `getByLabel` and `getByText` in `e2e/*runtime*.spec.ts` matches one element on the page.
- Not a weakening. `exact: true` narrows what a selector matches; Playwright still fails when a selector finds more than one element. The zero-count check `getByText(inputHint)).toHaveCount(0)` in `e2e/live-input-runtime.spec.ts` stays on substring matching, the stricter choice for a count of zero.
- MINOR: the Send, Check and Stop buttons are still matched by substring. They are unique today; a later name such as "Check again" would cause the same failure. Optional. Not changed: the selectors that fail today are fixed, and the others are unique.

Ran: `git show`, a grep of every selector in `e2e/`, a read of the console component and the shell, `prettier --check` on the three specs. Not run by the reviewer: Playwright and `pnpm verify`.
