<!-- No AI attribution in this description or in any commit (CLAUDE.md rule 15). -->

**Base: `wp/5.2-workspace-laptop` at af88060** (which carries `wp/3.4-statechart` with WP-3.1 to WP-3.4, and `main` at 032246c with WP-4.1 to WP-5.1). Merges after WP-5.2. Until then this pull request also shows WP-5.2's commits; review 1536808 and 63a1097. Merged in 76a5745 on 2026-11-25 (one conflict, `docs/reports/local-build-progress.md`, both sides kept): `pnpm verify` exit 0, `Test Files  107 passed (107)`, `Tests  1968 passed (1968)`; `pnpm build` with CI's fake public values, `check-bundle` and `check-static` exit 0. The browser tests were not run again.


## Up to date with WP-5.2

On 2026-11-26 `wp/5.2-workspace-laptop` came in twice: at 5d6549b (its merge of `wp/3.4-statechart` and `main` at 032246c) in 9d404cd, and at af88060 (WP-5.1's checks counting the lesson page, 08df7cc, and WP-5.2's notes) in ca8986d. Two files conflicted in 9d404cd: `e2e/screens.ts`, where the screenshot projects are both sides' (`main`'s `stack` and this branch's `phone-workspace`), and `docs/reports/local-build-progress.md` (both sides kept). On ca8986d: `pnpm verify` exit 0 (`Test Files  123 passed (123)`, `Tests  2238 passed (2238)`). The e2e job of CI ran here against the local stack, freshly reset (`supabase db reset`), with `CI=1` and the stack's publishable key: `pnpm test:e2e --project=chromium --project=stack --project=gallery`, `120 passed`, `1 skipped` (`[T-19] repeated wrong codes are limited`, a `test.fixme` that `main` has too), exit 0. Not run: Firefox, WebKit, `phone-workspace` and the `runtime-*` projects, which CI does not run on a pull request.

## What

WP-5.3, the workspace on a phone (`03-experience.md` section 6.8, FR-WSP-13). Below 768 px:

- A tab list at the top shows one of three views: Lesson, Code, Output. It stays at the top while the view scrolls. It is the `Tabs` primitive's new `views` kind (React Aria, panels kept mounted and inert).
- Run, Check and Stop sit in a bar fixed at the bottom. Its distance from the bottom is worked out from `window.visualViewport`, so it rides above the on-screen keyboard. The page keeps room for the bar at its end.
- Run shows the Output view with the console; Check shows it with the tests; Go to line shows the Code view.
- The Lesson view ends with one full-width action, "Write your code", which shows the Code view and focuses its tab.
- When the view changes under the focus (a shortcut from the editor), the selected tab takes it. The bar has no icons and no key labels, so it fits one row at 320 px; the editor keeps the cursor above it.

At 768 px and wider the look is unchanged; the grid now has rows for the editor, the actions and the output. Until the browser knows the width, a narrow screen shows the title and the lesson only.

## How it was verified

- `pnpm verify` on 63a1097: exit 0, `Test Files  105 passed (105)`, `Tests  1959 passed (1959)`. `pnpm build` with the fake public values: exit 0. `check-bundle`: `No server variable (RESEND_API_KEY, HEAP_RELEASE) in 24 files under .next/static.` `check-static`: exit 0.
- New unit tests: `phone-layout.test.ts` (7: the media query, the keyboard inset) and 10 in `workspace.test.tsx` (the views, the Lesson view's action and focus, arrow keys, Run and Check switching views, focus after a shortcut, Go to line, the bar in every view, the inset written on the element, the announcement outside hidden views, nothing built at 768 px and wider). The focus tests fail with the focus effect switched off.
- `e2e/workspace-phone.spec.ts` in its own project `phone-workspace` (emulated Pixel 7), Chromium, 4 of 4 passed against `next dev --webpack`: J-1 at 320, 375 and 430 px, and the unsupported browser at 375 px. Each view: no sideways page scroll (NFR-A11Y-05), every control in `main` at least 44 by 44 px (NFR-A11Y-06), axe, and the page's end above the bar (fails without the padding: `Received: -60.5625`). Python's files are held at first: the lesson reads and the editor takes typing before Python is ready.
- The 15 desktop journeys of `e2e/workspace-runtime.spec.ts` still pass (15 of 15), including a crossing of 768 px in each screenshot round.
- Screens in `docs/reports/screens/WP-5.3/`: `phone-{lesson,code,output,tests}` at 320, 375 and 430 px, `phone-unsupported-375`, and the desktop journeys' 375 px screens.
- 2026-11-25, after merging WP-5.2 at 8fe35c8: J-3 failed in 2 of 3 runs. The screen round's last resize back to 1280 px returned before the wide layout was built, so the first answer was typed into the phone layout's input line, which then went away, and an empty answer was sent. The screen rounds now wait for the layout to change after each resize. After that: J-3 passed 11 of 11 runs; the 15 desktop journeys passed 15 of 15 (one test per process, Chromium, `next dev --webpack`); the phone journeys passed at 320, 375 and 430 px, and the unsupported browser at 375 px. Once, the output-over-the-limit journey failed; code review 2 found the same race there (a resize to 375 px measured at once), fixed in 9771531, after which it passed 4 of 4 runs.
- Risk found on the way: text typed into the input line and not yet sent is lost when the window crosses 768 px (the input line is built again). Not fixed here.
- Not verified: a real on-screen keyboard (an emulated phone has none; the inset is a unit test), Firefox and WebKit (speed mode). Owner: complete a lesson on a real phone on the preview (the plan's owner step).

## Reviews

Code review 1 on 1536808: CHANGES REQUIRED, 2 BLOCKER (a hand-written tab list against ADR-0014; focus lost after a shortcut), 5 MAJOR. All fixed in 63a1097, with tests; report and answers in `docs/reports/reviews/WP-5.3/code-review-1.md`. Code review 2 (2026-11-25) on the WP-5.2 merge and the resize wait: CHANGES REQUIRED, 1 MAJOR (the same race in a second test), fixed in 9771531; `docs/reports/reviews/WP-5.3/code-review-2.md`. No security review: no sign-in, database or runtime change (speed mode). No design review (speed mode).

## antislop Delivery Gate report

antislop active: during (session override, CLAUDE.md rule 5). Dials from `DESIGN.md`: ENERGY 1 / RHYTHM 1 / MOTION 1.

- Block 1: PASS. R-02: no em dash in the new words. R-03 and NFR-A11Y-05: no sideways scroll at 320, 375, 430 px in every view (measured). R-25/R-39: axe passed in every view. R-26/R-35: every new control is tapped in J-1. R-27: Python starting and ready shown in the bar; the other states come from WP-5.2's components. R-32: tab list keys and focus covered by unit tests. NFR-A11Y-06: touch targets measured.
- Block 2: PASS. No new technique; the view tabs reuse the output tabs' look (amber bar under the current tab).
- Block 3: PASS. The focal point stays Check in the bar.
- Block 4: PASS. One view at a time, as section 6.8 asks.

## Decisions (safe defaults)

1. The bar holds Stop as well as Run and Check, so J-4 works from any view.
2. Previous and next end the Lesson and Output views and are hidden in the Code view, so the Code view is the editor and the bar.
3. Below and above 768 px the workspace renders two trees with keyed children; crossing 768 px rebuilds the editor and the output (the code is kept), and moves the bar.
4. The bar's inset and height are CSS variables written on the workspace's element from listeners, declared as `0px` in `components.css`, so nothing re-renders as the keyboard moves.
5. The console's 24 rem ceiling below 768 px (WP-5.2, decision 18) stays in the Output view.
6. The symbol row above the keyboard (FR-WSP-21, a Should) is not built: it is not in WP-5.3's list.
7. Below 768 px the bar's buttons have no icons, so the three fit one row at 320 px.
8. The console's answer field keeps 10 rem (`--console-answer-min`); Send and End input wrap.

## Risks and rollback

The phone views appear after hydration: on a slow first load a phone shows the title and the lesson, then the tab list appears above the lesson. Unmerged branch; nothing to roll back.
