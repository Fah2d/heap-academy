# WP-7.4 code review 3 (part 2b: J-5 and J-6)

Reviewer: `code-reviewer`, fresh context, on ed6b241 (branch `wp/7.4-journeys-part-2b`). The reviewer is read-only, so the implementer saved its report here; the findings are its words, shortened, with what was done about each.

Verdict: **CHANGES REQUIRED**. No BLOCKER, 2 MAJOR, 10 MINOR.

## Findings and what was done

| # | Severity | Finding | Done |
|---|---|---|---|
| 1 | MAJOR | `progress-journey.spec.ts`: the one-minute wait between code emails ran from before the sign-in started, so the third send could be refused as `rate_limited`; it also slept on a timer, which `.claude/rules/testing.md` forbids. | Fixed: the spec polls `auth.users` until the address's last confirmation or magic link email is more than 61 s old, the provider's own record. No timer. |
| 2 | MAJOR | No axe check on any screen of the journey; it is the only coverage of `/profile` with numbers and of the signed-in and signed-out course page. | Fixed: axe on every course page and profile visit, through `noAxeViolations`, now exported from `e2e/journeys.ts`. |
| 3 | MINOR | The streak check accepted any value but 0. | Fixed: both streaks must be "1 day"; a run across midnight would fail (named in the comment). |
| 4 | MINOR | "A reload doubles nothing" cannot fail: the table's key allows one row per lesson. | Comment reworded; the extra row count after the reload removed. |
| 5 | MINOR | The title cited FR-PRG-04, whose acceptance is the forged request. | Removed from the title; the database tests cover the forged request. |
| 6 | MINOR | Device contexts were not closed when the test failed, so a retrying sync could write after the cleanup. | Fixed: contexts are closed in `afterEach`, before `afterAll`. |
| 7 | MINOR | The test user was never deleted. | Fixed: `afterAll` deletes the user; completions and profile cascade. |
| 8 | MINOR | Removing a published course by SQL leaves it in the public content cache, which the catalog journey compares against the database. `lesson-route-journey` already did this. | Not changed: named in the description as a cross-spec risk for the `stack` job. |
| 9 | MINOR | The literal `"10"` repeated `LESSON_XP`. | Fixed. |
| 10 | MINOR | Laptop size only. | Fixed: device C (J-6) is a Pixel 7 at 375 px. |
| 11 | MINOR | `latestCode` could return the previous, spent code for an address that signed in before. | Fixed: `signInWithCode` notes the newest message before asking, and `latestCode` waits for a newer one. |

## Checked and correct (reviewer)

Strings and selectors match `src/messages`; `/profile` has one `dl`. Sign-out clears the device (`account-buttons.tsx`), so a broken clear fails the signed-out count. Cleanup order respects `on delete restrict`. The `lesson-route-journey` refactor keeps the same course. No check weakened; no attribution.

## Not checked

The journey was not run (no Docker here). The provider's rate-limit timestamps are the reviewer's reading of the auth server, not observed.
