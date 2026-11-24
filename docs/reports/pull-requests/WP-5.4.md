<!-- No AI attribution in this description or in any commit (CLAUDE.md rule 15). -->

**Base: `wp/5.3-workspace-phone` at 2653c90 (with `wp/5.2-workspace-laptop` at 3f5f1bb), plus `origin/wp/5.1-catalog` at 392fa44 (with the 2.2 to 4.3 line).** WP-5.4 depends on WP-5.2 and WP-4.3, and its marks go on WP-5.1's pages. The branch started from `wp/5.2-workspace-laptop`, took `wp/5.1-catalog` (afbd72d), then `wp/5.3-workspace-phone` (cf9d200) so the workspace changes do not conflict with the phone layout. Merges after WP-5.1, WP-5.2 and WP-5.3. Until then this pull request also shows their commits; review afbd72d's resolutions and the commits after it. Draft: parts 1 and 2 of WP-5.4.

## What

- Part 1 (f78c583, 8368967): the progress store on the device (FR-PRG-01, NFR-REL-01; `02-architecture.md` section 10). One opener for the `heap-academy` IndexedDB database at version 2, which adds a `completions` store beside WP-5.2's `code` store. A pass is kept in memory, then added with `add`, so of two tabs only the first pass counts and its row stays. A failed read keeps what was last read. A failed request or a closed connection makes the next call open again. `durability()` says `memory` when IndexedDB is missing or refuses.
- Part 2 (8474a95, 5359d9c): the completion moment (section 6.6, FR-WSP-06). A check that passes every test is kept at once, with the source that check started with. The tests panel shows the pass icon and "Lesson complete. You earned 10 XP." at `--text-2xl` (`DESIGN.md` section 7), and "Lesson complete. Its XP counted the first time you passed it." on a later pass; a second live region says it after the summary. When the device keeps nothing, a warning above the editor says a reload or leaving loses the work.
- The merge (afbd72d) resolved 7 conflicts. `/learn/[course]/[lesson]` is in the indexing test as indexed (`03-experience.md` section 3). The catalog boundary test lets the lesson page and `/dev/workspace` import exactly the workspace's index and the request's nonce.

Later parts: the invitation to save progress, completion marks and action labels on the course list and course page, the admin preview route, J-8 and the network-cut journey.

## How it was verified

- `pnpm verify` on 5359d9c: exit 0, `Test Files  123 passed (123)`, `Tests  2259 passed (2259)`.
- `pnpm build` on 5359d9c with CI's fake public values: exit 0; `check-bundle`: `No server variable (RESEND_API_KEY, HEAP_RELEASE) in 23 files under .next/static.`; `check-static`: exit 0.
- New tests: 17 in `progress-store.test.ts` (reload, the upgrade from version 1 keeping saved code, a second pass, two passes at once, two tabs at once, rows it did not write, no IndexedDB, a refused open, a refused write written later, a failed read, a closed connection, another tab's upgrade, a throwing listener). 10 in `workspace.test.tsx` (the first pass and its code, the source a check started with, a repeat, one record per result, a run before the device answers, a failed check, a later failed check, the notice at load and during the visit, and its absence). 2 in `warm-cache.test.ts`, 1 in `lesson-page.test.ts`.
- Browser on 5359d9c, Chromium, one test per Playwright process, against `next dev --webpack` on `localhost`: the 16 desktop journeys of `e2e/workspace-runtime.spec.ts`, including the new "a pass shows its XP once and is kept after a reload" (it reads the stored row's code), and the 4 phone journeys: 20 of 20 passed. The dev server must be reached as `localhost`: Next.js blocks its development files for `127.0.0.1`, and Python never starts.
- Not run: `pnpm test:db` (no database change), Firefox and WebKit (speed mode).

## Reviews

Code review 1 on afbd72d and f78c583: CHANGES REQUIRED, 1 BLOCKER, 2 MAJOR, 4 MINOR. All but one minor are fixed in 8368967; the report and answers are in `docs/reports/reviews/WP-5.4/code-review-1.md`. Code review 2 on 8474a95: CHANGES REQUIRED, 4 MAJOR, 3 MINOR, all fixed in 5359d9c; `docs/reports/reviews/WP-5.4/code-review-2.md`. Screens: `docs/reports/screens/WP-5.4/workspace-complete-*`. No security review: no sign-in, database or runtime change.

## antislop Delivery Gate report

antislop active: during (session override, CLAUDE.md rule 5). Dials from `DESIGN.md`: ENERGY 1 / RHYTHM 1 / MOTION 1. Part 2 only (part 1 has no interface).

- Block 1: PASS. R-02: no em dash in the new words. R-25/R-39: axe passed on the completed state in the journey. R-27: the completion, a repeat, and the storage notice each have a state, with unit tests. NFR-A11Y-04: one announcement per result, the completion in its own region (tested). R-03: no sideways scroll at 375 px in the phone journeys.
- Block 2: PASS. No new technique: the `Notice` primitive and the `Status` pass icon.
- Block 3: PASS. The focal point after a pass is the completion line, then Next (WP-5.2's primary action).
- Block 4: PASS. One line, no modal, no confetti, no animation beyond the 160 ms state change (section 6.6).

## Decisions (safe defaults)

1. The progress code lives in `src/features/progress`, and the IndexedDB opener moved there. The workspace imports it through the feature's index.
2. Merge: the lesson read uses WP-5.1's `cachedReader`, so its cache key carries the database address.
3. Merge: the catalog boundary test names the two files that host the workspace and the exact forbidden imports each may have. The lesson page stays in the catalog (WP-5.2 decision 7).
4. A completion's code is stored as it passed, with no cap. The server's 20,000-character limit applies when WP-6.1 syncs it.
5. A pass counts as first unless this device already has the lesson. The XP shown is the lesson's; the database copies it at sync (FR-PRG-04).
6. A made-up lesson address under a real course still costs one query and a cached `null` (review 1, MINOR 5). This is accepted until WP-7.1's firewall rule, as WP-5.1 first did for courses.
7. The invitation to save progress waits for a later part. It must not show to a signed-in learner, and the lesson page may not read identity (rule 9, the catalog boundary test). The guest's "saved on this device only" line comes with it.
8. `/dev/workspace` gives the example lesson a fixed ID and 10 XP.

## Risks and rollback

A tab still running WP-5.2's code (version 1) after this ships cannot open version 2. It keeps code in memory until it is reloaded. Unmerged branch; nothing to roll back.
