# Design review 5, WP-1.4

Reviewer: `design-reviewer`, fresh context. The full diff `main...wp/1.4-tokens-primitives-shell` at d48e68f, with the screenshots the owner retook in d48e68f. 2026-11-20.

Verdict: **CHANGES REQUESTED**, on the pull request description only. antislop active: during (global preference).

The reviewer is read-only, so the implementer saved this report as the reviewer returned it.

The screens are right. The fresh set shows every fix from design reviews 2 to 4. Nothing reads as a template or as a copy of IBM's Carbon design system, and I found no screen-level blocker. The one blocker is the pull request description. It was last written before d48e68f, so the new screenshots now contradict its Delivery Gate.

## Blocking findings

1. **`docs/reports/pull-requests/WP-1.4.md:55-61`**
   - **Problem:** "Screens" says the 16 files were taken "before the fixes" and "show the current navigation link without its marker, the dialog actions wrapping at 320 px, the development indicator over content, and the system pages off the header's left edge". The Gate header says "Not deliverable until the screenshots are taken again". The committed set (d48e68f) shows the opposite on all four:
     - The current-link marker: in `gallery-375.png` there is amber `#d4a017` at y 814-815, x 16-73, and in `gallery-1280.png` at y 736-737, x 80-137. That is a 2 px bar, 58 px wide. "Buttons" paints `#f2f0ec` and "Links" paints `#a9a59d`, with no amber under "Links".
     - The dialog actions at 320 and 375 px are stacked, full width, 44 px tall each, 12 px apart (measured in `gallery-dialog-320.png` at rows 468-511 and 524-567).
     - No development indicator appears in any of the 16 shots.
     - The heading's left edge equals the wordmark's: x 16 at 768 px and x 80 at 1280 px.
   - **Required fix:** rewrite "Screens" and the Gate header against d48e68f.

2. **`docs/reports/pull-requests/WP-1.4.md:66, 77, 92, 97`**
   - **Problem:** Gate lines that the screenshots now contradict:
     - R-03 still says the dialog actions are "NOT VERIFIED on screen".
     - R-35 still says "38 passed … nothing after 8c99179 has run in a browser".
     - Block 3 still says the current-item border "did not render" and is "NOT VERIFIED on screen", and that the system-page alignment is "NOT VERIFIED on screen".
     - C-4 rests on the old run.
   - **Required fix:**
     - Restate R-03, R-35, Block 3 and C-4 from the new screenshots and the 39-test run.
     - Keep NOT VERIFIED only for what is still unseen (listed below).
     - Block 3's identity-motif line can now say yes.

3. **`docs/reports/pull-requests/WP-1.4.md:5, 31-32, 70`**
   - **Problem:** The 39-test run has no evidence in the repository.
     - The file still reports only the earlier 38-test run. `git grep "39 passed"` finds only the instruction to expect 39 (line 180).
     - Design review 3, line 87, asked for the raw output to be pasted into the pull request. CLAUDE.md rule 1 asks for real tool output.
     - The count is right for the specs: gallery 4×5 + 1 + 2 = 23, shell 4 + 4×3 = 16, total 39. But the pass itself rests only on the owner's report.
     - R-25's "axe … passed … in the owner's run" points at the old run.
   - **Required fix:** paste the raw `pnpm test:e2e --project=chromium --project=gallery` output, including the `[ADR-0014] the current navigation link shows…` line. Then point R-25 and R-35 at that run.

4. **`docs/reports/pull-requests/WP-1.4.md:120, 169-201, 233, 239`**
   - **Problem:** These sections still describe work that is now done:
     - "What closes the design review" and "Owner actions now due". Steps 1, 3 and 4 are done (e18643d, d48e68f).
     - The Definition of Done boxes for design approval and "every reviewer blocker is fixed".
   - **Required fix:** update all three. Then run `gh pr edit 3 --body-file …` so GitHub matches. I could not see the GitHub body itself: `gh` failed with a TLS error in the sandbox, so I judged the repository copy.

## Status of findings from earlier design reviews

**Review 1**

- 2, 4, 6, 7, 13: fixed. Finding 4 is confirmed on screen: the progress track has square ends in every gallery shot.
- 5 and 15: fixed in source and covered by e2e tests that pass as reported.
- 10: fixed in source. A long reference was never captured.
- 1 (home link loop), 3 (no nav or footer), 11 (mono fallback): accepted by the owner. These are decisions 1, 2 and 5.
- 12 and 14: still open, and listed in the pull request.
- 8 (forced colors) and 9 (dialog with the phone keyboard open): not verified, because no screenshot shows them.

**Review 2**

- 1 (stale Gate): open again. These are the blocking findings above.
- 2 (current nav link): resolved, measured above.
- 3 (ragged dialog actions): resolved.
- 4 (stretched dialog trigger): resolved. "Reset code" is at its natural width in every gallery shot.
- 5 (system pages off the header's edge): resolved.
- 7 (lone word in the heading): resolved. `not-found-320` breaks "We could not / find this page".
- 8 (duplicate labels): resolved. The labels are "Standalone link" and "Navigation, the first link current", and "Test case states" appears once.
- 9: the indicator and the backdrop band are resolved. The phone device project is deferred.
- 6 (no primary action on the not-found page): deferred to WP-5.1.

**Review 3**

- 1 and 2: fixed in 554aab3.
- 3: listed under decision 3.
- 4: still NOT VERIFIED. No screenshot shows the error page without a reference.

**Review 4**

- 1: fixed. A grep of `src/` finds no physical direction utilities. `site-shell.tsx:15` uses `focus:inset-bs-4` and `primitive-gallery.tsx:20` uses `scroll-mbs-4`.

## Non-blocking notes

- **Test case names in the mono face.** `primitive-gallery.tsx`, Disclosures section; `gallery-*.png`. "Test 2: prints the total" is set in Plex Sans. `DESIGN.md` section 2 puts test case names in the tests panel in Plex Mono. The primitive itself is generic, but the tests panel (WP-4.x) should set its names in the mono face.
- **Dialog colors are correct.** The secondary button sits on the raised surface with the `#16161a` fill, the destructive button has a transparent fill with a `#ff7a7a` border, and both pass `surface="raised"` (`primitive-gallery.tsx:152,155`). This matches `DESIGN.md` 4.5.
- **The rest of the screens.** At 320 px the right 16 px gutter is empty on every row except the header hairline, so nothing overflows.
  - Type, spacing, amber use and the Plex Mono labels match `DESIGN.md`.
  - Amber appears only on the primary button, links, the current marker, the selected tab and progress.
  - Words: no em or en dashes in `src/` or `e2e/`, no buzzwords, and no blaming. "Try again", "Keep my code" and "Reset code" name their actions.
- **My own checks.** I ran `pnpm exec vitest run` on the contrast, primitives and shell tests at HEAD: 3 files, 94 tests passed.
- **Outside design scope, not reviewed.** e18643d (the owner's `.claude/settings.json` change) is on this branch.
- **Not verified on any screen:**
  - The focus ring, including the amber ring around the amber primary button, and focus inside the open dialog.
  - Hover and press.
  - Forced colors.
  - The dialog with the phone keyboard open.
  - The error page without a reference.
  - A long reference wrapping.
  - The skip link while it has focus.
  - Firefox and WebKit.
  - Real phone emulation: the narrow shots use the "Desktop Chrome" device resized.

When blocking findings 1 to 4 are fixed (a description-only change), this becomes APPROVE WITH NOTES. The notes are the list above, review 1's 12 and 14, and review 2's 6.

## Screenshots looked at

All in `docs/reports/screens/WP-1.4/`, as committed in d48e68f:

- `gallery-320.png`, `gallery-375.png`, `gallery-768.png`, `gallery-1280.png`. I cropped 320 and 375 at full resolution and sampled pixels.
- `gallery-dialog-320.png`, `gallery-dialog-375.png`, `gallery-dialog-768.png`, `gallery-dialog-1280.png`
- `not-found-320.png`, `not-found-375.png`, `not-found-768.png`, `not-found-1280.png`
- `error-320.png`, `error-375.png`, `error-768.png`, `error-1280.png`
