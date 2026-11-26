<!-- No AI attribution in this description or in any commit (CLAUDE.md rule 15). -->

**Base: `wp/7.4-journeys` at dbd91b2, with `origin/wp/6.3-profile-page` at a50ed1a merged in** (it holds WP-6.1's sync and the profile page the journeys walk). This pull request merges after WP-7.4 and WP-6.3; until then review the commits after the merge commit deb8398. WP-7.4 part 2b.

## What

J-5 (save my progress) and J-6 (another device), `docs/spec/01-requirements.md` section 2, FR-PRG-02, FR-PRG-03:
- `e2e/progress-journey.spec.ts` (`stack` project, production build and local stack). Three browser contexts are three devices on one account:
  1. Device A signs in, passes the second lesson (the account holds it), signs out, and its course page shows 0 of 2: sign-out clears the device (owner decision 2026-11-24).
  2. Device B, a guest, passes the first lesson (1 of 2; the account still has one row), then signs in. The account then holds both rows with their XP, the course page shows 2 of 2 and both lessons completed, and the profile shows 20 XP and one-day streaks.
  3. Device C, a fresh Pixel 7 at 375 px, signs in and shows the same course page and the same profile numbers.
  - axe on every course page and profile visit.
- `e2e/stack-course.ts`: the two-lesson course writer, taken out of `lesson-route-journey.spec.ts`, which now uses it.
- `e2e/journeys.ts`: `passLesson`, and `noAxeViolations` exported.
- `e2e/sign-in-helpers.ts`: `latestCode` waits for an email newer than the one before the request, so an address signing in a second time never gets its spent code.

## How it was verified

- `pnpm verify`: exit 0, `Test Files  142 passed (142)`, `Tests  2471 passed (2471)` (pnpm warns its pre-run install cannot take the store lock in this sandbox; the checks ran after it).
- `playwright test --list --project=stack`: 29 tests in 9 files, the new one among them.
- **Not run:** the journey itself, and `lesson-route-journey.spec.ts` after the refactor (no Docker here). Their first run is CI's `stack` job. Firefox and WebKit (speed mode).

## Reviews

Code review 3: CHANGES REQUIRED, 2 MAJOR, 10 MINOR; all but one minor fixed. Report: `docs/reports/reviews/WP-7.4/code-review-3.md`. No security review: tests only.

## antislop Delivery Gate report

antislop active: during (session override, CLAUDE.md rule 5). No page changed; tests only. Block 1: axe runs on the course page (guest, signed out, signed in) and the profile. Blocks 2 to 4: no change.

## Decisions (safe defaults)

1. The provider sends one code a minute to one address, so the journey takes about three minutes; its time limit is 360 s. It waits on the provider's own `auth.users` timestamps, not a timer.
2. Both streaks must read "1 day". A run that crosses midnight would fail; that is rarer than a check that accepts a wrong count.
3. The course is removed by SQL while published, as `lesson-route-journey` already does. The catalog journey compares the cached course list with the database, so a `stack` run with both in flight could see a stale list. Not changed here; if CI shows it, the catalog check should compare only its own courses.
4. J-10 (delete my account) waits for account deletion, which is blocked on the owner (the service-role secret, the notice address, the "recent sign-in" rule).

## For the owner

1. Open a draft pull request from `wp/7.4-journeys-part-2b` with this body, and check CI's `stack` job passes `progress-journey.spec.ts` and `lesson-route-journey.spec.ts`.
