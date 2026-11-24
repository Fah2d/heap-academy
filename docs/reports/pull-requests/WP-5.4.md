<!-- No AI attribution in this description or in any commit (CLAUDE.md rule 15). -->

**Base: `wp/5.3-workspace-phone` at 2653c90 (with `wp/5.2-workspace-laptop` at 3f5f1bb), plus `origin/wp/5.1-catalog` at 392fa44 (with the 2.2 to 4.3 line).** WP-5.4 depends on WP-5.2 and WP-4.3, and its marks go on WP-5.1's pages. The branch started from `wp/5.2-workspace-laptop`, took `wp/5.1-catalog` (afbd72d), then `wp/5.3-workspace-phone` (cf9d200) so the workspace changes do not conflict with the phone layout. Merges after WP-5.1, WP-5.2 and WP-5.3. Until then this pull request also shows their commits; review afbd72d's resolutions and the commits after it. Parts 1 to 5: WP-5.4 complete; J-8 and the gate journeys run only in CI.

## What

- Part 1 (f78c583, 8368967): the progress store on the device (FR-PRG-01, NFR-REL-01; `02-architecture.md` section 10). One opener for the `heap-academy` IndexedDB database at version 2, which adds a `completions` store beside WP-5.2's `code` store. A pass is kept in memory, then added with `add`, so of two tabs only the first pass counts and its row stays. A failed read keeps what was last read. A failed request or a closed connection makes the next call open again. `durability()` says `memory` when IndexedDB is missing or refuses.
- Part 2 (8474a95, 5359d9c): the completion moment (section 6.6, FR-WSP-06). A check that passes every test is kept at once, with the source that check started with. The tests panel shows the pass icon and "Lesson complete. You earned 10 XP." at `--text-2xl` (`DESIGN.md` section 7), and "Lesson complete. Its XP counted the first time you passed it." on a later pass; a second live region says it after the summary. When the device keeps nothing, a warning above the editor says a reload or leaving loses the work.
- Part 3 (2da1c68, d3ad772): progress on the course list and course page (FR-CAT-02, FR-CRS-02). Each course row shows "N of M lessons completed" and one action, "Begin the course", "Continue the course" (to the first lesson not completed) or "Review the course"; the course page has the same action as its primary button, and each lesson row links to its workspace and shows its XP and its state ("Completed", "Next up", "Not started") as an icon and a word. The rule is `courseStanding` in `src/domain`; the device is read by `useDeviceCompletions`. The content reads now carry lesson IDs in course order and each lesson's XP, under new cache key parts.
- Part 4 (bab29d3): the invitation to save progress (FR-AUTH-07, FR-PRG-01). Below a lesson's first completion, a guest sees "Your progress is saved on this device only. Sign in to keep it on every device." with a sign-in link back to the lesson and a Hide button; hidden, it stays hidden for the browser session. The root layout, which already read the visitor for the header, reads it once per request and hands the card down only for a guest, so the lesson page still reads no identity.
- The merge (afbd72d) resolved 7 conflicts. `/learn/[course]/[lesson]` is in the indexing test as indexed (`03-experience.md` section 3). The catalog boundary test lets the lesson page and `/dev/workspace` import exactly the workspace's index and the request's nonce.

- Part 5 (a0e14ab, 80e61d9, 6b93dcd): the admin preview (FR-ADM-08, section 7.7). `/admin/lessons/[id]/preview` runs the admin guard first, reads the last saved version through the admin's session without the solution, and shows it in the workspace with a banner and a link back to the editor. A preview keeps code in memory only, records no completion, asks nothing of the device, and shows no invitation and no previous or next. With no test case, Check is off and the tests panel says why. The editor's top bar has "Preview the lesson". J-8 (`e2e/j8-add-lesson-journey.spec.ts`, stack): create, fill from solution, validate, preview, publish, a guest sees the lesson within a minute and gets not-found at the preview. NFR-REL-02: a journey cuts the network after Python is ready; Run, Check and the kept pass still work.

## How it was verified

- `pnpm verify` on a4dd570: exit 0, `Test Files  128 passed (128)`, `Tests  2296 passed (2296)`.
- `pnpm build` on a4dd570 with CI's fake public values: exit 0; `check-bundle`: `No server variable (RESEND_API_KEY, HEAP_RELEASE) in 23 files under .next/static.`; `check-static`: exit 0.
- Unit tests: the progress store (17), the completion moment (10), `courseStanding` (8, one a property test), `useDeviceCompletions` (5), the course pages in each progress state (9), the invitation (12), the preview page (5), the preview in the workspace (5), the preview read (8).
- Browser on a4dd570, Chromium, one test per Playwright process, against `next dev --webpack` on `localhost`: `workspace-runtime.spec.ts` 17 of 17 (new: the invitation journey), `workspace-phone.spec.ts` 4 of 4, `catalog-gallery.spec.ts` 25 of 25 (new: progress from IndexedDB on the course page and the course list at 375 and 1280 px, with axe).
- Part 5, on 6b93dcd: `pnpm verify` exit 0, `Test Files  130 passed (130)`, `Tests  2320 passed (2320)`. `pnpm build` on a0e14ab: exit 0, `/admin/lessons/[id]/preview` listed; `check-bundle` and `check-static` exit 0. Browser, Chromium: `workspace-preview-runtime.spec.ts` 2 of 2 (the preview on `/dev/admin/preview`, the network cut), run twice. Found, not caused here: `admin-gallery.spec.ts` "the lesson editor's states" fails axe `landmark-unique` (several "Sections of this lesson" landmarks on the gallery page); it fails the same with part 5's editor change reverted.
- Not run: `pnpm test:db` (no database change), the stack journeys including J-8 and the gate journey (no Docker), Firefox and WebKit (speed mode).

## Reviews
Code review 1 (afbd72d, f78c583): 1 BLOCKER, 2 MAJOR, 4 MINOR, fixed in 8368967 apart from one minor. Code review 2 (8474a95): 4 MAJOR, 3 MINOR, fixed in 5359d9c. Code review 3 (2da1c68, part 3): 2 MAJOR, 6 MINOR, fixed in d3ad772. Code review 4 (bab29d3, part 4): 1 MAJOR, 4 MINOR, fixed in a4dd570 apart from one minor answered in decision 16. Security review 1 (bab29d3, sign-in and the layout's identity read): APPROVED, 2 MINOR, one fixed, one expected. Code review 5 (a0e14ab, part 5): 1 BLOCKER, 3 MAJOR, 3 MINOR, fixed in 6b93dcd apart from one minor answered (below 1024 px). Security review 2 (a0e14ab): APPROVED, 2 MINOR, both fixed. Reports with answers in `docs/reports/reviews/WP-5.4/`. Screens: `docs/reports/screens/WP-5.4/`.

## antislop Delivery Gate report

antislop active: during (session override, CLAUDE.md rule 5). Dials from `DESIGN.md`: ENERGY 1 / RHYTHM 1 / MOTION 1. Parts 2 to 5 (part 1 has no interface).

- Block 1: PASS. R-02: no em dash in the new words. R-25/R-39: axe passed on the completed state, the invitation, the course list and course page with progress, and the preview after a pass. R-27: the completion, a repeat, the storage notice, the invitation and its hidden state, and every course and lesson state (before the device answers, 0, partial, 100 percent) are tested. FR-CRS-02: state as a word beside an icon hidden from assistive technology. NFR-A11Y-04: one announcement per result, the completion in its own region (tested). R-03: no sideways scroll at 375 px in the phone journeys.
- Block 2: PASS. No new technique: the preview's banner is an information `Notice`; `Notice`, `Status` (one new `next` state with Carbon's `ChevronRight`), `Link` and `Button`.
- Block 3: PASS. The focal point after a pass is the completion line, then Next (WP-5.2's primary action).
- Block 4: PASS. One line, no modal, no confetti, no animation beyond the 160 ms state change (section 6.6). The invitation is an inline card below the result (section 2's anti-pattern table) and leaves Check and Next available.

## Decisions (safe defaults)

1. The progress code lives in `src/features/progress`, and the IndexedDB opener moved there. The workspace imports it through the feature's index.
2. Merge: the lesson read uses WP-5.1's `cachedReader`, so its cache key carries the database address.
3. Merge: the catalog boundary test names the two files that host the workspace and the exact forbidden imports each may have. The lesson page stays in the catalog (WP-5.2 decision 7).
4. A completion's code is stored as it passed, with no cap. The server's 20,000-character limit applies when WP-6.1 syncs it.
5. A pass counts as first unless this device already has the lesson. The XP shown is the lesson's; the database copies it at sync (FR-PRG-04).
6. A made-up lesson address under a real course still costs one query and a cached `null` (review 1, MINOR 5). This is accepted until WP-7.1's firewall rule, as WP-5.1 first did for courses.
7. The invitation must not show to a signed-in learner, and the lesson page may not read identity (rule 9, the catalog boundary test). Answered in part 4 by decision 15.
8. `/dev/workspace` gives the example lesson a fixed ID and 10 XP.
9. Before the device answers, the action says "Begin the course" and goes to the first lesson, and no count or lesson state is shown; the server cannot know a guest's progress (`02-architecture.md` section 10).
10. The spec's "open" lesson state shows as "Not started": "Open" beside a link reads as a command.
11. The course page's "N of M lessons completed" is FR-CAT-02's progress; FR-CRS-05's summary with XP stays in WP-6.2.
12. A content answer's cache key part carries the version of its shape, so a new shape never reads an old entry.
13. "After the first completion only" is read as below a lesson's first completion on this device; once hidden, the card stays hidden for the browser session (section 6.6).
14. No invitation when the device keeps progress only in memory: its words would be false, and the memory warning already shows.
15. The invitation reaches the workspace from the root layout through the progress feature, because the lesson page may not read identity (decision 7). This also gives WP-6.1 the place where the client learns who is signed in.
16. The invitation's "keep it on every device" holds once WP-6.1 merges progress at sign-in (FR-PRG-03); the sign-in page already says the same.
17. The preview shows the last saved version, not unsaved edits (the leave warning asks first). Its Check uses the workspace's worker, not a fresh one; only Validate decides publishing.
18. Below 1024 px the admin frame hides the preview, but it still mounts and loads Python (code review 5, MINOR 5, accepted).

## Risks and rollback

A tab still running WP-5.2's code (version 1) after this ships cannot open version 2. It keeps code in memory until it is reloaded. Unmerged branch; nothing to roll back. `e2e/catalog-journey.spec.ts` (stack, CI only) now expects the progress line and each row's XP and state.
