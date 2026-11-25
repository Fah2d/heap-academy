CHANGES REQUIRED

antislop active: during (session override).

Range `938a05d..1443296` (parts 1 to 5). No screenshots exist (`docs/reports/screens/WP-4.3/` is missing), so this is a code-only pre-review, not a design review, and it cannot approve. One correction to the brief: `04-content-system.md` has no sections 7.5 or 7.6; the reviewer used `03-experience.md` sections 7.5, 7.6, 8 and 9, and `04-content-system.md` section 4.

## Findings

**BLOCKER 1: No screenshots, no axe run, no Delivery Gate report.** `e2e/admin-gallery.spec.ts` and J-13 are written and not run. `.claude/rules/ui-design.md` requires all three before review. Fix: run the gallery specs and J-13 at 1280 px, look at every image, run axe, write the Delivery Gate report.

**MAJOR 2: One shared pending flag makes Save and the status moves report each other's work.** `lesson-editor.tsx:451-452`, `:703`; `lesson-status.tsx:96-98, 107, 118`. Save turns every status button pending and shows "Changing status"; Archive or Move back to draft turns the top-bar button to "Saving" though nothing is saved. Fix: a separate pending flag for status moves; Publish shows both.

**MAJOR 3: "Nothing was checked" gives the wrong retry step when Python failed to start.** `src/messages/admin.ts:416-417` (`validation.unavailable`), `:257` (`validateFirst.unavailable`), `lesson-editor.tsx:240`. With `python === "failed"`, Validate always ends `unavailable`, and the notice says "Press Validate to try again", which fails the same way. Only Try again restarts Python. Fix: a separate message for a failed start that points to Try again.

**MAJOR 4: The "Python failed" error state has no icon and no error styling.** `validation-panel.tsx:110-120`. DESIGN.md 4.2: fail and error carry an icon and a word; the panel's own `unavailable` case uses `Notice kind="error"`. Fix: show the failed start as `Notice kind="error"` with Try again.

**MINOR 5:** the pending Validate button says "Validating" while it only waits for Python (`validation-panel.tsx:143-145`). Fix: "Validates when Python is ready", like the workspace (03 section 6.7).

**MINOR 6:** `status_not_allowed` says "Reload the page to see it" but no Reload button is offered (`admin.ts:295-296`, `lesson-status.tsx:84-90`). Fix: offer Reload for it too.

**MINOR 7:** after a status move, the focused status line and the now-visible live region say the same thing; a screen reader hears it twice (`lesson-status.tsx:72-74`, `:94-99`). Fix: keep the live region `sr-only`.

**MINOR 8:** the failed rule says "Open the test case to see what it printed" with no way to get there (`validation-panel.tsx:47-53`). Fix: make each named test case a button that opens it.

**MINOR 9:** "Test case 2:" is set in Sans; DESIGN.md section 2 puts structural labels in Plex Mono (`test-case-list.tsx:108, 126-127`).

**MINOR 10:** limits written into copy ("1 to 12", "12 test cases", "5 second", "64,000") instead of taken from `CHECK_TEST_LIMIT`, `TEST_CASE_TIME_LIMIT_MS`, `HARNESS_OUTPUT_LIMIT` (`admin.ts:310, 312, 400`, `reason.output_limit`, `truncated`).

**MINOR 11:** gallery gaps: no screenshot of a stopped validation, Save on a published lesson validating first, the three `validateFirst` refusals, a timed-out rule, an error verdict with its line, truncated output, the outdated notes; axe missing on the Python-failed, validating, status-refused, unpublish-confirm and published shots.

**MINOR 12:** runbook logic reversed (`docs/runbooks/published-lesson-wrong.md:34`): "If a test case refused correct code, add a wrong answer that the old test case let through". Fix: accepted wrong code means record it as a wrong answer; refused correct code means fix the expected output or loosen the comparison.

**MINOR 13 (owner decision 5):** Delete has no undo; the way back is a reload that also drops other unsaved edits (`test-case-list.tsx:237-249`). Left to the owner.

## Clean

One primary button (Save). Publish, Validate, Stop, Fill from solution, Duplicate are secondary; Archive and Delete destructive with no red fill. Rule and verdict states carry an icon and a word. Both dialogs say what learners will see. Copy in `src/messages`, no em dashes, no blame. No brand asset. Logical properties throughout; focus handled after every list and status change.

## Screenshots looked at

None.
