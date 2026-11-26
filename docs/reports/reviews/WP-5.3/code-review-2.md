# WP-5.3 code review 2 (2026-11-25)

Reviewer: `code-reviewer` subagent, fresh context, one round (speed mode). Scope: the merge of `main` at dffe1a8 into `wp/5.2-workspace-laptop` (af95dc4, the `src/ui/primitives/button.tsx` conflict), the merge of `wp/3.4-statechart` into it (eaac0d7), and ffdae1c on `wp/5.3-workspace-phone` (the resize wait in `e2e/workspace-runtime.spec.ts`).

Verdict: CHANGES REQUIRED, 1 MAJOR.

## Findings

- af95dc4: no finding. The result is the union of both sides. `ButtonProps` has no `ref`, so `{...props}` cannot override `ref={element}`; `props.id` is read before the spread and written after it; the two effects are independent.
- eaac0d7: no finding. Nothing from `wp/3.4-statechart` was dropped from `playwright.config.ts`, `scripts/eslint/module-boundaries.mjs` or `src/features/workspace/index.ts`.
- ffdae1c: the wait is sound and weakens nothing (no timeout, retry or removed assertion). The `phoneLayout: false` case is justified: an unsupported browser never builds the phone layout, and `e2e/workspace-phone.spec.ts` covers that page at 375 px.
- MAJOR: the restarting test (`[FR-WSP-07] [FR-WSP-17] output over the limit`) still resized to 375 px with a bare `setViewportSize` and measured the console at once. It could measure the wide layout that was about to go, or get `null` if the layout changed during `boundingBox()`.

## Answers

- MAJOR fixed in 9771531: that test now uses `resize(page, 375, true)`. The test then passed 4 of 4 runs (Chromium, one test per process). The single failure of this test seen earlier in the run may have been this race; that is not proven.
- The reviewer ran no tests; the pass counts are this run's.
