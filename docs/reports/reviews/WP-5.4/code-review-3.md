# WP-5.4 code review 3

Reviewer: `code-reviewer` subagent, fresh context. Commit: 2da1c68 (part 3: completion marks and action labels on the course list and course page). Verdict: CHANGES REQUIRED, 2 MAJOR, 6 MINOR. Found sound: `courseStanding` is pure and each state is tested; marks are looked up by the lesson's place in the whole course; the server HTML and the first client render match; state is a word with a hidden icon; the boundary exception covers one file and one import; no literals in components, no physical sides; the stack journey's new expectations match the markup and the seed (`p_xp = 10`).

Answers in d3ad772.

| # | Severity | Finding | Answer |
|---|---|---|---|
| 1 | MAJOR | The gallery journey's IndexedDB seeding waited only for the heading; an open with no version could create an empty version 1 before the app's upgrade. | Fixed: `complete()` waits until the page shows a count that ends in "completed", which the page draws only after its store has opened the database. 25 of 25 gallery tests pass. |
| 2 | MAJOR | The cached answers changed shape but kept their cache key parts, so an answer cached by an earlier build could be read as the new shape. | Fixed: the course readers' key parts are `published-courses-2` and `published-course-2`, with a comment on the rule. A test checks the key parts (it fails on 2da1c68). |
| 3 | MINOR | "N of M lessons completed" on the course page is half of FR-CRS-05. | Kept, and said in the description: the line is FR-CAT-02's "each course shows the viewer's progress"; FR-CRS-05's summary with XP is WP-6.2's. |
| 4 | MINOR | Several row actions on the list share one name. | Fixed: each row's action ends with the course's title for a screen reader ("Begin the course: Loops"); the visible label starts the name (WCAG 2.5.3). Tested. |
| 5 | MINOR | Two test files' titles lacked requirement IDs. | Fixed. |
| 6 | MINOR | The "before the device answers" test did not check the lesson count shows. | Fixed. |
| 7 | MINOR | An e2e comment said "next up" without checking it. | Fixed: the journey checks one "Next up" and two "Not started". |
| 8 | MINOR | Two doc comments broke lines oddly. | Fixed. |

Found while fixing: the root layout's import graph (part 4) reached the progress hook, which uses `useEffect`, from a server component; the hook's file is now a client module. Six gallery tests matched a course title inside the new action name; those locators are now exact.

Gate on d3ad772 with part 4: `pnpm verify` exit 0, `Test Files  126 passed (126)`, `Tests  2292 passed (2292)`. Browser, Chromium, one test per process against `next dev --webpack` on `localhost:3265`: `catalog-gallery.spec.ts` 25 of 25, `workspace-runtime.spec.ts` 17 of 17, `workspace-phone.spec.ts` 4 of 4.
