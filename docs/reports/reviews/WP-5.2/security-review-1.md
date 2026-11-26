# Security review 1: WP-5.2 part 2

Reviewer: `security-reviewer`, fresh context, read-only, on `wp/5.2-workspace-laptop` at b386309 (range 49546a8..b386309), 2026-11-24.

Verdict: **CHANGES REQUIRED**, 1 MAJOR, 4 MINOR. No blocker. The reviewer found the code sound against T-07, T-21, T-25, rule 4 and rule 9, and checked the learn route's client chunks for the example solution, `lesson_solutions`, secret key names, `eval(` and `new Function` (none found).

## Findings and what was done (bd36501)

| Finding | What was done |
|---|---|
| MAJOR: no component tests with injection payloads for the new output surfaces (T-07). | `workspace-output.test.tsx`: markup, a terminal title sequence and a clear-screen sequence in standard output, standard error, the prompt, Python's error message, a test case's name, input, follow-up code, expected output, actual output and hint, the name follow-up code missed, and a hint. Each asserts no `img` or `script` element, no escape or bell character, and an unchanged document title. The browser test `[T-07]` now runs on the real workspace (`/dev/workspace`). |
| MINOR: an impossible lesson address still queried the course (T-25). | The course is read only after the lesson is known to be published. Test: `publishedCourse` is not called when the lesson read answers null. |
| MINOR: oversized code or batch input was refused silently; the device store has no cap. | Refusal: shown with the reason (see code review 1, MAJOR 3). Decision (safe default): saved code is not capped, because refusing to save would lose the learner's typing; a program over the limit is refused when run, with the reason. |
| MINOR: the name follow-up code missed skipped the console filter. | Passed through `consoleText`. With the filter removed, the T-07 test fails. |
| MINOR, for WP-5.4: device storage cannot be turned off (the admin preview), has no `onversionchange` handler, and the fallback to memory is silent. | Not changed here; listed for WP-5.4 in the description (FR-PRG-01 belongs to it). |
