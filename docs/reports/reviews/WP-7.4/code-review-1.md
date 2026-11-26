# WP-7.4 code review 1

Of f6b0d69 (part 1: journeys J-1 to J-4 at phone and laptop sizes). The reviewer was a fresh-context subagent and read-only. The implementer saved this report and wrote the answers. One round (speed mode). No security review: tests and Playwright projects only, no runtime, sign-in, database or header change.

## Code review 1 (`code-reviewer`): CHANGES REQUIRED, 4 MAJOR, 6 MINOR

Found sound: routing of both spec files to the right projects; J-1 holds Python's files until after the code is typed; J-4 checks Stop, the restart and a second Run; the phone flows tap to the right view before each step; no skipped test, suppression or raised timeout; no attribution in the commit.

| # | Severity | Finding | Answer |
|---|---|---|---|
| 1 | MAJOR | The phone journeys run only in Chromium (Pixel 7); WP-7.4 asks for three engines at phone sizes. | Fixed. New projects `phone-workspace-webkit` (iPhone 13) and `phone-workspace-firefox` (Desktop Firefox at 390 by 740 with touch; Firefox has no mobile mode) run `workspace-phone.spec.ts` and `journeys-phone.spec.ts`. Not run here: Firefox and WebKit are not installed and speed mode is Chromium only. |
| 2 | MAJOR | CI runs only `chromium`, `stack` and `gallery`, so none of the new tests run in CI. | Not changed: the owner already holds this decision (WP-7.2 description, "For the owner" 1). Named again in the WP-7.4 description with the project list. |
| 3 | MAJOR | J-2 never checks the actual output, skips Run, and checks Next by address only. | Fixed. J-2 now runs the starter first (its status checked through `words.runFinished(0)`), then checks the failed case shows "Expected output", "Your output", the wrong answer's "Hello, Sara!" and the expected text. The header comment says why Next is checked by address. |
| 4 | MAJOR | J-3 checks only that "42" appears; an implementation that never echoes passes. | Fixed. The console must hold exactly `First? 4\nSecond? 2\n42\n` where the program pauses, or `First? Second? 42\n` on the batch path, and the status names the line count (3 or 1). |
| 5 | MINOR | No journey at 768 to 1023 px, and J-2 to J-4 never at 320 px. | Fixed. The wide spec runs at 768, 1024 and 2560 px; the phone spec at 320, 375 and 430 px (FR-WSP-13's widths) in the `phone-workspace*` projects instead of the `phone*` ones. |
| 6 | MINOR | `completeFirst(10)`, "Run finished" and "Your task" are hard-coded. | "Run finished" now comes from `words.runFinished`. The XP and "Your task" stay as in `workspace-runtime.spec.ts`: the XP constant lives in a server component that e2e cannot import, and "Your task" is the example lesson's own heading. |
| 7 | MINOR | The wide journeys repeat `workspace-runtime.spec.ts` step for step, and the helpers exist in three files. | Kept. `workspace-runtime.spec.ts` checks each state's focus, announcements and screenshots at 1280 px; the journeys walk the whole path at the other widths and engines. Moving the old spec onto the shared helpers is churn this part does not need. The phone J-1 duplicate is removed: J-1 on a phone stays in `workspace-phone.spec.ts`, which now also runs on WebKit and Firefox. |
| 8 | MINOR | Stale comments: `workspace-phone.spec.ts` names a `j01-video-to-first-run.spec.ts` that does not exist; `playwright.config.ts` says one file per journey. | Fixed in both. |
| 9 | MINOR | One test per process is not how CI runs these. | Not possible here: Chromium starts in this sandbox only with `--single-process`, which allows one page per browser, so a second test in the same run fails at `newPage`. CI's normal run is the check. |
| 10 | MINOR | Mixed requirement tags. | Fixed: every journey test carries `[NFR-COMPAT-01] [NFR-COMPAT-03]`. |
