<!-- No AI attribution in this description or in any commit: no co-author trailer, no "Generated with" line, no session link (CLAUDE.md rule 15). -->

## What and why

This is a visual polish pass on every screen, following `DESIGN.md`, at the owner's instruction for this session. It covers spacing, alignment, type sizes, contrast, empty and loading states, and phone layouts at 320 and 375 px. This branch is built on `wp/8.2-review-fixes`; merge that one first. After the pass, `design-reviewer` reviewed the whole application, including WP-8.2's interface changes. Its findings are fixed below.

How the pass was done: every learner page was opened at 320, 375, 768 and 1280 px in a development server, and every committed screen was looked at. Every page measured `scrollWidth - clientWidth = 0` at 320 and 375.

Changes from the pass:

| Screen | What was wrong | What changed |
|---|---|---|
| Sign-in, 320 px | Cloudflare's flexible widget is never narrower than 300 px (Cloudflare's widget configuration page), so in the 288 px column it ran 12 px past the gutter. | Below 300 px of column the widget is `compact` (150 × 140 px). A container query reserves 140 px for it, so nothing moves when it appears. New unit test, which failed before the change. |
| Home, course list, course page, phones | Cards kept the desktop 24 px padding on a 320 px screen. | 16 px below 768 px, 24 px from 768 px. The theme has no `sm` breakpoint, so the step is at `md`. |
| Course page | The course's size line sat 12 px above the two progress lines, which sat 4 px apart, so one block of metadata read as two. | One block with 4 px between lines. |
| Profile | Every part was 24 px apart, so the heading, numbers, courses and account ran together. The catalog's pages use 48 px between sections. | 48 px between sections, as on the catalog's pages (RHYTHM 1). The heading, name and numbers stay one block. 16 px under section headings, as on the course page. A course's progress line is `--text-xs`, as the same words are on the catalog. |
| Workspace lesson text | A heading inside the lesson ("Your task") sat 16 px below the text above it, while Hints sat 32 px below. | A level-two heading after the first block gets 32 px above it, matching Hints. The dashboard's preview uses the same component. |
| Dashboard lesson editor screens | The full-page capture drew the sticky save bar where the test had scrolled, and left an empty band where the bar belongs. | `saveScreen` scrolls to the top before a full-page capture. |

Checked and left alone:

- **Loading states:** section 8 says the course list, the course page and the profile are server-rendered with no spinner. The workspace's "Starting Python" bar and the sign-in states have their screens.
- **Empty states:** the home and course list name what happens next. The new profile's empty state has a link to the courses.
- **Contrast:** every pair in use is in DESIGN.md 4.3 and passes AA. The pass added no colour.
- **The home page heading is five lines at 320 px:** DESIGN.md gives the home heading `--text-2xl` with no phone step.

Changes from the design review (`reviews/WP-9.1/design-review-1.md` has every finding and its answer):

| Finding | What changed |
|---|---|
| M2, a revealed hint was lost across 768 px | The hint count lives in `Workspace`, so rebuilding the layout keeps it. Only a hint the learner just asked for takes the focus. New unit test, which failed before the change. The runtime journey checks the open hint and runs axe at 1280, 768 and 375. |
| M3, the phone views did not fill the screen | Below 768 px `main` is a column, and the views, the editor and the output take the height left. This found a defect also on `main`: the site footer lay under the fixed action bar. The bar's height is now padding on `<body>`, so the footer sits above it. |
| M4, long output lines were cut with no cue | The test case blocks and the output pane use the visible scrollbar the code blocks use. |
| M1, the starting bar wrapped on a phone | Below 768 px the progress bar spans the action bar, so its words sit on one line. |
| m1, the preview at 1280×720 was crowded | The preview's back link and title share a row. The frame drops its block padding around the preview from 1024 px. The footer lines up with the header. The editor box grew from 112 px to 170 px. |
| m2, m3, m13, capture artifacts | The gallery screens capture the main region or the dialog only. The lesson editor's Code section has its own capture. The home screens wait for the editor. |
| m4, test case names wrapped under the status | The name wraps in its own column. |
| m6, panels moved at 768 px when Python was ready | From 768 to 1023 px Python's status has its own row, 44 px tall while empty. |
| m8, the profile's name and numbers | The name is `--text-lg` in the text colour. Below 768 px the numbers are two to a row in every state. |
| m9, the deleted dialog kept its question | The title becomes "Account deleted", with a "Go to the home page" link. New unit test, which failed before the change. |
| m11, lesson numbers did not line up | Unmarked rows are indented by the marker's width plus its gap. |
| m13, an idiom in the reset dialog | "The Undo button brings it back." |

## Work package

- Work package: none in the plan. This is the owner's instruction for this session.
- Requirements: FR-AUTH-06 (the challenge's size), NFR-A11Y-05, FR-PRF-01, FR-CRS-05.
- Time box: none set. Time taken: not measured.

## How it was verified

- `pnpm verify`, final: exit 0, `Test Files  166 passed (166)`, `Tests  2946 passed (2946)`.
- e2e, final: CI's projects plus every screen project, with one worker, after `supabase db reset`. The projects were `chromium`, `stack`, `gallery`, `runtime-chromium`, `phone`, `phone-375`, `phone-360` and `phone-workspace`. Result: `437 passed (6.8m)`, `1 skipped`, `E2E_EXIT=0`. The skip is `admin-gate-journey.spec.ts` "[T-19] repeated wrong codes are limited", a `test.fixme` already on `main`.
- The run before it: `436 passed`, `1 failed`. The failure was the new lesson editor capture: its locator for the Code group also matched the editor's "Code in Python" group. It now matches the name exactly. That journey then passed on its own (`1 passed`), and in the final run.
- After that run, the phone's progress bar was made to take its own row. The final run above includes that change, and `WP-7.5/symbol-row-keyboard-375.png` shows the bar the action bar's full width.
- New checks that were shown to fail first:
  - `bot-challenge.test.tsx`: the compact widget below 300 px. The boundary cases at 299.5 and 300 px were added after the code review.
  - `workspace.test.tsx`: a revealed hint survives the 768 px step and the focus stays put.
  - `delete-account.test.tsx`: the deleted dialog's title and its link to the home page.
- `pnpm test:db` was not run. No migration or policy changed.

## Screens

Every screen in `docs/reports/screens/` was recaptured on this branch, with one worker after `supabase db reset`. Screens whose pixels changed are committed in place.

### antislop Delivery Gate report

antislop active: during (global preference). Design Read from `DESIGN.md`: a coding practice tool for beginners who arrive from short videos. Formal, clean, professional. Dial ENERGY 1 / RHYTHM 1 / MOTION 1.

Block 1, Hard Gate:

- R-02 PASS: no em dash in the changed message files (grep).
- R-03 PASS: every learner page measured `scrollWidth - clientWidth = 0` at 320 and 375 in a development server. The galleries and phone projects assert it in the e2e run.
- R-17 PASS: no statistics added. The profile gallery's numbers are sample data on a development-only page.
- R-18 PASS: no testimonials.
- R-23 PASS: no asset created, no icon added.
- R-24 PASS: one new destination, the deleted dialog's link to the home page, which exists.
- R-25 PASS: zero axe violations on every state that ran, including the open hint at 1280, 768 and 375.
- R-26 PASS: the new link in the deleted dialog is driven by the unit test and checked in the gallery.
- R-27 PASS: every state keeps its test and its screen. The open hint at 375 has a new screen.
- R-28 PASS: no FAQ.
- R-32 PASS: no hand-written focus management. The hint's focus uses the existing call, now gated on a request. Dialogs and tabs stay React Aria.
- R-33 PASS: every new or changed string is in `src/messages` (`profile.ts`, `workspace.ts`, `gallery.ts`).
- R-34 PASS: dark only (ADR-0015). No colour added.
- R-35 PASS: run in the browser at 320, 375, 768 and 1280, and every recaptured screen was looked at.
- R-36 PASS: nothing is claimed that was not measured. Real-phone keyboard and overlay scrollbars are not verified.
- R-37 PASS: direction from the signed `DESIGN.md`. DESIGN.md was not edited.
- R-38 PASS: no new people or names.
- R-39 PASS: one `h1` per page. The deleted dialog's title changes with its state, and its status is announced.
- R-40 PASS: no new script.

Block 3: the current-item marker stays the identity motif. The lesson numbers now line up under it (m11).

## Reviews

- code-reviewer: CHANGES REQUIRED, 1 major, 5 minors (`reviews/WP-9.1/code-review-1.md`). The major (the widget's threshold in rem against px) and minors 2, 3 and 5 are fixed and tested. Minor 4 is under "Risks". Minor 6 is answered.
- design-reviewer: CHANGES REQUIRED, 0 blockers, 4 majors, 13 minors (`reviews/WP-9.1/design-review-1.md`). M2, M3 and M4 are fixed. M1 is fixed in part, and the real keyboard is for the owner. Minors 1, 2, 3, 4, 6, 8, 9, 11, 12 and 13 are fixed. m5 and m10 are answered with no change. m7 needs the owner (a pair for DESIGN.md 4.3).
- security-reviewer: not needed. No change to sign-in's server side, the database, headers or the runtime.

## Deviations from the plan or the spec

None in this branch. The owner decisions from WP-8.2 (m9, B4's short-window scroll, the m7 copy) are still open, in `pull-requests/WP-8.2.md`.

## Risks and rollback

- The widget's size is chosen once, when it renders. A window widened afterwards keeps the compact widget, which fits. A 320 px phone turned from landscape to portrait keeps the 300 px widget, which runs 12 px into the gutter until the page reloads. Rendering the widget again would clear its token (code review, minor 4).
- Rollback: revert the merge commit. No migration.

## Definition of Done

- [x] Every screen was looked at, and the pass and the review's findings are fixed or answered.
- [x] `pnpm verify` passes. The e2e results are recorded as they are.
- [x] Every state keeps its screen and its axe check.
- [x] No stub, dead control, placeholder, or invented number.
