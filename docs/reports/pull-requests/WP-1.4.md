## What and why

The design foundation every screen builds on: tokens in three tiers from `DESIGN.md`, self-hosted IBM Plex, the primitives (button, link, text field, tabs, dialog with its actions row, disclosure, notice, progress, status), the page frame with skip link and landmarks, the not-found and error pages, a lint rule against raw design values, and a development-only gallery of every primitive.

The owner ran the browser suite once, outside Claude Code: 38 passed. The design review of those screenshots found one primitive state that did not render (the current navigation link). It is fixed in source, and **the fix has not been seen in a browser**: the screenshots need one more run. The steps are under "Owner actions now due".

## Work package

- Work package: WP-1.4 Design tokens, primitives, and the shell.
- Requirements: FR-SYS-01, NFR-A11Y-02, NFR-A11Y-03, NFR-A11Y-05, NFR-A11Y-06, NFR-A11Y-07, NFR-A11Y-08, NFR-I18N-01, NFR-I18N-02, NFR-I18N-03; goal G-4; ADR-0014, ADR-0015.
- Time box 3 hours. Taken: about 3 h 10 min across the first two sessions (15:51 to 19:05 on 2026-11-16), and about 40 min of work in a third session for the screenshots, design reviews 2 to 4, the fixes and the owner's decisions. Total about 3 h 50 min, under the 4.5 hour stop line. The third session ran from 20:12 to about 23:50 on the clock: about 3 hours of that was a pause on a usage limit, with no work done.

## How it was verified

`pnpm verify` at c66fe45:

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
      Tests  520 passed (520)
exit=0
```

- **End to end and axe, the owner's run** on this branch before this session's commits (head 790f66a; the screenshot code is from b985ccb), outside Claude Code: `pnpm test:e2e --project=chromium --project=gallery`, **38 passed** (chromium and gallery). That count is as the owner reported it; the raw output is not in the repository. The design reviewer checked that 38 matches the spec files (gallery 4 widths × 5 + 2 motion = 22; shell 4 + 4 × 3 = 16).
- **Not run in a browser:** everything after 8c99179. That includes the new e2e test `[ADR-0014] the current navigation link shows the text color and the amber marker`, so the next run should report 39 tests. A browser still cannot start inside this machine's sandbox.
- The current-link fix started with a unit test that fails on the old `link.tsx` and passes on the new one:

  ```
  old link.tsx:  × [ADR-0014] gives the current navigation link only the current color and marker
                 AssertionError: expected true to be false // Object.is equality
  new link.tsx:  Tests  1 passed | 18 skipped (19)
  ```

- Tests added in this package: primitives (`src/ui/primitives/primitives.test.tsx`), shell, not-found and error pages (`src/features/shell/shell.test.tsx`), the contrast of every token pair in use (`src/ui/tokens/contrast.test.ts`), the raw-value lint rule (`scripts/eslint/rules.test.ts`), and the e2e files `e2e/shell.spec.ts` and `e2e/gallery.spec.ts`. Each title names its requirement or ADR.
- Contrast: `docs/reports/screens/WP-1.4/contrast.md`. All 52 text pairs pass 4.5 to 1 and all 15 non-text pairs pass 3 to 1. The lowest non-text ratio is 3.59 (control border on a raised surface).
- The test count went from 521 to 520: the three request-ID tests went with the code they tested (decision 3), one test replaced them, and the current-link unit test is new.
- Production build with the fake `.env.example` values passed inline, at 9d3182a: `next build` exit 0. The compiled CSS has:
  - `.text-balance{text-wrap:balance}`, `.md\:flex-row`, `.md\:justify-end`, `.border-action`, `.border-transparent`;
  - the logical forms `.border-be`, `.border-be-\(length\:--marker-width\)`, `.-mbe-\(--hairline\)`, `.pbs-4`, `.pbe-2`, `.pbs-1`, `.focus\:inset-bs-4:focus{inset-block-start:var(--spacing-4)}`, `.scroll-mbs-4{scroll-margin-block-start:var(--spacing-4)}`;
  - none of `.border-b{`, `.pt-4{`, `.pb-2{`, `.pt-1{`, `.-mb-\(--hairline\){`, `focus\:top-4`, `scroll-mt-4`.
- `next start` of the 24141ee build probed with `curl`:
  - `/no-such-page` answers `HTTP/1.1 404 Not Found` with the not-found page, inside the new `mx-auto max-w-page px-gutter py-7` frame.
  - `/dev/primitives` answers 404.
  - A client-sent `x-request-id: PROBE_value_…` header appears nowhere in five responses (security review 1 MINOR 3). The first probe answered from a server without the new classes and did reflect the header. So another server, from an older build, was answering on that port at first. Security review 1 used port 3190 for its own server earlier the same day; whether that server was the one is not verified.

## Screens

In `docs/reports/screens/WP-1.4/`, from the owner's run before this session's commits, on Chromium. Each axe check saves the state it measured:

- `gallery`, `gallery-dialog`, `error` and `not-found`, each at 320, 375, 768 and 1280 px (16 files).

These were taken **before** the fixes in 4ad0b16, fce14cc and 24141ee. They show the current navigation link without its marker, the dialog actions wrapping at 320 px, the development indicator over content, and the system pages off the header's left edge. The next run replaces them; the dialog state is then captured at the viewport's size.

antislop Delivery Gate report, antislop active: during (global preference). The lines below are from the owner's e2e run, the 16 screenshots, design review 2's screen review, and source. Where a fix came after the screenshots, the line says so. **Not deliverable until the screenshots are taken again** and show the current navigation marker.

Block 1, Hard Gate:

- R-02 PASS: `grep` for an em dash over `src/` and `e2e/` finds none. Design review 2 found none in the screens.
- R-03 PASS in your run: the 320 and 375 px screenshots are single-column with 16 px gutters and full-width fields, and the overflow tests passed in the owner's run. The 44 px tests passed in the same run. The dialog actions changed afterwards (they now stack at full width below `md`): NOT VERIFIED on screen.
- R-17, R-18, R-36, R-38 PASS: no statistics, testimonials or claims. The gallery's "5.5 MB" is the measured Brotli runtime size (E-02, 5.46 MB), as design review 2 confirmed.
- R-23 PASS: no logo, mark, avatar or illustration created (ADR-0031). The wordmark is text.
- R-24 ACCEPTED BY THE OWNER until WP-5.1: the wordmark and "Go to the home page" point at `/`, which is a 404 until then (decision 1).
- R-25 PASS: every token pair in use passes (contrast.md), and axe, which includes its color-contrast rule, passed on every captured state in the owner's run. Design review 2 measured the rendered colors against the tokens.
- R-26 PASS: every control has behavior. Retry calls `retry()`, the dialog opens and closes, the tabs switch. The `/` loop is under R-24.
- R-27 PASS: the primitives carry their empty, disabled, invalid, read-only and error states, seen in the screenshots.
- R-28 PASS: there is no FAQ.
- R-32 PARTIAL. The skip-link keyboard test and the not-found keyboard test passed in the owner's run. React Aria primitives and a 2 px amber focus ring token. No screenshot shows the focus ring, so the amber ring around the amber primary button is NOT VERIFIED.
- R-33 PASS: nothing is patched by an external script.
- R-34 PASS: there is one theme (ADR-0015) and no toggle.
- R-35 PARTIAL. The owner's run drove the pages in Chromium: 38 passed, raw output not committed. I have not clicked through the app myself, and nothing after 8c99179 has run in a browser.
- R-37 PASS: the direction is the signed `DESIGN.md` (Design Read, dials ENERGY 1 / RHYTHM 1 / MOTION 1).
- R-39 PASS with an accepted gap. Native or React Aria controls, `lang`, `<title>`, and the `header` and `main` landmarks; reduced motion passed in the owner's run. The `nav` and `footer` landmarks are absent until they have destinations, accepted by the owner (decision 2): the header nav comes with WP-5.1 and the footer element with WP-6.3.
- R-40 PASS: no media; fonts are self-hosted with `font-display: swap`. Nothing was measured, so no performance number is reported.

Block 2, Purpose-Gate:

- R-01, R-07, R-10, R-12, R-13, R-19, R-22 PASS: no gradients, glows, patterns, glass or large shadows; no template animations; no illustrations. Confirmed in the screenshots.
- R-04 PASS: Carbon icons, chosen in `DESIGN.md` for IBM Plex; each icon names a real state (error, warning, information, success).
- R-06 PASS: Plex Mono is the written identity motif (`DESIGN.md` section 2), for structural labels and code only. Design review 2 confirmed the labels are Plex Mono at 5× zoom.
- R-08, R-09 PASS: no decorative arrows or capsule badges.
- R-14 N/A: no feature cards.

Block 3, Liveliness:

- The dials are set and explicit (`DESIGN.md`): yes. Uniform structure and motion on state changes only: yes, and the system pages now share the header's left edge (fce14cc, NOT VERIFIED on screen). One focal point per screen: yes on the error page; the not-found page's only step is a text link until WP-5.1 (design review 2, MINOR 6). Whitespace from the spacing scale: yes (48 px between sections, 16 px within). The accent is amber only: yes. The identity motif, Plex Mono labels with the amber current-item border: the labels yes; the current-item border did not render in the screenshots and is fixed in 4ad0b16, NOT VERIFIED on screen. A Design Read was declared: yes, `DESIGN.md` line 5.

Block 4, Craftsmanship:

- C-1, C-2, C-3, C-5 PASS.
- C-4 PARTIAL: every breakpoint holds in the screenshots, and the keyboard tests passed. NOT VERIFIED: forced colors, the dialog with the phone keyboard open, hover and press, and the error page without a reference (a browser error, since 24141ee; a unit test covers it, no screenshot does).
- R-30 PASS: design review 2 judged it neither a template nor a Carbon copy (outlined fields, neutral notices with a full border, centered button labels, line tabs with an amber bar).
- R-05, R-15, R-16, R-20, R-29, R-31 PASS.
- R-11 PASS: the progress track has square ends (seen in the screenshots).
- R-21 PASS: dark only, by ADR-0015.

## Reviews

The reports are in `docs/reports/reviews/WP-1.4/`.

- **code-reviewer (1): changes required.** The BLOCKER (nothing took the screenshots) is fixed in b985ccb, and the owner's run produced them. The lint gaps are fixed in b1ca483. MAJOR 1 (the error reference) is decided and done in 24141ee. MAJOR 2 and 4 are decided (decisions 1 and 2). Not run again.
- **security-reviewer (1): changes required.** MAJOR 1 and 2 are decided (decision 4); the settings change is yours, below. MINOR 3 (a client-chosen request ID shown on the error page) no longer applies after 24141ee: the page shows no request ID. Not run again.
- **design-reviewer (2), from the screenshots: changes required.**
  - BLOCKER 1, the stale Delivery Gate: rewritten above.
  - MAJOR 2, the current navigation link showed neither the text color nor the amber marker. Both class sets were on the element, and Tailwind's stylesheet order let the resting ones win. Fixed in 4ad0b16, with a unit test and an e2e test.
  - MINOR 3, 4, 5, 7, 8 and 9 fixed in fce14cc: dialog actions stack at full width below `md` (`DialogActions`), the dialog trigger keeps its width, system pages share the header's left edge, the system heading is balanced, gallery labels name the variant, and screenshots leave out the development indicator and capture an open dialog at the viewport's size. The phone device project of MINOR 9 is not added.
  - MINOR 6, the not-found page has no primary action: with WP-5.1, when `/` exists.
- **design-reviewer (3), of the fixes: APPROVE PENDING SCREENSHOTS.** Every fix is correct in source and in the compiled CSS. Its MINORs:
  - 1, the e2e test checked the marker's color only: it now also checks the 2 px width and weight 600 (554aab3).
  - 2, physical block-axis utilities against the logical-properties rule: switched to `border-be`, `-mbe`, `pbs` and `pbe` (554aab3).
  - 3, the spec lines that still promise a reference: all four are listed under decision 3.
  - 4, no screenshot of the error page without a reference: listed as NOT VERIFIED under C-4.
- **design-reviewer (4), of 554aab3: APPROVE PENDING SCREENSHOTS.** No collision or lost declaration. Its one MINOR, two more physical utilities (`focus:top-4`, `scroll-mt-4`), is fixed in 9d3182a; that two-class change was not reviewed again.
- **What closes the design review:** a fresh screenshot set at 9d3182a or later that matches "What a fresh screenshot set must show" in `design-review-3.md`, and a passing run of the current-link e2e test. Then the verdict becomes APPROVE WITH NOTES. Nothing in the gallery, tabs, header or system pages should differ from what review 3 lists.

## Decisions

The owner's decisions on 2026-11-16:

1. **The home link loop: (a), accepted until WP-5.1.** The wordmark and "Go to the home page" lead to a 404 until `/` exists.
2. **No `nav` or `footer` landmark yet: accepted.** The header nav is built in WP-5.1 and the footer element in WP-6.3. A later `spec-change` pull request adds both to `08-delivery-plan.md`. Not done here.
3. **The error reference: the recommendation, accepted.** The page shows the server's digest only, which Next.js logs with the error (24141ee). A browser error gets no reference until the client error report exists. The request ID context and parser are removed, since nothing else used them. Still to come:
   - WP-1.3 logs the digest together with the request ID, and `proxy.ts` replaces any incoming `x-request-id`. The removed parser used the header `x-request-id` and the format `^[A-Za-z0-9_-]{8,64}$`, for WP-1.3 to keep or change.
   - A `spec-change` so four lines say the error page shows the server's digest, and no reference for a browser error: `01-requirements.md` line 157 (FR-SYS-01) and line 229 (NFR-OBS-01), `03-experience.md` line 90, and `07-operations.md` line 83.
4. **The sandbox exclusions: accepted.** Browser tests run in your terminal or, from WP-2.2, in the `e2e` CI job, never outside the sandbox from a session. `docs/reports/guardrails.md` line 184 now says so (04d06bf). You edit `.claude/settings.json` yourself; the exact change is below.
5. **The mono fallback is not metric-matched: accepted.** A follow-up makes it match, as `DESIGN.md` section 5 asks.

### The change to `.claude/settings.json`

Replace the `excludedCommands` line, and add seven deny rules after `"Bash(gh pr merge *)"`:

```diff
       "Bash(gh pr merge *)",
+      "Bash(gh pr merge)",
+      "Bash(gh extension)",
+      "Bash(gh extension *)",
+      "Bash(gh ext)",
+      "Bash(gh ext *)",
+      "Bash(gh api *merge*)",
+      "Bash(gh api *Merge*)",
       "Bash(gh workflow disable *)",
```

```diff
-    "excludedCommands": ["gh", "pnpm test:e2e", "pnpm test:e2e *", "npx playwright *"],
+    "excludedCommands": ["gh"],
```

- The bare forms (`gh pr merge`, `gh extension`, `gh ext`) are there because I have not verified that `Bash(x *)` also matches `x` with no arguments.
- Both spellings of `merge` are there because I have not verified whether the match is case-sensitive. `*Merge*` catches the GraphQL `enablePullRequestAutoMerge`; `*merge*` catches `mergePullRequest`, `pulls/<n>/merge` and the `merges` endpoint.
- `gh api *merge*` also refuses a harmless read such as `gh api repos/<owner>/<repo>/pulls/3/merge` (is it merged?). That errs toward blocking.
- The guard already blocks `gh pr merge`, the two merge endpoints and every GraphQL mutation (`scripts/claude-guard.mjs:640`, `:734`, `:738`, `:749`). It does not block `gh extension`; security review 1 MAJOR 2 also suggests adding that to `checkGh`, which is your locked file.
- Settings are read when a session starts, so start a new Claude Code session after the change.

## Try it locally

There is no preview: Vercel is not set up yet (WP-1.3).

1. `pnpm dev`
2. Open `http://127.0.0.1:3000/dev/primitives`. Under "Links", "Buttons" is the current link: it should be in the text color with an amber bar under it. Tab through every control, open the dialog and press Escape, switch the tabs, open the disclosure. At phone width, the dialog's two buttons stack at full width.
3. Open `http://127.0.0.1:3000/dev/error` (the error page) and `http://127.0.0.1:3000/anything` (the not-found page). Both headings start at the wordmark's left edge.

## Owner actions now due

Run these in your own terminal, outside Claude Code, from the repository root, in this order:

1. Apply the `.claude/settings.json` change under "Decisions", then start a new Claude Code session so it is read.
2. Stop the production server a session left on port 3190. The sandbox cannot see or stop it:

   ```sh
   pkill -f "next start --hostname 127.0.0.1 --port 3190"
   ```

3. Take the screenshots again and run the browser suite. Expect 39 passed:

   ```sh
   git pull
   pnpm test:e2e --project=chromium --project=gallery
   ```

   Paste the output into this pull request.
4. Commit the new screenshots, or ask me to:

   ```sh
   git add docs/reports/screens/WP-1.4
   git commit -m "docs(reports): retake the WP-1.4 screenshots after the design fixes"
   git push
   ```

5. Ask for a last `design-reviewer` pass with those screenshots. Its approval is a "Done when" line.
6. Update this pull request's description on GitHub. `gh` cannot reach GitHub from the sandbox:

   ```sh
   gh pr edit 3 --body-file docs/reports/pull-requests/WP-1.4.md
   ```

Later, not in this pull request: the `spec-change` pull request (the header nav in WP-5.1, the footer element in WP-6.3, the `shell` module, the four error-reference lines), and the metric-matched mono fallback.

## Deviations from the plan or the spec

- **`spec-change` label: a new module `src/features/shell`.** It holds the page frame (skip link, header), the not-found and error pages, fonts and the development gallery. The module list in `02-architecture.md` section 4 and in `CLAUDE.md` names six features, and `shell` is not one of them. The lint table needs no change (`features/*` is allowed). The spec change is to add `shell` to that list.
- **The error page shows no request ID, and a browser error shows no reference** (decision 3). FR-SYS-01, NFR-OBS-01, `03-experience.md` and `07-operations.md` still promise one; the wording change is a later `spec-change`.
- **`agentRules: false` in `next.config.ts`.** Without it, `next dev` writes an `AGENTS.md` into the repository on start. Agent instructions live in `CLAUDE.md`, which you keep. The option exists in the Next.js 16.4.6 config schema, as the security reviewer checked.
- Development-only pages use the page extension `.dev.tsx`, which is enabled only on the development server. `next build` has no route and no bundle for them.
- `NEXT_WATCH_POLL_INTERVAL_MS` (a polling file watcher for sandboxes) is read in `next.config.ts` outside the environment schema, and polling did not fix the watcher here (EMFILE). It is a candidate for removal; that is your call.
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
- The narrow screenshots use the "Desktop Chrome" device resized, not a phone device (design review 2, MINOR 9).
- The pnpm store is writable from the sandbox (security review 1, MINOR 8); not yet recorded in `guardrails.md`.

## Risks and rollback

Interface foundation only: no data, no sign-in, nothing deployed. To roll back, revert the merge.

## Definition of Done

- [ ] Every "Done when" line is met, with evidence above. **Not met:** the design reviewer's approval waits on a fresh screenshot set that shows the current navigation marker. Screenshots and axe: met by your run, before this session's fixes. Contrast: met. The dev-only page is absent from the production build.
- [x] Every cited Must requirement has a passing test that names its ID. The new current-link e2e test has not run.
- [x] `pnpm verify` passes. The CI checks do not exist yet (WP-1.3).
- [x] Every state of every changed view exists.
- [x] No stub, dead control, placeholder, commented-out code or invented number. The `/` link is decision 1.
- [x] No new tables. No new server actions.
- [ ] Every reviewer blocker is fixed. Fixed in source; design review 2's MAJOR 2 needs your browser run to confirm.
- [x] No AI attribution in any commit or in this description. `git log --format='%an <%ae> | %cn <%ce>' ef7276c..HEAD` shows `Fahad <Fah2d@users.noreply.github.com>` as author and committer on all 32 commits before this description's commit.
