<!-- No AI attribution in this description or in any commit (CLAUDE.md rule 15). -->

**Base: `wp/7.2-a11y-perf` at cf6dde1.** It holds the 2.2 to 5.4 line (the catalog, the lesson workspace, the admin area) that this test walks. This pull request merges after it; until then review the commits after cf6dde1. WP-7.1 part 1 of the security pass: the canary test of T-21 only.

## What and why

`e2e/canary-journey.spec.ts` (`stack` project, so CI's `e2e` job runs it on every pull request) is the T-21 canary of `06-security-privacy.md` section 4:
- It writes a published course whose published lesson has a unique token in its solution, its wrong answer's code and its wrong answer's label; a draft and an archived lesson in that course; and a draft course with a draft lesson. Each hidden item carries its own token in every field a learner would otherwise read.
- A guest, then a learner signed in with an email code, opens every page they can reach, the hidden lesson and course addresses, and every admin address (both course editors, all four lesson editors and previews, setup, verify, new course). Searched: every text response the browser receives (HTML, payloads, scripts, the worker's fetches); each page fetched again as HTML and as the router's payload; the sitemap, robots and health files; the Data API's `courses`, `chapters`, `lessons` and `lesson_solutions` as anonymous and with the learner's token. No token may appear.
- So that a walk of error pages cannot pass: the shown course and lesson must answer 200 and carry their public text in all three forms, the Data API must return the canary course and lesson, and a third test reads every token back as the database owner.
- The client bundles (`.next/static` and `public/_runtime/worker`) must not hold the seed lesson's wrong answer, which the source knows. The fixture tokens are written after the build, so only a response can carry them.

## Work package

- Work package: WP-7.1, part 1 of several. Covers T-21 (and NFR-SEC-03 for the responses). Not in this part: T-14's firewall rule and Postgres counters, the auth provider check, the dependency audit, the history secret scan, the production advisor run, the whole-application `security-reviewer` pass.
- Time: about 16 minutes of a 3.5 hour box.

## How it was verified

- `pnpm verify` on 2dea27a: exit 0, `Test Files  130 passed (130)`, `Tests  2327 passed (2327)`.
- Bundle test, on a fresh `next build` with the fake public values: `1 passed`. A planted file holding the seed wrong answer in `.next/static/chunks` and then in `public/_runtime/worker` each made it fail with that file named.
- The payload redirect: a local `next start` of this build answers `text/x-component` behind the redirect for all 11 kinds of page walked.
- Not run: the guest and learner walks and the read-back (no Docker or Postgres here). Their first run is CI's `stack` job. Firefox and WebKit (speed mode).

## Reviews

- code-reviewer: CHANGES REQUIRED, 1 BLOCKER, 1 MAJOR, 6 MINOR. All fixed in 2dea27a except half of one minor (the catalog count race that `catalog-journey`'s own courses already carry). Report: `docs/reports/reviews/WP-7.1/code-review-1.md`.
- security-reviewer: not asked (speed mode: one test file, no sign-in, database, runtime or configuration change).
- Open MAJOR findings for the owner to waive: none.

## Try it on the preview

Nothing changes on any page. Check that CI's `e2e` job passes `canary-journey.spec.ts` (4 tests).

## Owner actions now due

1. Open a draft pull request from `wp/7.1-security-canary` with this file as its body.
2. Found, not fixed here (outside T-21): `src/features/admin/index.ts` re-exports `AdminStateGalleryServer`, so the development gallery's sample programs (`src/messages/gallery.ts`) ship in a production admin client chunk, against `next.config.ts` ("no route, no bundle"). No lesson content is in it. Recommended: a small fix that keeps the gallery out of the feature's public index. Default: left for a later part.

## Decisions (safe defaults)

1. The canary writes its own content instead of adding tokens to the seed, which also runs on staging.
2. The seed's solution is not a bundle needle: the example lesson's public instructions show it. Its wrong answer is.
3. The canary course sits at position 900 so journeys that move the first course never take it.

## Deviations from the plan or the spec

None. WP-7.1 is split into parts; this is part 1.
