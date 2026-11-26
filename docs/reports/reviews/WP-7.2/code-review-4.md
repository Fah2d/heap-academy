# WP-7.2 code review 4

Of 37d9677..484a09f (part 4: `main` merged in, the bundle fix, the unsynced state, Lighthouse on a local production build). The reviewer was a fresh-context subagent and read-only. The implementer saved this report and wrote the answers. One round (speed mode). No security review: no sign-in, database, runtime or header change. The bundle fix touched the script policy's outcome, and its failure was found by the policy's own test.

## Code review 4 (`code-reviewer`): CHANGES REQUIRED, 1 BLOCKER, 1 MAJOR, 3 MINOR

Found sound: the unsynced test is deterministic (it aborts only POSTs that carry a `next-action` header, asserts that some were refused, waits on conditions, and finds exactly one stored completion); titles cite IDs; the page-weight test has a lesson-page control that keeps its marker honest; no AI attribution in the commits.

| # | Severity | Finding | Answer |
|---|---|---|---|
| 1 | BLOCKER | `"sideEffects": ["*.css"]` lets the bundler skip `src/domain/schema.ts`, whose only work is `z.config({ jitless: true })`. Zod's `new Function` probe returns and the script policy reports it (NFR-SEC-02). The commit and report claimed no module runs code that matters at import; that was false. | Fixed in 491b23a. The list names `./src/domain/schema.ts`. The full e2e run before the fix failed `e2e/lesson-editor-journey.spec.ts:128` on `script-src eval`, and the run after it passed it. `scripts/repository.test.ts` now fails if a module that calls `z.config` is not listed (it failed with only `*.css`). The report is corrected, and its Lighthouse "after" column measured again. |
| 2 | MAJOR | The keyboard walk read only the ids written inside each gallery part, so `gallery-lesson-empty`, made by `EmptyLessonExample` and shown on two pages, was never walked. | Fixed in fc02b22. The walk follows the gallery's own components that a part renders, and a new test fails unless the walked ids are every `<Example id=` in the file. The example is walked on both pages, 2 of 2 passed. The same gap is on `wp/7.1-security-canary`, which was already pushed; see the pull request's owner list. Exporting ids from the gallery module was not done: the gallery is a client module, and the spec reads its source. |
| 3 | MINOR | The page-weight test waits for network idle, which is time-based. | Fixed in fc02b22. It waits for the load event, which covers every script the HTML names, then until every script the browser has fetched has reached the listener. A prefetch started later than that is still not seen; on the three pages none is today, which the passing control and the failing mutation show. Mutation: with no `sideEffects`, the three public pages fail and the control passes. |
| 4 | MINOR | The unsynced comment said the page is shown again; the test only sends the event, and the sync also retries on a timer. | Fixed: the comment says both. |
| 5 | MINOR | The `/courses` "Before" cell had no weight. | Fixed: it and the course page's say "weight not recorded". |

## Found while fixing

The full e2e run after the fix failed once: `e2e/sign-in.spec.ts:80`, the in-app browser test, clicked "Show Google" before the page's code had run, so nothing happened. It now waits as the keyboard walk does, for the page to ask for the bot challenge (1086dee). The race was not reproduced alone; after the change the file passed 120 of 120 with `--repeat-each=5`.
