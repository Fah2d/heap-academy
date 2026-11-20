# Design review 7, WP-1.4

Reviewer: `design-reviewer`, fresh context. Commit aade057, which answers the one blocker of review 6. 2026-11-20.

Verdict: **APPROVE WITH NOTES**. antislop active: during (global preference).

The reviewer is read-only, so the implementer saved this report as the reviewer returned it.

**Blocking findings:** none.

## The five checks

**1. R-03 now matches `e2e-39-passed.txt`.** It is at `docs/reports/pull-requests/WP-1.4.md:77`.

- I compared the numbered run order with `--list`. Each spec file runs in order on one worker, because the config has no `fullyParallel` setting.
- Not-found page, 44 px tests: 320 px is test 8, 375 is 12, 768 is 16 and 1280 is 20. Sideways-scroll tests: 9, 13, 18 and 21.
- Gallery: the 44 px tests are 11, 24, 29 and 34. The sideways-scroll tests are 15, 25, 30 and 35.
- Only test 16 has no ✓ line. Test 18 has one (`e2e-39-passed.txt:27`). So "One of them, the not-found page's 44 px test at 768 px" is correct.

**2. Every line aade057 changed is true.**

- **Line 32, "the commits after it change only screenshots (d48e68f) and documentation":** true. `git diff --stat e18643d aade057` lists 17 files, all under `docs/`. d48e68f changes 13 PNGs only.
- **Line 34, test 37:** `e2e-39-passed.txt:86` reads `…ion link shows the text color and the amber marker`. Of the 39 titles in `--list`, only the `[ADR-0014]` one has that ending.
- **Line 35, "34 ✓ lines; 14, 16, 23, 28, 33 have none":** I counted it again and it holds.
- **Line 35, "by name and by run order":** this matches `playwright.config.ts`, with two workers and two files. The gallery titles carry their width in the `at N px` describe block, which the output cuts off. The shell titles end with the width.
- **Line 35, "saves its screenshot only after its check passes":** true.
  - `e2e/shell.spec.ts:56-57`: the `expect(...violations).toEqual([])` comes before `saveScreen(page, "not-found", width)`.
  - `e2e/gallery.spec.ts:46-47` has the same order.
  - `e2e/screens.ts:27` writes `docs/reports/screens/WP-1.4/<name>-<width>.png`.
  - `not-found-768.png` and `gallery-dialog-375.png`, `-768.png` and `-1280.png` are all in `git show --stat d48e68f`.
- **R-32, line 86, "the not-found page's 44 px tests, which press Tab":** true (`e2e/shell.spec.ts:66`).
- **Line 140, "fixed in 6c30622":** true. `git show --stat 6c30622` shows the description, design-review-5.md and the e2e file.
- **Lines 148, 264 and 219:** these match `design-review-6.md`, and aade057 is the commit directly after 6c30622.
- **Line 265, "37 commits before the R-03 fix's commit":** true. `git rev-list --count ef7276c..aade057^` gives 37. `git log --format='%an <%ae> | %cn <%ce>'` gives `37 Fahad <Fah2d@users.noreply.github.com> | Fahad <Fah2d@users.noreply.github.com>`. A grep of the commit bodies for co-author or "Generated with" text found nothing.

**3. No overclaims, and NOT VERIFIED is kept.**

- R-32 still marks the amber ring around the primary button as NOT VERIFIED. C-4's unseen list is untouched by aade057.
- `prettier --check` passes on both changed Markdown files.
- Neither file contains an em or en dash.

**4. Only `docs/` changed.** `git show --name-only aade057` lists `docs/reports/pull-requests/WP-1.4.md` and `docs/reports/reviews/WP-1.4/design-review-6.md`, and nothing else.

**5. e18643d:** not reviewed, as you asked.

## Notes (not blocking)

- **Line 11:** "ran design reviews 6 and 7" was written before review 7 ran. It becomes true once this report is saved, so leave it unless the report is not saved.
- **Line 148:** the list of review 6's accuracy notes leaves out the `not-found-768.png` note. That note is applied at line 35, so this is only an incomplete summary, not an overclaim.
- **R-32, line 86:** the line counts all four not-found 44 px tests as passed. Test 16, the 768 px one, passes on the summary line only. R-03 now says so and points to "How it was verified". R-32 could add the same pointer.
- **Line 15:** the `pnpm verify` output was taken before aade057. aade057 changes documentation only, and the Prettier check above passes. I did not run the full `pnpm verify`.
- **Line 260:** "Every reviewer blocker is fixed" is now true, because review 6's one blocker is fixed in aade057.
- **Carried forward:**
  - Review 5's unseen list under C-4.
  - Review 1's items 12 and 14, and review 2's MINOR 6.
  - The WP-4.x note on Plex Mono for test case names.
  - The time box: the fourth session's length is not measured, and the total is near the 4.5 hour stop line (handbook section 3.4). That is the owner's call.

## Not verified

- **The GitHub PR body:** `gh pr view 3` failed with `tls: failed to verify certificate: x509: OSStatus -26276`.
- **The owner's run:** it rests on the pasted output.
- **The full `pnpm verify` at aade057:** not run.

## Screenshots looked at

I opened none. No claim in aade057 depends on what a screenshot shows. I checked only that these files are in d48e68f, and that each is saved after its axe check passes:

- `docs/reports/screens/WP-1.4/not-found-768.png`
- `docs/reports/screens/WP-1.4/gallery-dialog-375.png`
- `docs/reports/screens/WP-1.4/gallery-dialog-768.png`
- `docs/reports/screens/WP-1.4/gallery-dialog-1280.png`
