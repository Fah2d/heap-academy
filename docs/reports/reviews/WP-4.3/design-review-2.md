antislop active: during (global preference).

CHANGES REQUIRED

Range `e1f1ce9..HEAD` at c5902d0 (e51304f, ecbb815, 87af7ec), against DESIGN.md, 03-experience sections 7.4 to 7.6, 8 and 9, the glossary and the antislop skills. Code-only review again: this sandbox has no browser and no local Supabase stack, and `docs/reports/screens/WP-4.3/` does not exist.

## Findings

**BLOCKER 1 (still open from round 1): no screenshots, no axe run, no Delivery Gate report.** The new gallery test in `e2e/admin-gallery.spec.ts` (lines 415 to 503) and J-13 are written but have never run. Fix: run the gallery specs and J-13 at 1280 px, look at every image, and write the Delivery Gate report into the pull request.

**MAJOR 2: the "output cut at the limit" state is not shown as it really is, and the real state breaks the layout.** The solution output box (`test-case-list.tsx:372-378`) has no height limit. A real cut output of 64,000 characters would make one test case thousands of pixels tall, pushing Fill, the hint and Delete far down the page. The gallery feeds the box 8 short lines (`admin-state-gallery.tsx:322`) while the text above says "cut at 64,000 characters", so the `admin-verdict-truncated` screenshot will not show the state it is named for. Fix: give the box a maximum height with vertical scrolling, with its focus ring inside it (DESIGN.md section 4.5). In the gallery, print `HARNESS_OUTPUT_LIMIT` characters.

**MINOR 3: an Open button can name a different number than the test case it opens.** The labels use the numbers from the last validation (`validation-panel.tsx:51-54, 59-67`), but the button opens the test case in the list as it is now. Fix: build the labels from the editor's current test cases.

**MINOR 4: the new sentence repeats the buttons and is unclear.** `admin.ts:392-393` gives "The solution did not pass test case 2 (Doubles). Each test case shows what it printed." "It" could mean the test case or the solution, and "Each test case" reads oddly when one failed. Fix: "The solution did not pass test case 2 (Doubles). Open it to see what the solution printed.", with a plural form for several.

**MINOR 5: one limit is still typed into the copy (rest of round 1 MINOR 10).** `admin.ts:324-325`: "1 to 80 characters." in the name hint. Fix: take the limit as a number, like the error message does.

**MINOR 6: gaps left from round 1 MINOR 11.** No gallery picture for Save refused because Python could not run the programs (`validateFirst.unavailable`) or for the checklist's own error for that case (`validation.unavailable`, shown by `validation-panel.tsx:186-190`). `admin-validation-passed` (`e2e/admin-gallery.spec.ts:405`) has no axe run on its state. The "Still missing" state of rule 1 (lines 406-411) has no screenshot. No picture of a test case opened and focused by Open. Fix: a gallery runtime that is ready but whose program check returns nothing; axe before line 405; screenshots after line 411 and after one Open click.

**MINOR 7: the solution output box is styled differently from code in a lesson (from part 3).** `test-case-list.tsx:374` is a bare box with no padding, while lesson code blocks sit in a padded, rounded editor-coloured panel (`lesson-content.tsx:69-74`). Fix: use the same wrapper.

**MINOR 8: the pull request description is out of date.** Line 197 still lists round 1 MINOR 11 as not done; the part 7 section does not mention ecbb815; decisions 16 and 15 are out of order.

## Round 1 findings at HEAD

| Round 1 | Status |
|---|---|
| BLOCKER 1 | Open: needs the e2e run. |
| MAJOR 2 | Fixed: separate pending flags (`lesson-editor.tsx:467-488`). |
| MAJOR 3 | Fixed: separate messages when Python could not start. |
| MAJOR 4 | Fixed: a failed start is an error notice with Try again. |
| MINOR 5, 6, 7, 12 | Fixed. |
| MINOR 8 | Fixed; follow-ups are MINOR 3 and 4 above. |
| MINOR 9 | Fixed: "Test case N" in Plex Mono. |
| MINOR 10 | Fixed except the name hint (MINOR 5 above). The 5 seconds now comes from the runtime's `TIME_LIMIT_MS`, the right source. |
| MINOR 11 | Mostly done; gaps in MINOR 6 above. |
| MINOR 13 | Left to the owner (decision 13). |
| Decision 14 | Done: icon and word in each title; "Test case 2: Doubles, Failed" for a screen reader; no verdict once out of date. |

## Clean in this range

Save is still the only primary button; Open is secondary. Pass and fail always show an icon and a word. All new copy is in `src/messages`, no string literals in components, no em dashes, glossary words used, no blame. Logical CSS properties only. No brand asset, illustration or invented number.

## Screenshots looked at

None. No screenshots exist for WP-4.3.
