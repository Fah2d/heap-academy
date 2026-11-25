<!-- No AI attribution in this description or in any commit (CLAUDE.md rule 15). -->

**Base: `wp/5.4-progress-preview` at a15f858.** That branch holds the 2.2 to 5.4 line and the runtime branches, which WP-7.2 checks. This pull request merges after them; until then review the commits after a15f858. WP-7.2 parts 1 and 2 of the accessibility and performance pass. The numbers are in `docs/reports/day-7-quality.md`.

## What

Part 1, the admin area:
- 1e95ee3: one admin state per gallery page (`/dev/admin?state=<state>`), axe on all 34. Before, about 20 editors on one page made axe report `landmark-unique`, and `e2e/admin-gallery.spec.ts` had never passed.
- a28300c: **saving an existing course's details did nothing** (WP-4.1 code). The strict schema refused the whole course handed to the form. Now only the four fields are parsed.
- 51c9b24, 8c41dae: Stop gives focus back to Validate; a renamed chapter keeps its heading; the `Button` primitive removes React Aria's spent pending announcement when it unmounts (`role-img-alt`).

Part 2, the workspace (3b6df36, 30b720b):
- axe on every workspace state a browser can reach: four journeys gained it (stopped, keyboard, markup as text, saved code restored), and `e2e/workspace-a11y-runtime.spec.ts` adds an error while running, the time limit with Python held in "restarting", a test case out of input, a revealed hint, and the open reset dialog.
- The keyboard walkthrough (NFR-A11Y-03): Tab through the whole workspace, 17 named stops in the reading order of `03-experience.md` section 6.1, each with the 2 px focus ring; test cases open and close by Enter and Space; the reset dialog holds focus until Escape, then gives it back.
- Reduced motion on the workspace (NFR-A11Y-08): no transition or animation after a Check.
- `e2e/workspace-load-profile.spec.ts`, its own `profile` project (Chromium, DevTools throttling): NFR-PERF-03 on a throttled phone, and NFR-PERF-06's one-line Run in the browser.

## How it was verified

- `pnpm verify` on 30b720b: exit 0, `Test Files  130 passed (130)`, `Tests  2326 passed (2326)`.
- `pnpm build` on 3b6df36 (part 2 changes tests only): exit 0. `check-bundle`: `No server variable (RESEND_API_KEY, HEAP_RELEASE) in 23 files under .next/static.` `check-static`: exit 0.
- Chromium, one test per process, `next dev --webpack` on `localhost`: `workspace-a11y-runtime` 8 of 8, `workspace-runtime` 17 of 17, `workspace-load-profile` 2 of 2; part 1: `admin-gallery` 46 of 46.
- Throttled phone (150 ms, 1.6 Mbit/s, CPU x4), development server: first paint 740 ms, editor typing 45.4 s, Python ready 77.7 s. Typing lands while Python is `loading`. The 45 s is the dev server's 9.1 MB of unminified code; the production lesson route's client code is 361,690 bytes gzipped (computed, not measured). One-line Run: 3 to 13 ms (limit 150).
- Not run: Lighthouse (NFR-PERF-01; no preview deployment, Lighthouse not installed), the stack journeys and `pnpm test:db` (no Docker), Firefox and WebKit (speed mode).

## Reviews

Code review 1 (part 1): CHANGES REQUIRED, 1 BLOCKER, 6 MINOR; fixed or answered (`docs/reports/reviews/WP-7.2/code-review-1.md`). Code review 2 (part 2): CHANGES REQUIRED, 3 MAJOR, 7 MINOR; all fixed in 30b720b (`code-review-2.md`). No security review: no sign-in, database, runtime or header change.

## antislop Delivery Gate report

antislop active: during (session override, CLAUDE.md rule 5). No visible change to a learner page in part 2 (tests and a report only). Block 1 PASS: zero axe violations on all checked states (R-25, R-39); focus visible on every stop and never lost. Blocks 2 to 4 PASS: no new technique, no copy, no motion change.

## For the owner

1. **CI does not run the workspace's browser checks.** `.github/workflows/ci.yml` line 226 runs `--project=chromium --project=stack --project=gallery`; `runtime-chromium`, `phone-workspace` and `profile` never run, so NFR-A11Y-02's required check misses the workspace. Recommended: add `--project=runtime-chromium --project=phone-workspace` there. Default: CI is left unchanged; this branch does not edit it.
2. Lighthouse on the preview for the home, course list and course pages (NFR-PERF-01), or a written waiver.
3. a28300c fixes WP-4.1's course editor. If WP-4.1 merges first, cherry-pick it there.

## Decisions (safe defaults)

1. The admin gallery takes the catalog gallery's one-state-per-page pattern; each state is still checked as a whole page.
2. axe waits only for CSS transitions, not looping animations.
3. The `Button` primitive finds React Aria's announcement by its structure (`role="log"`, then `role="img"` with `aria-labelledby`); if that changes, axe reports it again.
4. `memory` and `crashed` are not reached in a browser (no program triggers them on demand); they share the error component axe passed. The sync states are WP-6.1's, on the other line.
5. The load profile is measured on the development page; the production lesson route needs the database. Its numbers are labeled as development numbers.
