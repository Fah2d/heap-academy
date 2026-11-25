# Day 7 quality: accessibility and performance (WP-7.2)

Every number here comes from the command next to it, run on branch `wp/7.2-a11y-perf` on 2026-11-25. "Not measured" means what it says. Browser runs are Chromium only (speed mode, 2026-11-24), one test per Playwright process, against `next dev --webpack` on `localhost` with the fake public values of `.env.example`.

## Summary

| Requirement | Result | Evidence |
|---|---|---|
| NFR-A11Y-01 WCAG 2.2 AA by automated checks and a keyboard walkthrough | Workspace and admin area: done. Other pages: automated checks only. | Sections 1 and 2 |
| NFR-A11Y-02 zero serious or critical axe findings on every page and workspace state | Zero on every state checked (list below). Four workspace states not reached in a browser. | Section 1 |
| NFR-A11Y-03 keyboard alone, focus visible, trapped only in dialogs | Pass in the workspace | Section 2 |
| NFR-A11Y-04 outcomes announced in live regions | Pass (component tests) | `src/features/workspace/components/workspace.test.tsx`, `src/features/workspace/client/workspace-view.test.ts`, in `pnpm verify` |
| NFR-A11Y-05 320 px without page scroll | Pass where checked | `e2e/workspace-phone.spec.ts` (320 px), `e2e/phone.spec.ts`, `e2e/catalog-gallery.spec.ts`, `e2e/shell.spec.ts`; not rerun in this part |
| NFR-A11Y-06 touch targets 44 by 44 px | Pass where checked | The same phone and gallery specs; not rerun in this part |
| NFR-A11Y-07 AA contrast on tokens, syntax colors included | Pass | `src/ui/tokens/contrast.test.ts`, in `pnpm verify` |
| NFR-A11Y-08 motion stops under reduced motion | Pass | Section 3 |
| NFR-PERF-01 Lighthouse mobile 90+, LCP 2.5 s or less, CLS 0.1 or less | **Not measured** | No preview deployment of this branch; section 5 |
| NFR-PERF-03 lesson readable and editor typeable before Python is ready | Pass, throttled | Section 4 |
| NFR-PERF-06 Run 150 ms or less, Check of ten 500 ms or less | Pass | Section 4 |

## 1. axe (NFR-A11Y-02)

Command, for each spec, one test per process (`<line>` is each `test(` line):

```
npx playwright test -c <config: Desktop Chrome, baseURL http://localhost:3272, project "chromium"> e2e/<spec>:<line>
```

| Spec | Result on this branch | States with axe |
|---|---|---|
| `e2e/workspace-runtime.spec.ts` | 17 of 17 passed | ready; check failed; passed and complete; save-progress invitation; waiting for input; stopped (new); output over the limit and restarting; keyboard run and leave (new); markup printed as text (new); program too large; loading; load failed; syntax error; reset with Undo; saved code restored (new); unsupported browser; long program |
| `e2e/workspace-a11y-runtime.spec.ts` (new) | 7 of 7 passed | error while running (`ZeroDivisionError`); time limit (5 s) with Python restarting; a test case out of input (`input_ended`) |
| `e2e/admin-gallery.spec.ts` | 46 of 46 (part 1, on 8c41dae) | all 34 admin states and the list |

Earlier packages' axe specs, not rerun in this part: `catalog-gallery`, `gallery`, `phone`, `shell`, `sign-in`, `workspace-phone`, `workspace-preview-runtime`, and the stack journeys (CI only; no Docker here).

Not reached in a browser, with the reason:

- `memory` and `crashed` errors: no program makes Pyodide run out of memory or the worker crash on demand. They use the same error component as the states above, which axe passed.
- "Server unreachable" and "unsynced completion": the completion sync is WP-6.1, on the other line (`night-b`), not on this branch.

**Finding: CI does not run the workspace's axe checks.** `.github/workflows/ci.yml` line 226 runs `--project=chromium --project=stack --project=gallery`. The workspace specs run in `runtime-chromium` and `phone-workspace`, which no CI job runs, so NFR-A11Y-02's "required check" does not cover the workspace yet. This part does not change CI; the pull request asks the owner.

## 2. Keyboard walkthrough (NFR-A11Y-03)

`e2e/workspace-a11y-runtime.spec.ts`, 1280 px, Python ready. Tab from the top of the page until focus returns to the skip link:

| Order | Landmark | Stops |
|---|---|---|
| 1 | page start | Skip to the main content |
| 2 | header | Heap Academy |
| 3 | Main navigation | Courses |
| 4 | Account navigation | Sign in |
| 5 | main | Back to Python basics |
| 6 | Instructions | the code example (scrollable), Copy code |
| 7 | Hints | Show a hint |
| 8 | Your code | Reset code, the editor (Escape, then Tab, leaves it) |
| 9 | main (actions) | Run, Check, Stop |
| 10 | Output | the selected tab of Console and Tests (one Tab stop), Program output (scrollable) |
| 11 | Lessons | Previous lesson, Next lesson |

This is the reading order of `03-experience.md` section 6.1. Every stop draws the 2 px solid focus ring; the editor draws it on its outer element. Also checked: after a failed Check the summary takes focus, Tab reaches each test case, and Enter and Space open and close it; the reset dialog keeps Tab inside it, Escape closes it, and focus returns to Reset code. Next.js's development indicator is skipped; it is not in a production build.

Not walked in this part: the catalog, sign-in, profile and admin pages by keyboard alone (their specs check focus on single controls only), and the phone layout's view tabs beyond `e2e/workspace-phone.spec.ts`.

## 3. Reduced motion (NFR-A11Y-08)

With `prefers-reduced-motion: reduce` emulated, after a Check has changed the page's state, no element of `/dev/workspace` has a transition or animation duration above 0 (`e2e/workspace-a11y-runtime.spec.ts`, passed). The primitives gallery has the same check (`e2e/gallery.spec.ts`, WP-1.4). The rule is `src/ui/base.css`.

## 4. Load profile and speed (NFR-PERF-03, NFR-PERF-06)

Command: `npx playwright test -c <config as above> e2e/workspace-load-profile.spec.ts:<line> --reporter=json`. The `profile` project in `playwright.config.ts` runs it.

Throttled phone profile: 412 by 915 px, round trip 150 ms, 1.6 Mbit/s down, 750 kbit/s up, processor 4 times slower, cache off. Times from the navigation's start, on the **development server**:

| Measure | Value |
|---|---|
| Lesson title readable | 350 ms (442 ms on a second run) |
| Editor took typing (after opening the Code view) | 45,605 ms |
| Python ready | 77,796 ms |
| Page bytes over the network | 9,143,077 |
| Python runtime bytes over the network | 6,428,872 |
| Python's state when the typing landed | `loading` |

NFR-PERF-03 holds: the lesson reads and the editor takes typing while Python is still loading. The 45.6 s is the development server's unminified page code (about 9.1 MB) at 1.6 Mbit/s; it is not a production number. The production build's client code for `/learn/[course]/[lesson]` is 10 files, 1,159,463 bytes, 361,690 bytes gzipped (computed from `.next/server/app/learn/[course]/[lesson]/page_client-reference-manifest.js` and the route's build manifest after `pnpm build`, polyfills left out). At 1.6 Mbit/s that is about 1.8 s of transfer. That figure is computed, not measured in a browser: the production lesson route needs the database, and the development-only workspace page is not in a production build.

Laptop, no throttling, Python ready, a one-line Run from the press to the output on screen, measured in the page, after one warm-up Run: 11, 11, 11, 10, 5 ms. The limit is 150 ms. Check of ten test cases: `src/grader/node-runner/runner.test.ts` asserts 500 ms or less, in `pnpm verify`.

## 5. Not measured

- NFR-PERF-01, Lighthouse mobile on the home, course list and course pages: needs a preview deployment of this branch (`07-operations.md`), and Lighthouse is not installed here. Owner: run it on the preview once the line is deployed, or name a waiver.
- The throttled profile on a production build of the lesson route: needs the local stack (Docker) or a preview with seeded content.
- Firefox and WebKit: speed mode.
