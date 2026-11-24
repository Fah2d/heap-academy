**Part 3 of WP-6.1.** Branch `wp/6.1-sync-wiring`: `wp/5.4-progress-preview` (215251b) with `wp/6.1-synced-progress` merged in. Review the commits after the merge. Merges after the WP-5.x pull requests and WP-6.1 part 2. Draft.

## What

- One device store. Part 2 and WP-5.4 each had one over the same IndexedDB database, at different versions, so part 2's would have fallen back to memory. Part 2's two files are removed; WP-5.4's store gained the sync operations.
- The sync runs for a signed-in learner, started by the header's account control: on load, when the tab shows, and after each pass (FR-PRG-02, FR-PRG-03, FR-PRG-06; architecture section 10).
- Sign-out clears the completions on this device. An answer from a sync that started before the clear changes nothing, in this tab or another.
- Batches are limited to 100 completions and 900,000 bytes (Next refuses an action body over 1 MB). Code over 20,000 characters is cut before sending.

## Verification

`pnpm verify`: exit 0, 129 files, 2314 tests. `pnpm build` with CI's fake values, `check-bundle`, `check-static`: exit 0. Not run: `pnpm test:db`, any browser test, J-5 and J-6.

## Reviews (one round: code, security)

Both: CHANGES REQUIRED. Fixed in the following commit, and not reviewed again: a sync in flight at sign-out restoring the list; a failed clear returning the rows; success read before the commit; batch size; missing tests for mounting and the visibility trigger. The open findings are decisions 1 to 3.

## Decisions for the owner (safe defaults)

1. Saved code (the editor's text per lesson) is **not** cleared at sign-out, so the next person on a shared device can read it. Recommended: clear it too. It cannot be recovered once cleared, so it waits for you.
2. Device completions carry no account. If a session expires without Sign out, unsent passes go to whoever signs in next on that device, as a guest's passes do (FR-PRG-03). Binding rows to an account changes that design.
3. Sign-out does not try to send unsent passes first, and clears them on the button press even if the sign-out request then fails.
4. The progress index exports `SignedInProgressSync`, which imports the server actions when it renders, so client code can still load the index.

## Not in this pull request

The unsynced notice and server-rendered progress for a signed-in learner.

## Risks and rollback

Unmerged branch; nothing to roll back. The sync against a real Supabase and a real IndexedDB is not verified.
