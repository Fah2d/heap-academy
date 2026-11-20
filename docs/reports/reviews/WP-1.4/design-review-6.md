# Design review 6, WP-1.4

Reviewer: `design-reviewer`, fresh context. Commit 6c30622, which answers the four blockers of review 5. 2026-11-20.

Verdict: **CHANGES REQUESTED**, one line. antislop active: during (global preference).

The reviewer is read-only, so the implementer saved this report as the reviewer returned it.

One line is wrong, and fixing it is a one-word change. With it fixed, the verdict becomes APPROVE WITH NOTES.

## Blocking finding

`docs/reports/pull-requests/WP-1.4.md:78`: **problem:** R-03 says that "two of" the sideways-scroll and 44 px tests have no ✓ line, "the not-found page's at 768 px". The raw output disagrees. The sideways-scroll test at 768 px does have a ✓ line: `✓  18 …e not-found page does not scroll sideways at 768 px (92ms)` (`e2e-39-passed.txt:27`). Only one of the two lacks a ✓ line: the 44 px test at 768 px. The other test with no ✓ line at 768 px is the axe test, which R-25 covers. Line 35 of the description already says this correctly, so R-03 contradicts both the evidence file and line 35. Under the line-by-line rule, a Gate line that the evidence contradicts blocks. **Required fix:** change it to "One of them, the not-found page's 44 px test at 768 px, has no ✓ line of its own". Then run `gh pr edit 3 --body-file …` again.

## What I checked

**1. Review 5's four blockers**

- Blocker 1 is fixed. "Screens" (lines 59-71) and the Gate header (line 73) are rewritten against d48e68f.
  - The 13-of-16 claim holds. `git show --stat d48e68f` lists 13 PNGs, and `error-320.png`, `error-375.png` and `not-found-375.png` are not among them.
  - The dialog shots are taken at the viewport size: `sips` reports 320/375/768/1280 × 900, and the spec uses `fullPage: false`.
- Blocker 2 is fixed apart from the line above. R-03's dialog sentence, R-35, Block 3 and C-4 are restated.
  - The NOT VERIFIED tags that were dropped cover only what is now seen: the dialog actions, the current-item border and the system-page alignment.
- Blocker 3 is fixed. The raw output is in `e2e-39-passed.txt`, and R-25 (line 82) and R-35 (line 89) point at it.
- Blocker 4 is fixed. Lines 148, 199-218 and 248-263 are updated.
  - Line 263 says "36 commits before this description's commit". That holds: `git rev-list --count ef7276c..6c30622` gives 37, all authored and committed by `Fahad <Fah2d@users.noreply.github.com>`.

**2. Claims about `e2e-39-passed.txt`**

- The summary line is `39 passed (16.8s)` (line 90). There is no failed, flaky or skipped line.
- I counted 34 ✓ lines. Tests 14, 16, 23, 28 and 33 have no ✓ line. This matches line 35.
- There are four `[WebServer] ⨯ Error` blocks, after error tests 17, 26, 31 and 36.
- Test 37 is the current-link test and test 3 is the dev-only test. Both claims are correct.
- `--list` prints `Total: 39 tests in 2 files`, as claimed.
- The mapping holds, but the numbers in the output are the order tests started in, not the `--list` order. There is no `fullyParallel` setting, so each spec file runs in one worker, in the order it is written. Under that order every one of the 34 ✓ names matches:
  - shell: tests 1, 3-6, 8-10, 12-14, 16 and 18-21
  - gallery: 2/7/11/15/17 at 320 px, 22-26 at 375, 27-31 at 768, 32-36 at 1280, then 37-39
- So test 14 is the not-found axe test at 768 px, test 16 is the not-found 44 px test at 768 px, and tests 23, 28 and 33 are the open-dialog tests at 375, 768 and 1280 px. This is what line 35 says.

**3. NOT VERIFIED**

- C-4 (lines 109-117) keeps all nine of review 5's unseen items: focus ring, focus in the dialog, skip link while focused, hover and press, forced colors, dialog with the phone keyboard open, error page without a reference, long reference wrapping, Firefox/WebKit, and real phone emulation.
- R-32 keeps the amber ring around the primary button as NOT VERIFIED.
- I found no overclaim.

**4. Documentation only**

- `git show --stat 6c30622` shows three files, all under `docs/`.
- `git diff --name-only e18643d 6c30622` lists nothing outside `docs/`.
- Prettier passes on the two changed Markdown files, and there are no em or en dashes in the description.

**5. e18643d**

- It changes only `.claude/settings.json`. I did not review it.

## Notes (not blocking)

- **Line 33** quotes the full `[ADR-0014] …` title. The output line is cut short: `✓  37 …ion link shows the text color and the amber marker` (line 86). The ending matches only one test, so the claim holds, but the description should say the line is shortened.
- **Line 35** says "matched by name against `--list`". The output lines are cut off before the width, so the widths of the three dialog tests come from the run order, not from the names. It should say "by name and run order".
- **More evidence for line 35:** `not-found-768.png` also changed in d48e68f. The axe test at 768 px (test 14) saves it only after its axe check passes, so it supports that test's pass. The description could cite it.
- **Line 32:** "the only commit after it, d48e68f" is now out of date, because 6c30622 also comes after it. 6c30622 is docs only, so nothing material changes.
- **Line 260:** "Every reviewer blocker is fixed" is ticked before review 6 confirmed it, and stays wrong until the R-03 line is fixed.
- **R-32 (line 86):** "the not-found keyboard test" is really the 44 px test, which presses Tab once (`e2e/shell.spec.ts:66`). This is old wording.
- **Line 11:** the fourth session's length is not measured, and the description says the total is near the 4.5 h stop line (handbook section 3.4). This is outside design scope; it is for the owner.
- Carried forward from review 5: its non-verified list, review 1's 12 and 14, review 2's MINOR 6, and the WP-4.x note on the mono face for test case names.

**Not verified:**

- The GitHub PR body. I did not try `gh`, and review 5 reported a TLS failure in the sandbox.
- The `pnpm verify` output at lines 17-29. I did not rerun it, because `vitest --coverage` writes files.
- The owner's run itself. It rests on the pasted output.

## Screenshots looked at

None were opened again. No claim depended on something review 5 did not measure. For the open-dialog shots I checked only their pixel sizes with `sips`: `docs/reports/screens/WP-1.4/gallery-dialog-320.png`, `-375.png`, `-768.png` and `-1280.png`.
