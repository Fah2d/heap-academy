<!-- No AI attribution in this description or in any commit: no co-author trailer, no "Generated with" line, no session link (CLAUDE.md rule 15). -->

## What and why

The owner asked for two things in this session. First, fix every open BLOCKER, MAJOR and minor finding in `docs/reports/reviews/WP-8.1/design-review-1.md`. Second, make `e2e/canary-journey.spec.ts` reliable. WP-8.1 had already fixed B1, B2, M3, minor 1 and minor 13. This branch fixes the other 16.

| ID | Finding | What changed |
|---|---|---|
| B3 | The profile has no screens. | New development page `/dev/profile` (`profile-gallery.tsx`), with sample data and a fake deletion that never reaches a server. New `e2e/profile-gallery.spec.ts` in `gallery`. It checks filled, empty and name error at 320, 375, 768 and 1280. It checks the delete dialog, a mistyped word, deleting, deleted and delete failed at 375 and 1280. It checks the could-not-load page at 375 and 1280. Every state runs axe, and the screens are saved in `screens/WP-8.2/`. |
| B4 | From 768 px up, four bars frame the workspace. | The workspace now has one compact bar instead of the site header (`docs/spec/03-experience.md` section 4). The root layout gets a `bar` slot (`src/app/@bar`). On `/learn/[course]/[lesson]` the slot renders `LessonBar`: the way back to the course, then the lesson's title as the page's one `h1`. The account control stays in the header. The workspace drops its own title row, except in the admin preview. Previous/next and the footer lose their vertical padding inside the locked frame. The editor gets a floor of 10rem and the output a floor of 8rem (`--workspace-rows`). Where the window is shorter than the floors, `main` scrolls. Below 768 px, the way back and Sign in share one line and the title takes the next. |
| M1 | Dashboard gallery screens are whole-page captures about 17,000 px tall, with dialogs captured full page. | `saveScreen` takes an `element` and captures only that region. A page with a visible fixed element is captured at window size. `admin-states` and `admin-course-states` are replaced by one capture per state: courses empty, failed and rows; setup failed; code limited and checking; editor refusals and empty; new-course form invalid and slug taken; move refused. Dialogs are captured at window size. |
| M2 | Sign-in states have no screens. | New development page `/dev/sign-in` (`sign-in-gallery.tsx`), with fake send and verify answers. New `e2e/sign-in-gallery.spec.ts` covers sending, too many codes, the code step, verifying, code rejected and too many tries, at 375, 768 and 1280, each with axe. |
| M4 | Python's traceback shows before the plain-words error card. | `console-panel.tsx` renders the error card first, then the console. |
| m2 | A rejected code leaves the field neutral. | `sign-in-view.tsx` marks the field invalid with the reason as its error message until the code changes, a new code is sent, or the email is changed. A screen reader hears it once through an alert. Unit test. |
| m3 | The actions row wraps at 768, and the Python status breaks across lines. | The key hints show from 1024 px (`max-lg:hidden`). The status does not wrap (`whitespace-nowrap`). |
| m4 | Code examples cut long lines with no sign they scroll. | A `.scroll-visible` class in `code.css` shows a thin scrollbar in the surface colours. It is applied to lesson code blocks and table regions. |
| m5 | Hints show Markdown backticks literally. | Hints stay plain text, as the content system says. The seed hint no longer uses backticks. The dashboard's hint field now says learners see plain text. |
| m6 | An empty console box shows above the time-limit error. | When a run ends on an error with nothing printed, only the error card shows. |
| m7 | Two links to one place per course row. | The action label now names where it goes: "Start the first lesson", "Go to your next lesson", "Open the first lesson". |
| m8 | The error page says "Try again." above a "Try again" button. | The body now says "We could not prepare this page. The problem is on our side, not yours." |
| m9 | `InformationFilled` and `ChevronRight` (as a status) are not in DESIGN.md's icon list. | Removed. The next-lesson status and the information notice show no icon. The current-item marker (M3) carries the next lesson. See "Deviations". |
| m10 | The gallery's reset dialog says "You cannot undo this", but the workspace offers Undo. | The dialog says "You can undo this straight after." |
| m11 | On a phone the unsupported warning sits below the lesson. | It comes first below 768 px (`max-md:order-first`). |
| m12 | Full-page phone captures paint fixed bars mid-page. | Fixed through M1's capture rule. |

**The canary.** The real cause is not the one WP-8.1 recorded. The test's second `beforeAll` hook stopped polling after about 30 s, even though the file's timeout is 180 s. The course appears only once the cached list's minute has passed: about 31 to 61 s after another test last read the list. When a journey had just read the list, the hook gave up first. The hook now sets its own timeout to the wait it polls for, as `e2e/lesson-route-journey.spec.ts` already does. The proof is in `docs/reports/launch-readiness.md`. The walk also checks the course title on the course page and in the lesson's header.

**Found and fixed on the way:**

- **Not-found pages lost the wordmark.** Next.js renders a not-found page without the `bar` slot. The layout now falls back to the site's bar. `src/app/layout.test.tsx` failed before the fix. `e2e/shell.spec.ts` (the skip link) caught it in the full run.
- **`e2e/workspace-a11y-runtime.spec.ts`, "after a failed Check".** This test failed on `main` too: an open test case's input and output blocks are focusable (`tabIndex=0`), so the walk stops on them before the next case's toggle. The test now walks through those stops and checks each one is inside the open panel and shows its ring. The focus order now includes the account navigation and the compact bar.

## Work package

- Work package: none in the plan. This is the owner's instruction for this session, on the findings of WP-8.1's design review.
- Requirements: FR-PRF-01 to 03, FR-AUTH-02, FR-WSP-08, FR-SYS-01, NFR-A11Y-02, 03, 05 and 06.
- Time box: none set. Time taken: not measured.

## How it was verified

- `pnpm verify`, final: exit 0, `Test Files  165 passed (165)`, `Tests  2941 passed (2941)`.
- e2e: CI's projects plus every screen project, with one worker, after `supabase db reset`. The projects were `chromium`, `stack`, `gallery`, `runtime-chromium`, `phone`, `phone-375`, `phone-360` and `phone-workspace`. Result: `437 passed (5.7m)`, `1 skipped`, `E2E_EXIT=0`. The skip is `admin-gate-journey.spec.ts` "[T-19] repeated wrong codes are limited", a `test.fixme` already on `main`. The canary's four tests passed in that run.
- The run before the review fixes: `435 passed`, `1 failed`. The failure was `shell.spec.ts`, the skip link, caused by the not-found header (code review finding 1).
- `shell.spec.ts` was rerun after `/dev/profile` and `/dev/sign-in` joined its list of pages absent from the production build: `18 passed`.
- New checks that were shown to fail first:
  - `layout.test.tsx`: the fallback bar.
  - `lesson-page.test.ts`: a corrupt lesson in the bar.
  - `sign-in-view.test.tsx`: a repeated refusal.
  - `workspace-runtime.spec.ts`: Retry fits at 320 and 375. It failed with the class under review: `expect(locator).toBeInViewport() failed`.
- `pnpm test:db` was not run. No migration or policy changed.

## Screens

Screens are in `docs/reports/screens/`, recaptured on this branch with the projects listed under "How it was verified". New: `WP-8.2/` (profile and sign-in states). The new per-region dashboard captures are in `WP-2.3/` and `WP-4.1/`. Screens whose pixels changed are committed in place.

### antislop Delivery Gate report

antislop active: during (session override, CLAUDE.md rule 5). Design Read from `DESIGN.md`: a coding practice tool for beginners who arrive from short videos. Formal, clean, professional. Dial ENERGY 1 / RHYTHM 1 / MOTION 1.

Block 1, Hard Gate:

- R-02 PASS: no em dash in the changed message files (grep).
- R-03 PASS: the profile and sign-in galleries assert `scrollWidth - clientWidth == 0`. The profile is checked at 320 and the sign-in steps at 375, 768 and 1280. The phone projects' existing checks pass at 360 and 375.
- R-17 PASS: no statistics. The profile gallery's numbers are sample data on a development-only page, which a production build does not serve (`.dev.tsx`).
- R-18 PASS: no testimonials.
- R-23 PASS: no asset created. Two icons were removed and none added.
- R-24 PASS: no new destination. The compact bar holds the existing way back to the course.
- R-25 PASS: zero axe violations on every state in the two new galleries and in every existing journey that ran.
- R-26 PASS: every control on the new development pages is driven by a test: change name, save, delete, the confirm field, send code, sign in.
- R-27 PASS: every profile and sign-in state in section 8 now has a test and a screen. The dashboard states each have their own capture.
- R-28 PASS: no FAQ.
- R-32 PASS: no hand-written focus management. The rejected-code alert uses the existing `LiveRegion`. The bar's link is the `Link` primitive.
- R-33 PASS: every new string is in `src/messages` (`gallery.ts`, `catalog.ts`, `system.ts`, `admin.ts`).
- R-34 PASS: dark only (ADR-0015).
- R-35 PASS: run in the browser through the journeys, and the screens were looked at.
- R-36 PASS: nothing is claimed that was not measured. Real-phone behaviour is not verified.
- R-37 PASS: direction from the signed `DESIGN.md`.
- R-38 PASS: "Sara" and `sara@example.test` are sample data on development pages.
- R-39 PASS: the bar's `h1` is the page's only `h1`. The header keeps its banner landmark and the account navigation. The rejected code is announced once.
- R-40 PASS: no new script. The compact bar is server-rendered.

Block 3: the focal point FAIL from WP-8.1 (the workspace frame at 720 px) is addressed by B4. The current-item marker stays the identity motif.

## Reviews

- code-reviewer: CHANGES REQUIRED, 3 blockers, 3 majors, 5 minors (`reviews/WP-8.2/code-review-1.md`). The blockers are fixed and tested: the not-found header, Retry clipped on a phone, and a debug line. Majors 4 and 5 are fixed and tested. Major 6 was not a defect (it was a run in progress). Minors 7 and 9 are fixed. Minors 8, 10 and 11 are answered in the file.
- design-reviewer: not run on this branch alone. `wp/9.1-visual-polish` is built on this branch, and its design review covers every screen, these included. Its findings and answers are in that branch's report.
- security-reviewer: not needed. No change to sign-in's server side, the database, headers or the runtime. The two development pages are `.dev.tsx` and absent from a production build: `shell.spec.ts` checks `/dev/*` answers 404 there.

## Try it on the preview

1. Open a lesson at 1280×720. One bar sits above the lesson: "Back to …", the lesson's title, Sign in. The editor is at least 10rem tall.
2. Open a lesson on a phone. "Back to …" and Sign in share the first line, and the title is on the next.
3. Open an address that does not exist. The header shows the wordmark and Courses.
4. Sign in with a wrong code. The field turns red and says why. Typing clears it.
5. Run `print(x)` in a lesson, with no `x` defined. The plain-words card comes first, then Python's traceback.

## Deviations from the plan or the spec

1. **m9:** DESIGN.md section 4.5 says a notice is "icon and sentence". The information notice now has no icon, because `InformationFilled` is not in the icon list. The other choice is to add `InformationFilled` to DESIGN.md section 8 and put it back. The owner decides.
2. **B4:** section 6.1 says "The page itself does not scroll at these widths". With the floors, `main` scrolls only when the window is too short to hold them. The other choice is to let the editor shrink below 10rem.
3. **Test expectations changed:** the workspace focus order (the compact bar is now in the header), and the "after a failed Check" walk (see above). Neither is weaker: each expects more stops, in the order the page has.

## Risks and rollback

- The `@bar` slot depends on Next.js parallel routes. A route without its own `@bar` page uses `[...rest]` or `default.tsx`. A not-found render uses the layout's fallback. `layout.test.tsx` and `shell.spec.ts` cover the fallback.
- Rollback: revert the merge commit. No migration.

## Definition of Done

- [x] Every open finding in `design-review-1.md` has a change and, where it is testable, a test.
- [x] `pnpm verify` passes. The e2e results are recorded as they are.
- [x] Every state of every changed view exists and has a screen.
- [x] No stub, dead control, placeholder, commented-out code, or invented number.
- [x] No new table. No new server action.
