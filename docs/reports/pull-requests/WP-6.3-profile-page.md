**Part of WP-6.3 and WP-6.2.** The profile page with XP and streak. Stacked on `wp/6.1-sync-wiring`.

## What and why

A signed-in learner can see their display name, XP, and current and longest streak at `/profile` (FR-PRF-01, FR-PRG-04, FR-PRG-05), and can change their display name. The browser's time zone is stored so the streak counts the learner's days (FR-PRF-02).

## What changed

- `/profile` (not indexed). A visitor is sent to sign in and back. A read that fails ends on the shared error page with Try again. A new account sees zeros and a link to the courses.
- "Profile" in the header for a signed-in learner.
- Display name editing in place: 1 to 40 characters, trimmed; control and text-reordering characters are refused (`src/domain/display-name.ts`).
- `updateProfile` server action: time zone, display name, or both. It reports whether the stored value changed; the page renders again only then, and sends at most once per visit.
- `profile` added to the log route segments and to the indexing table.
- Reads and the update use the caller's own session, so row level security decides.

## Verification

- `pnpm verify`: exit 0, 132 test files, 2349 tests.
- `pnpm build`, `check-bundle`, `check-static`: exit 0.
- Not run: browser tests, `pnpm test:db`, anything against a real database.

## Reviews

One round each (speed mode). Code review: CHANGES REQUIRED. Security review: CHANGES REQUIRED. Both found the same fault: for zones the server spells differently (`Asia/Kolkata`), the page could update and refresh without end. Fixed; the fix was not reviewed again.

Left open (minor): after guest progress syncs on sign-in, an already open profile shows the earlier numbers until a reload.

## Decisions taken (safe defaults)

1. XP and streak appear first on the profile. The header shows no numbers: the experience spec (section 4) lists no XP or streak there, while the delivery plan says "in the header". Proposed spec change: remove "header" from WP-6.2.
2. The profile reads only the account's completions, so it needs no decision on guest XP.
3. A display name may hold any letters, numbers, or symbols, in any script. The database limit (1 to 40) is the only rule it enforces itself; the character rules are the action's.

## Not in this part

Per-course progress, sign-out section, account deletion (blocked on the service-role secret, the notice address and the "recent sign-in" rule), the course page summary (FR-CRS-05).
