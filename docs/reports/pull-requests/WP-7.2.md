<!-- No AI attribution in this description or in any commit (CLAUDE.md rule 15). -->

**Base: `main` at 23cfb4b, merged in (37d9677).** WP-7.2 parts 1 to 4 of the accessibility and performance pass. The numbers are in `docs/reports/day-7-quality.md`.

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

Part 3, the keyboard elsewhere (4aa6d03, 9b49a74):
- `e2e/keyboard.ts`: Tab through a whole page; it must reach every shown control once, in document order, never lose focus, and each stop must draw the full ring of DESIGN.md section 6 (solid, 2 px, opaque `--color-focus`, offset 2 or -2 px, in the viewport). The workspace walk now uses the same rule.
- Walked: the catalog states and all 34 admin states (`gallery`), sign-in with its in-app browser state, the not-found page and the shared error page (production build), the admin preview, and the three phone views with the arrow keys between them.
- **The development server's pages were never hydrated at 127.0.0.1**, which is how every development-server project opens them. `next.config.ts` now sets `allowedDevOrigins: ["127.0.0.1"]`, in development only.

Part 4, after `main` was merged in (37d9677):
- **Every page downloaded the lesson workspace and CodeMirror** (6c5c98b, 491b23a). The root layout's feature indexes re-export the lesson page, and Next.js takes a layout's client components from its whole import graph. `"sideEffects": ["*.css", "./src/domain/schema.ts"]` in `package.json` lets the bundler drop the unused re-exports; the home page's transfer fell from 474 to 274 KiB. `e2e/page-weight-journey.spec.ts` guards it. The first version listed only the style sheets, which dropped the Zod setting in `schema.ts`; the lesson editor's script policy test caught it, and `scripts/repository.test.ts` now guards the list.
- The "Unsynced completion" state (FR-PRG-06) gets its test, axe and screenshot (9fb2a21: `e2e/unsynced-journey.spec.ts`, `docs/reports/screens/WP-7.2/workspace-unsynced-1280.png`).
- Lighthouse 12.8.2, mobile, on a local production build: performance 95, 96, 96 and accessibility 100 on `/`, `/courses` and the course page. LCP 2.8 to 2.9 s misses the 2.5 s target; see the owner list.
- The keyboard walk now covers every admin example, including the one a shared component renders (fc02b22), and the in-app sign-in test no longer clicks before hydration (1086dee).

## How it was verified

Part 4, on 740a8f0 plus this description:
- `pnpm verify`: exit 0, `Test Files  153 passed (153)`, `Tests  2737 passed (2737)`.
- e2e as CI runs it (`--project=chromium --project=stack --project=gallery`, after `supabase db reset`, `CI=true`): `222 passed`, `1 skipped` (a `test.fixme` from `main`), exit 0. The run before the Zod fix failed `e2e/lesson-editor-journey.spec.ts:128` on `script-src eval`; the run after it failed once on `e2e/sign-in.spec.ts:80`, fixed in 1086dee (then 120 of 120 with `--repeat-each=5`).
- Mutations: with no `sideEffects`, the three public page-weight tests fail and the lesson-page control passes; with only `*.css`, the new repository test fails.
- Lighthouse: the figures of `day-7-quality.md` section 5, measured again on the corrected build.
- Not run: `pnpm test:db` (no database change in part 4), Firefox and WebKit, Lighthouse on the preview.

Parts 1 to 3:

- `pnpm verify` on 9b49a74: exit 0, `Test Files  130 passed (130)`, `Tests  2327 passed (2327)`.
- `pnpm build` on 3b6df36 (part 2 changes tests only): exit 0. `check-bundle`: `No server variable (RESEND_API_KEY, HEAP_RELEASE) in 23 files under .next/static.` `check-static`: exit 0.
- Chromium, one test per process, `next dev --webpack` on `localhost`: `workspace-a11y-runtime` 8 of 8, `workspace-runtime` 17 of 17, `workspace-load-profile` 2 of 2; part 1: `admin-gallery` 46 of 46. Part 3: `keyboard-gallery` 44 of 44 at both `127.0.0.1` and `localhost`; on the production build, sign-in and not-found 40 of 40, the error page 1 of 1; preview 3 of 3; phone 5 of 5. Mutations (no outline; a transparent `--color-focus`) fail a walk.
- Throttled phone (150 ms, 1.6 Mbit/s, CPU x4), development server: first paint 740 ms, editor typing 45.4 s, Python ready 77.7 s. Typing lands while Python is `loading`. The 45 s is the dev server's 9.1 MB of unminified code; the production lesson route's client code is 361,690 bytes gzipped (computed, not measured). One-line Run: 3 to 13 ms (limit 150).
- Not run: Lighthouse (NFR-PERF-01; no preview deployment, Lighthouse not installed), the stack journeys and `pnpm test:db` (no Docker), Firefox and WebKit (speed mode).

## Reviews

Code review 1 (part 1): CHANGES REQUIRED, 1 BLOCKER, 6 MINOR; fixed or answered (`docs/reports/reviews/WP-7.2/code-review-1.md`). Code review 2 (part 2): CHANGES REQUIRED, 3 MAJOR, 7 MINOR; all fixed in 30b720b (`code-review-2.md`). Code review 3 (part 3): CHANGES REQUIRED, 2 MAJOR, 6 MINOR; all fixed or answered in 9b49a74 (`code-review-3.md`). Code review 4 (part 4): CHANGES REQUIRED, 1 BLOCKER, 1 MAJOR, 3 MINOR; all fixed (`code-review-4.md`). No security review: no sign-in, database, runtime or header change; `allowedDevOrigins` affects only the development server and names only the loopback address.

## antislop Delivery Gate report

antislop active: during (session override, CLAUDE.md rule 5). No visible change to a page in parts 2 and 3 (tests, a development setting, reports). Block 1 PASS: zero axe violations on all checked states (R-25, R-39); focus visible on every stop and never lost. Blocks 2 to 4 PASS: no new technique, no copy, no motion change.

## For the owner

1. **CI does not run the workspace's browser checks.** `.github/workflows/ci.yml` line 226 runs `--project=chromium --project=stack --project=gallery`; `runtime-chromium`, `phone-workspace` and `profile` never run, so NFR-A11Y-02's required check misses the workspace. Recommended: add `--project=runtime-chromium --project=phone-workspace` there. Default: CI is left unchanged; this branch does not edit it.
2. Lighthouse on the preview for the home, course list and course pages (NFR-PERF-01), or a written waiver.
3. **LCP is 2.8 to 2.9 s against 2.5 s** on the local build. Recommended: preload only the 400 font weight, then measure on the preview (it changes how headings first paint, a `DESIGN.md` question). Default: no change; a written waiver if the preview misses too.
4. **`wp/7.1-security-canary` carries the keyboard walk's gap** that code review 4 found (`gallery-lesson-empty` never walked). Its copy of `e2e/keyboard-gallery.spec.ts` is replaced by this branch's when both merge; merge 7.1 first, then this branch, and take this branch's file in the conflict.

## Decisions (safe defaults)

1. The admin gallery takes the catalog gallery's one-state-per-page pattern; each state is still checked as a whole page.
2. axe waits only for CSS transitions, not looping animations.
3. The `Button` primitive finds React Aria's announcement by its structure (`role="log"`, then `role="img"` with `aria-labelledby`); if that changes, axe reports it again.
4. `memory` and `crashed` are not reached in a browser (no program triggers them on demand); they share the error component axe passed. The sync states are WP-6.1's, on the other line.
5. The load profile is measured on the development page; the production lesson route needs the database. Its numbers are labeled as development numbers.
6. The sign-in walks replace Cloudflare's bot challenge script with a stand-in; the widget's own keyboard behaviour is not verified.
7. `allowedDevOrigins` is set here, not in its own branch, because the part 3 walks fail without it in CI's `gallery` project.
