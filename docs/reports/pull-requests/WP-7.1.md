<!-- No AI attribution in this description or in any commit (CLAUDE.md rule 15). -->

**Base: `wp/7.2-a11y-perf` at cf6dde1.** It holds the 2.2 to 5.4 line (the catalog, the lesson workspace, the admin area) that this test walks. This pull request merges after it; until then review the commits after cf6dde1. WP-7.1 parts 1 and 2 of the security pass: the canary test of T-21, and the threat results with the recorded scans.

## What and why

`e2e/canary-journey.spec.ts` (`stack` project, so CI's `e2e` job runs it on every pull request) is the T-21 canary of `06-security-privacy.md` section 4:
- It writes a published course whose published lesson has a unique token in its solution, its wrong answer's code and its wrong answer's label; a draft and an archived lesson in that course; and a draft course with a draft lesson. Each hidden item carries its own token in every field a learner would otherwise read.
- A guest, then a learner signed in with an email code, opens every page they can reach, the hidden lesson and course addresses, and every admin address (both course editors, all four lesson editors and previews, setup, verify, new course). Searched: every text response the browser receives (HTML, payloads, scripts, the worker's fetches); each page fetched again as HTML and as the router's payload; the sitemap, robots and health files; the Data API's `courses`, `chapters`, `lessons` and `lesson_solutions` as anonymous and with the learner's token. No token may appear.
- So that a walk of error pages cannot pass: the shown course and lesson must answer 200 and carry their public text in all three forms, the Data API must return the canary course and lesson, and a third test reads every token back as the database owner.
- The client bundles (`.next/static` and `public/_runtime/worker`) must not hold the seed lesson's wrong answer, which the source knows. The fixture tokens are written after the build, so only a response can carry them.

Part 2: `docs/reports/day-7-security.md` maps every threat row to the tests whose titles cite it, and names the gaps: T-14's Postgres counters and T-17's J-10 are built on no branch. It records a gitleaks scan of every branch's history (no leaks, 1189 commits) and `pnpm audit` (1 moderate, in a development dependency only). Titles now cite `[T-02]` (the loop, flood and memory fixtures, J-4, the time limit), `[T-22]` (J-13) and `[T-25]` (the role grants test).

## Work package

- Work package: WP-7.1, parts 1 and 2. Covers T-21 (and NFR-SEC-03 for the responses), and the threat table's record. Not in these parts: T-14's firewall rule and Postgres counters (the counters need `pnpm test:db`, so Docker), the auth provider check, the production advisor run, `pnpm infra:verify` against production, the whole-application `security-reviewer` pass.
- Time: about 30 minutes of a 3.5 hour box.

## How it was verified

- `pnpm verify` on 2dea27a: exit 0, `Test Files  130 passed (130)`, `Tests  2327 passed (2327)`.
- Bundle test, on a fresh `next build` with the fake public values: `1 passed`. A planted file holding the seed wrong answer in `.next/static/chunks` and then in `public/_runtime/worker` each made it fail with that file named.
- The payload redirect: a local `next start` of this build answers `text/x-component` behind the redirect for all 11 kinds of page walked.
- Part 2, on 9a4b774: `pnpm verify` exit 0, `Test Files  130 passed (130)`, `Tests  2327 passed (2327)`. `gitleaks git --redact --no-banner --config .gitleaks.toml --log-opts="--all" .`: exit 0, `1189 commits scanned.`, `no leaks found`. `pnpm audit --audit-level high`: exit 0.
- Not run: the guest and learner walks and the read-back (no Docker or Postgres here). Their first run is CI's `stack` job. Firefox and WebKit (speed mode).

## Reviews

- code-reviewer: CHANGES REQUIRED, 1 BLOCKER, 1 MAJOR, 6 MINOR. All fixed in 2dea27a except half of one minor (the catalog count race that `catalog-journey`'s own courses already carry). Report: `docs/reports/reviews/WP-7.1/code-review-1.md`.
- code-reviewer, part 2: CHANGES REQUIRED, 1 MAJOR (the grants test already on this branch), 6 MINOR; all fixed in 9a4b774. Report: `code-review-2.md`.
- security-reviewer: not asked (speed mode: one test file, no sign-in, database, runtime or configuration change).
- Open MAJOR findings for the owner to waive: none.

## Try it on the preview

Nothing changes on any page. Check that CI's `e2e` job passes `canary-journey.spec.ts` (4 tests) and `database` passes with the retitled grants test.

## Owner actions now due

1. Open a draft pull request from `wp/7.1-security-canary` with this file as its body.
2. Found, not fixed here (outside T-21): `src/features/admin/index.ts` re-exports `AdminStateGalleryServer`, so the development gallery's sample programs (`src/messages/gallery.ts`) ship in a production admin client chunk, against `next.config.ts` ("no route, no bundle"). No lesson content is in it. Recommended: a small fix that keeps the gallery out of the feature's public index. Default: left as is. A separate gallery entry would need a change to the module boundary rule (`scripts/eslint/module-boundaries.mjs` allows a feature only through its `index.ts`), which is the owner's.

## Decisions (safe defaults)

1. The canary writes its own content instead of adding tokens to the seed, which also runs on staging.
2. The seed's solution is not a bundle needle: the example lesson's public instructions show it. Its wrong answer is.
3. The canary course sits at position 900 so journeys that move the first course never take it.

## Deviations from the plan or the spec

None. WP-7.1 is split into parts; these are parts 1 and 2.
