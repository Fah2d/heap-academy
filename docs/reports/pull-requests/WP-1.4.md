## What and why

The design foundation every screen builds on: tokens in three tiers from `DESIGN.md`, self-hosted IBM Plex, the primitives (button, link, text field, tabs, dialog, disclosure, notice, progress, status), the page frame with skip link and landmarks, the not-found and error pages with a reference, a lint rule against raw design values, and a development-only gallery of every primitive.

**The browser checks have not run.** Inside this machine's Claude Code sandbox, a browser cannot start. The screenshots, axe, the 44 px checks and the final design approval are yours to run. The steps are under "Owner actions now due".

## Work package

- Work package: WP-1.4 Design tokens, primitives, and the shell.
- Requirements: FR-SYS-01, NFR-A11Y-02, NFR-A11Y-03, NFR-A11Y-05, NFR-A11Y-06, NFR-A11Y-07, NFR-A11Y-08, NFR-I18N-01, NFR-I18N-02, NFR-I18N-03; goal G-4; ADR-0014, ADR-0015.
- Time box 3 hours. Taken: about 3 h 10 min, from 15:51 to 19:05 on 2026-11-16, across two sessions. That is under the 4.5 hour stop line.

## How it was verified

`pnpm verify` at 075435f:

```
$ pnpm format:check && pnpm lint && pnpm typecheck && pnpm attribution && pnpm test
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
$ eslint --max-warnings=0 .
$ tsc --noEmit
$ node scripts/check-attribution.mjs --branch && node scripts/check-attribution.mjs --files
$ vitest run --coverage
 Test Files  12 passed (12)
      Tests  521 passed (521)
exit=0
```

- Tests added: primitives (`src/ui/primitives/primitives.test.tsx`), shell, not-found and error pages, request ID parsing (`src/features/shell/shell.test.tsx`), the contrast of every token pair in use (`src/ui/tokens/contrast.test.ts`), the raw-value lint rule (`scripts/eslint/rules.test.ts`). Each title names its requirement or ADR.
- Contrast: `docs/reports/screens/WP-1.4/contrast.md`. All 52 text pairs pass 4.5 to 1 and all 15 non-text pairs pass 3 to 1. The lowest non-text ratio is 3.59 (control border on a raised surface).
- Production build without a browser. A `next build` with the fake `.env.example` values succeeded, and `next start` was probed with `curl`:

  ```
  --- /no-such-page
  HTTP/1.1 404 Not Found
  <html lang="en" dir="ltr" class="hCeJlq_variable p5Brlq_variable">
  <title>Page not found | Heap Academy</title>
  <a href="#main" class="sr-only focus:not-sr-only ...">Skip to the main content</a>
  <header class="border-b border-border">
  <main id="main" tabindex="-1" class="flex-1 outline-none">
  <h1 class="text-xl font-semibold text-text">We could not find this page</h1>
  --- /dev/primitives
  404
  ```

  The security reviewer separately found `/dev/error`, `/dev` and `/dev/primitives.dev` also answer 404 on the production build. No canary server secret appears anywhere in `.next`.
- After the Tailwind `source("../")` fix, the compiled CSS has 0 matches each for `#fff]`, `rounded-[6px`, `gap-[3px`, `.uppercase`, `.italic` and `.ml-4`.
- **End to end and axe: not run.** Exactly what happened:
  1. `pnpm test:e2e --project=chromium --project=gallery` stops before any test runs. `next build` refused, because no `.env.local` exists: `NEXT_PUBLIC_SUPABASE_URL: required`. Fixed in 7bf3939: the servers under test now get the fake `.env.example` values.
  2. Run again, `next dev` panicked: `Error [TurbopackInternalError]: unable to start FSEvent stream`. The panic log was written under `/tmp/claude-501/`. So `pnpm test:e2e` still runs inside the sandbox, although `.claude/settings.json` excludes it and the settings have reloaded.
  3. With `NEXT_WATCH_POLL_INTERVAL_MS=1000`: `Watchpack Error (watcher): Error: EMFILE: too many open files, watch`, then `Error: Timed out waiting 60000ms from config.webServer.`
  4. Also, `~/Library/Caches/ms-playwright` does not exist, so no Playwright browser is installed.

  I stopped after three attempts, as the rules say. `gh` is affected the same way: `gh api user` gives `tls: failed to verify certificate: x509: OSStatus -26276`, so you open this pull request by hand. My guess is that `"allowUnsandboxedCommands": false` makes Claude Code ignore `excludedCommands`. I have not verified that guess.

## Screens

No screenshots exist yet. Each e2e axe check now saves its state, on Chromium, to `docs/reports/screens/WP-1.4/<state>-<width>.png`:

- `gallery`, `gallery-dialog` and `error` at 320, 375, 768 and 1280 px;
- `not-found` at the same widths.

You run it once, as described under "Owner actions now due".

antislop Delivery Gate report, antislop active: during (global preference). This report has open lines, so the work is **not deliverable** until you run the browser checks. Every PASS below is from source or the production build, not from a browser.

Block 1, Hard Gate:
- R-02 PASS: `grep` for an em dash over `src/` and `e2e/` finds none.
- R-03 NOT VERIFIED: needs the 320 and 375 px screenshots and the overflow e2e test.
- R-17, R-18, R-36, R-38 PASS: no statistics, testimonials or claims. The gallery's "5.5 MB" is the measured Brotli runtime size (E-02), which replaced an invented "9.8 MB".
- R-23 PASS: no logo, mark, avatar or illustration created (ADR-0031). The wordmark is text.
- R-24 OPEN, for you: the wordmark and "Go to the home page" point at `/`, which is a 404 until WP-5.1. See decision 1.
- R-25 PASS (tokens): every token pair in use passes (contrast.md). The live check of the rendered pages is NOT VERIFIED.
- R-26 PASS: every control has behavior. Retry calls `retry()`, the dialog opens and closes, the tabs switch. The `/` loop is under R-24.
- R-27 PASS: the primitives carry their empty, disabled, invalid, read-only and error states. The error page exists.
- R-28 PASS: there is no FAQ.
- R-32 NOT VERIFIED in a browser. From source: React Aria primitives, a visible 2 px amber focus ring token, and a skip link. The keyboard e2e test has not run.
- R-33 PASS: nothing is patched by an external script.
- R-34 PASS: there is one theme (ADR-0015) and no toggle.
- R-35 FAIL: the app has not been clicked through in a browser. Only the build and `curl` ran. **This line blocks delivery until you run the e2e suite.**
- R-37 PASS: the direction is the signed `DESIGN.md` (Design Read, dials ENERGY 1 / RHYTHM 1 / MOTION 1).
- R-39 PARTIAL. Native or React Aria controls, `lang`, `<title>`, and the `header` and `main` landmarks: PASS. Reduced motion: PASS by e2e test (not run) and the `transition: none` rule in base.css. The `nav` and `footer` landmarks are absent on purpose until they have destinations; that needs your acceptance (decision 2).
- R-40 PASS: no media; fonts are self-hosted with `font-display: swap`. Nothing was measured, so no performance number is reported.

Block 2, Purpose-Gate:
- R-01, R-07, R-10, R-12, R-13, R-19, R-22 PASS: no gradients, glows, patterns, glass or large shadows; no template animations; no illustrations.
- R-04 PASS: Carbon icons, chosen in `DESIGN.md` for IBM Plex; each icon names a real state (error, warning, information, success).
- R-06 PASS: Plex Mono is the written identity motif (`DESIGN.md` section 2), used for structural labels and code only.
- R-08, R-09 PASS: no decorative arrows or capsule badges.
- R-14 N/A: no feature cards.

Block 3, Liveliness:
- The dials are set and explicit (`DESIGN.md`): yes. The output matches them, with uniform structure and motion on state changes only: yes, from source. There is one focal point per screen, the page's `h1`: yes. Whitespace comes from the spacing scale: yes. The accent is amber only: yes. The identity motif is Plex Mono labels with the amber current-item border: yes. A Design Read was declared: yes, `DESIGN.md` line 5. The visual judgment of all of these needs the screenshots.

Block 4, Craftsmanship:
- C-1, C-2, C-3, C-5 PASS. C-4 NOT VERIFIED until the screenshots and e2e run.
- R-05, R-15, R-16, R-20, R-29, R-31 PASS. R-30 (too close to Carbon) NOT VERIFIED: the design reviewer needs the screenshots.
- R-11 PASS after 201b41b: the progress track was pill-shaped, and now has square ends.
- R-21 PASS: dark only, by ADR-0015.

## Reviews

The reports are in `docs/reports/reviews/WP-1.4/`.

- **code-reviewer: changes required.**
  - The BLOCKER was that nothing took the screenshots. Fixed in b985ccb.
  - The lint gaps (named colors, inline custom properties) are fixed in b1ca483.
  - The error hint and the test fixes are in b985ccb.
  - The other findings are for you.
- **security-reviewer: changes required.**
  - The two MAJOR findings concern `.claude/settings.json` and the guard. I cannot edit those files.
  - Servers now bind to 127.0.0.1, and `/dev/error` is checked (d5e002d).
- **design-reviewer: changes required.** This was a source review; it cannot approve without screenshots.
  - Fixed: the error hint (8f85981); the progress pill, nav link width, read-only hover, Tailwind scan and the invented number (201b41b).
  - It becomes "approve pending screenshots" once you decide its items 1, 3 and 11.

I did not run the reviewers a second time after the fixes.

Open MAJOR findings for you to waive or decide:

1. **The home link is a 404 until WP-5.1** (code MAJOR 2, design MAJOR 1). Options:
   - (a) Accept the loop until WP-5.1.
   - (b) WP-1.3's "one real page" becomes a page at `/`. That is a small spec change; the copy needs `DESIGN.md` and your words.

   I recommend (a): the site is not public before WP-5.1, and a `/` page would be placeholder content. By default, (a) holds.
2. **No `nav` or `footer` landmark yet** (code MAJOR 4, design MAJOR 3). `03-experience.md` section 4 asks for both. Neither has a destination until WP-5.1 and WP-6.3. I recommend accepting this and adding "build the header nav" to WP-5.1 and "build the footer element" to WP-6.3 in a `spec-change` pull request. Not done here.
3. **The error reference** (code MAJOR 1). The page shows the server digest, otherwise the request ID the root layout received. After client-side navigation that ID belongs to an earlier request, and browser errors are not logged until `/api/client-error` exists. I recommend logging the digest with the request ID in WP-1.3, and dropping the request-ID fallback for browser errors until the client error report exists. This needs a `spec-change` to NFR-OBS-01's wording.
4. **The sandbox exclusions** (security MAJOR 1 and 2).
   - `excludedCommands` for `pnpm test:e2e` and `npx playwright *` would run agent-written specs and configs outside the sandbox. `gh` outside the sandbox can install and run extensions, and the guard does not block `gh extension`. On this machine the exclusions do not take effect at all (above).
   - I recommend running browser tests in CI only, removing those two exclusions, and adding deny rules `Bash(gh extension *)` and `Bash(gh ext *)`. Correct `guardrails.md` line 184 as well.
   - These are locked files, so only you can change them.
5. **The mono fallback is not metric-matched** (design MINOR 11, code MINOR). The signed `DESIGN.md` section 5 asks for it. Accept, or I fix it in a follow-up.

## Try it on the preview

There is no preview: Vercel is not set up yet (WP-1.3). Locally, on your machine:

1. `pnpm dev`
2. Open `http://127.0.0.1:3000/dev/primitives`. Tab through every control, open the dialog and press Escape, switch the tabs, open the disclosure.
3. Open `http://127.0.0.1:3000/dev/error` (the error page) and `http://127.0.0.1:3000/anything` (the not-found page).

## Owner actions now due

1. In your own terminal, outside Claude Code:

   ```sh
   pnpm exec playwright install chromium
   pnpm test:e2e --project=chromium --project=gallery
   ```

   Paste the output into this pull request. The screenshots land in `docs/reports/screens/WP-1.4/`. Commit them on this branch, or ask me to.
2. Ask for a second `design-reviewer` pass with the screenshots. Its approval is a "Done when" line.
3. Decide items 1 to 5 above.
4. Open this pull request. `gh` cannot reach GitHub from the sandbox:

   ```sh
   gh pr create --base main --head wp/1.4-tokens-primitives-shell --title "WP-1.4: design tokens, primitives, and the shell" --body-file docs/reports/pull-requests/WP-1.4.md --label spec-change
   ```

   This description is saved in the repository at `docs/reports/pull-requests/WP-1.4.md`.

## Deviations from the plan or the spec

- **`spec-change` label: a new module `src/features/shell`.** It holds the page frame (skip link, header), the not-found and error pages, the request ID context, fonts and the development gallery. The module list in `02-architecture.md` section 4 and in `CLAUDE.md` names six features, and `shell` is not one of them. The lint table needs no change (`features/*` is allowed). The spec change is to add `shell` to that list.
- **`agentRules: false` in `next.config.ts`.** Without it, `next dev` writes an `AGENTS.md` into the repository on start. Agent instructions live in `CLAUDE.md`, which you keep, so the file is turned off. The option exists in the Next.js 16.4.6 config schema, as the security reviewer checked.
- Development-only pages use the page extension `.dev.tsx`, which is enabled only on the development server. `next build` has no route and no bundle for them.
- `NEXT_WATCH_POLL_INTERVAL_MS` (a polling file watcher for sandboxes) is read in `next.config.ts` outside the environment schema, and polling did not fix the watcher here (EMFILE). It is a candidate for removal; that is your call.
- No footer or nav yet: see decision 2.
- The gallery's inline `style` on the progress bar (its width) is the app's own inline style attribute. WP-1.3's attempt without `style-src-attr 'unsafe-inline'` will fail on it as well as on React Aria.

Still listed, not fixed:

- The gallery module is in the production server bundle (not the browser bundle) because the shell index exports it. Fixing that needs a boundary-rule exception.
- A field that is invalid with no `errorMessage` shows a lone icon.
- A `role="status"` notice mounted with its text may not be announced.
- The selected tab's weight shifts its neighbors.
- The title separator is duplicated in `error.tsx` and `global-error.tsx`.
- Two stale comments in `semantic.css`.
- `@fontsource/*` is unused at runtime; it is the source of the committed WOFF2 files.
- The gallery lacks the icon and full-width button states.

## Risks and rollback

Interface foundation only: no data, no sign-in, nothing deployed. To roll back, revert the merge.

## Definition of Done

- [ ] Every "Done when" line is met, with evidence above. **Not met:** screenshots, axe and design-reviewer approval wait on your browser run. Contrast is met; the dev-only page is absent from the production build.
- [x] Every cited Must requirement has a passing test that names its ID. The e2e ones exist but have not run.
- [x] `pnpm verify` passes. The CI checks do not exist yet (WP-1.3).
- [x] Every state of every changed view exists.
- [x] No stub, dead control, placeholder, commented-out code or invented number. The `/` link is decision 1.
- [x] No new tables. No new server actions.
- [ ] Every reviewer blocker is fixed. The code BLOCKER is fixed in code, and its evidence needs your run.
- [x] No AI attribution in any commit or in this description. `git log --format=fuller ef7276c..HEAD` shows author and committer `Fahad <Fah2d@users.noreply.github.com>` on all 23 commits.
