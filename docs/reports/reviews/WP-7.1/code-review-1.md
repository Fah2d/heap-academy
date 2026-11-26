# WP-7.1 code review 1

Of 45d78bc (part 1: the canary test of T-21, `e2e/canary-journey.spec.ts`). The reviewer was a fresh-context subagent and read-only. The implementer saved this report and wrote the answers. One round (speed mode). No security review: the change is one test file and touches no sign-in, database, runtime or configuration code.

## Code review 1 (`code-reviewer`): CHANGES REQUIRED, 1 BLOCKER, 1 MAJOR, 6 MINOR

Found sound: the fixture SQL, traced by hand against the constraints, the validation trigger and `save_lesson` (lengths, test case shape, the validated save before publishing, quoting); the body reads; no attribution in the commit.

| # | Severity | Finding | Answer |
|---|---|---|---|
| 1 | BLOCKER | With `RSC: 1` and `maxRedirects: 0`, every direct payload fetch read only the empty 307 to `?_rsc`, so half the direct fetches searched empty strings. | Fixed in 2dea27a. Both fetches follow redirects, and the payload must be `text/x-component`. Checked on a local `next start` of this build: all 11 kinds of page answer `text/x-component` behind the redirect. |
| 2 | MAJOR | Nothing showed the walk saw the canary content: error pages, a hidden course, an empty publishable key (401 on every Data API call) or a failed lesson page all passed. | Fixed in 2dea27a. The shown course and lesson must answer 200 and carry the course title in the browser, in the HTML and in the payload; the lesson must show its title; the Data API's `courses` and `lessons` must answer 200 and hold the canary course and lesson; the publishable key must not be empty; both canary courses and all four lessons must exist. |
| 3 | MINOR | `/admin/courses` is not a route; the course editors were not visited. | Fixed: `/admin/courses/<id>` for both canary courses, `/admin/courses/new`, `/admin/setup`, `/admin/verify`. |
| 4 | MINOR | Titles wrote `T-21` outside brackets (`.claude/rules/testing.md`). | Fixed: `[T-21]` first. |
| 5 | MINOR | The worker bundle `public/_runtime/worker/` was not scanned. | Fixed: scanned beside `.next/static`, and each must hold JavaScript. A planted file there fails the test. |
| 6 | MINOR | The seed solution is not secret: the example's public instructions show it. | Fixed: the needle is the seed's wrong answer only, as a whole program in three spellings. |
| 7 | MINOR | The published canary course can disturb `catalog-journey` (count read twice) and `course-structure-journey` (moves the first course) in a parallel worker. | Partly fixed: the canary course sits at position 900, last in the list. The count race is the same one `catalog-journey`'s own published courses already carry; left as is. |
| 8 | MINOR | `networkidle` on every page waits for Pyodide and Turnstile. | Fixed: `networkidle` only on the published lesson, for the worker's own fetches; other pages wait for `load`. |

Out of scope, for the owner: `src/features/admin/index.ts` re-exports `AdminStateGalleryServer`, so the admin gallery's sample programs from `src/messages/gallery.ts` ship in a production admin client chunk, against `next.config.ts` ("no route, no bundle"). Not lesson content, so not a T-21 leak. The first version of the needles hit it.
