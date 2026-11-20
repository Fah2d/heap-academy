**Part 1 of WP-6.2.** The pure streak and XP functions only. Branched from `main`; it does not depend on WP-6.1 part 1.

## What and why

FR-PRG-05's streak and FR-PRG-04's XP total, as pure functions in `src/domain` (architecture section 8.1, ADR-0012), with property tests for day boundaries and daylight saving.

## Work package

- Work package: WP-6.2 XP and streak, part 1.
- Requirements covered: FR-PRG-05, the pure part of FR-PRG-04, NFR-MAINT-02 for `src/domain`.
- Time box 2 hours for the whole package. Part 1 took from 07:31 to 07:34 on 2026-11-20, plus the description and review.

## What changed

| Item | Where |
|---|---|
| `TimeZone`, a branded IANA zone in canonical spelling, and `parseTimeZone`, which accepts only a named zone the platform knows, refuses fixed offsets such as `+03:00`, and returns the canonical name (`europe/london` gives `Europe/London`). | `src/domain/streak.ts` |
| `localDay(instant, zone)`: the local calendar date as a day count, from `Intl.DateTimeFormat` with the zone (Gregorian calendar, Latin digits). No offset arithmetic (architecture section 14). | `src/domain/streak.ts` |
| `streak(completedAt, now, zone)`: `current`, consecutive local days with a completion ending today or yesterday, otherwise 0; and `longest`. A completion later than `now` counts as made at `now`, as the database's trigger stores it; a time outside the range of a date is not counted. | `src/domain/streak.ts` |
| `totalXp(completions)`: the sum of each completion's XP. | `src/domain/streak.ts` |
| The seeded property testing helper, the same file as on `wp/3.3-grader`. | `scripts/testing/property.ts` |

## How it was verified

`pnpm verify` at the docs commit:

```
 Test Files  9 passed (9)
      Tests  398 passed (398)
```

Coverage of `src/domain` (the gate is lines 90, branches 90), from `vitest run src/domain --coverage`:

```
Statements   : 100% ( 35/35 )
Branches     : 100% ( 14/14 )
Functions    : 100% ( 11/11 )
Lines        : 100% ( 32/32 )
1 file fully covered.
```

pnpm's install check failed on the sandbox's store lock, as on WP-6.1 part 1; the run went on with WP-3.1's installed `node_modules`.

**Tests added** in `src/domain/streak.test.ts`, property tests over 500 seeded cases each, in nine zones (New York, London, Lord Howe with its half-hour shift, Santiago with its change at midnight, Sydney, Kolkata, Kiritimati at UTC+14, Pago Pago at UTC−11, UTC) on dates across 2026 and 2027:

- the streak equals its definition on days from an independent oracle (the platform's `en-CA` date string for the zone), for completions and `now` near local midnight;
- every 2026 daylight saving change of the nine zones, swept in 5-minute steps for 26 hours either side: the local day moves by 0 or 1, only at local midnight or across a change that skips it, and equals the oracle;
- the streak equals its definition, computed on whole day numbers, for any set of days, with up to two hours of jitter each day;
- order and repeats on one day change nothing; current is never more than longest;
- 24 hours after local noon is always the next local day, across every daylight saving change;
- a minute before and after local midnight, on the New York spring-forward and fall-back dates, and in Kolkata, are consecutive days; one instant is two different days in Kiritimati and Pago Pago;
- a streak ending yesterday counts, one ending the day before does not; a completion just before and just after midnight is a two day streak;
- a completion after now counts as now; `NaN`, both infinities and times outside the date range are not counted; unknown zones and fixed offsets are refused; zones come back in canonical spelling;
- XP is additive and independent of order, and 10 + 25 + 5 is 40.

## Screens

None.

## Reviews

- Code review 1 (`docs/reports/reviews/WP-6.2-part-1/code-review-1.md`, which covers all three part-1 branches), of f82bc85: CHANGES REQUIRED, with 3 majors and 3 minors. All are fixed; the response is at the end of the file.
- Five mutants each fail a test, among them the reviewer's offset arithmetic at `now`.
- The fixes were not reviewed again.

## Owner actions now due

1. Decide where a guest's XP comes from. The device's `Completion` (WP-6.1) holds no XP, and if it comes from the lesson's current XP, a guest and an account can differ after a lesson's XP is edited.

## Deviations from the plan or the spec

- **A completion later than `now` counts as `now`.** FR-PRG-05 does not say; this matches the trigger that clamps `completed_at` (architecture section 8.3), so a device clock slightly behind the server's loses no day.
- **`EST5EDT` and `Etc/GMT+3` are accepted.** Both are names in the IANA database; only fixed offsets are refused.

## What is left for part 2

The display in the header, on the course page and in the completion moment; XP from the account's completion rows (and from the lessons for a guest); the learner's time zone from the profile; the check that a guest and an account with the same history show the same numbers.

## Risks and rollback

Nothing calls these functions yet.

## Definition of Done

- [ ] Every "Done when" line is met. **Not met:** XP from the completion rows and the guest/account comparison are part 2. The property tests pass and domain coverage meets the threshold.
- [x] FR-PRG-05 and FR-PRG-04 have passing tests that name their IDs.
- [x] `pnpm verify` passes.
- [x] No stub, dead control, placeholder, or invented number.
- [x] No new tables. No new server actions.
- [ ] Every reviewer blocker is fixed. See Reviews.
- [x] No AI attribution in any commit or in this description.

## Opening this pull request

`gh` cannot reach GitHub from the sandbox. From your terminal in the repository root:

```sh
gh pr create --draft --base main --head wp/6.2-streak-part-1 \
  --title "feat(domain): WP-6.2 part 1 streak and XP" \
  --body-file docs/reports/pull-requests/WP-6.2-part-1.md
```
