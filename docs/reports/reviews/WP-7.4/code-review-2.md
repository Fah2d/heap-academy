# WP-7.4 code review 2

Of 5a329ca (part 2a: journeys J-1 to J-4 as a guest on the seeded lesson's real address). The reviewer was a fresh-context subagent and read-only. The implementer saved this report and wrote the answers. One round (speed mode). No security review: tests only, with no runtime, sign-in, database or header change.

## Code review 2 (`code-reviewer`): CHANGES REQUIRED, 1 MAJOR, 6 MINOR

Found sound:
- **The seed matches the journeys.** Title, the "Your task" heading, a starter that prints nothing, a wrong answer that fails only `works-for-omar`, 10 XP, and test cases the grader's schema accepts.
- **No interference with other stack journeys.** j8, j13, lesson-editor, course-structure and catalog-journey each make their own course under a timestamped slug. admin-gate's write to `say-hello-by-name` must be refused.
- **The Pyodide gate works on the production build.** The production build serves Pyodide under `/_runtime/pyodide/`, so J-1's gate applies there too.
- **Phone J-1 is right.** The Lesson view comes first, and Run selects the Output view.
- **No weakened checks.** The commit carries no attribution.

| # | Severity | Finding | Answer |
|---|---|---|---|
| 1 | MAJOR | J-2's last step, "Go to the next lesson", never runs anywhere: on the seed `next` is null, and on `/dev/workspace` only the href is checked. Make a two-lesson course through `sql`, as `catalog-journey.spec.ts` does, and click Next. | Fixed. Each worker writes its own course (`journeys-<time>`) with two published lessons, both the example lesson's content, through `save_lesson` as validated, and removes it at the end. J-2 passes the first lesson, taps or clicks Next, and checks the address and the second lesson's heading. The spec no longer uses the seed. |
| 2 | MINOR | The last-lesson branch passes even if the lesson nav is gone (FR-WSP-11: disabled, not hidden). | Fixed. A J-2 on the last lesson checks that the "This is the last lesson" link has `aria-disabled="true"`. |
| 3 | MINOR | Nothing asserted depends on the database. | Fixed. `Target.course`: J-1 on the real address checks the back link's text (the course title from the database) and its href `/courses/<slug>`. |
| 4 | MINOR | The `[NFR-COMPAT-01]` tag and the comment overstate what runs: `stack` is Chromium only. Use a real Pixel 7 emulation. | Fixed. The phone size is a Pixel 7 (its user agent, pixel density, mobile mode and touch) at 375 px. The tag is now `[NFR-COMPAT-03]`, and the comment says the stack project is Chromium only for now. |
| 5 | MINOR | `completeFirst(10)` is shared by targets whose XP comes from different sources. | Fixed. `Target.xp`: each target names its own value. |
| 6 | MINOR | "Both hold the example lesson" is not exact for the seed. | Fixed. The comment now names what every target shares. The seed is no longer a target, and the spec writes the example lesson's own instructions and hint. |
| 7 | MINOR | J-3 takes the batch path whenever the field shows, so a broken interactive path in Chromium would pass. | Fixed. In Chromium, J-3 now requires the interactive path. Locally, with this check, J-3 passed in Chromium at all 7 sizes tried (320 to 2560 px). |
