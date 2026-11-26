# WP-7.2 code review 2

Of 3b6df36 (part 2: axe on the remaining workspace states, the keyboard walkthrough, reduced motion, the throttled load profile, `docs/reports/day-7-quality.md`). The reviewer was a fresh-context subagent and read-only. The implementer saved this report and wrote the answers. One round (speed mode). No security review: no sign-in, database, runtime or header change.

## Code review 2 (`code-reviewer`): CHANGES REQUIRED, 3 MAJOR, 7 MINOR

Found sound: the `profile` project and the `notDesktop` list (`playwright test --list` puts the profile spec only in `profile`, 2 tests); eslint, prettier and `tsc --noEmit` exit 0; no attribution in the commit.

| # | Severity | Finding | Answer |
|---|---|---|---|
| 1 | MAJOR | The report marks NFR-A11Y-01 done for the admin area, but the admin pages were not walked by keyboard. | Fixed. The row says the admin area has automated checks only. |
| 2 | MAJOR | The open reset dialog and a revealed hint had no axe check, yet the report claimed every reachable state. | Fixed. axe runs on the open dialog, and a new test reveals a hint and runs axe (screens in `WP-7.2/workspace-hint-*`). |
| 3 | MAJOR | "Lesson title readable" was the title in the DOM, not on screen. | Fixed. The test waits for the title to be visible and records first contentful paint (740 ms), and asserts it comes before Python is ready. The report names both numbers for what they are. |
| 4 | MINOR | The walkthrough did not assert the named stops of the report's table, nor one stop for the two output tabs. | Fixed. The test asserts the 17 stops by name, in order, and the count. |
| 5 | MINOR | Focus on the page itself was skipped anywhere in the walk. | Fixed. It is skipped only after Next lesson, the last control; anywhere else it fails the test. |
| 6 | MINOR | "Python restarting" during the time-limit axe check was a race. | Fixed. The new worker's files are held, as in the output-limit journey, and the test asserts `data-python="restarting"` before axe. |
| 7 | MINOR | The warm-up Run was not recorded. | Fixed. All six Runs are recorded and asserted, the first one included (13 ms). |
| 8 | MINOR | NFR-PERF-06's Check-of-ten half is the Node runner's, not the browser's. | Fixed. The row and section 4 say so. |
| 9 | MINOR | The commands were not reproducible. | Fixed. The report gives the committed project commands, the exact settings of the local config, and the command that computes the production byte counts (rerun: same output). |
| 10 | MINOR | "Lighthouse's mobile profile" is true only of its simulated values. | Fixed in the spec's comment and the report. |

## After the fixes

- Chromium, one test per process: `workspace-a11y-runtime.spec.ts` 8 of 8, `workspace-load-profile.spec.ts` 2 of 2. `workspace-runtime.spec.ts` 17 of 17 on 3b6df36 (not changed since).
