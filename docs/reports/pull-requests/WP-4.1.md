<!-- No AI attribution in this description or in any commit: no co-author trailer, no "Generated with" line, no session link (CLAUDE.md rule 15). -->

## Up to date with main

`main` at 81fdc39 (#10 on top of #5 to #8) is in this branch through `wp/2.3-admin-gate`, which has it (d6dfb0c): merge commit 00c025d. No rebase, no force push. One file conflicted, `docs/reports/local-build-progress.md`: the copy from `wp/2.3-admin-gate`, which holds every section of this branch's copy (this branch's copy differed only in older lines of the same session). No test failed and no code changed.

On 00c025d, `pnpm verify`, exit 0:

```
 Test Files  62 passed (62)
      Tests  1112 passed (1112)
```

`next build` on 00c025d with CI's public values, exit 0, routes `/_not-found`, `/admin`, `/admin/courses/[id]`, `/admin/courses/new`, `/admin/setup`, `/admin/verify`, `/api/csp-report`, `/api/health`, `/auth/callback`, `/sign-in`. `check-bundle` (22 files) and `check-static`: exit 0. Not run: `pnpm test:db` (no Docker) and e2e (no browser).

The earlier merge of `main` at 0efe863 follows.

`main` at 0efe863 (#5, #6, #7, #8) is in this branch through `wp/2.3-admin-gate`, which already has it (a9d23f1, with 1fb08e1 and 39c22f1): merge commit 1696ef1. No rebase, no force push.

- One file conflicted: `docs/reports/local-build-progress.md`. The copy from `wp/2.3-admin-gate` was taken, the newer one; its only difference in this branch's sections is a done owner step (the WP-4.2 lockfile commit) that a later session removed.
- Four test files failed after the merge, 7 tests: `chapter-list.test.tsx`, `course-details-form.test.tsx`, `course-list.test.tsx`, `course-status.test.tsx` (for example `AssertionError: expected '' to contain 'This was changed somewhere else after…'`). Same cause as WP-2.2 and WP-2.3: `main`'s `Notice` puts an announced notice in a `LiveRegion` that is in the page first and gets its words one frame later. Fixed in 9dfb2bd: the tests wait for the same words in the same `alert` region (`waitFor`). No assertion was removed or loosened, and the components are unchanged.

On 9dfb2bd, `pnpm verify`, exit 0:

```
 Test Files  62 passed (62)
      Tests  1103 passed (1103)
```

`next build` with CI's public values (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` from `.github/workflows/ci.yml`), exit 0, routes `/_not-found`, `/admin`, `/admin/courses/[id]`, `/admin/courses/new`, `/admin/setup`, `/admin/verify`, `/api/csp-report`, `/api/health`, `/auth/callback`, `/sign-in`. `node scripts/check-bundle.mjs .next/static`: "No server variable (RESEND_API_KEY, HEAP_RELEASE) in 22 files under .next/static." `node scripts/check-static.mjs .next`: "No prerendered page in .next, apart from /_global-error, which Next.js always prerenders."

Not run on the merge: `pnpm test:db` (no Docker on this machine) and e2e (no browser here).

No new decision: the merge took no choice beyond WP-2.2's decision A (CI's `e2e` job does not run `main`'s `phone` projects).

## What and why

Courses and chapters in the dashboard (FR-ADM-03, FR-ADM-09, FR-ADM-10, FR-ADM-11, T-20): the course list, the course editor, the server actions for course structure, and the cached queries for published content.

- **The course list** (`/admin`): every course in the owner's order, with status and published and draft lessons, Move up and Move down, and New course as the page's one action.
- **New course** (`/admin/courses/new`) and **the course editor** (`/admin/courses/[id]`):
  - Details: title, address, summary, up to five outcomes.
  - Status: publish, move back to draft, archive. Taking a course off the site and archiving ask first and say what learners will see. A course with no published lesson cannot be published: the database refuses it (`courses_before_write`) and the editor shows the reason.
  - Chapters in order, each with its lessons, numbered as learners see them (`2`, `2.3`). Move up and Move down, rename in place, delete an empty chapter after a question, add a chapter.
- **Stale saves are refused** (FR-ADM-10). Details, status and a chapter rename each name the `updated_at` they loaded and are written only if the row still has it. Otherwise the editor says so and offers Reload. Chapters get an `updated_at` (migration `20261121070000_structure_versions.sql`). A move changes only positions, so it keeps every row's version: an editor open in another tab can still save.
- **Unsaved text is never lost silently.** While the details or a chapter form hold unsaved text, leaving by a link, Back, or closing the tab asks once (`useLeaveWarning`).
- **Server actions** `saveCourse`, `setCourseStatus`, `saveChapter`, `deleteChapter`, `reorder` (section 9.1), through the wrapper with access `admin`. Anyone else gets `not_found`, and the database refuses the write again. `reorder` sends the whole new order to `reorder_courses` or `reorder_chapters` (security invoker, `search_path = ''`), which rewrite positions in one statement or refuse with `order_out_of_date`.
- **Published content** in `src/content` (section 7.3 and 12): `publishedCourses()` and `publishedCourse(slug)`, read with the session-less client, in the data cache under the tag `content` for at most 60 s. Every successful structure action calls `contentChanged()` (`updateTag`). Nothing renders them yet; WP-5.1 builds the pages.
- **The invariant is now enforced.** A lint rule lets `src/content` import from `infrastructure` only the session-less client, the environment schema and the logger, and never `next/headers`. A unit test shows the public client sends no cookie and no user token.

## Work package

- Work package: WP-4.1 Courses and chapters (`docs/spec/08-delivery-plan.md`), stacked on WP-2.3 (`wp/2.3-admin-gate`).
- Requirements and threats covered: FR-ADM-03, FR-ADM-09, FR-ADM-10, FR-ADM-11, T-20 (and T-21 for the content invariant).
- Time box 2.5 hours. The store and actions were committed at 11:07 on 2026-11-21 and the views at 22:43 by earlier sessions; how long they worked is not known. This session (from 01:51 on 2026-11-22) checked the Done-when lines, ran the three reviews and fixed their findings, about one hour. Total working time: not measured.

## How it was verified

- `pnpm verify` on f4052c1, exit 0: Prettier, ESLint, `tsc`, attribution, `Test Files  58 passed (58)`, `Tests  1051 passed (1051)`.
- `next build` with the fake values of `.env.example`: exit 0. `/admin/courses/[id]` and `/admin/courses/new` are dynamic. `check-static` ("No prerendered page in .next, apart from /_global-error") and `check-bundle` ("No server variable (RESEND_API_KEY, HEAP_RELEASE) in 22 files under .next/static") pass.
- The production server, probed with `curl` before the fixes (no browser here): `/admin`, `/admin/courses/new` and `/admin/courses/<uuid>` answer `404` with the title `Page not found | Heap Academy`, as `/no-such-page` does, and carry `cache-control: private, no-store`.
- Database: the PGlite harness, every migration, then every test, with and without the seed. All 11 files pass, 0 not ok: `01` 33, `02` 80, `03` 57, `04` 54, `05` 47, `06` 8, `07` 6, `08` 14, `09_reorder` 22, `10_course_versions` 6, `11_structure_versions` 11. **Not run on the Supabase image.**
- Mutant: with the chapter and course update policies set to `using (true)`, `09_reorder` fails 5 assertions (the learner and `aal1` refusals and the "changed nothing" checks).
- Unit tests added or changed (requirement IDs in titles): the structure actions through the real wrapper (guest, learner, oversized input, admin, stale rename, a chapter added to a course deleted meanwhile); the store's error mapping; the details form (slug taken as the Address field's error, pending keeps focus); the status panel (moves, questions, focus on the new status); the chapter list (rename takes and returns focus, add returns focus to the title, a stale rename keeps the typed text, unsaved text reported and cleared, pending keeps focus); the leave warning; the published-content queries (cache tag and minute, failure logged, a made-up address costs no query); the content boundary rule; the public client's headers; `contentLogRoute`.
- End to end and axe: **written, not run** (no browser in this session):
  - `e2e/course-structure-journey.spec.ts` (`stack` project): create, add and reorder chapters, publish refused with the reason, a stale save from a second tab, the leave question, archive; courses moved in the list.
  - `e2e/admin-gallery.spec.ts` (`gallery` project): the refusals, the empty editor, and a new test for the pending, saved, question and failure states.

## Screens

None yet: no browser can run here. When CI runs, the `e2e` job saves these to `docs/reports/screens/WP-4.1/` at 1280 px: `admin-new-course-invalid`, `admin-course-editor-publish-refused`, `admin-course-editor-stale`, `admin-courses`, `admin-course-states`, `admin-course-archive-question`, `admin-course-draft-question`, `admin-chapter-delete-question`, `admin-course-editor-pending`, `admin-course-editor-saved`, `admin-course-failures`.

antislop Delivery Gate report, antislop active: during (global preference). From source only; every line that needs a rendered page is NOT VERIFIED until the `e2e` job runs.

- Block 1:
  - PASS:
    - R-02: no em dash in `src/messages/admin.ts` or `src/messages/gallery.ts`.
    - R-17, R-18, R-36, R-38: the only numbers are the real limits (60, 140, five outcomes) and the positions learners see.
    - R-23, R-24: no brand asset, icon or illustration added; the gallery's sample rows are development-only.
    - R-27: every state of the list and the editor is in source, unit tests and the gallery: empty, failed, rows, pending, saved, refused (publish, stale, order, slug taken), the three questions, rename, the editor's load failure.
  - PASS by code:
    - R-26 and R-35 by code: every control acts. New course, each course link, Move up and Move down, Save details, Publish, Move back to draft, Archive, Rename, Save chapter, Cancel, Delete, Add chapter and Reload each call an action or navigate; the e2e specs press each one. The click-through in a browser is NOT VERIFIED.
    - R-32: focus stays on a pressed button while its change is saved (`isPending`), moves to the rename field and back to Rename, to the new status after a status move, to the empty title after Add chapter, to the Address field when it is taken, and back to the moved item's button after a move. The focus ring is NOT VERIFIED.
    - R-39: one `h1`; a table caption and `th scope`; distinct labels for the new-chapter and rename fields; the outcomes hint tied to its fieldset.
  - NOT VERIFIED: R-03, R-25 (layout, density at 1024 and 1280 px).
- Block 2: no gradient, glow, shadow, badge or arrow. Statuses are words. Archive and Delete are destructive with a border, never a red fill. PASS by code.
- Block 3:
  - Dials: ENERGY 1, RHYTHM 1, MOTION 1.
  - Focal point: New course on the list (the new `action` link variant, styled as the primary button); Save details in the editor.
  - The details, status and chapters share the prose measure.
- Block 4: C-1, C-2, C-3, C-5 PASS by code. C-4 NOT VERIFIED until screenshots exist.

## Reviews

Saved in `docs/reports/reviews/WP-4.1/`. All three are round 1, on a039c64. None has re-reviewed the fixes.

- **code-reviewer (1): CHANGES REQUIRED.**
  - BLOCKER 1 (chapter forms lose text silently): the chapter forms report unsaved text to the editor, which runs one leave warning for details and chapters.
  - BLOCKER 2 (stale chapter rename overwrites): `chapters.updated_at`, the rename names it, `stale` is refused with Reload; pgTAP `11`.
  - SHOULD FIX 3 (a reorder bumps every course's version): position-only changes keep `updated_at` for courses and chapters; pgTAP `11`.
  - SHOULD FIX 4 (silent catch): `content-read-failed` is logged with `GET /content/<query>`.
  - SHOULD FIX 5: stated in this description.
  - NIT 6: a chapter added to a gone course says `not_found`.
  - NIT 7: chapter order ties broken by ID in the move and the editor.
  - NIT 8 (branded IDs): not done. No branded ID type exists in the codebase yet; adding one for this package alone would be a second convention. Listed below.
  - NIT 9: the chapter form uses the shared `trimmedText`. `CourseStatus` in `types.ts` still duplicates the domain's `ContentStatus`; merging them touches every admin view and is left for WP-4.3, which adds lesson statuses.
  - NIT 10: fixed with the security finding.
  - NIT 11: not added. The editor's `onChanged` keeps the version; the e2e journey saves details after a status change and would fail without it.
  - NIT 12: not changed. The second e2e test still relies on the seed's course; it puts the order back at the end.
  - NIT 13: decision 1 below.
- **security-reviewer (1): CHANGES REQUIRED.**
  - MAJOR 1: `09_reorder` publishes course "one", so a learner and an admin at `aal1` see it; both functions are called with its full visible order and refused by row level security; positions unchanged; the mutant above.
  - MAJOR 2: the lint rule and the public client test.
  - MINOR 3: an address that cannot be a slug answers "no course" with no query.
  - MINOR 4: not done. An e2e step posting a server action as a learner needs the action's ID from a built page; the database refusal is already in the journey and in pgTAP.
- **design-reviewer (1): CHANGES REQUIRED.**
  - BLOCKER 1 (no screenshots): cannot be met here; the specs now photograph every state.
  - BLOCKER 2: the Delivery Gate report above.
  - MAJOR 3: focus, as in R-32 above, with tests of `document.activeElement`.
  - MAJOR 4: the chapter leave warning.
  - MAJOR 5: the gallery has a published course with saves that never answer (pending, the questions, rename), saves that succeed (saved, the new status), the editor's load failure (`CourseEditorFailed`, shared with the page) and a taken address.
  - MINOR 6: gallery examples are page-wide.
  - MINOR 7: chapters on the prose measure; a lesson row is number, title, status.
  - MINOR 8: chapter and lesson numbers in Plex Mono.
  - MINOR 9: New course uses the `action` link variant.
  - MINOR 10: not done. In-app links still use the browser's `confirm` (OK and Cancel). A dialog needs the warning to hold navigation and render one; that is a rework of `leave-warning.ts` that WP-4.2's lesson editor shares, so it is done there or as its own change.
  - MINOR 11: the messages are corrected (invalid input, slug taken on the field, stale says what reloading drops, "Only admins", an actor in the delete question, "course or chapter").
  - MINOR 12: distinct field names.
  - MINOR 13: `aria-describedby`.
  - MINOR 14: the empty status lines are visually hidden.

## Try it on the preview

After WP-2.2 and WP-2.3's owner actions: sign in, pass the second step, and press New course. Create a course, add two chapters, move the second up, try Publish (refused: no published lesson), and Archive it. Open the same course in a second tab, save there, then save in the first: refused with Reload.

## Owner actions now due

1. Everything WP-2.2 and WP-2.3 still wait for; this branch is stacked on them.

## Decisions for the owner

1. **Chapters have no status.** FR-ADM-03 says courses and chapters are published, unpublished and archived; the WP-2.1 schema, `02-architecture.md` section 8 and `03-experience.md` section 7.3 give only courses a status, and a chapter shows when its course is published. Recommendation: a `spec-change` to FR-ADM-03 saying chapters are created, edited, reordered and deleted when empty. Default: as built.
2. **Reordering a course or chapter keeps its `updated_at`.** So `updated_at` means "the editable text last changed", not "the row last changed". Recommendation: accept. Default: as built.

## Deviations from the plan or the spec

1. Add a lesson and the lessons' own order (section 7.3) are not here: they create and open a lesson, which WP-4.2 builds. The chapter rows list lessons with their status and number only.
2. A new `action` variant of the `Link` primitive, for navigation that is a screen's main action.
3. The content boundary rule tightens what `src/content` may import from `infrastructure`. It enforces the existing invariant of section 7.3; the graph of section 4.1 is unchanged.

## Risks and rollback

- Nothing has run against Supabase or PostgREST: the nested selects (`chapters(..., lessons(...))`, `lessons(slug)`) are proven only by the e2e journey, which has not run.
- `unstable_cache` with `updateTag` was read from Next.js 16.4.6's source by the code reviewer, not run.
- Rollback: revert the merge. Data: `chapters.updated_at`, the two reorder functions and the replaced `courses_before_write`. Reverting the code leaves them harmless.

## Definition of Done

- [ ] Every "Done when" line is met. **No:** screenshots at 1280 px and `design-reviewer`'s approval wait for CI's browsers; e2e is written, not run.
- [x] Every cited Must requirement has a passing test that names its ID.
- [ ] `pnpm verify` and every required check pass. `pnpm verify` passes; CI not run here.
- [x] Every state of every changed view exists.
- [x] No stub, dead control, placeholder, commented-out code, or invented number.
- [x] New server actions use the wrapper. Changed tables and the new functions have policy tests.
- [ ] Every reviewer blocker is fixed. Code blockers fixed; design BLOCKER 1 needs the screenshots from CI. No reviewer has re-reviewed the fixes.
- [x] No AI attribution in any commit or in this description.

Create with:

```sh
gh pr create --draft --base wp/2.3-admin-gate --head wp/4.1-courses-chapters --title "WP-4.1 Courses and chapters" --body-file docs/reports/pull-requests/WP-4.1.md
```
