# WP-8.2 code review 1

Reviewer: `code-reviewer`, fresh context. The uncommitted fixes on `wp/8.2-review-fixes`, as they stood around 22:05. Verdict: CHANGES REQUIRED.

| # | Severity | Finding | Answer |
|---|---|---|---|
| 1 | BLOCKER | The not-found page for an unknown address lost the wordmark and Courses. Next.js renders it without the `bar` slot, and no test caught it. | Fixed. The layout falls back to the site's bar when the slot is absent. `layout.test.tsx` failed before the fix. `shell.spec.ts` now checks the wordmark link and the Main navigation on the 404 page. In a browser, `/nope`, `/courses/nope`, `/learn/x/y` and `/learn/python-basics/nope` all show "Heap Academy / Courses / Sign in". The skip-link test in the first full e2e run failed on this too. |
| 2 | BLOCKER | On a phone, Retry in "Python could not start" was clipped. `whitespace-nowrap` applied at every width, and `min-w-0` was dropped. | Fixed. `min-w-0` is back, and nowrap applies from 768 px up only. `workspace-runtime.spec.ts` now asserts Retry is wholly in the viewport at 320 and 375. That test failed with the reviewed class and passes with the fix. |
| 3 | BLOCKER | A debug `console.log` in the root layout. | It was live debugging of finding 1, removed before the review ended. `pnpm verify` passes. |
| 4 | MAJOR | A corrupt lesson would throw in the `bar` slot, which has no error boundary, and replace the whole document with the global error page. | Fixed. `readLesson` returns those three failures as typed results. `loadLesson` still throws them, so the page ends on the shared error page with status 500. `lessonBar` returns null, so the header shows the site's bar. Unit tests cover all three cases and failed before the change. |
| 5 | MAJOR | The new routing has no tests: a move from the lesson to another page, the 404 header, the `lessonBar` branches. | Added. `lesson-route-journey.spec.ts` (stack) goes lesson to course page with the Back link, then browser Back, then the footer's Privacy link, checking which bar shows each time. `shell.spec.ts` checks the 404 header. `lesson-page.test.ts` has four `lessonBar` tests. |
| 6 | MAJOR | 5 screenshots missing from `screens/WP-8.2/`. | Not a defect. The reviewer looked while the e2e run was still writing them. All 5 are present (`ls … \| grep -c "too-many-codes\|delete-failed"` gives `5`). |
| 7 | MINOR | The walk through an open case's blocks passed with zero stops and allowed 4. | Fixed. The test counts the panel's `[tabindex="0"]` blocks, asserts at least one, and expects focus on each in turn. |
| 8 | MINOR | `profile-could-not-load` is the generic error page. | Kept. The profile ends on the shared error page by design (section 8), and the test's comment says so. Recorded for the owner. |
| 9 | MINOR | The same refused code sent twice is announced once. | Fixed. Each refusal renders a new alert (`key`). A unit test failed without the key and passes with it. |
| 10 | MINOR | "Review the course" became "Open the first lesson", while FR-CAT-02 calls the state "review". | Recorded for the owner as a copy decision. |
| 11 | MINOR | `pull-requests/WP-2.3.md` still names `admin-states-1280`, which this branch deletes. | Left. That file records WP-2.3 as it was merged. The replacement captures are listed in `pull-requests/WP-8.2.md`. |

The reviewer also confirmed:

- The canary fix is legitimate. In Playwright 1.65.1, `beforeAll` gets the project's timeout (30 s by default), not `describe.configure`'s 180 s.
- Soft navigation switches the bar correctly.
- The route handlers are not shadowed by `@bar/[...rest]`.
