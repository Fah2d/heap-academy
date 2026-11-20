# Design review 4, WP-1.4

Reviewer: `design-reviewer`, fresh context. Commit 554aab3 only, which answers MINORs 1 and 2 of review 3. 2026-11-16.

Verdict: **APPROVE PENDING SCREENSHOTS**. antislop active: during (global preference).

The reviewer is read-only, so the implementer saved this report as the reviewer returned it. A first attempt at this review stopped on a usage limit before it reported; this is the second attempt, from a fresh context.

I checked source and compiled CSS only. No screenshots were taken after 554aab3, and this commit should not change anything visible. I did not start a server, did not run the e2e test, and did not review `docs/reports/pull-requests/WP-1.4.md`.

Evidence I produced:

- **The stylesheet.** I compiled `src/ui/styles.css` with the repository's `@tailwindcss/postcss` (Tailwind 4.3.5). The output went to the scratchpad, not the repository. I did not run `next build`.
  - Present, by byte offset: `.-mbe-\(--hairline\)` 7293, `.border-be {` 9097, `.border-be-\(length\:--marker-width\)` 9201, `.border-action` 9348, `.border-border` 9410, `.border-transparent` 9608, `.pbs-1` 10645, `.pbs-4` 10703, `.pbe-2` 10761, `.data-selected\:border-action[data-selected]` 16848.
  - Absent: `.border-b {`, `.pt-4`, `.pt-1`, `.pb-2`, `.-mb-`.
  - `.border-be-\(length\:--marker-width\)` declares `border-block-end-style: var(--tw-border-style); border-block-end-width: var(--marker-width)`.
  - `@property --tw-border-style` has `initial-value: solid`.
- **Unit tests at 554aab3.** `pnpm exec vitest run src/ui/primitives/primitives.test.tsx src/features/shell/shell.test.tsx`: 2 files passed, 26 tests passed.

## The fixes

| Review 3 finding                      | Fix                                              | Assessment                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1: e2e checks the marker's color only | `e2e/gallery.spec.ts:94-125`                     | **Correct.** The test now reads `borderBlockEndWidth` and `fontWeight` too. It expects `"2px"` and `"600"` for the current link, and `"2px"` for the resting link. The border style resolves to `solid` (see above), so the computed width really is 2 px and not 0 px. Chromium reports the weight as the string `"600"`. The literal `"2px"` matches `--marker-width: 2px` (`src/ui/tokens/components.css:36`). It is hardcoded rather than read from the token, which is fine: `DESIGN.md` 4.2 specifies the 2 px itself. Not run (no browser in the sandbox). |
| 2: physical block-axis utilities      | link, tabs, disclosure, text-field, site-shell   | **Correct where changed, but incomplete.** Two remain (MINOR 1 below).                                                                                                                                                                                                                                                                                                                                                     |

**Collisions.** I checked each class list against the compiled CSS. Nothing collides, and no declaration is lost.

- **Tab** (`tabs.tsx:21`):
  - One utility sets the border width: `border-be-(length:--marker-width)`, 2 px, block-end only.
  - Two utilities set the color for all sides: `border-transparent` and `data-selected:border-action`. The selected one wins by specificity (it has an attribute selector), and it also comes later in the stylesheet (16848 against 9608).
  - The other sides of the tab have no width, so the color on all sides does no harm.
  - The tab's `-mbe-(--hairline)` (−1 px) still pulls the tab down over the 1 px rule on the tab list. That rule is `border-be border-border` on a different element (`tabs.tsx:31`), so the 2 px marker still covers the hairline with nothing in conflict.
- **Current nav link** (`link.tsx:28,34`):
  - The width comes only from `border-be-(length:--marker-width)`.
  - The color comes only from `border-action`, because the current and resting sets are still exclusive.
  - The resting link gets `border-transparent` at the same width, so the layout still does not shift.
- **Header** (`site-shell.tsx:19`): `border-be border-border` gives a 1 px solid rule on the block-end edge. That is the same result as before.

## BLOCKER

None.

## MAJOR

None.

## MINOR

1. **Two physical block-axis utilities remain, against `.claude/rules/react-next.md:27`.** Review 3 missed both. They are in the same folders that MINOR 2 covered.
   - **Where:**
     - `src/features/shell/components/site-shell.tsx:15`: `focus:top-4`, on the skip link.
     - `src/features/shell/components/primitive-gallery.tsx:20`: `scroll-mt-4`, on `Section`.
   - **Fix:** Tailwind 4.3.5 has `inset-bs` (`inset-block-start`) and `scroll-mbs` (`scroll-margin-block-start`), both in `node_modules/tailwindcss/dist/lib.js`. Use:
     - `focus:inset-bs-4`
     - `scroll-mbs-4`
   - **Effect:** Nothing changes visually in horizontal writing modes. Fix it in this pull request, before the fresh screenshots are taken.

Not a finding: `data-pressed:translate-y-(--press-shift)` in `button.tsx:23` is physical, but CSS has no logical form of `translate`. A downward press nudge is right in every writing mode this product supports.

## What a fresh screenshot set must show

The same as review 3, run at 554aab3 or later, with MINOR 1 fixed. The run must include "[ADR-0014] the current navigation link shows the text color and the amber marker", and it must pass with the new width and weight assertions.

Compared with review 3, nothing in the gallery, tabs, text-field error, header or system pages should change by even one pixel. If something does, report it as a regression.

## Outcome

| #              | Outcome                                                                                                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Review 3: 1    | Fixed. Closes when a run of the e2e test passes.                                                                                                                                                                                     |
| Review 3: 2    | Fixed in the five files listed. MINOR 1 here covers the two that were missed.                                                                                                                                                        |
| Review 3: 3, 4 | Not in this commit. They are already addressed in the pull request rewrite, per review 3's outcome table.                                                                                                                            |
| This review: 1 | Fixed by the implementer in 9d3182a (added after the review). The production CSS has `.focus\:inset-bs-4:focus{inset-block-start:var(--spacing-4)}` and `.scroll-mbs-4{scroll-margin-block-start:var(--spacing-4)}`; `focus\:top-4` and `scroll-mt-4` are absent. Not reviewed again. |

## Screenshots looked at

None. This commit changes no rendering, and the set in `docs/reports/screens/WP-1.4/` was taken before 554aab3. I reviewed source and compiled CSS only.
