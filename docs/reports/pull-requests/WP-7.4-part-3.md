<!-- No AI attribution in this description or in any commit (CLAUDE.md rule 15). -->

**Base: `main` at 23cfb4b and `wp/7.2-a11y-perf` at 376fba2, both merged in, with `wp/7.4-journeys-part-2b` folded in.** WP-7.4 part 3. Merge after WP-7.2. Part 2b's J-5 and J-6, and part 2c's J-10, reached `main` through the 6.x branches. Folding 2b in took `main`'s newer copies of its four files, so `wp/7.4-journeys-part-2b` can be closed.

## What

- **Two flaky tests seen on CI, fixed at the cause:**
  - `e2e/admin-gallery.spec.ts`, the lesson editor's states (3283059). `fill` ran before the page hydrated, and the field read `## Changed## Ask, then answer`. With the CPU slowed 12 times this failed 3 of 3, with that exact value. `openExample` now waits until every code editor is built, which an effect does. Then 5 of 5 passed.
  - `src/grader/node-runner/runner.test.ts`, FR-RUN-04 (a71998e). Four CI runs failed (`main` 45838216937, 45835181452 and 45776998779; `wp/6.3-stack-legal` 45823406773). The second case printed `False True`, because the first case's 0 ms timer had not fired yet. It was a race, not a time-out. The callback is now a microtask, which always runs after the case's answer and before the next case. The test still requires the callback to run and its effects to be undone. 5 of 5 passed.
- **The database journeys in Firefox and WebKit**:
  - The new `stack-firefox` and `stack-webkit` projects run every `*-journey` spec.
  - The lesson route journey now waits until its new course is on the site. The cached course list answered 404 for it in both engines.
  - The review screens test checks the saved screens only in the projects that save them.
- `e2e/page-weight-journey.spec.ts` (from WP-7.2) stops reading responses before it returns. It failed once here: Python's files kept arriving after the check, and their bodies were read after the page closed.
- `chapter-list.test.tsx` waits for the chapter add to answer. `pnpm verify` failed it once under load; it passed 5 of 5 alone.

## How it was verified

- `pnpm verify`: exit 0, `Test Files  153 passed (153)`, `Tests  2737 passed (2737)`.
- e2e as CI runs it (`--project=chromium --project=stack --project=gallery`, after `supabase db reset`, `CI=true`): `232 passed`, `1 skipped` (a `test.fixme`), exit 0.
- `--project=stack-firefox --project=stack-webkit --workers=2`: `53 passed`, `14 failed`, `2 skipped`, `1 did not run`.
  - **WebKit: every stack journey passed.**
  - **Firefox: 14 failed**, with `Page crashed` during `axe` or `fill`, plus one `toHaveURL` after a crash. The failures were the same with the default number of workers, with 2, and with 1 (`sign-in-journey.spec.ts`: 2 passed, 1 crashed).
- Not run: the runtime and phone projects (`runtime-*`, `phone-workspace-*`) in this part. They were walked in parts 1 and 2a.

## For the owner

1. **Firefox crashes on the production build's pages.** It happens in every database journey that types or runs axe, and it is not load. It was not investigated further here, because it is past this package's time box. Recommended: a work package that opens one crashing test's trace (`playwright show-trace`) and tries the newest Playwright Firefox. Default: `stack-firefox` stays in the config, not in CI, as the way to reproduce it.
2. **CI still runs only Chromium.** WP-7.4's "Done when" needs a job on `main` with `stack-webkit`, `stack-firefox`, the `runtime-*` projects and the `phone-workspace-*` projects, and `playwright install` for all three engines. Default: CI unchanged.
3. `wp/7.2-a11y-perf` carries the page-weight defect fixed here. It shows only when the lesson page's late fetches outlive the check. Merge 7.2 first, then this branch, which holds the fix.
4. The owner's phone pass on the production site (`docs/reports/spikes/app-devices.md`).

## Decisions (safe defaults)

1. The admin gallery waits for built code editors, the only sign the page's code has run that its examples share. The course editor's examples have no code editor, and no flake was seen there.
2. In Firefox and WebKit the review screens test checks only that the committed screens exist. Comparing modification times across projects would race with a Chromium run in the same invocation.
