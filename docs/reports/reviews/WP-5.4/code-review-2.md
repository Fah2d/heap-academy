# WP-5.4 code review 2

Reviewer: `code-reviewer` subagent, fresh context. Commit: 8474a95 (the completion moment). Verdict: CHANGES REQUIRED, 4 MAJOR, 3 MINOR. Found fine: the words in `src/messages`, no em dash, logical CSS, the module boundary, the parsed lesson ID, no stale line after a new check, no double record.

Answers in 5359d9c.

| # | Severity | Finding | Answer |
|---|---|---|---|
| 1 | MAJOR | The recorded code was the code at the press of Check; a check pressed while Python loads starts later, with the code as it is then. | Fixed: `useRuntime` keeps the source each check starts with (`lastCheckedSource`), and the record uses it. Tests: the code typed after Check is not recorded; a later start's source is. The browser journey reads the stored row and finds the checked code. |
| 2 | MAJOR | The line did not follow `DESIGN.md` section 7 (pass icon, `--text-2xl`). | Fixed: `CheckmarkFilled` in the pass colour and `text-2xl`. Screens: `docs/reports/screens/WP-5.4/workspace-complete-{1280,768,375}.png`. |
| 3 | MAJOR | The summary was announced twice: the region's text grew when the completion arrived. | Fixed: the completion has its own `role="status"` region. Test: the summary region never holds the joined text; the second region holds the completion. |
| 4 | MAJOR | The notice said work stays until the tab closes; a reload loses it. | Fixed: "Your code and completed lessons are lost when you reload or leave this page." |
| 5 | MINOR | A Run before the device answered dropped the XP line for good. | Fixed: answers are dropped only after unmount; the line shows beside its own summary. Test with a held answer. |
| 6 | MINOR | "keeps one pass once" could not fail. | Fixed: the result goes to a run and back to the same check summary; one record. |
| 7 | MINOR | Nothing tested the durability check after a record. | Fixed: a test where the device turns to memory during the visit and the notice appears. |

Gate on 5359d9c: `pnpm verify` exit 0, `Test Files  123 passed (123)`, `Tests  2259 passed (2259)`; `pnpm build` exit 0, `check-bundle` and `check-static` exit 0. Browser, Chromium, one test per process against `next dev --webpack` on `localhost:3265`: 16 desktop and 4 phone journeys, 20 of 20 passed.
