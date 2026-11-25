# Day 7 quality: accessibility and performance (WP-7.2)

Every number here comes from the command next to it, run on branch `wp/7.2-a11y-perf` on 2026-11-25. "Not measured" means what it says. Browser runs are Chromium only (speed mode, 2026-11-24), one test per Playwright process, against `next dev --webpack` on `localhost` with the fake public values of `.env.example`.

## Summary

| Requirement | Result | Evidence |
|---|---|---|
| NFR-A11Y-01 WCAG 2.2 AA by automated checks and a keyboard walkthrough | Automated checks and a keyboard walkthrough on every page and admin state checked; the sign-in code step and the admin dialogs not walked | Sections 1 and 2 |
| NFR-A11Y-02 zero serious or critical axe findings on every page and workspace state | Zero on every state checked (list below). Four workspace states not reached in a browser. | Section 1 |
| NFR-A11Y-03 keyboard alone, focus visible, trapped only in dialogs | Pass on every page walked (section 2) | Section 2 |
| NFR-A11Y-04 outcomes announced in live regions | Pass (component tests) | `src/features/workspace/components/workspace.test.tsx`, `src/features/workspace/client/workspace-view.test.ts`, in `pnpm verify` |
| NFR-A11Y-05 320 px without page scroll | Pass where checked | `e2e/workspace-phone.spec.ts` (320 px), `e2e/phone.spec.ts`, `e2e/catalog-gallery.spec.ts`, `e2e/shell.spec.ts`; not rerun in this part |
| NFR-A11Y-06 touch targets 44 by 44 px | Pass where checked | The same phone and gallery specs; not rerun in this part |
| NFR-A11Y-07 AA contrast on tokens, syntax colors included | Pass | `src/ui/tokens/contrast.test.ts`, in `pnpm verify` |
| NFR-A11Y-08 motion stops under reduced motion | Pass | Section 3 |
| NFR-PERF-01 Lighthouse mobile 90+, LCP 2.5 s or less, CLS 0.1 or less | **Not measured** | No preview deployment of this branch; section 5 |
| NFR-PERF-03 lesson readable and editor typeable before Python is ready | Pass, throttled | Section 4 |
| NFR-PERF-06 Run 150 ms or less, Check of ten 500 ms or less | Run: pass in the browser. Check of ten: pass in the Node runner, not measured in the browser | Section 4 |

## 1. axe (NFR-A11Y-02)

With the committed configuration (it starts its own servers, or reuses them on ports 3100 to 3102):

```
pnpm exec playwright test --project=runtime-chromium e2e/workspace-runtime.spec.ts e2e/workspace-a11y-runtime.spec.ts
pnpm exec playwright test --project=profile e2e/workspace-load-profile.spec.ts --reporter=json
```

How the numbers below were produced: the sandbox here crashes a Chromium that runs several tests in one process, so each test ran alone, `npx playwright test -c "$TMPDIR/pw-a11y.config.ts" e2e/<spec>:<line>` for each `test(` line. That config is the committed `runtime-chromium` project's settings with `baseURL: "http://localhost:3272"` (a `next dev --webpack` started by hand), `workers: 1`, `launchOptions: { args: ["--no-sandbox", "--single-process"] }`, and the project named `chromium` so the screens are saved.

| Spec | Result on this branch | States with axe |
|---|---|---|
| `e2e/workspace-runtime.spec.ts` | 17 of 17 passed | ready; check failed; passed and complete; save-progress invitation; waiting for input; stopped (new); output over the limit and restarting; keyboard run and leave (new); markup printed as text (new); program too large; loading; load failed; syntax error; reset with Undo; saved code restored (new); unsupported browser; long program |
| `e2e/workspace-a11y-runtime.spec.ts` (new) | 8 of 8 passed | error while running (`ZeroDivisionError`); time limit (5 s), with Python held in "restarting"; a test case out of input (`input_ended`); a revealed hint; the open reset dialog |
| `e2e/admin-gallery.spec.ts` | 46 of 46 (part 1, on 8c41dae) | all 34 admin states and the list |

Earlier packages' axe specs, not rerun in this part: `catalog-gallery`, `gallery`, `phone`, `shell`, `sign-in`, `workspace-phone`, `workspace-preview-runtime`, and the stack journeys (CI only; no Docker here).

Not reached in a browser, with the reason:

- `memory` and `crashed` errors: no program makes Pyodide run out of memory or the worker crash on demand. They use the same error component as the states above, which axe passed.
- "Server unreachable" and "unsynced completion": the completion sync is WP-6.1, on the other line (`night-b`), not on this branch.

**Finding: CI does not run the workspace's axe checks.** `.github/workflows/ci.yml` line 226 runs `--project=chromium --project=stack --project=gallery`. The workspace specs run in `runtime-chromium` and `phone-workspace`, which no CI job runs, so NFR-A11Y-02's "required check" does not cover the workspace yet. This part does not change CI; the pull request asks the owner.

## 2. Keyboard walkthrough (NFR-A11Y-03)

`e2e/workspace-a11y-runtime.spec.ts`, 1280 px, Python ready. Tab from the top of the page until focus returns to the skip link. The test asserts each stop below by name, in this order, and nothing else:

| Order | Landmark | Stops |
|---|---|---|
| 1 | page start | Skip to the main content |
| 2 | header | Heap Academy |
| 3 | Main navigation | Courses |
| 4 | Account navigation | Sign in |
| 5 | main | Back to Python basics |
| 6 | Instructions | the code example (scrollable, named by its code), Copy code |
| 7 | Hints | Show a hint |
| 8 | Your code | Reset code, the editor (Escape, then Tab, leaves it) |
| 9 | main (actions) | Run, Check, Stop |
| 10 | Output | the selected tab of Console and Tests (one Tab stop), Program output (scrollable) |
| 11 | Lessons | Previous lesson, Next lesson |

This is the reading order of `03-experience.md` section 6.1. Every stop draws the 2 px solid focus ring; the editor draws it on its outer element. Focus that falls to the page itself before Next lesson fails the test. Also checked: after a failed Check the summary takes focus, Tab reaches each test case, and Enter and Space open and close it; the reset dialog keeps Tab inside it, Escape closes it, and focus returns to Reset code. Next.js's development indicator is skipped; it is not in a production build.

### Every other page (part 3)

`e2e/keyboard.ts` walks a whole page: it numbers every control a person can reach (shown, enabled, not inert, no negative tabindex), in document order, then presses Tab from where focus is until it wraps. The test passes only if the walk reached each control once, in that order, never fell to the page itself on the way, and found the same controls afterwards. Each stop must draw the ring of `DESIGN.md` section 6: solid, 2 px, the opaque colour of `--color-focus`, offset 2 px or -2 px, on a control shown in the viewport, read after its 160 ms colour transition. The workspace walk above uses the same ring rule. Mutations checked: the base outline set to `none`, and `--color-focus: transparent`, each fail a walk.

Commands, each test in its own process as in section 1 (a local config with the committed project's settings and the `baseURL` named):

| Spec (project) | Pages | Where run | Result |
|---|---|---|---|
| `e2e/keyboard-gallery.spec.ts` (`gallery`) | the catalog gallery, home with no course, empty course list, course list, course page, each at 375 and 1280 px; all 34 admin states at 1280 px, each waiting for its code editors | `next dev` at `127.0.0.1:3281` and at `localhost:3281` | 44 of 44 at each |
| `e2e/sign-in.spec.ts` (`chromium`) | `/sign-in` and `/sign-in?failed=google` at 375 and 1280 px; the in-app browser before and after "Show Google", focus moving to the Google button | production build, `next start` at `127.0.0.1:3290` | 5 of 5 new; with the other sign-in and not-found tests, 40 of 40 |
| `e2e/shell.spec.ts` (`chromium`) | the not-found page, with the shell every page shares, at 375 and 1280 px | the same | 2 of 2 new |
| `e2e/catalog-outage.spec.ts` (`chromium`) | the shared error page at 1280 and 375 px | production build with the database at port 1, at `127.0.0.1:3103`; the spec's port (3102) was changed for this run only, because an older server the sandbox cannot stop holds 3102 | 1 of 1 |
| `e2e/workspace-preview-runtime.spec.ts` (`runtime-chromium`) | the admin preview, Python ready | `next dev` at `localhost:3281` | 1 of 1 new; the spec 3 of 3 |
| `e2e/workspace-phone.spec.ts` (`phone-workspace`) | at 375 px: Lesson, Code and Output, each walked; the arrow keys move between them and the selected view takes focus | `next dev` at `localhost:3281` | 1 of 1 new; the spec 5 of 5 |

The sign-in walks replace Cloudflare's bot challenge script with a stand-in that renders nothing. The widget is a frame from Cloudflare's origin, and its keyboard behaviour is Cloudflare's: **not verified**, so "never trapped" is not proven for that frame.

**Finding, fixed: the development server's pages were never hydrated at 127.0.0.1.** `playwright.config.ts` opens the development server as `127.0.0.1`, and Next.js 16.4.6 refuses its development files to that origin (`Blocked cross-origin request to Next.js dev resource /_next/hmr from "127.0.0.1"`). There the admin states' editors never appeared, and "Show Google" did nothing. `next.config.ts` now sets `allowedDevOrigins: ["127.0.0.1"]` in the development phase only.

Not walked: the sign-in code step (needs the auth service; stack only), the profile page (WP-6.3, on the other line), and the admin confirm dialogs (opened by the J-12 and J-13 journeys, stack only). The `phone-workspace` and `runtime-chromium` projects run in no CI job (section 1), so the phone, preview and workspace walks are local evidence only.

## 3. Reduced motion (NFR-A11Y-08)

With `prefers-reduced-motion: reduce` emulated, after a Check has changed the page's state, no element of `/dev/workspace` has a transition or animation duration above 0 (`e2e/workspace-a11y-runtime.spec.ts`, passed). The primitives gallery has the same check (`e2e/gallery.spec.ts`, WP-1.4). The rule is `src/ui/base.css`.

## 4. Load profile and speed (NFR-PERF-03, NFR-PERF-06)

Command: the `profile` line in section 1; here, `npx playwright test -c "$TMPDIR/pw-prof.config.ts" e2e/workspace-load-profile.spec.ts:<line> --reporter=json` (the same settings as section 1, for the profile spec). The numbers are the test's annotations.

Throttled phone profile: 412 by 915 px, round trip 150 ms, 1.6 Mbit/s down, 750 kbit/s up, processor 4 times slower, cache off. These are the values of Lighthouse's simulated mobile profile, applied as real throttling; Lighthouse's own applied throttling is slower (about 562 ms round trip), so this profile is the lighter one. Times from the navigation's start, on the **development server**, last run:

| Measure | Value |
|---|---|
| First contentful paint (the lesson's text on screen) | 740 ms |
| Lesson title laid out (Playwright's "visible") | 226 ms |
| Editor took typing (after opening the Code view) | 45,422 ms |
| Python ready | 77,653 ms |
| Page bytes over the network | 9,143,079 |
| Python runtime bytes over the network | 6,428,837 |
| Python's state when the typing landed | `loading` |

NFR-PERF-03 holds: the lesson is painted and the editor takes typing while Python is still loading. The 45.4 s is the development server's unminified page code (about 9.1 MB) at 1.6 Mbit/s; it is not a production number. The production build's client code for `/learn/[course]/[lesson]` is 10 files, 1,159,463 bytes, 361,690 bytes gzipped (computed after `pnpm build`, polyfills left out, with the command below). At 1.6 Mbit/s that is about 1.8 s of transfer. That figure is computed, not measured in a browser: the production lesson route needs the database, and the development-only workspace page is not in a production build.

```
node -e 'const fs=require("fs"),zlib=require("zlib");const d=".next/server/app/learn/[course]/[lesson]/";const m=fs.readFileSync(d+"page_client-reference-manifest.js","utf8");const f=new Set([...m.matchAll(/static\/chunks\/[^"\\]+\.js/g)].map(x=>x[0]));for(const r of JSON.parse(fs.readFileSync(d+"page/build-manifest.json","utf8")).rootMainFiles)f.add(r.replace(/^\/?_next\//,""));let raw=0,gz=0;for(const x of f){const b=fs.readFileSync(".next/"+x);raw+=b.length;gz+=zlib.gzipSync(b,{level:9}).length}console.log(f.size,"files raw",raw,"gzip",gz)'
```

Laptop, no throttling, Python ready, six one-line Runs, each from the press to the output on screen, measured in the page: 13, 10, 9, 10, 10, 3 ms (the first is the first Run after Python was ready). The test asserts the largest is 150 ms or less. Check of ten test cases is measured in the Node runner, not in the browser: `src/grader/node-runner/runner.test.ts` asserts 500 ms or less, in `pnpm verify`.

## 5. Not measured

- NFR-PERF-01, Lighthouse mobile on the home, course list and course pages: needs a preview deployment of this branch (`07-operations.md`), and Lighthouse is not installed here. Owner: run it on the preview once the line is deployed, or name a waiver.
- The throttled profile on a production build of the lesson route: needs the local stack (Docker) or a preview with seeded content.
- Firefox and WebKit: speed mode. `sign-in.spec.ts`, `shell.spec.ts` and `catalog-outage.spec.ts` also run in the `firefox` and `webkit` projects; their walks were run in Chromium only. WebKit on macOS skips links on Tab unless the system setting allows it, so a local WebKit run there may fail the walks (not verified).
