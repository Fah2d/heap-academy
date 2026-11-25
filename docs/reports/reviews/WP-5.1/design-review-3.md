# WP-5.1 design review 3 (condensed)

Reviewer: design-reviewer, of `08c8087..abf86db` (round 2's fixes 4cd37c7 and dff1adb, then the merges of main), and the 12 uncommitted screenshots in `docs/reports/screens/WP-5.1/`. They were written at 13:55:46 to 13:56:03 on 2026-11-24, after HEAD (13:53), from a working tree with no other change. antislop active: during (global preference). Verdict: CHANGES REQUIRED. The four gallery states are now seen and look designed. Still missing: the journey screens, the failure state and focus. The pull request description still says no browser has run.

Round 1 and round 2 status:

- R1 BLOCKER 1 (screenshots, axe, 320 px, click-through): closed for the four gallery states (`home-empty`, `list-empty`, `list-rows`, `course`). Still open for the real pages, the failure state, focus and the click-through (findings 1 to 3).
- R1 MAJOR 4 (no primary action): open, waiting on the owner's decision (finding 5).
- R1 MAJOR 5 (empty pages never shown whole): closed, and now seen in `catalog-home-empty-*` and `catalog-list-empty-*`.
- R1 MINORs 7 to 10: closed, and seen. The list's h1 is 24 px over 20 px titles. "Chapters" is 20 px over 16 px chapter headings. Titles are weight 600 and counts are 13 px. The chapter panels end at the prose width (x = 733 at 1280).
- R1 MINOR 12 and R2 finding 1 (gallery frames, repeated id): closed. Each state is drawn alone (`catalog-state-gallery.tsx:57-59`). The spec requires one h1 and no `duplicate-id-aria` result, and each screen shows the page and nothing else.
- R2 finding 2 (the failure is drawn only by JavaScript): partly done. The home link is left out on `/` (item 30) and the measurements are in decision 9. The drawing on a catalog page is still not seen (finding 2), and the owner has not yet confirmed decision 9.
- R2 finding 3 (five wrong Gate lines): closed. `aria-labelledby="course-chapters"` is at `course-page.tsx:56`.
- R2 finding 4 (error page wording): open. It is owner action 6 and outside this branch (finding 9).

Findings:

1. BLOCKER, the journey screens `home`, `courses` and `course` (`e2e/catalog-journey.spec.ts`, `stack` project) do not exist. Three states of the real pages appear only there:
   - the home page with courses (titles at 16 px under the 20 px "Courses");
   - the course list with Courses marked as current (amber block-end bar, weight 600, `aria-current`);
   - the course page with outcomes (muted disc markers).

   The gallery cannot show the current marker, because its address is `/dev/catalog`. So `courses-nav-link.tsx:14` is false, and `catalog-list-*` show Courses at rest. Do not read those screens as the `/courses` header. The R-35 click-through is also still missing: course title to course page, Courses to `/courses`, wordmark to `/`. Only the owner's run with the local stack can close this.

   Optional: add `home-rows` and `course-outcomes` states to the gallery. That would leave only the current marker and the click-through depending on the stack.

2. BLOCKER, the "Could not load" state (03-experience section 8, course list and course page) has no screenshot on a catalog page, and no spec visits a failing catalog page. This does not need the stack. The production build with a Supabase address where nothing listens fails every catalog read; that is the `chromium` project's default (`playwright.config.ts:22,39,64`), and Chromium now runs in this sandbox.

   Fix: add a test that opens `/`, `/courses` and `/courses/python-basics` against a server whose Supabase address has nothing listening. Use its own address so the test also fails the read in CI, where the stack is running. The test expects:
   - status 500;
   - the error page heading and Try again;
   - no home link on `/`;
   - a clean axe result;
   - `catalog-error` saved at 375, 768 and 1280 px.

3. MAJOR, focus is not captured (R-32 is NOT VERIFIED). By code it should work: the global `:focus-visible` ring (`src/ui/base.css:29-31`) applies, the heading link is an inline-flex box so the ring wraps it whole, and no container clips it. But it has not been seen.

   Fix: in the gallery spec, Tab to the first course title on `list-rows` and to Courses, and capture the viewport at 375 and 1280 px. The focused current Courses link joins the journey screens.

4. MAJOR, the pull request description and the evidence are out of date (`docs/reports/pull-requests/wp/5.1-catalog.md`):
   - The 12 screenshots are untracked. Commit them.
   - No output of the gallery run is pasted. Several places still say the gallery spec has never run: the opening paragraph, Part 5's "Not run: every e2e spec", "Screens: None yet", the Reviews section's "No third round was run", and owner action 1. `test-results/.last-run.json` is dated 2026-11-23 19:29 with `"status": "failed"`, so this checkout keeps no record of the 17 passes, and I could not confirm them myself. The count fits the spec (1 list test plus 4 states at 4 widths), and the screens' times fit one run in order. Paste the real list output.
   - Some Gate lines can now move, for the four gallery states only:
     - R-03: overflow was 0 at all four widths, and no text escapes in the screens.
     - R-25: the colors sampled from the screens equal the tokens (see "Checks out").
     - C-4.

     Keep them NOT VERIFIED for the journey pages and the failure state.
   - The R-27 PASS line says "(list and home, each a whole page at its own gallery address)". That reads as if the home page with courses had a gallery address. Only `home-empty` does, and no screen shows the home page with courses. Reword it.
   - Decision 18 (four h1s on one gallery page, a paragraph as its title) describes part 4's gallery. Decision 23 and `catalog-state-gallery.tsx:61-62` replaced it. Remove it or mark it as replaced.

5. MAJOR, carried from round 1 (MAJOR 4) and Deviation 1: there is no primary action. The screens show the cost. `catalog-course-1280.png` has no focal point: the title, the summary and the two chapter panels carry about the same weight, and the lessons are plain text. The owner decides the merge order. I accept it as a recorded deviation once he answers; it is not a change for this branch.

6. MINOR, `src/ui/primitives/link.tsx:32` (`heading` variant, `min-block-target`), seen in `catalog-list-rows-375.png`. A one-line title sits in a 44 px box that is taller than its line; a wrapped title does not, so rows of the same kind differ:
   - top border to title ink: 39 px in row 1, 31 px in row 2;
   - title underline to summary: 25 px against 17 px.

   Every one-line row also has more space on top than at the bottom: 39 px above against 31 px below (`catalog-list-rows-1280.png`). Fix: reach 44 px without moving the text. For example, give the variant equal block padding and negative block margin, so the layout follows the line box and the target stays 44 px.

7. MINOR, `course-page.tsx:80`, seen in `catalog-course-1280.png`. In both chapter panels it is 30 px from the top border to the "Chapter" label's ink, but 38 px from the last lesson to the bottom border. The last row's `py-2` adds to the panel's `p-5`. Fix: no block-end padding on the last lesson row (`last:pbe-0`).

8. MINOR, `src/features/shell/components/site-shell.tsx:30`. This is the shared header from WP-1.4; this branch puts Courses next to the wordmark. `items-center` centers the boxes of the 20 px wordmark and the 16 px links, and the nav link's transparent 2 px block-end border lifts its text further. Measured in every screen at 375 and 1280: wordmark baseline at y = 40, Courses and Sign in at y = 37. Fix: `items-baseline` on the header row, here or in the shell's next change.

9. MINOR, carried from round 2 (finding 4): the error page wording in `src/messages/system.ts:13`, which visitors see when the catalog fails. This is owner action 6, as a separate copy change.

10. MINOR, `home-page.tsx:23,29` and `course-page.tsx:37,52`. The gap between a section heading and its content is 16 px for the list sections (Courses, Chapters) and 12 px for the prose sections (How a lesson works, You will be able to). It is visible in `catalog-home-empty-*`. RHYTHM 1 asks for one structure, so use one gap for every section.

Checks out:

- Phones: 375 px looks designed, not squeezed. The side gutter is 16 px. The 4-line home heading is balanced. The 59-character title (the limit is 60, `supabase/migrations/20261120120200_content.sql:9`) wraps cleanly with its underline on each line. A wrapped lesson title stays under its text, with the number in its own column (`catalog-course-375.png`, 2.1).
- Rendered colors, sampled from the PNGs, match DESIGN.md 4.2 exactly:
  - page `#0E0E10`, panels `#16161A`, hairlines `#2E2E36`;
  - titles `#D4A017`, 7.60 on the panel;
  - metadata and nav `#A9A59D`, 7.35 on the panel and 7.86 on the page;
  - text `#F2F0EC`.
- Amber appears only on the course title links.
- Brand: no icon, badge, shadow, gradient or illustration. The wordmark is live text (ADR-0031).
- Plex Mono appears only on "Chapter 1" and the lesson numbers, the DESIGN.md motif.
- Words: plain, no em dash, no buzzword. The empty sentence is honest, and the counts come from content.
- Not a template: no hero, no card grid, no statistics. A stranger would not take it for another product.

Ran:

- Reading and code:
  - `git log` and `git diff --stat` for `08c8087..HEAD`;
  - DESIGN.md in full, 03-experience sections 1 to 5, 8, 9 and 10.9;
  - the antislop core (modes, R-03, R-05, R-27, R-32, R-35, R-39, the Delivery Gate) and the layoutmobile skill;
  - rounds 1 and 2 and the pull request description;
  - the catalog components, `catalog-page.tsx`, `link.tsx`, `site-shell.tsx`, the catalog and gallery messages, `page.dev.tsx`, `catalog-gallery.spec.ts`, `screens.ts` and `playwright.config.ts`;
  - the title and summary limits in the migration.
- Measurements: decoded the PNGs with Python's zlib (no files written) to sample the colors and to measure baselines, panel edges and text lines.
- Not run: any e2e spec (I did not re-run the gallery spec, to avoid overwriting the screens), the build, axe, keyboard and reduced motion.

Screenshots looked at: `catalog-home-empty-375.png`, `catalog-home-empty-768.png`, `catalog-home-empty-1280.png`, `catalog-list-empty-375.png`, `catalog-list-empty-768.png`, `catalog-list-empty-1280.png`, `catalog-list-rows-375.png`, `catalog-list-rows-768.png`, `catalog-list-rows-1280.png`, `catalog-course-375.png`, `catalog-course-768.png`, `catalog-course-1280.png`, all in `docs/reports/screens/WP-5.1/`.

The reviewer is read-only; the implementer saved this report verbatim from its answer.
