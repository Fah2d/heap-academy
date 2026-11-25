**Part 2 of WP-6.1 (2a and 2b).** Stacked on `wp/2.3-admin-gate`. The screens are not on this stack, so no interface is added.

## What and why

Progress that survives a failed network and reaches the account (FR-PRG-02, FR-PRG-03, FR-PRG-06, NFR-REL-01, T-08, T-10; architecture section 10).

| Item | Where |
|---|---|
| `recordCompletion` and `mergeProgress` server actions, signed-in only, strict inputs, byte limits. The caller is the verified identity. | `src/features/progress/server` |
| Completion store over the caller's own session: insert with do nothing on conflict, list. Row level security decides. | `src/infrastructure/db/completion-store.ts` |
| Device store with an atomic read-modify-write; entries are parsed with the server's bounds on read. | `src/features/progress/client/device-store.ts` |
| IndexedDB backend; memory when IndexedDB is missing, blocked or fails (`durable: false`, so a screen can tell the learner). | `.../idb-backend.ts` |
| Sync: on start, when the tab shows, retry with a wait that doubles from 2 s to 60 s; one run at a time; a pass and a sync never overlap. | `.../sync.ts` |

## Not in this pull request

The unsynced notice, server-rendered progress and the call sites need the workspace and catalog screens (WP-5.x, not on this stack). They follow once those merge. `sync.ts` takes the two server actions as ports, because client code may not import a server folder.

## Verification

`prettier`, `eslint`, `tsc`, attribution check, `vitest --coverage`: exit 0, 59 files, 1073 tests. Removing the lock between a pass and a sync fails 3 tests. Not run: `pnpm test:db` and a real IndexedDB (no Docker, no browser test yet; the fake in the test is hand-written). The `ON CONFLICT DO NOTHING` path against the insert-only grants is reasoned, not run.

## Reviews (one round)

- Code review: CHANGES REQUIRED. Major (a stale account list could remove a pass stored during a sync) fixed with the lock and a test. Minors fixed: retry timer cleared first; code 23503 no longer means "refused" (a deleted account would have dropped lessons on the device); test titles. Open minor: no wiring test for the action wrapper.
- Security review: APPROVE, no blocker or major. Fixed: device entries and the server schema refuse NUL and out-of-range values, so one bad entry cannot block every sync. Open: a pgTAP test for `ON CONFLICT DO NOTHING`; up to 100 single inserts after a refused batch (rate limit not checked); backdated `completedAt` (confirm streak does not trust it, WP-6.2).

## Decisions with a safe default

- A. A pass sends `recordCompletion` first and falls back to the retrying sync, as the spec says.
- B. A refused lesson is dropped from the device, not kept.
- C. Another session wrote a second device store in the same checkout; this one was kept because it is atomic across tabs.
