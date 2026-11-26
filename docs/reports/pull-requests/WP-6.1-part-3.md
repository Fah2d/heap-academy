**Part 3 of WP-6.1.** Branch `wp/6.1-sync-wiring`: `wp/5.4-progress-preview` (215251b) with `wp/6.1-synced-progress` merged in. Review the commits after the merge. Merges after the WP-5.x pull requests and WP-6.1 part 2. Draft.

## What

- One device store. Part 2 and WP-5.4 each had one over the same IndexedDB database, at different versions, so part 2's would have fallen back to memory. Part 2's two files are removed; WP-5.4's store gained the sync operations.
- The sync runs for a signed-in learner, started by the header's account control: on load, when the tab shows, and after each pass (FR-PRG-02, FR-PRG-03, FR-PRG-06; architecture section 10).
- Sign-out clears the completions on this device. An answer from a sync that started before the clear changes nothing, in this tab or another.
- The workspace says when a completed lesson has not reached the account, and removes the notice once it has (FR-PRG-06).
- Batches are limited to 100 completions and 900,000 bytes (Next refuses an action body over 1 MB). Code over 20,000 characters is cut before sending.

## Verification

`pnpm verify`: exit 0, 129 files, 2317 tests. `pnpm build` with CI's fake values, `check-bundle`, `check-static`: exit 0. Not run: `pnpm test:db`, any browser test, J-5 and J-6.

## Reviews (one round: code, security)

Both: CHANGES REQUIRED. Fixed in the following commit, and not reviewed again: a sync in flight at sign-out restoring the list; a failed clear returning the rows; success read before the commit; batch size; missing tests for mounting and the visibility trigger. The open findings are decisions 1 to 3.

The unsynced notice (8f7e125) had its own code review: APPROVE, three minor test and timing points left open.

Delivery Gate for the notice: existing `Notice` primitive (warning kind, text label, polite announcement), words in `src/messages`, no new color, layout or motion. Not seen in a browser: widths, contrast on screen and screen reader are not verified.

## Decisions for the owner (safe defaults)

1. Saved code (the editor's text per lesson) is **not** cleared at sign-out, so the next person on a shared device can read it. Recommended: clear it too. It cannot be recovered once cleared, so it waits for you.
2. Device completions carry no account. If a session expires without Sign out, unsent passes go to whoever signs in next on that device, as a guest's passes do (FR-PRG-03). Binding rows to an account changes that design.
3. Sign-out does not try to send unsent passes first, and clears them on the button press even if the sign-out request then fails.
4. The progress index exports `SignedInProgressSync`, which imports the server actions when it renders, so client code can still load the index.

## Later change

`wp/5.4-progress-preview` at fea2606 was merged in. The course list and course page now also read the device list again when a sync rewrites it (found in review: on a new device they showed nothing completed until the tab was shown again). `pnpm verify` steps pass on the merged line; the build was run on the branch stacked above.

## Server-rendered progress (added 2026-11-25)

The root layout reads a signed-in learner's completed lesson IDs with their own session, and the course list, course page and home page are rendered with them; the device's list is added in the browser. The read is one attempt under the session client's time limit; if it fails, progress comes from the device. Sign-out now makes mounted pages read the cleared list.

One code review (CHANGES REQUIRED: retries could hold a page about 13 s, no layout test; both fixed, not reviewed again) and one security review (APPROVE). `pnpm verify`: 138 files, 2391 tests. `pnpm build`, `check-bundle`, `check-static`: pass. Not run: `pnpm test:db`, browser tests, J-6.

5. A second tab keeps the account's marks after sign-out elsewhere until it loads again (display only). Recommended: accept.
6. A failed server read writes no log line, because a layout has no route name to log. Recommended: add with the error reporting in WP-7.3.

## Risks and rollback

Unmerged branch; nothing to roll back. The sync against a real Supabase and a real IndexedDB is not verified.
