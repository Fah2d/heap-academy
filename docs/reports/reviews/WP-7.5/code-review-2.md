# WP-7.5 code review 2

Reviewer: `code-reviewer`, fresh context. Commit 3f2ba8f (the answers to review 1). Verdict: CHANGES REQUIRED. Every review 1 fix was found in place, with a test that fails without it.

| # | Severity | Finding | Answer |
|---|---|---|---|
| 1 | MAJOR | `compare.ts`: `(?<!\d)\p{P}(?!\d)` kept any punctuation next to a digit, so "Your total is 42" for "Your total is 42." was no longer named a punctuation slip. The property test copied the same regex. | Fixed: `withoutPunctuation` keeps only punctuation inside a number: between two digits (3.5, 1,000), or a minus or point that starts one (-5, .5) and does not follow a letter or digit. Tests for the reviewer's four inputs and for `withoutPunctuation` itself, by example, not by its own pattern. |
| 2 | MINOR | The "under Python's message" test did not check order. | Fixed: the explanation is the message's next sibling, and the line button follows it. |
| 3 | MINOR | The chunk-failure test restored its spy and mock only on success. | Fixed: `onTestFinished`. |
| 4 | MINOR | The "same session" test passed no course, so no join was checked. | Fixed: a course with two lessons and one count row; the join is asserted. The no-course case keeps its own test. |
| 5 | MINOR | The near-miss property covered normalized mode only. | Added: in exact mode, a missing last line is exactly one non-blank line more, ending as the others do. |
| 6 | MINOR | `toBeInViewport()` on the editor did not show room above the keyboard. | Replaced, see design review 2, finding 3. |
