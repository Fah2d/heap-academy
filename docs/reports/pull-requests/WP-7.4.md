<!-- No AI attribution in this description or in any commit (CLAUDE.md rule 15). -->

**Base: `wp/7.2-a11y-perf` at cf6dde1.** It holds the 2.2 to 5.4 line, the runtime branches and WP-7.2's fix that lets the development server hydrate at `127.0.0.1`, which these tests need. This pull request merges after it; until then review the commits after cf6dde1. WP-7.4 part 1 of 2.

## What

Part 1, journeys J-1 to J-4 at every size (NFR-COMPAT-01, NFR-COMPAT-03):
- `e2e/journeys.ts`: each journey written once. On a phone it taps to the view each step needs; above 768 px it clicks. Each journey checks the page never scrolls sideways and runs axe on its screens.
  - J-1: the lesson reads at once, typing lands while Python's files are held, Run shows the output.
  - J-2: Run, Check, a failed case with expected and actual output, a fix, a pass, the completion line, Next's address.
  - J-3: `input()` twice; the console holds each prompt with the echoed answer (or the batch path's output).
  - J-4: Stop ends a runaway loop, Python comes back without a reload, the next Run works.
- `e2e/journeys-phone.spec.ts`: J-2 to J-4 by touch at 320, 375 and 430 px. J-1 on a phone stays in `workspace-phone.spec.ts`.
- `e2e/journeys-wide-runtime.spec.ts`: J-1 to J-4 at 768, 1024 and 2560 px in the `runtime-*` projects (one per engine).
- `playwright.config.ts`: `phone-workspace-webkit` (iPhone 13) and `phone-workspace-firefox` (Firefox at 390 px with touch) run both phone specs, so the phone journeys have all three engines.

Part 2 (next): J-5, J-6, J-8, J-10, J-12 and J-13 on the stack in all three engines, once the 6.x branches settle.

## How it was verified

- `pnpm verify`: exit 0, `Test Files  130 passed (130)`, `Tests  2327 passed (2327)`.
- Chromium, one test per process, against `next dev --webpack` on `127.0.0.1:3301`: `phone-workspace` 9 of 9 (J-2 to J-4 at three widths), `runtime-chromium` 12 of 12 (J-1 to J-4 at three widths). `playwright test --list` shows `phone.spec.ts` still only in the `phone*` projects.
- Not run: Firefox and WebKit (not installed here; speed mode), the stack journeys (no Docker), a normal multi-test run (this sandbox's Chromium needs `--single-process`, one page per browser).

## Reviews

Code review 1: CHANGES REQUIRED, 4 MAJOR, 6 MINOR. Three majors and five minors fixed; one major (CI) is the owner's open decision; two minors answered without change. Report: `docs/reports/reviews/WP-7.4/code-review-1.md`. No security review: tests and test projects only.

## antislop Delivery Gate report

antislop active: during (session override, CLAUDE.md rule 5). No visible change to any page; tests only. Block 1 PASS: zero axe violations on every journey screen walked. Blocks 2 to 4: no change.

## For the owner

1. **CI runs none of these.** `.github/workflows/ci.yml` line 226 runs `--project=chromium --project=stack --project=gallery`. WP-7.4's "Done when" needs a job on `main` with `runtime-chromium runtime-firefox runtime-webkit phone-workspace phone-workspace-webkit phone-workspace-firefox` and `playwright install` for all three. Recommended: add that job on `main` and before launch. Default: CI unchanged.
2. The phone pass on real phones, including the in-app browsers, in `docs/reports/spikes/app-devices.md`.

## Decisions (safe defaults)

1. The journeys run on `/dev/workspace` (the example lesson, no database). The real lesson route as a guest needs the stack; part 2 covers it with the stack journeys.
2. Firefox's phone project is a desktop Firefox at a phone's size with touch, because Playwright's Firefox has no mobile mode.
3. `workspace-runtime.spec.ts` keeps its own J-2 to J-4 at 1280 px with screenshots and focus checks; it is not moved onto the shared journeys.
