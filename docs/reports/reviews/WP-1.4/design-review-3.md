# Design review 3, WP-1.4

Reviewer: `design-reviewer`, fresh context. Range `40e9b54..24141ee` (commits 4ad0b16, fce14cc, 24141ee). 2026-11-16.

Verdict: **APPROVE PENDING SCREENSHOTS**. antislop active: during (global preference).

The reviewer is read-only, so the implementer saved this report as the reviewer returned it.

This pass checks source and compiled CSS only. The 16 screenshots in `docs/reports/screens/WP-1.4/` were taken before these commits. I opened three of them again to set a baseline (`not-found-1280`, `gallery-dialog-320`, `error-375`). I did not review `docs/reports/pull-requests/WP-1.4.md`; it is being rewritten in parallel.

Evidence I produced:

- **The stylesheet.** I compiled `src/ui/styles.css` with the repository's `@tailwindcss/postcss` (Tailwind 4.3.5). The output went to the scratchpad, outside the repository; I did not run `next build`.
  - `.border-action` is at byte 9330 and `.border-transparent` at 9590.
  - `.text-text` is at 12103 and `.text-text-muted` at 12152.
  - `.hover\:text-text:hover` is at 14333, inside the hover media query, after `.text-text-muted`. Hover still wins over the resting color.
  - `.md\:flex-row` and `.md\:justify-end` are at 17244 and 17297, inside `@media (width >= 48rem)`, after `.flex-col` at 8170.
  - `.text-balance { text-wrap: balance }` is present.
  - `--breakpoint-md: 48rem` is defined in `src/ui/tokens/semantic.css:107`.
- **Unit tests at 24141ee.** `pnpm exec vitest run src/ui/primitives/primitives.test.tsx src/features/shell/shell.test.tsx`: 2 files passed, 26 tests passed.
- **Leftovers.** `grep -rni "requestid|request-id|REQUEST_ID" src e2e scripts` found nothing.

## The fixes

| Review 2 finding                       | Fix                                                                                                      | Assessment                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2 (MAJOR): current nav link            | `link.tsx:34-35` puts the current and resting styles in separate class sets, so a link gets only one set | **Correct.** Nothing can collide any more, so stylesheet order no longer decides it. The current link now gets `--color-text`, weight 600 and an amber bottom border with `--marker-width` (2 px). That matches `DESIGN.md` 4.2 and line 96. The resting link keeps its transparent 2 px border, so making a link current does not shift the layout vertically. The unit test guards the class lists. The e2e test checks the computed colors but has not run (see MINOR 1). |
| 3: ragged dialog actions               | `DialogActions`, `dialog.tsx:26-28`                                                                      | **Correct.** Below `md` the buttons stack full width; from `md` they sit in one row, end-aligned. The stacked order follows the DOM ("Keep my code" first), so focus order matches what the learner sees, and the safe action comes first.                                                                                                                                                                                      |
| 4: stretched trigger                   | `primitive-gallery.tsx:143` wraps the trigger in a `flex` div                                            | **Correct.** `DialogTrigger` adds no wrapper element and the overlay renders in a portal, so the button keeps its natural width.                                                                                                                                                                                                                                                                                               |
| 5: system pages off the header's edge  | `system-page.tsx:18-19`                                                                                  | **Correct.** The outer wrapper uses the same three classes as the header's inner div (`site-shell.tsx:20`). The heading will start at x 16 at 768 px and at x 80 at 1280 px, the same as the wordmark.                                                                                                                                                                                                                         |
| 7: lone word in the heading            | `text-balance` on the `h1`                                                                               | **Correct.** The class is in the compiled CSS.                                                                                                                                                                                                                                                                                                                                                                                 |
| 8: duplicate labels                    | `gallery.ts:19,21`; Status `Example` removed                                                             | **Correct.** "Standalone link" and "Navigation, the first link current" name variants rather than repeating content. "Test case states" now appears once, as the `h2`.                                                                                                                                                                                                                                                         |
| 9: dev indicator, backdrop band        | `screens.ts:21-26`; dialog captured with `fullPage: false`                                               | **Correct in source.** `nextjs-portal` is still the host element in Next 16.4.6 (`next/dist/compiled/next-devtools/index.js`). Removing it right before the capture is enough for a still image. A fresh set will confirm it.                                                                                                                                                                                                   |
| 6                                      | Left for WP-5.1                                                                                          | As agreed.                                                                                                                                                                                                                                                                                                                                                                                                                     |

**Commit 24141ee (owner's decision 3).** The error page now shows only the server's digest. Without one, the reference block does not render: the hint and the label disappear together, so the page never shows a label with nothing after it. The remaining page is still complete and designed: heading, sentence, primary "Try again", standalone home link. The body copy, "Something failed on our side…", stays true for a browser error. `/dev/error` throws during the server render, so it still gets a digest. The old `error-375.png` shows `72104186`, an 8-digit digest, because no request ID header exists before WP-1.3. The error screenshots should therefore still show the reference after this commit. No new visual problem.

No fix introduces a new problem for an accent, a token, type, or words. I found no em dashes and no buzzwords in the changed messages. Nothing new is drawn or generated.

## BLOCKER

None in this range. Review 2's BLOCKER 1, the stale Delivery Gate, is being handled in the parallel rewrite and was not reviewed here.

## MAJOR

None.

## MINOR

1. **The new e2e test checks the marker's color but not that it is visible.** `e2e/gallery.spec.ts:86-115`.
   - It compares `color` and `borderBlockEndColor` only.
   - A current link with a 0-width border, or one that lost its weight 600, would still pass. Both are part of the `DESIGN.md` 4.2 marker, and the weight is the cue that is not color.
   - Fix: also check, for the current link:
     - `borderBlockEndWidth` equals the resolved `--marker-width` (`"2px"`).
     - `fontWeight` is `"600"`.
   - For the resting link, check that `borderBlockEndWidth` is also `"2px"`, which guards against a layout shift.
2. **Physical block-axis utilities, against `.claude/rules/react-next.md:27` ("Logical CSS properties only").** These were not introduced in this range, but `link.tsx:28` was edited here.
   - Where:
     - `link.tsx:28`: `border-b-(length:--marker-width)`
     - `tabs.tsx:21`: `-mb-(--hairline)` and `border-b-…`
     - `tabs.tsx:31`: `border-b`
     - `tabs.tsx:39`: `pt-4`
     - `disclosure.tsx:43`: `pb-2`
     - `text-field.tsx:42`: `pt-1`
     - `site-shell.tsx:19`: `border-b`
   - Tailwind 4.3.5 has the logical forms: `border-be-*`, `mbe-*`, `pbs-*` and `pbe-*` are in `node_modules/tailwindcss/dist/lib.js`.
   - The new e2e test already reads `borderBlockEndColor`, so it would keep passing after the switch.
   - Fix: switch these utilities in this pull request. If not, the code reviewer and the owner should decide whether the rule covers the block axis, and record the answer.
3. **The spec still promises a reference on every error page.** These lines are now untrue for browser errors after 24141ee:
   - `docs/spec/01-requirements.md:157` (FR-SYS-01, "(for errors) show a reference ID")
   - `docs/spec/03-experience.md:90` ("error (with reference ID)")
   - `docs/spec/01-requirements.md:229` (NFR-OBS-01)
   - `docs/spec/07-operations.md:83`

   The owner's decision outranks the spec, but `WP-1.4.md:129` names only NFR-OBS-01 for the `spec-change`. Fix: the `spec-change` should cover all four lines. While the pull request file is being rewritten, also fix two lines that describe deleted code:
   - `WP-1.4.md:31` still lists "request ID parsing" tests.
   - `WP-1.4.md:166` still lists "the request ID context".

4. **No screenshot of the error page without a reference.** That state became real in 24141ee, for any error raised in the browser. A unit test covers it (`shell.test.tsx`, `queryByText(referenceHint)` is null), and the change only removes two lines. Fix, optional: add a dev route that throws in a client component, and capture it. Otherwise list it under "Not verified" in the Gate.

Not a finding: `DialogActions` switches at the viewport `md` breakpoint, not at the dialog's own width. Between about 544 and 767 px wide, the buttons stack inside a 512 px dialog where a row would fit. That is acceptable. A container query (`@container` on the dialog with `@md:flex-row`) would follow the dialog itself, if the workspace Reset dialog ever needs it.

## What a fresh screenshot set must show

From `pnpm test:e2e --project=chromium --project=gallery`, run outside the sandbox, at 24141ee or later:

1. **The run.** The raw output is pasted into the pull request: 39 passed (gallery 4 × 5 + 1 nav test + 2 motion = 23, plus shell 16), including "[ADR-0014] the current navigation link shows the text color and the amber marker".
2. **`gallery-320/375/768/1280.png`, under "Links":**
   - The mono label "Standalone link" sits above "Go to the notices".
   - The mono label "Navigation, the first link current" sits above the nav.
   - "Buttons" is `#f2f0ec`, weight 600, with a 2 px `#d4a017` bar directly under it.
   - "Links" is `#a9a59d` with no amber pixels.
   - Both labels share one baseline.
3. **The same shots, other sections:**
   - The "Reset code" trigger under "Dialog" is at its natural width, not stretched.
   - "Test case states" appears once, as the heading, with no mono label repeating it.
   - The Next.js "N" indicator appears in none of the 16 shots.
4. **`gallery-dialog-*.png`:**
   - Each shot is viewport height (900 px), with no backdrop band.
   - At 320 and 375 px, "Keep my code" sits above "Reset code". Both are full width and equal width, 12 px apart.
   - At 768 and 1280 px, the two buttons sit in one end-aligned row.
5. **`not-found-*` and `error-*`:**
   - At 768 and 1280 px, the heading's left edge equals the wordmark's (x 16 and x 80).
   - At 320 px, the not-found heading does not end on a single word.
   - The error shots still show "If it keeps happening, keep this reference." and a `Reference` digest.

When that set matches, this becomes APPROVE WITH NOTES, provided the rewritten Delivery Gate agrees with it line by line. The notes are MINORs 1 to 4 above, review 2's findings 6 (WP-5.1) and 9's phone device project, and review 2's "Not verified" list.

## Outcome

| #                       | Outcome                                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review 2: 1             | Out of scope here; being rewritten in parallel. Must agree with the fresh screenshots.                                                                    |
| Review 2: 2             | Fixed in source and confirmed in compiled CSS. Closes on a fresh gallery screenshot and a passing run of the e2e test.                                    |
| Review 2: 3, 4, 5, 7, 8 | Fixed in source. Close on fresh screenshots.                                                                                                              |
| Review 2: 9             | Fixed in source for the indicator and the band. The phone device project is deferred.                                                                     |
| Review 2: 6             | Deferred to WP-5.1, as agreed.                                                                                                                            |
| 24141ee                 | No design problem. Spec wording follow-up in MINOR 3.                                                                                                     |
| This review: 1, 2       | Fixed by the implementer in 554aab3 (added after the review).                                                                                             |
| This review: 3          | The `spec-change` scope in the pull request now names all four lines; the two stale lines were already gone from the rewrite (added after the review).    |
| This review: 4          | Listed under "Not verified" in the Delivery Gate (added after the review).                                                                                |

## Screenshots looked at

All are pre-fix and served as the baseline only:

- `docs/reports/screens/WP-1.4/not-found-1280.png`
- `docs/reports/screens/WP-1.4/gallery-dialog-320.png`
- `docs/reports/screens/WP-1.4/error-375.png`
