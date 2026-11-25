**Part of WP-6.3 and WP-6.2.** The profile page with XP and streak. Stacked on `wp/6.1-sync-wiring`.

## What and why

A signed-in learner can see their display name, XP, and current and longest streak at `/profile` (FR-PRF-01, FR-PRG-04, FR-PRG-05), and can change their display name. The browser's time zone is stored so the streak counts the learner's days (FR-PRF-02).

## What changed

- `/profile` (not indexed). A visitor is sent to sign in and back. A read that fails ends on the shared error page with Try again. A new account sees zeros and a link to the courses.
- "Profile" in the header for a signed-in learner.
- Display name editing in place: 1 to 40 characters, trimmed; control and text-reordering characters are refused (`src/domain/display-name.ts`).
- `updateProfile` server action: time zone, display name, or both. It reports whether the stored value changed; the page renders again only then, and sends the time zone at most once per visit. A saved name always renders the page again.
- `profile` added to the log route segments and to the indexing table.
- Reads and the update use the caller's own session, so row level security decides.

- Progress per course (FR-PRF-01): each published course with at least one completed lesson, with a link and a count.
- Account section with Sign out (experience spec 5.5), the same form as the header's.

- Course page: XP earned of total beside the completed count (FR-CRS-05, WP-6.2).

## Verification

- prettier, eslint, tsc, attribution, vitest with coverage (138 test files): pass.
- `pnpm build`, `check-bundle`, `check-static`: exit 0.
- Not run: browser tests, `pnpm test:db`, anything against a real database.

## Reviews

One round each (speed mode). Code review: CHANGES REQUIRED. Security review: CHANGES REQUIRED. Both found the same fault: for zones the server spells differently (`Asia/Kolkata`), the page could update and refresh without end. Fixed; the fix was not reviewed again.

A second round of each, on the name editing and the merges: code review CHANGES REQUIRED (a sync did not refresh course progress), security review CHANGES REQUIRED (no markup test for the name). Both fixed; the fixes were not reviewed again.

Left open (minor): an invalid Save leaves focus on the button; a direct data API call can store a name the action would refuse (only its owner sees it); other invisible characters can sit inside a visible name; after guest progress syncs on sign-in, an already open profile shows the earlier numbers until a reload.

Third round, on per-course progress and sign-out: code review CHANGES REQUIRED (no test of the whole page), security review APPROVE. The test is added, not reviewed again.

Fourth round, code review of the course page XP line: CHANGES REQUIRED (no Delivery Gate, decision 5 departs from the spec, test titles and cases). The tests are fixed, not reviewed again.

antislop Delivery Gate: **not run** for the profile page or the course page header. No screenshots, axe or browser check; those need the local stack.

## Decisions taken (safe defaults)

1. XP and streak appear first on the profile. The header shows no numbers: the experience spec (section 4) lists no XP or streak there, while the delivery plan says "in the header". Proposed spec change: remove "header" from WP-6.2.
2. The profile reads only the account's completions, so it needs no decision on guest XP.
3. A display name may hold any letters, numbers, or symbols, in any script. The database limit (1 to 40) is the only rule it enforces itself; the character rules are the action's.

4. Only courses with a completed lesson are listed. A course read that fails shows the error page for the whole profile.

5. The course page counts the XP each completed lesson carries now, for guests and accounts alike. After a lesson's XP is edited, it differs from the profile, which sums the stored completion values. This departs from architecture section 8.1 and FR-CRS-05 ("Values equal derived progress") until you accept it as a spec change, or ask for completion XP to be carried to the page.

## Not in this part

Account deletion (blocked on the service-role secret, the notice address and the "recent sign-in" rule).
