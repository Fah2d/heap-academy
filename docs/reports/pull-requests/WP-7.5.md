<!-- No AI attribution in this description or in any commit: no co-author trailer, no "Generated with" line, no session link (CLAUDE.md rule 15). -->

## What and why

WP-7.5 Polish. All five Should items are built, in the plan's order. Each one has its tests, states, screens and this Delivery Gate.

1. **Home page live editor (FR-LND-01).** The home page holds a short program in the real editor, and the real Python worker runs it. CodeMirror is fetched after the page's load event. Python is fetched on the first Run or the first edit. A Run pressed while Python starts is kept until Python is ready (FR-WSP-17). If the editor's code cannot be fetched, the program stays as text and Run still runs it. A browser that cannot run Python is told why and is offered no Run.
2. **Error explanations (FR-WSP-23).** Thirteen common Python errors get one sentence on what they mean. The sentence sits under Python's message, in the lesson and on the home page. Each of the 13 names is checked against what real Pyodide raises.
3. **Near-miss messages (FR-GRD-07).** A failed Check whose output differs in one way only names that way: letter case, spaces, punctuation, or a missing last line. Punctuation inside a number (3.5, 1,000, -5) is never stripped, so a wrong number is never called a slip. Test case outputs no longer wrap, so a wrap cannot hide a missing space.
4. **Symbol row (FR-WSP-21).** In the phone's Code view, a row of 11 keys ends the action bar: Tab, then `: ( ) [ ] " ' = # _`. Each key goes in at the cursor, and the editor keeps focus, so the keyboard stays open. At 768 px and wider there is no row.
5. **Completion counts (FR-ADM-13).** The course editor shows each lesson's completion count. The counts come from `public.lesson_completion_counts()` through the admin's own session, are parsed, and default to 0 for a lesson with no row. A refused or malformed answer fails the read instead of showing a made-up number.

## Work package

- Work package: WP-7.5 (`docs/spec/08-delivery-plan.md`).
- Requirements and threats covered: FR-LND-01, FR-WSP-23, FR-GRD-07, FR-WSP-21, FR-ADM-13. Also touched: FR-WSP-17, FR-WSP-08, FR-WSP-04, FR-SYS-02, NFR-PERF-01. Threats: T-01, T-07, T-19, T-20, T-21 (see the security review).
- Time box: 3 hours. Time taken: not measured. The commits run from 06:12 to the push at about 07:30 (+0300). The build before the first commit and three review rounds came on top, so the package is past its box. Nothing was cut to fit.

## How it was verified

- `pnpm verify`, final, on the pushed commit: `VERIFY_EXIT=0`, `Test Files  158 passed (158)`, `Tests  2844 passed (2844)`.
- Tests added, with requirement IDs in their titles:
  - `home-editor.test.tsx`: 9 tests.
  - `error-explanation.test.ts`: 22 tests, including real Pyodide through the Node runner for all 13 names.
  - `compare.test.ts`: near-miss examples, two properties (normalized and exact), and `withoutPunctuation` by example.
  - `symbol-row.test.tsx`: 6 tests. The remount no-replay test fails with the guard removed.
  - `workspace-output.test.tsx`: explanation order, every near-miss kind in the panel, no wrapping, and the answers box per status.
  - `courses.test.ts`: the counts join, the refused read and malformed counts.
  - `workspace.test.tsx`: the symbol row shows only in the phone Code view.
- Database tests: the function `lesson_completion_counts()` and its four-caller tests are on `main`; this package adds no migration. `supabase db reset` then `pnpm test:db`: not run in this session.
- End to end and axe, as CI runs it (`--project=chromium --project=stack --project=gallery`, after `supabase db reset`): see "e2e" below. New journeys, each with axe on every state:
  - `e2e/home-editor-journey.spec.ts`: 8 states × 375, 768, 1280. The initial state waits for network idle and checks that no `/_runtime/` request was made.
  - `e2e/near-miss-journey.spec.ts`: 3 kinds × 3 widths, in the real worker and harness.
  - `e2e/symbol-row-journey.spec.ts`: Pixel 7 emulation at 320 and 375, plus 768 with no row.
  - `e2e/completion-counts-journey.spec.ts`: counts 3, 1, 0 from the database. One more completion is inserted, and the count reads 2 after a reload.
  - `e2e/page-weight-journey.spec.ts`: every editor script on `/` starts at or after `loadEventStart`.
- Lighthouse 12.8.2, mobile, on a local production build, `/`, three runs:
  - performance 95, 95, 94
  - accessibility 100 on all three runs
  - LCP 2.9, 2.9, 3.0 s
  - TBT 70, 50, 90 ms
  - CLS 0
  - 461 KiB
  - Main's recorded `/` was 95, LCP 2.9 s. An earlier build with CodeMirror in the entry bundle scored 87, so CodeMirror waits for the load event.

e2e as CI runs it, final, after the round 2 fixes:

- Run 1: 14 stack journeys failed with "Sign-in is not working right now". The local `supabase db reset` had run without `ACTION_COUNTER_KEY`, so the Vault secret was empty. This was environment, not code.
- After a reset with the key: `273 passed (5.1m)`, `1 skipped`, `E2E_EXIT=0`.
- Screens recaptured after `supabase db reset` with `--workers=1` on the four new journeys: `37 passed (2.0m)`, `E2E_EXIT=0`.

## Screens

`docs/reports/screens/WP-7.5/`, 41 files, captured on a clean seed with one worker:

- `home-editor{,-starting,-ran,-error,-input,-too-large,-failed,-unsupported,-no-editor}-{375,768,1280}.png`
- `near-miss-{letter_case,punctuation,spaces}-{375,768,1280}.png`
- `symbol-row-{320,375}.png` and `symbol-row-keyboard-{320,375}.png`. The keyboard screens show only the area above a 300 px keyboard.
- `admin-completion-counts-1280.png`

There is no screen of a missing last line: the seed's expected outputs are one line each. The unit and component tests cover it.

### antislop Delivery Gate report

antislop active: during (session override, CLAUDE.md rule 5). Design Read from `DESIGN.md`: a coding practice tool for beginners arriving from short videos, formal, clean, professional, dial ENERGY 1 / RHYTHM 1 / MOTION 1.

Block 1, Hard Gate:

- R-02 PASS: no em dash in `src/messages/catalog.ts`, `workspace.ts` or `admin.ts` (grep).
- R-03 PASS: the symbol-row journey asserts `scrollWidth - clientWidth <= 0` at 320 and 375. The row scrolls inside itself. Outputs scroll inside their own block.
- R-17 PASS: no statistics. The completion counts are read from the database, and the e2e checks them against rows it wrote.
- R-18 PASS: no testimonials.
- R-23 PASS: no asset created. The keys are text, and the icons are the existing Carbon set.
- R-24 PASS: no new navigation.
- R-25 PASS: zero axe violations on every journey state above. The explanation is in `text-text`, not muted.
- R-26 PASS: every control works, and every e2e drives it:
  - Run, Stop and Retry on home
  - every symbol key
  - the answer field on home
  - Go to line in the error card
- R-27 PASS: home has initial, starting, ran, error, input, too large, failed, unsupported and no editor. Counts have 0 and a failed read.
- R-28 PASS: no FAQ.
- R-32 PASS:
  - Run and Stop are Buttons.
  - The symbol keys are Buttons with names, and focus stays in the editor.
  - The read-only program and each output block are focusable and named.
  - Focus rings come from the primitives.
- R-33 PASS: all in source.
- R-34 PASS: dark only (ADR-0015), no toggle.
- R-35 PASS: run as a production build and driven by the journeys above. Each control's result is asserted (output text, focus, counts).
- R-36 PASS: the performance numbers above are measured. Where the cursor lands above a real phone keyboard is stated as not verified.
- R-37 PASS: direction from the signed `DESIGN.md`.
- R-38 PASS: the program's name "Sara" is sample program text, not a person shown as a user.
- R-39 PASS:
  - Native buttons, each with an accessible name.
  - The row is a `group` named "Symbols".
  - The answer field is labelled by the program's prompt.
  - No motion added.
- R-40 PASS:
  - The editor box keeps one height before and after CodeMirror arrives (`--home-editor-size`), and CLS is 0 on three runs.
  - CodeMirror loads after the load event.
  - Python loads on first use.

Block 2, Purpose-Gate:

- R-01, R-07, R-10, R-12, R-13, R-22 PASS: none used.
- R-04 PASS: Play and Stop icons only, on Run and Stop, as in the workspace.
- R-06 PASS: Plex Mono on the symbol keys and the program, which are code. That is the identity motif in `DESIGN.md`.
- R-08, R-09 PASS: no arrows, no badges.
- R-14 PASS: no feature cards.
- R-19 PASS: no animation.

Block 3, Liveliness:

- Dials set: yes, ENERGY 1 / RHYTHM 1 / MOTION 1.
- Output matches the dials: yes. The home page keeps one structure, and the editor uses the workspace's own parts.
- Focal point: yes. On home it is the h1 with the editor. On a failed Check it is the failure sentence with its near miss.
- Structural whitespace: yes. The 1280 px home layout aligns to the top, and the space under the h1 is the column's (see deviations).
- One accent: yes. Amber stays on focus and the primary action. Run on home is secondary (see owner actions).
- Identity motif: yes. Plex Mono for code and the symbol keys.
- Design Read declared: yes, above.

Block 4, Craftsmanship:

- C-1 PASS: each choice has a one-line reason in the code or here.
- C-2 PASS: same as R-26.
- C-3 PASS: the editor replaces nothing. It shows the product.
- C-4 PASS: every state, at 320 to 1280 px, and by keyboard. The no-editor and unsupported fallbacks are tested.
- C-5 PASS: no claims.
- R-05 PASS: no template sections added.
- R-11 PASS: primitives' radii.
- R-15 PASS: "Run", not a generic call to action. The heading and intro say what to do with the program.
- R-16 PASS: no buzzwords.
- R-20 PASS: the editor is the product's own.
- R-21 PASS: dark only, per ADR.
- R-29 PASS: tokens only.
- R-30 PASS: no clone.
- R-31 PASS: each visual change has its reason in the review records.

## Reviews

- code-reviewer: round 1 CHANGES REQUIRED (1 blocker, 4 majors), all fixed (`reviews/WP-7.5/code-review-1.md`). Round 2 CHANGES REQUIRED (1 major, 5 minors), all fixed (`code-review-2.md`).
- security-reviewer: APPROVE, no findings (`security-review-1.md`).
- design-reviewer: round 1 CHANGES REQUIRED (1 blocker, 3 majors, 9 minors). Round 2 CHANGES REQUIRED (3 majors, 5 minors). Fixed or answered in `design-review-1.md` and `design-review-2.md`.

Open MAJOR findings for the owner to waive:

1. Design review 1, MAJOR 2: at 768 and 1280 px the tests pane is too short to show the near miss beside the outputs it explains. The workspace layout predates this package.
2. Design review 1, MAJOR 4: on a phone the action bar is about 200 px tall while Python starts, because the status wraps. Above a 300 px keyboard, the bar and the keyboard take about 500 of 740 px. The PythonStatus layout predates this package.

## Try it on the preview

1. Open `/`. The program shows with no Python download (DevTools, Network, `/_runtime/`: nothing). Press Run. The button says Python is starting, then the output prints.
2. Change `"Sara"` to `10 / 0` and press Run. The error card shows ZeroDivisionError, then one sentence on what it means.
3. Open `/learn/sample-course/say-hello-by-name`. Write `print("hello, " + input("What is your name? ") + "!")` and press Check. Each failure says the only difference is capital and small letters.
4. On a phone, open the same lesson's Code view. Tap the editor, then the keys in the row. Each one goes in and the keyboard stays open.
5. As the admin, open the sample course in the dashboard. Each lesson row shows its completion count.

## Owner actions now due

1. Read the 13 error explanations in `src/messages/workspace.ts` (`pythonErrorExplanations`) as you would read lesson text.
2. Decide whether Run is the primary button on the home page only (design review 1, MINOR 9). Default: secondary, as in the workspace.
3. Waive or schedule the two open MAJORs above.
4. On a real phone, check that the line being typed stays above the symbol row with the keyboard open. Emulation cannot show it (design review 2, MAJOR 3).
5. The seed's sample lesson shows its example as an indented code block, which renders as a paragraph (design review 2, MINOR 8). It predates this package.
6. WP-7.3 is not merged into `main`. The plan starts WP-7.5 only after the four Day 7 packages merge; it was started by your instruction of this session.

## Deviations from the plan or the spec

1. **Start condition.** WP-7.3 is unmerged; see owner action 6.
2. **Python starts on first use on the home page,** not when the page opens. Architecture section 5.7 allows a lazy start. The home page stays at its Lighthouse score, and a visitor who only reads downloads no 5.5 MB runtime.
3. **The answers box** (batch input) now shows only once Python has said it cannot pause for input. Before, it also showed while Python had failed to start. This changes the lesson workspace too.
4. **Test case outputs no longer wrap** in the tests panel, in every lesson. Long lines scroll sideways inside their block.
5. **Home layout at 1280 px** aligns to the top, so the h1 holds still when the output grows. The cost is the space under the h1 that design review 1 named.
6. **The `goToLine` request replays** when the editor is rebuilt across 768 px. This predates the package, was found in review, and is not fixed here.
7. **Row limit.** `lesson_completion_counts()` returns one row per lesson in the database. Past the Data API's 1000-row default, counts would be cut off. That is far beyond the first release (security review note).

## Risks and rollback

- Risk: a slow network delays the editor until after the load event. Until then the program shows as text, at the same size.
- Risk: the punctuation rule's notion of "inside a number" is narrow. A wrong case falls back to the plain failure sentence, never to a wrong claim.
- Rollback: revert the merge commit. No migration and no data change.

## Definition of Done

- [x] Every "Done when" line is met, with evidence above.
- [x] Every cited requirement (all Should) has a passing test that names its ID.
- [x] `pnpm verify` and every required check pass.
- [x] Every state of every changed view exists.
- [x] No stub, dead control, placeholder, commented-out code, or invented number.
- [x] No new table. No new server action.
- [x] Every reviewer blocker is fixed.
- [x] No AI attribution in any commit or in this description.
