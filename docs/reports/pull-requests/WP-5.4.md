<!-- No AI attribution in this description or in any commit (CLAUDE.md rule 15). -->

**Base: `wp/5.2-workspace-laptop` at 3f5f1bb, with `origin/wp/5.1-catalog` at 392fa44 merged in (afbd72d).** WP-5.4 depends on WP-5.2 and WP-4.3; `wp/5.1-catalog` carries the 2.2, 2.3, 4.1, 4.2 and 4.3 line, and WP-5.4's completion marks go on WP-5.1's pages. Merges after WP-5.1 and WP-5.2. Until then this pull request also shows their commits; review afbd72d's conflict resolutions and the commits after it. Draft: part 1 of WP-5.4.

## What

Part 1 (f78c583): the progress store on the device (FR-PRG-01, NFR-REL-01; `02-architecture.md` section 10).

- `src/features/progress/client/device-database.ts`: one opener for the `heap-academy` IndexedDB database at version 2, which adds a `completions` store beside WP-5.2's `code` store. A tab holding an older version closes its connection when another tab upgrades.
- `src/features/progress/client/progress-store.ts`: `record` keeps a pass in memory first, tells listeners, then writes it to IndexedDB. A second pass of a lesson keeps the first and returns `false` (FR-WSP-06). Operations run one at a time. Rows read back are checked. `durability()` says `memory` when IndexedDB is missing, refuses to open, or refused a write; a later call writes what is pending.
- `saved-code.ts` uses the shared opener.

The merge (afbd72d) resolved 7 conflicts. Two WP-5.1 checks now see WP-5.2's lesson page: `/learn/[course]/[lesson]` is in the indexing test as indexed (`03-experience.md` section 3), and the catalog boundary test lets the lesson page and `/dev/workspace` import exactly the workspace's index and the request's nonce.

Still to come in later parts: the completion moment and the invitation, the storage notice, completion marks and action labels on the course list and course page, the admin preview route, and the browser journeys (J-8, the network cut).

## How it was verified

- `pnpm verify` on f78c583: exit 0, `Test Files  122 passed (122)`, `Tests  2225 passed (2225)`.
- `pnpm build` on afbd72d with CI's fake public values: exit 0; `check-bundle`: `No server variable (RESEND_API_KEY, HEAP_RELEASE) in 23 files under .next/static.`; `check-static`: exit 0.
- New: 12 tests in `progress-store.test.ts` (reload, upgrade from version 1 keeping saved code, a second pass, two passes at once, listeners, rows it did not write, no IndexedDB, refused open, a refused write kept and written later).
- Not run: browser tests (none yet for this part), `pnpm test:db` (no database change).

## Reviews

Code review 1 on afbd72d and f78c583: see below.

## Decisions (safe defaults)

1. Base: `wp/5.2-workspace-laptop` plus `wp/5.1-catalog`, not `wp/5.3-workspace-phone` (WP-5.3 and WP-5.4 can run beside each other).
2. The progress code lives in `src/features/progress`, and the IndexedDB opener moved there; the workspace imports it through the feature's index.
3. Merge: the lesson read uses WP-5.1's `cachedReader`, so its cache key carries the database address.
4. Merge: the catalog boundary test names the two files that host the workspace and the exact forbidden imports each may have, rather than moving the lesson page (WP-5.2 decision 7 keeps it in the catalog).
5. A completion's code is stored as passed, with no cap here; the server's 20,000-character limit applies when WP-6.1 syncs it.

## Risks and rollback

A tab still running WP-5.2's code (version 1) after this ships cannot open the database at version 2 and keeps code in memory until reloaded. Unmerged branch; nothing to roll back.
