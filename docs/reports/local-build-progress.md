# Local build progress

Work done in sessions while the owner was away, and what is left for the owner to run. Newest first. The newest copy of this file is on the branch named in its first section.

## Session of 2026-11-23 (from about 23:25), in `night-b`, merging `main` into the open branches

New task list: (1) merge `origin/main` (0efe863: WP-1.1 to 1.4, #5, #6, #7, #8) into wp/2.1-schema-policies, wp/2.2-sign-in, wp/2.3-admin-gate, wp/4.1-courses-chapters, wp/4.2-lesson-editor, wp/4.3-validate-publish and wp/5.1-catalog, one branch per task, each later branch also merging the branch before it; `pnpm verify` and `pnpm build` on each; push; update each description's "Up to date with main" section. (2) Then continue WP-5.1.

This file is kept whole on every branch this run touches; the newest copy is on the branch of the last task below.

### Task 1a done: wp/2.1-schema-policies

- Merge commit 837fc05, no conflict (`main` adds no database file).
- `pnpm verify`: exit 0, 28 files, 709 tests. `next build` with CI's public values: exit 0.
- Not run: `pnpm test:db` (no Docker), e2e (no browser).
- Description: `docs/reports/pull-requests/WP-2.1.md` has a new "Up to date with main" section. `gh` still cannot reach GitHub (certificate error), so the pull request text on GitHub is not updated; paste the file when opening or editing it.

### Task 1b done: wp/2.2-sign-in

- Merge commit 2f45f1d: `wp/2.1-schema-policies` (with `main`) into this branch. Conflicts: this file (took 2.1's copy) and `playwright.config.ts` (kept both the `stack` project and `main`'s `phone` projects).
- After the merge 10 sign-in view tests failed: `main`'s `Notice` draws an announced notice's words one frame after its live region. 6bf689e makes those tests wait for the same words (`waitFor`, `findByText`); no assertion removed.
- `pnpm verify`: exit 0, 42 files, 918 tests. `next build` with CI's public values (including the Turnstile test key): exit 0. `check-bundle` and `check-static`: exit 0.
- Not run: `pnpm test:db` (no Docker), e2e (no browser).
- Description: `docs/reports/pull-requests/WP-2.2.md`, new "Up to date with main" section with decision A (CI's e2e job does not run `main`'s `phone` projects).

### Task 1c done: wp/2.3-admin-gate

- Merge commit a9d23f1: `wp/2.2-sign-in` (with `main`) into this branch. One conflict: this file (took 2.2's copy, which holds 2.3's sections unchanged).
- After the merge 4 tests in `second-step-form.test.tsx` failed, same `LiveRegion` cause as 2.2. 1fb08e1 makes them wait for the same words (`waitFor`); no assertion removed.
- `setup-flow.test.tsx` had the same race and failed 2 tests in the 4.1 merge run; 39c22f1 fixes it on this branch the same way. `pnpm verify` again: exit 0, 1010 tests.
- `pnpm verify`: exit 0, 53 files, 1010 tests. `next build` with CI's public values: exit 0. `check-bundle` and `check-static`: exit 0.
- Not run: `pnpm test:db` (no Docker), e2e (no browser).
- Description: `docs/reports/pull-requests/WP-2.3.md`, new "Up to date with main" section.

### Task 1d done: wp/4.1-courses-chapters

- Merge commit 1696ef1: `wp/2.3-admin-gate` (with `main`) into this branch. One conflict: this file (took 2.3's copy).
- After the merge 7 tests in four admin component test files failed, same `LiveRegion` cause. 9dfb2bd makes them wait for the same words (`waitFor`); no assertion removed.
- `pnpm verify`: exit 0, 62 files, 1103 tests. `next build` with CI's public values: exit 0. `check-bundle` and `check-static`: exit 0.
- Not run: `pnpm test:db` (no Docker), e2e (no browser).
- Description: `docs/reports/pull-requests/WP-4.1.md`, new "Up to date with main" section.

### Task 1e done: wp/4.2-lesson-editor

- 4.2 is stacked on 4.1 (it merged an older 4.1, d9eba53), so this merges `wp/4.1-courses-chapters` (with 2.3 and `main`): merge commit c7ecb24. One conflict: this file (took 4.1's copy).
- After the merge 1 test in `lesson-editor.test.tsx` failed, same `LiveRegion` cause. 45a4e2f makes it wait for the same words (`waitFor`); no assertion removed.
- `pnpm verify`: exit 0, 73 files, 1320 tests. `next build` with CI's public values: exit 0. `check-bundle` and `check-static`: exit 0.
- Not run: `pnpm test:db` (no Docker), e2e (no browser).
- Description: `docs/reports/pull-requests/WP-4.2.md`, new "Up to date with main" section.

### Task 1f done: wp/4.3-validate-publish

- Merge commit 0914d87: `wp/4.2-lesson-editor` (with 4.1, 2.3 and `main`). Conflicts: this file (took 4.2's copy, a superset) and `playwright.config.ts` (kept 4.3's `engines` and `runtime-*` projects and `main`'s `phone` projects).
- After the merge: one type error in `test-case-list.tsx` (`main`'s `TextField` needs `errorMessage` with `isInvalid: true`), fixed in 4b04c28; 3 tests in `validation-panel.test.tsx` failed (same `LiveRegion` cause), fixed in a9b7994 with `waitFor`; no assertion removed.
- `pnpm verify`: exit 0, 102 files, 1892 tests. `next build` with CI's public values: exit 0. `check-bundle` and `check-static`: exit 0.
- Not run: `pnpm test:db` (no Docker), e2e (no browser).
- Description: `docs/reports/pull-requests/wp/4.3-validate-publish.md`, new "Up to date with main" section with decision M1.

### Task 1g done: wp/5.1-catalog

- Merge commit aa5d0ce: `wp/4.1-courses-chapters` (with 2.3 and `main`). Conflicts: this file (took the newest copy, from 4.3) and `e2e/screens.ts` (kept this branch's `stack` and `main`'s `phone` projects in the screenshot set, decision 26).
- No test failed. The first `pnpm verify` failed at `prettier --check` on `public/_runtime/`, an untracked build output left by the 4.3 build in this checkout (4.3 ignores it, 5.1 does not yet); deleted, nothing changed in the branch.
- `pnpm verify`: exit 0, 67 files, 1200 tests. `next build` with CI's public values: exit 0, no `/dev` route. `check-bundle` and `check-static`: exit 0.
- Not run: `pnpm test:db` (no Docker), e2e (no browser).
- Description: `docs/reports/pull-requests/wp/5.1-catalog.md`, new "Up to date with main" section and decision 26.

### Owner: run this

1. When `gh` works: paste the "Up to date with main" sections of `WP-2.1.md`, `WP-2.2.md`, `WP-2.3.md`, `WP-4.1.md`, `WP-4.2.md`, `wp/4.3-validate-publish.md` and `wp/5.1-catalog.md` into the pull requests on GitHub.
2. Decide WP-2.2 decision A (add the `phone` projects to the CI `e2e` job or not); WP-4.3 decision M1 and WP-5.1 decision 26 follow it.

### Next

- Task 1 is done for all seven branches (23:37 to 23:50).

### Task 2 blocked: WP-5.1

WP-5.1's five parts are built and reviewed twice (see the 20:35 session below). What is left is the e2e runs, the screenshots and the design approval that needs them, and the owner's decisions. Checked again at 23:50, both still fail in this sandbox:

- Docker: `failed to connect to the docker API at unix:///Users/fahad/.docker/run/docker.sock ... no such file or directory`, so no `supabase start` and no `stack` journey.
- Chromium: `bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer...: Permission denied (1100)`, so no gallery spec, axe or screenshot.

Checked again in 105 fresh sessions, from 23:52 to 2026-11-24 04:39 (the list of times is shortened to this range; the old list is in git history): `origin/main` still at 0efe863; none of the seven branches is behind `main`; each stacked branch contains the one before it (2.1 in 2.2, 2.2 in 2.3, 2.3 in 4.1, 4.1 in 4.2, 4.2 in 4.3, 4.1 in 5.1); local and remote branches match. Docker fails with the same error each time (at 04:39: `failed to connect to the docker API at unix:///Users/fahad/.docker/run/docker.sock`), and Chromium fails to start (at 04:39: `browserType.launch: Target page, context or browser has been closed`; earlier checks showed `MachPortRendezvousServer... Permission denied (1100)`). Nothing to merge and nothing new to build.

No code was changed for task 2. The run stops here. The owner's steps for WP-5.1 are in the 20:35 session's "Owner: run this" below, and step 1 above.

## Session of 2026-11-23 (from about 20:35), in `night-b`, on `wp/5.1-catalog`

Same task list as the sessions below. Tasks 1 and 2 are done; this run did WP-5.1 part 5 (task 3), the last part.

### Task 3, part 5 done: review round 2 and its fixes

- Review round 2 on `af42bd5..08c8087`, reports `docs/reports/reviews/WP-5.1/*-review-2.md`. Security: APPROVE with three minors. Code: CHANGES REQUIRED (BLOCKER 1: the journey's setup checked an unscoped `role="status"` on a page with three, so it could never pass). Design: CHANGES REQUIRED (round 1 BLOCKER 1 still open, no screenshots; new BLOCKER: the gallery repeated an id, so axe would fail before any screen; new BLOCKER: five wrong Delivery Gate lines; MAJOR: the failure state is drawn only by JavaScript).
- 4cd37c7: each gallery state at its own address (`/dev/catalog?state=...`), drawn alone; the chapter list named by its heading; `max-inline-*` and `min-block-target` in what this branch adds (decision 22 was wrong); the error page leaves out its home link on `/`.
- dff1adb: the journey's status check scoped to the Status panel; one cleanup that moves a published course back to draft through the dashboard first; the page data check asserts `text/x-component`; the screens check wants files from this run; the boundary test finds route files by their imports and sees `require`, `next/headers` and relative paths (two mutations failed it); the indexing test fails when its page extensions differ from `next.config.ts` (one mutation failed it).
- `pnpm verify`: exit 0, 63 files, 1149 tests. `next build` with CI's fake values: exit 0, no `/dev` route, no gallery string in `.next/static`, the logical classes in the built CSS. `check-bundle` and `check-static`: exit 0.
- Not changed, for the owner: security MINOR A (a backtick `import()` passes `scripts/eslint/module-boundaries.mjs`; an enforcement control, older than this branch); design finding 4 (the WP-1.4 error page wording); the cause of two content reads per failed request (recorded in decision 9).
- Not run: every e2e spec (no browser, `next dev` fails, no Docker).
- Description: `docs/reports/pull-requests/wp/5.1-catalog.md`, now part 5 of 5, with items 26 to 35, part 5 evidence, round 2 summary, corrected Delivery Gate lines, decisions 9 and 22 changed and 23 to 25 new, owner actions 4 to 6.
- Time: about 2.2 hours of the 3 hour box over five parts.
- Servers: the reviewers' `next start` servers on ports 4138, 4317 and 4518 were stopped by the sandbox's time limit; none is left from this run.
- Push: succeeded, `08c8087..fd4c6bf` (4cd37c7 the fixes, dff1adb the tests and journey, fd4c6bf the reports, description and progress). This line is pushed after it.

### Owner: run this

1. `lsof -ti:3101,3451,3452,3453,3461,3917,3918 | xargs kill` if anything is listed (from earlier runs).
2. With `supabase start`: `pnpm test:e2e --project=stack e2e/catalog-journey.spec.ts` and `pnpm test:e2e --project=gallery e2e/catalog-gallery.spec.ts`; commit `docs/reports/screens/WP-5.1/`; then ask `design-reviewer` for its approval with the screens.
3. Decide WP-5.1 deviation 1 (merge order with WP-5.2 for the Begin action), decision 9 (500 with the error page, now with the round 2 measurements), and owner actions 5 and 6 in the description.
4. Create the draft pull request with the `gh` command at the end of the description, after step 2.
5. The owner actions of the sessions below are still due.

### Next

- Task 3 is done as far as this sandbox allows: WP-5.1 waits for the owner's e2e run and decisions. No task is left in the list.

## Session of 2026-11-23 (from about 19:55), in `night-b`, on `wp/5.1-catalog`

Same task list as the sessions below. Tasks 1 and 2 are done; this run did WP-5.1 part 4 (task 3).

### Task 3, part 4 done: the three reviews and their fixes

- Review round 1 on `origin/wp/4.1-courses-chapters..af42bd5`, reports in `docs/reports/reviews/WP-5.1/`. Security: APPROVE with four minors. Code: CHANGES REQUIRED (MAJOR 1: a failed read answered 200 with `noindex`). Design: CHANGES REQUIRED (BLOCKER 1 no screenshots, BLOCKER 2 the stack project saved no screen, BLOCKER 3 three wrong Delivery Gate lines, MAJOR 4 no primary action, MAJOR 5 empty pages never shown whole).
- 55399e7: a course address that is not in the cached course list makes no course query (7 tests failed before).
- 4a6628d: a failed read throws, so `/`, `/courses` and a course page answer 500 with the error page (5 tests failed before); the gallery shows the empty home page and course list as whole pages; a `heading` link variant in `src/ui` at weight 600; item headings one size down; metadata `text-xs`; chapter list at the prose width; two copy fixes; `home.description` is `shell.description`.
- dd515e1: the static checks see `import("...")` and every page extension (a mutation of the import pattern failed the new test); the journey publishes the course and moves it back to draft in the dashboard, so the 75 s `toPass` wait and the raised timeouts are gone; it checks raw HTML and page data for draft, solution and wrong-answer marks; the `stack` project saves screens, and the journey checks that the nine files exist.
- `pnpm verify`: exit 0, 63 files, 1141 tests. `pnpm build` with CI's fake public values: exit 0, no `/dev` route, no gallery string in `.next/static`. `check-bundle` and `check-static`: exit 0. The built app with no database: `/`, `/courses`, `/courses/python-basics` 500 for a browser and for Googlebot; `/courses/Not_A_Slug` 404; `/sitemap.xml` 500.
- Not run: every e2e spec (no browser, `next dev` fails, no Docker), so design BLOCKER 1 stays open.
- Description: `docs/reports/pull-requests/wp/5.1-catalog.md`, now with the part 4 evidence, the review summary, the corrected Delivery Gate lines, two deviations (no primary action until WP-5.2; no per-segment `loading.tsx` or `error.tsx`), decisions 9, 10, 13 and 14 changed and 17 to 22 new.
- Time: about 1.7 hours of the 3 hour box over four parts.
- Servers this run and its reviewers could not stop (the sandbox hides them): `next start` on ports 3461, 3917 and 3918.
- Push: succeeded, `af42bd5..2879b2a` (55399e7 the content fix, 4a6628d the catalog fixes, dd515e1 the tests and journey, 2879b2a the reports, description and progress). This line is pushed after it.

### Owner: run this

1. `lsof -ti:3101,3451,3452,3453,3461,3917,3918 | xargs kill` if anything is listed.
2. With `supabase start`: `pnpm test:e2e --project=stack e2e/catalog-journey.spec.ts` and `pnpm test:e2e --project=gallery e2e/catalog-gallery.spec.ts`; commit `docs/reports/screens/WP-5.1/`. The journey now signs in an admin in its setup, inside the default hook timeout.
3. Decide WP-5.1 deviation 1 (merge order with WP-5.2 for the Begin action) and decision 9 (500 with the error page for a failed read).
4. The owner actions of the sessions below are still due.

### Next

- Task 3, WP-5.1 part 5, in `night-b` on `wp/5.1-catalog`: review round 2 (`code-reviewer`, `security-reviewer`, `design-reviewer`) on `af42bd5..HEAD`, reports `*-review-2.md`, fix findings test first, verify and build again, finish the description. Design approval still needs the screenshots.

## Session of 2026-11-23 (from about 19:10), in `night-b`, on `wp/5.1-catalog`

Same task list as the sessions below. Tasks 1 and 2 are done; this run did WP-5.1 part 3 (task 3).

### Task 3, part 3 done: the indexing test, the catalog gallery, the e2e specs, the Delivery Gate report

- d231b32: `src/app/indexing.test.ts` finds every `page.tsx` and fails on a page missing from the indexing table of 03-experience section 3; sign-in and every admin page (at each stage of the admin door) must say `noindex`, the catalog pages must not. Two mutations (sign-in indexed; `noindex` removed from `adminMetadata`) each failed it.
- 173ba6a: `/dev/catalog`, a development-only gallery of the course list's and course page's empty and failed states; `e2e/catalog-gallery.spec.ts` (320 to 1280 px, axe, screenshots); `e2e/catalog-journey.spec.ts` against the local stack (counts equal the database, only published content, titles, canonical addresses, 404 and sitemap for a draft course, `noindex` on sign-in and the admin door, 320 px, axe, screenshots); `sqlRows` in `e2e/admin-helpers.ts`; `catalog` added to the log route segments.
- `pnpm verify`: exit 0, 63 files, 1131 tests. `pnpm build` with CI's fake public values: exit 0, no `/dev` route in the build. `check-bundle` and `check-static`: exit 0.
- Not run: every e2e spec, so no axe result, 320 px measurement or screenshot. In this sandbox `next dev` fails (`unable to start FSEvent stream`; with polling, `EMFILE` and restarts), Chromium cannot start (`MachPortRendezvousServer ... Permission denied (1100)`), and Docker is not running.
- Description: `docs/reports/pull-requests/wp/5.1-catalog.md`, now with the part 3 evidence, the Delivery Gate report (from source, with NOT VERIFIED lines), and sixteen decisions (new: 13 the journey waits up to 75 seconds for the content cache; 14 it writes content through `save_lesson` like the seed; 15 `/admin/courses/new` not indexed; 16 the gallery's sample content).
- Time: about 1.3 hours of the 3 hour box over three parts.
- Servers this run could not stop (the sandbox hides them from `pkill`): a `next dev` on port 3101 (it may be in a restart loop) and a `next start` on port 3453.
- Push: succeeded, `1c94bc6..973790d` (d231b32 the indexing test, 173ba6a the gallery and e2e specs, 973790d the description and progress). This line is pushed after it.

### Owner: run this

1. `lsof -ti:3101,3451,3452,3453 | xargs kill` if anything is listed.
2. With `supabase start`: `pnpm test:e2e --project=stack e2e/catalog-journey.spec.ts` and `pnpm test:e2e --project=gallery e2e/catalog-gallery.spec.ts`; look at `docs/reports/screens/WP-5.1/` and commit the screens.
3. Read WP-5.1 decisions 13 to 16 when convenient.
4. The owner actions of the sessions below are still due.

### Next

- Task 3, WP-5.1 part 4, in `night-b` on `wp/5.1-catalog`: `code-reviewer`, `security-reviewer` and `design-reviewer` on `origin/wp/4.1-courses-chapters..HEAD`, reports in `docs/reports/reviews/WP-5.1/`, fix the findings test first, verify and build again, finish the description. The design review will lack screenshots unless the owner has run the e2e specs.

## Session of 2026-11-23 (from about 18:40), in `night-b`, on `wp/5.1-catalog`

Same task list as the sessions below. Tasks 1 and 2 are done; this run did WP-5.1 part 2 (task 3).

### Task 3, part 2 done: the home page, the course list, the course page, and Courses in the header

- Read `DESIGN.md` (signed, revision 2), `.claude/rules/ui-design.md`, 03-experience sections 3 to 5, 8 and 9, and the antislop skills; antislop in `during` mode.
- Built test first in 1fba0b1 and 7ac30d7: `/`, `/courses` and `/courses/[course]` from `src/content`, with the empty and could-not-load states, 404 for a course that is not published, titles, descriptions and canonical paths, and `noindex` when a read fails; Courses in a "Main" header landmark, current only on `/courses`; a test that the catalog reads only through `src/content`.
- The first build logged two failed content reads: the build tried to prerender the pages. Each catalog read now waits for the request (`connection()`); the next build logged none.
- `pnpm verify`: exit 0, 62 files, 1104 tests. `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: exit 0.
- The built app under `next start` with no database: `/` and `/courses` 200 with the error notice and `noindex`; `/courses/python-basics` 200 "This course could not be loaded" with `noindex`; `/courses/Not_A_Slug` 404. One read per request.
- Description: `docs/reports/pull-requests/wp/5.1-catalog.md`, now with twelve decisions (new: 8 the home paragraph describes the lesson page before it exists; 9 a failed read is shown in the page with `noindex`; 10 the course title link is weight 500; 11 `aria-current` only on `/courses`; 12 the header wraps).
- Time: about 0.75 hours of the 3 hour box over two parts.
- Not run: e2e, axe, screenshots, database tests. No browser or local Supabase stack here.
- Two `next start` servers from this run may still be listening on ports 3451 and 3452. The sandbox hides them from `ps` and `pkill`, so they could not be stopped from here.
- Push: succeeded, `c5ca0e2..5224cc0` (1fba0b1 the pages, 7ac30d7 the header, 5224cc0 the description and progress). This line is pushed after it.

### Owner: run this

1. If `lsof -ti:3451,3452` shows anything: `lsof -ti:3451,3452 | xargs kill`.
2. Read WP-5.1 decisions 8 to 12 when convenient.
3. The owner actions of the sessions below are still due.

### Next

- Task 3, WP-5.1 part 3, in `night-b` on `wp/5.1-catalog`: e2e for the three pages against the local stack (counts against the database, 320 px with no page scroll, every non-indexed page `noindex`), a way to show the empty and failed states in a browser, screenshots, axe, and the Delivery Gate report. If this sandbox still has no browser, write the specs and the gallery and leave the runs to the owner.

## Session of 2026-11-23 (from about 18:15), in `night-b`, on `wp/5.1-catalog`

Same task list as the sessions below. Tasks 1 and 2 were done; this run started task 3 and did WP-5.1 part 1.

### Task 3, part 1 done: WP-5.1 content layer, sitemap and indexing rules

- Branch `wp/5.1-catalog` from `origin/wp/4.1-courses-chapters` (962683c). The task list names `.claude/commands/work-package.md`, which does not exist; followed `.claude/skills/work-package/SKILL.md`.
- Built test first in cdc4f17 and d41b2ad: a course or chapter with no published lesson is left out (FR-CAT-04, FR-CRS-01; 3 new tests failed before the change); a warm cache test shows a second view makes no database query and a failed read is not kept (passed on the existing wiring at once); `/sitemap.xml` per request and `/robots.txt` (FR-SEO-01); `metadataBase` set to `https://heapacademy.dev`.
- `pnpm verify`: exit 0, 60 files, 1062 tests. `pnpm build` with CI's fake public values: exit 0 (`ƒ /sitemap.xml`, `○ /robots.txt`). `check-bundle` and `check-static`: exit 0.
- Environment: night-b's `node_modules` was the old WP-3.4 install, without `@supabase/*`, and `pnpm install` cannot run here. It is moved to `$TMPDIR/night-b-aside/node_modules`, with the leftover untracked `public/_runtime/` from the WP-3.4 checkout. night-b now has an APFS copy of night-a's `node_modules` (lockfile superset, same versions for shared packages). A symlink failed: Turbopack will not read `node_modules` outside the project root. `/node_modules` is in `.git/info/exclude` for this clone only.
- Description: `docs/reports/pull-requests/wp/5.1-catalog.md`, with seven decisions taken with a safe default and the `gh pr create` line for later. Do not open it yet.
- Time: about 0.3 hours of the 3 hour box.
- Not run: e2e, axe, screenshots, database tests.
- Push: succeeded, new branch `origin/wp/5.1-catalog` (cdc4f17, d41b2ad, and the docs commit). This line is pushed after it.

### Owner: run this

1. Nothing new for WP-5.1 yet. Read its decisions 1 to 7 when convenient (7: no lesson link or Begin action until WP-5.2's workspace route exists).
2. The owner actions of the sessions below are still due.

### Next

- Task 3, WP-5.1 part 2, in `night-b` on `wp/5.1-catalog`: read `DESIGN.md`, `.claude/rules/ui-design.md` and the antislop skills; build the home page, `/courses` and `/courses/[course]` with their states, titles, descriptions and canonical paths, and Courses in the header; test that each page reads only through `src/content`.

## Session of 2026-11-23 (from about 17:28), in `night-a`, on `wp/4.3-validate-publish`

Same task list as the session below. This run did task 2.

### Task 2 done: WP-4.3 part 8, the second review round and its fixes

- ecbb815 checked against design MINOR 11: it covers the stopped validation, Save validating first and its refusals, the time limit, the error line, cut and cleaned output and the outdated notes, with axe. The reviewers found the gaps left (below).
- Review round 2 on `e1f1ce9..c5902d0`, reports in `docs/reports/reviews/WP-4.3/` (`code-review-2.md`, `security-review-2.md`, `design-review-2.md`). Security: APPROVE. Code: CHANGES REQUIRED only for the e2e runs, no new BLOCKER or MAJOR. Design: CHANGES REQUIRED for the screenshots (BLOCKER 1, open since round 1) and MAJOR 2 (a real cut output made a test case thousands of pixels tall).
- Fixed test first in bb1d583 (4 new tests failed before the change): Open labels from the list now; invisible characters removed from shown output (the zero-width joiner and non-joiner kept); the solution's output in the lesson code panel, scrolling inside a new `--spacing-output` token (20rem) with the focus ring inset; the name hint's limit from `TEST_CASE_LIMITS`; `testCaseList.title` from its parts; clearer failed-solution sentence; a test that focus moves only once (seen failing with the effect's dependency list removed); gallery states for Python that started but could not run the programs (Validate and Save), Open focusing a test case, rule 1's missing parts, axe on the passed state, the cut output at its real length.
- A first try with `max-block-80` built to no CSS at all (the theme defines only its own spacing tokens); found by checking the built stylesheet, then replaced by the token.
- `pnpm verify`: exit 0, 98 files, 1841 tests. `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: exit 0. The built CSS holds `.max-block-output{max-block-size:var(--spacing-output)}`. No gallery string in `.next/static`.
- Description rewritten: `docs/reports/pull-requests/wp/4.3-validate-publish.md` (opening paragraph, part 8 evidence, "Left for the owner", decisions renumbered and three new: 18 invisible characters, 19 the new size token, 20 the T-21 bundle note). Time: about 3.6 hours of sessions against a box of 3.5, under 1.5 times.
- Not run: e2e, screenshots, axe, database tests. No browser or local Supabase stack in this sandbox.
- Push: succeeded, `c5902d0..ad1bd6a` (bb1d583 the fixes, 1110243 the review reports, ad1bd6a the description and progress). This line is pushed after it.

### Owner: run this

1. `pnpm test:e2e` for `e2e/admin-gallery.spec.ts` and `e2e/j13-publish-journey.spec.ts` against the local stack; look at `docs/reports/screens/WP-4.3/`; then the Delivery Gate report. The new gallery checks have never run.
2. Decide WP-4.3 decisions 17 to 20 (17: cherry-pick 87af7ec onto `wp/4.1-courses-chapters`; 19: accept `--spacing-output` and add it to DESIGN.md).
3. Open the draft with the `gh pr create` line at the end of the description when you want it.
4. Earlier owner actions for WP-2.2, WP-2.3, WP-4.1 and WP-4.2 are still due.

### Next

- Task 3: in `night-b`, create the WP-5.1 branch from `origin/wp/4.1-courses-chapters` and start WP-5.1 part 1 under `.claude/skills/work-package/SKILL.md` (the task list names `.claude/commands/work-package.md`, which does not exist; the skill is the same procedure).

## Session of 2026-11-23 (from about 17:15), in `night-a`, on `wp/4.3-validate-publish`

Task list given by the owner for unattended runs: (1) merge `origin/wp/4.2-lesson-editor` into `wp/4.3-validate-publish`; (2) WP-4.3 part 8, verify and a second review; (3) WP-5.1 in `night-b` from `origin/wp/4.1-courses-chapters`, one part per run. This run did task 1.

### Task 1 done: the CodeMirror lockfile merged into `wp/4.3-validate-publish`

- The owner pushed 4148777 ("chore(deps): add CodeMirror to the lockfile") to `wp/4.2-lesson-editor`. Merged in 9538964. `pnpm-lock.yaml` merged with no conflict; all 41 `package.json` specifiers match the lockfile's importers (script check). `pnpm install` still cannot run in this sandbox (store lock), so CI's frozen install is the real test.
- The first `pnpm verify` after the merge failed one test the merge did not touch: `course-details-form.test.tsx` > "names a taken address and keeps what was typed" (focus on the button, not the field). It passed 5 of 5 alone. Cause: the form moved focus on the next animation frame, but its state update inside an async transition commits only when the transition ends. `lesson-editor.tsx` had the same pattern for a taken address.
- Fixed test first in 87af7ec: `src/features/admin/components/focus-after-commit.ts` (`useFocusAfterCommit`) focuses after the commit. Three new tests failed before the fix.
- `pnpm verify`: exit 0, 98 files, 1837 tests. `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: exit 0.
- Commit ecbb815 (part 8's gallery states for design MINOR 11, at 10:48) was already pushed by an earlier session with no entry here. It is included in the verify run above. Its e2e gallery test was not run.
- Description updated: `docs/reports/pull-requests/wp/4.3-validate-publish.md`, with the merge evidence, owner action 1 marked done, and new decision 17 (the WP-4.1 focus fix carried on this branch; recommendation: cherry-pick 87af7ec onto `wp/4.1-courses-chapters`). Its opening paragraph still says "Parts 1 to 6"; part 8 rewrites it.
- Push: succeeded, `ecbb815..8f9a47a` (the merge 9538964, the fix 87af7ec, the docs commit 8f9a47a). This line is pushed after it.

### Owner: run this

1. If CI's frozen install fails on `wp/4.3-validate-publish`: `pnpm install` there and commit the lockfile.
2. Decide decision 17 (cherry-pick 87af7ec onto `wp/4.1-courses-chapters` or not).
3. If this sandbox still cannot run them: `pnpm test:e2e` for `e2e/admin-gallery.spec.ts` and `e2e/j13-publish-journey.spec.ts` against the local stack.
4. Earlier owner actions for WP-2.2, WP-2.3, WP-4.1 and WP-4.2 are still due.

### Next

- Task 2: WP-4.3 part 8, on `wp/4.3-validate-publish` in `night-a`: check ecbb815 against design MINOR 11; a second code, security and design review round on e1f1ce9..HEAD, with fixes; rewrite the description's opening paragraph and "Left for part 8".

## Session of 2026-11-23 (from about 10:05), in `night-a`, on `wp/4.3-validate-publish`

### WP-4.3 Test cases, validation, publishing: part 7, `wp/4.3-validate-publish` (base `wp/4.2-lesson-editor`)

- Built test first (10 tests failed before the change): design review MINOR 8 (each failed test case named in the checklist gets an Open button that opens it and focuses its title; none for one removed since), MINOR 9 (the test case number in Plex Mono), MINOR 10 (the limits in admin copy come from `CHECK_TEST_LIMIT`, `HARNESS_OUTPUT_LIMIT` and the runtime's `TIME_LIMIT_MS`, passed into the messages as numbers), and decision 14 (each verdict in its test case's title, read as "Test case 1: Doubles, Passed").
- Commit e51304f at 10:22. `pnpm verify`: exit 0, 97 files, 1833 tests (the first two runs failed on Prettier for 3 files, then on a non-exhaustive switch; both fixed).
- `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: pass.
- Push: succeeded, `0a4541b..e51304f`. This progress commit is pushed after it.
- Time box: the seven sessions add up to about 2.5 hours against 3.5. Recorded in the description.
- Description updated: `docs/reports/pull-requests/wp/4.3-validate-publish.md` (`--base wp/4.2-lesson-editor`), with sixteen open decisions (new: Open buttons under the failed rule; decision 14 is now built). Do not open it until part 8 is done.
- Not run: e2e, screenshots, axe, database tests (no migration changed). No local Supabase stack or browser in this sandbox.

### Owner: run this

1. Unchanged: the WP-4.2 lockfile commit, then merge `wp/4.2-lesson-editor` into `wp/4.3-validate-publish` and run `pnpm install` there.
2. If this sandbox still cannot run them: `pnpm test:e2e` for `e2e/admin-gallery.spec.ts` and `e2e/j13-publish-journey.spec.ts` against the local stack, which also writes the screenshots into `docs/reports/screens/WP-4.3/`.
3. Earlier owner actions for WP-2.2, WP-2.3, WP-4.1 and WP-4.2 are still due.

### Next

- WP-4.3 part 8, on `wp/4.3-validate-publish`: design MINOR 11 (gallery states for a stopped validation, Save validating first, the `validateFirst` refusals, a timed-out rule, an error verdict with its line, cut and cleaned output, the outdated notes); a second code, security and design review round on e1f1ce9..e51304f, with fixes; the e2e runs, screenshots, axe and the Delivery Gate report if a browser and the stack are available.
- WP-5.1 (depends on WP-4.1) can start beside it, on `wp/4.1-courses-chapters`.

## Session of 2026-11-23 (from about 09:40), in `night-a`, on `wp/4.3-validate-publish`

### WP-4.3 Test cases, validation, publishing: part 6, `wp/4.3-validate-publish` (base `wp/4.2-lesson-editor`)

- Review round 1 on `938a05d..1443296`: code, security and design, all CHANGES REQUIRED. Reports saved in `docs/reports/reviews/WP-4.3/` (`code-review-1.md`, `security-review-1.md`, `design-review-1.md`). The design review is code-only: no screenshots exist.
- Fixed, test first (commit e1f1ce9 at 09:55): the code BLOCKER (Validate with a nameless test case said Python could not run; now it opens the test case and focuses the field); T-07 (`src/grader/console-text.ts` strips escape sequences, control and bidi characters from shown output and Python's message, and such output is never filled); separate pending states for Save and status moves, each disabling the other; the failed Python start as one error with a Try again instruction; J-13's status assertions; Reload on `status_not_allowed`; the status said once; the stored status parsed; controller reports sent by code to `reportError`; a trimmed title keeps Publish; no program on open (T-23 tests); the runbook's wrong-answer step.
- `pnpm verify`: exit 0, 97 files, 1828 tests (the first run failed on Prettier for 3 files; formatted, then the run above).
- `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: pass.
- Push: succeeded, `1443296..8fadb66` (e1f1ce9 and the docs commit 8fadb66). This line is pushed after it.
- Description updated: `docs/reports/pull-requests/wp/4.3-validate-publish.md` (`--base wp/4.2-lesson-editor`), with fifteen open decisions (new: Delete has no undo; verdicts inside each test case; output with control characters is stripped and not fillable). Do not open it until part 7 is done.
- Not run: e2e, screenshots, axe, database tests (no migration changed). No local Supabase stack or browser in this sandbox.

### Owner: run this

1. Unchanged: the WP-4.2 lockfile commit, then merge `wp/4.2-lesson-editor` into `wp/4.3-validate-publish` and run `pnpm install` there.
2. If this sandbox still cannot run them in part 7: `pnpm test:e2e` for `e2e/admin-gallery.spec.ts` and `e2e/j13-publish-journey.spec.ts` against the local stack, which also writes the screenshots into `docs/reports/screens/WP-4.3/`.
3. Earlier owner actions for WP-2.2, WP-2.3, WP-4.1 and WP-4.2 are still due.

### Next

- WP-4.3 part 7, on `wp/4.3-validate-publish`: the design minors 8 to 11 and the verdict in each test case title (decision 14); a second review round on e1f1ce9 and later; the e2e runs, screenshots, axe and the Delivery Gate report if a browser and the stack are available.
- WP-5.1 (depends on WP-4.1) can start beside it, on `wp/4.1-courses-chapters`.

## Session of 2026-11-23 (from about 09:00), in `night-a`, on `wp/4.3-validate-publish`

### WP-4.3 Test cases, validation, publishing: part 5, `wp/4.3-validate-publish` (base `wp/4.2-lesson-editor`)

- The runbook `docs/runbooks/published-lesson-wrong.md` (07-operations section 8.1), found as an untracked draft and checked against the code: corrected the button names ("Reload the page" appears only for a newer version), the section list, and the public addresses (`/learn/<course>/<lesson>`, `/courses/<course>`, `/courses` from 03-experience section 3).
- J-13: `e2e/j13-publish-journey.spec.ts` (a failing solution and a passing starter are refused with the reason and get no Publish; a passing lesson is published, survives a reload, and moves back to draft after the dialog). Written, not run: no local Supabase stack here.
- A flaky unit test fixed: the archive test in `lesson-editor.test.tsx` failed once in the full run (passed 5 of 5 alone). The status renders before the async transition ends, and React Aria's pending Button ignores presses; the test now waits for the button to settle. No component change.
- Commit af0f0c1 at about 09:19. `pnpm verify`: exit 0, 96 files, 1811 tests (the first run failed on the flaky test, before the fix).
- Push: succeeded, `5f0c307..af0f0c1`. This progress commit is pushed after it.
- No `pnpm build` this part (no application code changed).
- Description updated: `docs/reports/pull-requests/wp/4.3-validate-publish.md` (`--base wp/4.2-lesson-editor`), now with twelve open decisions (new: Publish is never offered to a broken lesson, so J-13's "refused with the reason" is the checklist). Do not open it until part 6 is done.

### Owner: run this

1. Unchanged: the WP-4.2 lockfile commit, then merge `wp/4.2-lesson-editor` into `wp/4.3-validate-publish` and run `pnpm install` there.
2. Earlier owner actions for WP-2.2, WP-2.3, WP-4.1 and WP-4.2 are still due.

### Next

- WP-4.3 part 6, on `wp/4.3-validate-publish`: code, security and design review with fixes. The e2e runs and screenshots need the local stack and a browser, which this sandbox has not had; if they still cannot run, the description says so and the owner runs them.
- WP-5.1 (depends on WP-4.1) can start beside it, on `wp/4.1-courses-chapters`.

## Session of 2026-11-23 (from about 06:00), in `night-a`, on `wp/4.3-validate-publish`

### WP-4.3 Test cases, validation, publishing: part 4, `wp/4.3-validate-publish` (base `wp/4.2-lesson-editor`)

- Built test first: the lesson's status in the editor's Publish section (`src/features/admin/components/lesson-status.tsx`). Publish appears only after a passing validation of the lesson as it is now; it saves with the validated hash, then calls `setLessonStatus` with the saved version. Move back to draft (from published) and Archive ask first and say what learners will see. Save on a published lesson validates first and saves nothing on a failed rule, a stop, or a Python that could not start. Gallery: status actions on every lesson editor, a new archived state; an e2e gallery test (written, not run).
- Found by a test: React holds state updates inside an async transition until it ends, so "Validating" and Stop never showed during Save. The validation now runs outside the transition.
- Commit bffeb6a at about 06:11. `pnpm verify`: exit 0, 96 files, 1811 tests.
- `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: pass.
- Push: succeeded, `c94215b..bffeb6a`. This progress commit is pushed after it.
- Description updated: `docs/reports/pull-requests/wp/4.3-validate-publish.md` (`--base wp/4.2-lesson-editor`), now with eleven open decisions (three new: Save on a published lesson validates even for a title-only change; Publish saves the editor's content first; status moves leave unsaved edits unsaved). Do not open it until part 5 is done.
- No reviews yet. No e2e run, no screenshots, no database tests (no migration changed).

### Owner: run this

1. Unchanged: the WP-4.2 lockfile commit, then merge `wp/4.2-lesson-editor` into `wp/4.3-validate-publish` and run `pnpm install` there.
2. Earlier owner actions for WP-2.2, WP-2.3, WP-4.1 and WP-4.2 are still due.

### Next

- WP-4.3 part 5, on `wp/4.3-validate-publish`: the runbook `docs/runbooks/published-lesson-wrong.md` (07-operations section 8.1); J-13 (written; e2e cannot run here); code, security and design review, with fixes. Then the description is ready.
- WP-5.1 (depends on WP-4.1) can start beside it, on `wp/4.1-courses-chapters`.

## Session of 2026-11-23 (from about 05:29), in `night-a`, on `wp/4.3-validate-publish`

### WP-4.3 Test cases, validation, publishing: part 3, `wp/4.3-validate-publish` (base `wp/4.2-lesson-editor`)

- Built test first: Validate in the lesson editor. A "Publish" section with the checklist of section 7.6 (a state and a reason per rule), Validate and Stop, and Python's state (loading, ready, failed with Try again), on the learners' runtime controller started with the editor. Each test case shows the solution's verdict and output; "Fill from solution" copies it into the expected output. Save sends the validated hash only after a passing validation of exactly what it saves (T-22). Four new `/dev/admin` states (Python loading, Python failed, validating, a failed validation with Fill), and an e2e gallery test (written, not run).
- Fixed in passing: an editor test left a save pending forever, which kept the next test's Save pending (React joins async transitions).
- Commit 6ff2a5d at about 05:43. `pnpm verify`: exit 0, 96 files, 1797 tests.
- `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: pass.
- Push: succeeded, `438b73e..6ff2a5d`. This progress commit is pushed after it.
- Description updated: `docs/reports/pull-requests/wp/4.3-validate-publish.md` (`--base wp/4.2-lesson-editor`), now with eight open decisions (three new: Validate is the one action for the verdicts; Python starts when the editor opens; when a verdict stops showing). Do not open it until part 4 is done.
- No reviews yet. No e2e run, no screenshots, no database tests (no migration changed).

### Owner: run this

1. Unchanged: the WP-4.2 lockfile commit, then merge `wp/4.2-lesson-editor` into `wp/4.3-validate-publish` and run `pnpm install` there.
2. Earlier owner actions for WP-2.2, WP-2.3, WP-4.1 and WP-4.2 are still due.

### Next

- WP-4.3 part 4, on `wp/4.3-validate-publish`: Publish, Unpublish and Archive with confirmations (Publish only when `checkedNow(...).whole` and passed; it saves with the hash, then calls `setLessonStatus`); Save on a published lesson validating first; the runbook `docs/runbooks/published-lesson-wrong.md`; J-13; code, security and design review. Then the description is ready.
- WP-5.1 (depends on WP-4.1) can start beside it, on `wp/4.1-courses-chapters`.

## Session of 2026-11-23 (from about 05:01), in `night-a`, on `wp/4.3-validate-publish`

### WP-4.3 Test cases, validation, publishing: part 2, `wp/4.3-validate-publish` (base `wp/4.2-lesson-editor`)

- Built test first: the test case list in the lesson editor (`src/features/admin/components/test-case-list.tsx`): add, duplicate, move up, move down, delete, the limit of 12, every field with its section 7.5 description, a message per field, focus kept in the list; Save checks the test cases, opens the one with a problem and focuses its field; test case edits count as unsaved; the `Disclosure` primitive takes controlled props; two new `/dev/admin` states; an e2e gallery test (written, not run).
- Commit a95b8ba at 05:08. `pnpm verify`: exit 0, 93 files, 1755 tests.
- `pnpm build` with CI's fake public values: exit 0. `check-bundle` and `check-static`: pass.
- Push: succeeded, `4f90372..a95b8ba`. This progress commit is pushed after it.
- Description updated: `docs/reports/pull-requests/wp/4.3-validate-publish.md` (`--base wp/4.2-lesson-editor`), now with five open decisions (two new: plain text areas for test case fields; Delete asks nothing). Do not open it until part 3 is done.
- No reviews yet. No e2e run, no screenshots, no database tests (no migration changed).
- The runbook `docs/runbooks/published-lesson-wrong.md` waits for part 3, because it names the Unpublish control part 3 builds.

### Owner: run this

1. Unchanged from the session before: the WP-4.2 lockfile commit, then merge `wp/4.2-lesson-editor` into `wp/4.3-validate-publish` and run `pnpm install` there.
2. Earlier owner actions for WP-2.2, WP-2.3, WP-4.1 and WP-4.2 are still due.

### Next

- WP-4.3 part 3, on `wp/4.3-validate-publish`: Validate and Stop with the checklist (section 7.6) on the runtime controller, the verdict per test case with actual output, "Fill from solution", Save on a published lesson validating first, Publish, Unpublish and Archive with confirmations, the states "Python loading", "validating" and "validation failed" with gallery states; the runbook; J-13; code, security and design review. Then the description is ready.
- WP-5.1 (depends on WP-4.1) can start beside it, on `wp/4.1-courses-chapters`.

## Session of 2026-11-23 (from about 04:20), in `night-a`, on `wp/4.3-validate-publish`

### WP-4.3 Test cases, validation, publishing: part 1, `wp/4.3-validate-publish` (base `wp/4.2-lesson-editor`)

- `wp/3.4-statechart` merged in (938a05d). Conflicts resolved in `playwright.config.ts` (the `stack` project beside the three engines and the runtime projects), `scripts/eslint/module-boundaries.mjs` (both sets of messages), `src/features/workspace/index.ts` (all three exports), `security-headers.test.ts` and `proxy.test.ts` (both sides' tests). `pnpm verify` after the merge: 87 files, 1685 tests.
- Built test first: the validation checklist and the test case list rules in `src/grader`; the gradable hash; `saveLesson` now carries the test cases and marks a save validated only when the hash matches; `setLessonStatus` (publish, unpublish, archive); the validation runner on the learners' runtime controller.
- `pnpm verify` on 922accb: exit 0, 92 files, 1744 tests.
- Push: succeeded (new branch). This progress commit is pushed after it.
- Description: `docs/reports/pull-requests/wp/4.3-validate-publish.md`, with its `gh pr create` command (`--base wp/4.2-lesson-editor`) and three open decisions. Do not open it until part 2 is done.
- No reviews yet. No e2e, no `next build`, no database tests run (no migration changed).
- Setup: `night-a`'s `node_modules` now has `pyodide` 314.0.7 copied from `night-b` (`node_modules/pyodide`, with `ws` and `@types` in its own `node_modules`).

### Owner: run this

1. The WP-4.2 lockfile commit (below) is still due. Then merge `wp/4.2-lesson-editor` into `wp/4.3-validate-publish` and run `pnpm install` there, so the lockfile has both Pyodide and CodeMirror.
2. Earlier owner actions for WP-2.2, WP-2.3, WP-4.1 and WP-4.2 are still due.

### Next

- WP-4.3 part 2, on `wp/4.3-validate-publish`: the test case list, verdicts, "Fill from solution", the checklist with Validate and Stop, Publish, Unpublish and Archive in the lesson editor, with every state and the gallery; the runbook `docs/runbooks/published-lesson-wrong.md`; J-13; reviews. Then the description is ready.
- WP-5.1 (depends on WP-4.1) can start beside it, on `wp/4.1-courses-chapters`.

## Session of 2026-11-23 (from 04:02), in `night-a`, detached HEAD pushed to `wp/4.2-lesson-editor`

Sessions from 01:22 to 03:42 started and left no change. A session from 00:39 made 11 review-fix commits (6b799fe..7db29ac) on a detached HEAD in `night-a` and did not push them or record its reviews. This session recovered those reviews from that session's subagent transcripts, finished the two open findings, and wrote the description.

### WP-4.2 The lesson editor: ready as a draft, `wp/4.2-lesson-editor` (base `wp/4.1-courses-chapters`)

- Description: `docs/reports/pull-requests/WP-4.2.md`, with its `gh pr create` command and three decisions (the editor's nonce rule, where the lesson-content component lives, `save_lesson` keeping the position).
- `pnpm verify` on 8b289f3: exit 0, 69 files, 1269 tests. `next build`, `check-static`, `check-bundle` pass.
- PGlite: 365 assertions pass, with and without the seed (`12_lesson_order` now 27).
- Review round 1 (code, security, design, on be24f80): all CHANGES REQUIRED. Saved in `docs/reports/reviews/WP-4.2/`. Every finding fixed or answered in the description, except those needing a browser or the lockfile. Not re-reviewed.
- New this session:
  - 3b1bcf8: `save_lesson` keeps the lesson's position unless the chapter changes (security MINOR 2), test first.
  - 8b289f3: Zod `jitless` for every schema a browser loads, plus a lint rule (security MINOR 1), test first.
- e2e written, not run.
- Push: succeeded, `be24f80..c69e191`. This progress commit is pushed after it.
- `wp/4.2-markdown-part-1` is superseded by `wp/4.2-lesson-editor`. Do not open a pull request for part 1.
- The local branch `wp/4.2-lesson-editor` in the `night-c` worktree is behind the pushed branch. Run `git -C /private/tmp/claude-501/night-c pull --ff-only` before working there.

### Owner: run this

1. In a checkout of `wp/4.2-lesson-editor`, with dependencies installed, run `pnpm install && git add pnpm-lock.yaml && git commit -m "build: lock the CodeMirror packages" && git push`. The CodeMirror packages are not in `pnpm-lock.yaml`, so CI fails at the frozen install until this is done.
2. Earlier owner actions for WP-2.2, WP-2.3 and WP-4.1 are still due.

### Next

- WP-4.3 (test cases, validation, publishing) depends on WP-4.1, WP-4.2 and WP-3.4. All three are built as drafts. Stack it on `wp/4.2-lesson-editor` and merge `wp/3.4-statechart` in. Expect conflicts with the 3.x line in `package.json` and the lockfile (Pyodide against CodeMirror).
- WP-5.1 (depends on WP-4.1) can start beside it, on `wp/4.1-courses-chapters`.

## Session of 2026-11-22 (from 01:51), on `wp/4.1-courses-chapters`

Order given by the owner: (1) update waiting branches, done 2026-11-20 and `main` has not moved (037c4ad); (2) to (4) WP-2.1, 2.2, 2.3, done; (5) WP-3.4; then the plan order. WP-4.1, pushed unfinished, first.

Clones: `/private/tmp/claude-501/night-a` (2.x, 4.x line), `night-b` (3.x line), and `night-c`, a worktree of night-a on the local branch `wp/4.2-lesson-editor` (WP-4.2 in progress, not pushed yet).

### WP-4.1 Courses and chapters: ready as a draft, `wp/4.1-courses-chapters` (stacked on `wp/2.3-admin-gate`)

Description: `docs/reports/pull-requests/WP-4.1.md`, with its `gh pr create` command. `pnpm verify`: 58 files, 1051 tests. `next build`, `check-static`, `check-bundle` pass. PGlite: 338 assertions pass, with and without the seed (new `11_structure_versions`, 11). Code, security and design review 1: CHANGES REQUIRED; every blocker and major fixed except design BLOCKER 1 (screenshots need CI's browsers); the rest fixed or answered in the description; not re-reviewed. e2e written, not run.

Before this session the branch had one unpushed commit (9f20137, the views) and the WP-2.3 merge with the owner's lockfile commit; both are pushed now.

### WP-3.4 The statechart: ready as a draft, `wp/3.4-statechart` at fb21e29 (stacked on `wp/3.3-grader`)

Description: `docs/reports/pull-requests/WP-3.4.md`, with its `gh pr create` command. `pnpm verify`: 41 files, 1066 tests. Production build has no `/dev/runtime`; a `VERCEL_ENV=preview` build has it. Round 1 BLOCKER (a refused Run or Check left the chart stuck) fixed with `dispatchEvent`; round 2 code review APPROVE, security review APPROVE on the condition that the owner accepts ADR-0034 (Proposed: a program that yields once can compute while the page waits for input; Stop is the control; a liveness ping was rejected because a program that yields periodically defeats it). e2e written, not run. The phone check is the owner's.

### WP-4.2 The lesson editor: in progress in `night-c`, local branch `wp/4.2-lesson-editor`

`origin/wp/4.1-courses-chapters` (d9eba53) merged in (d9e03ac). Highlighting (`src/content/markdown/highlight.ts`, `document.ts`) written, not committed. CodeMirror packages are in `package.json` and copied into `node_modules` from `/private/tmp/claude-501/cm-side`; the lockfile is not updated (Owner: run this, item 3).

## Session of 2026-11-21 (from 10:33), on `wp/2.3-admin-gate`

### WP-2.3 The admin gate: ready as a draft, `wp/2.3-admin-gate` (stacked on `wp/2.2-sign-in`)

Description: `docs/reports/pull-requests/WP-2.3.md`, with its `gh pr create` command. `pnpm verify`: 49 files, 959 tests. `next build`, `check-static`, `check-bundle` pass. PGlite: 299 assertions pass (new `08_admin_list_check`, 14). Code, security and design review 1: CHANGES REQUIRED, no code or security blocker; every finding fixed or answered in the description; not re-reviewed. e2e (J-12, the admin gallery) written, not run.

Picked up from an uncommitted draft a session at about 06:10 left in `$TMPDIR/wp22`.

### WP-3.4: `wp/3.2-live-input` merged into `wp/3.4-statechart` (312bf29)

Conflicts with WP-3.3 resolved in `controller.ts` (status has both `awaitingInput` and `checking`; the run record has `kind: "run"`; input only for runs), `worker/core.ts` (`Loaded` carries the input-capable runner and the harness checker), `runtime-dev.ts` and both tests. The Pyodide input tests now import `pyodide` by name (WP-3.3's fixed-import lint rule) and send `harnessVersion`. `pnpm verify`: 39 files, 1028 tests.

### Owner: run this

1. Still due from the session before: the WP-2.2 lockfile commit, and the server on port 3197.
2. WP-2.3's owner actions in its description: section 10 step 8 (TOTP on), then after the merge `docs/runbooks/admin-access.md` section 1 on production.

## Session of 2026-11-21 (from 05:32), on `wp/2.2-sign-in`

Sessions between 01:31 and 05:12 started and did nothing (their scratch folders are empty). This one picked up WP-2.2 from the uncommitted work in `$TMPDIR/wp22`.

### WP-2.2 Sign-in: ready as a draft, `wp/2.2-sign-in` (stacked on `wp/2.1-schema-policies`)

Description: `docs/reports/pull-requests/WP-2.2.md`, with its `gh pr create` command. `pnpm verify`: 38 files, 867 tests. `next build`, `check-static` and `check-bundle` pass. PGlite: 285 assertions pass, including two new files (`06_is_admin_wrapper`, `07_password_on_confirm`). Design, code and security review 1: all CHANGES REQUIRED; every finding fixed or answered in the description; not re-reviewed. e2e written, not run.

`wp/2.2-sign-in-part-1` is superseded by `wp/2.2-sign-in` (its tip fadd19b is in it). Do not open a pull request for part 1.

### WP-3.4 The statechart: part 1, `wp/3.4-statechart` at e1123ce (stacked on `wp/3.3-grader`)

`src/runtime/workspace-chart.ts`: a typed reducer (ADR-0020's choice, no library), with 38 tests: every transition of the architecture diagram, every unlisted pair a no-op, the diagram checked against the table, the pending intent, the lesson region, generated paths. `pnpm verify`: 38 files, 989 tests. No reviews yet, no description yet.

Left in WP-3.4: merge `wp/3.2-live-input` (its conflicts with 3.3 in `controller.ts`, `core.ts`, `runtime-dev.ts` and their tests); drive the development page with the chart (input, a check, a runaway loop); a way for that page to exist on previews (the `.dev.tsx` pages are dropped from every `next build`, previews included); the spike report from `docs/templates/spike-report.md` after the owner's phone check.

### Setup notes added this session

- npm works with a private cache: `npm install --cache $TMPDIR/npmc ...`. `$TMPDIR/supa-side/node_modules` holds `@supabase/ssr` 0.12.7 and `@supabase/supabase-js` 2.119.2 with their dependencies. Copy them (`cp -R`, not symlinks: Turbopack does not follow links out of the project) into a clone's `node_modules` to build and test the WP-2.2 branches until the owner commits the lockfile.
- A server started with `&` in one command cannot be found or stopped from the next one (the sandbox hides it). Start and stop it in the same command (`cmd & pid=$!; ...; kill $pid`).
- The PGlite harness's `auth.users` stub (in `$TMPDIR/harness/run.mjs`) now has `encrypted_password` and `email_confirmed_at`.

### Owner: run this

1. In a checkout of `wp/2.2-sign-in`, with dependencies installed: `pnpm install && git add pnpm-lock.yaml && git commit -m "build: lock the Supabase clients" && git push`. Every CI job of WP-2.2 and of anything stacked on it fails at the frozen install until this is done.
2. A production server from this session is still listening on port 3197 and the sandbox cannot stop it: `lsof -ti tcp:3197 | xargs kill`.
3. The WP-2.2 owner actions in its description: runbook section 10 with Confirm email on and the Turnstile key split, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Vercel, `e2e` as a required check.

## Session of 2026-11-21 (from 00:30)

Order given by the owner: (1) update waiting branches, already done on 2026-11-20; (2) WP-2.1; (3) WP-2.2; (4) WP-2.3; (5) WP-3.4; then the plan order.

### Setup notes for the next session

- `pnpm install` cannot run here: pnpm fails with `Failed to open the store operation lock at "pnpm-store-operation-locks": Operation not permitted`, also with `--store-dir` and cache folders under `$TMPDIR`. So no package can be added. Scratch clones get `node_modules` by `cp -Rc` from a folder with the same `pnpm-lock.yaml`: `$TMPDIR/wp13-merge` (lockfile of `main`, sha1 `78b66709`) and `$TMPDIR/-Users-fahad-heap-academy/f5fba7f9-a8ad-4cf7-ab98-f96c832e2ec3/scratchpad/ha3` (lockfile of the WP-3.x branches with Pyodide, sha1 `afaedb81`). The main checkout's `node_modules` is stale.
- In a new clone, run `pnpm run prepare` (sets `core.hooksPath`) and set `user.name` and `user.email` from the main checkout before the first commit. Commit 036626d was made without them (see WP-2.1 owner action 5).
- `gh` cannot reach GitHub from the sandbox (certificate error), so pull requests are not opened; each description file ends with its `gh pr create` command.
- The PGlite harness: from `$TMPDIR`, `PGL=$TMPDIR/pgl SEED=1 node harness/run.mjs <clone> $TMPDIR/pgtap/pgtap.sql.in`.

## WP-2.1 Schema and policies: ready as a draft, `wp/2.1-schema-policies` at fc1b637

Description: `docs/reports/pull-requests/WP-2.1.md`, with its `gh pr create` command. `pnpm verify`: 24 files, 658 tests. PGlite: 271 assertions pass, with and without the seed. Security review 2: APPROVE. Code review 2: CHANGES REQUIRED, all fixed or answered except "nothing has run on Supabase".

This session added: the staging seed through the deploy workflow, guarded by `STAGING_PROJECT_REF`; a check that a published lesson has instructions and a test case; solutions that cannot move to another lesson; `05_limits.test.sql` (47 assertions: every size limit, the stale save across two saves, the two timestamp triggers, every table and column privilege).

Owner: open it so `db` runs; generate the types; add `STAGING_PROJECT_REF`; decide on commit 036626d's identity. Details in the description.

## Branches brought up to date with `main`, 2026-11-20

`main` at 037c4ad (#3 and #4 merged) is merged into each waiting branch, with no rebase and no force push. `pnpm verify` passed on each before its push.

| Branch | Merge | Pushed to | Tests | Conflicts |
|---|---|---|---|---|
| `wp/spec-change-shell-nav-errors` | 803943e | fa74af4 | 650 | none |
| `wp/1.4-followups` | d750ae5 | 3585d6d | 670 | the two `design-review-5.md` and `-6.md` reports, moved to `docs/reports/reviews/WP-1.4-followups/` |
| `wp/3.1-python-worker` | f617391 | a288083 | 788 | `next.config.ts`, `playwright.config.ts`, `package.json`, `pnpm-lock.yaml` |
| `wp/3.2-live-input` | b4f0f11 (merges `wp/3.1-python-worker`) | 6a9c165 | 827 | none |
| `wp/3.3-grader` | 6f0cfe8 (merges `wp/3.1-python-worker`) | 62dc019 | 951 | none |
| `wp/6.1-merge-part-1` | 42b3708 | ac6c13c | 665 | none |
| `wp/6.2-streak-part-1` | 61eac99 | f59b8ba | 666 | none |
| `wp/4.2-markdown-part-1` | 1074bcf | 26d7f62 | 726 | none |

The `spec-change` pull request marks the four WP-1.3 decisions approved. Only the marks changed; see its "Owner actions now due".

Conflicts still ahead, between waiting branches:

- `wp/3.2-live-input` and `wp/3.3-grader`: `src/messages/runtime-dev.ts`, `src/runtime/controller.ts`, `src/runtime/controller.test.ts`, `src/runtime/worker/core.ts`, `src/runtime/worker/core.test.ts`. Whichever merges second needs `main` merged in and these resolved.
- `wp/1.4-followups` and `wp/3.1-python-worker`: `playwright.config.ts`.
