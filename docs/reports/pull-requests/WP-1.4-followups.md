**Merges after #3.** This branch starts from `wp/1.4-tokens-primitives-shell` at a4d8ac9. Once #3 is merged, GitHub shows only this branch's own commits.

## What and why

The follow-ups that WP-1.4 listed under "Still listed, not fixed", and decision 5 (the mono fallback):

1. **A metric-matched fallback for IBM Plex Mono**, as `DESIGN.md` section 5 asks, at both weights.
2. **An invalid field always says why.** There is no lone icon, no red border without words, and `isRequired` never adds the browser's own message.
3. **An announced notice is announced.** Its live region is in the page before the notice, and the notice draws whole.
4. **Selecting a tab no longer moves its neighbors.**
5. **The error pages' title comes from the one template**, not a literal separator.
6. **Two stale comments in `semantic.css`.**
7. **`@fontsource/*` is the recorded source of the WOFF2 files**, checked byte for byte by a test.
8. **The gallery shows a button with an icon and the full-width button.**
9. **Phone device projects** for the narrow screens, at 412, 375 and 360 px (design review 2, MINOR 9).
10. **The writable pnpm store is recorded** in `guardrails.md` (security review 1, MINOR 8).

Not done, for you to decide: **the gallery in the server bundle**, and **one line of `DESIGN.md`**. See "Needs your decision".

## Work package

- Work package: WP-1.4 Design tokens, primitives, and the shell, follow-ups.
- Requirements: ADR-0014, NFR-PERF-01 (layout shift), NFR-A11Y-02, NFR-A11Y-05, NFR-A11Y-06, FR-SYS-01; ADR-0031.
- Commits: a4d8ac9..789fb15, 13 commits.
- Time taken: about 2 hours 30 minutes, from the branch to this description, including design reviews 5 and 6 and their fixes.

## What changed

| Item | Change | Where |
|---|---|---|
| 1 | Two local families, Menlo and Courier New (with Liberation Mono on Linux). Each has a face at weight 400 and one at 600, so bold code uses the font's real bold, not a synthesized one. Each is scaled with `size-adjust` and the ascent, descent and line-gap overrides to Plex Mono's metrics, by the formula `next/font` uses for its own fallbacks. They come first in the mono stack, ahead of `ui-monospace`. Consolas is left out: it is not on this machine, so its metrics could not be measured; Windows has Courier New. Android is not covered, as the CSS and `fonts.ts` say: it ships none of these fonts, its Chrome has no `ui-monospace`, and no Android font file was at hand to measure. | `src/ui/tokens/font-fallbacks.css`, `src/features/shell/fonts.ts`, `src/ui/styles.css` |
| 2 | `isInvalid: true` requires `errorMessage` in the type. `validate` returns a sentence or nothing; React Aria's `true` (invalid, no reason) is not accepted. Validation is always React Aria's `aria` behavior, so `isRequired` only marks the field required and never adds the browser's own message ("Please fill out this field."). The sentence for an empty required field comes from `validate` or the owner. The browser still checks `type`, `pattern` and `minLength` when a form without `noValidate` is submitted; the form primitive that sets `noValidate` comes with the first form (design review 6, MINOR 1). An invalid field whose sentence is empty throws `INVALID_WITHOUT_SENTENCE`. | `src/ui/primitives/text-field.tsx` |
| 3 | `LiveRegion`: the `status` or `alert` region renders empty, with no box of its own, and the whole notice arrives one animation frame later. | `src/ui/primitives/live-region.tsx`, `notice.tsx` |
| 4 | Each tab holds an invisible weight-600 copy of its title in the same grid cell, `aria-hidden`, so its width is the selected width from the start. | `src/ui/primitives/tabs.tsx` |
| 5 | `pageTitle(title)` fills `shell.titleTemplate`. It uses a replacer function, so a `$` in a title stays as written. | `src/messages/shell.ts`, `src/app/error.tsx`, `src/app/global-error.tsx` |
| 6 | The 14 px code size is set in `components.css`, not `base.css`. The example of a class with no token is `p-9`, since `--spacing-7` exists. | `src/ui/tokens/semantic.css` |
| 7 | `fonts.ts` says where the files come from; the test compares all five with the locked `@fontsource` files. They stay development dependencies. | `src/features/shell/fonts.ts`, `src/ui/tokens/font-fallbacks.test.ts` |
| 8 | "With an icon": the secondary Run button with Carbon's `Play`. Run is a secondary action (`DESIGN.md` 4.5), and Run with `Play` is on section 8's list. "Full width, as on a phone": the Check button with `block`. | `primitive-gallery.tsx`, `src/messages/gallery.ts`, `src/ui/icons.ts`, `src/ui/primitives/button.tsx` |
| 9 | Three projects run against the development server with Playwright's Pixel 7 profile (touch, mobile viewport, pixel density): `phone` (412 px as shipped), `phone-375` and `phone-360` (the viewport set to that width, 667 px high). `e2e/phone.spec.ts` checks the gallery and the not-found page: no sideways scroll, 44 px targets for every control that is drawn and for the open dialog's buttons, the full-width button spans the column, and axe. Screenshots: `phone-gallery-<width>.png` and `phone-not-found-<width>.png`. | `playwright.config.ts`, `e2e/phone.spec.ts`, `e2e/screens.ts` |
| 10 | What the `allowWrite` entry means: the store is shared by every project on this machine. | `docs/reports/guardrails.md` |

## How it was verified

`pnpm verify` at 687e42c:

```
$ pnpm format:check && pnpm lint && pnpm typecheck && pnpm attribution && pnpm test
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
$ eslint --max-warnings=0 .
$ tsc --noEmit
$ node scripts/check-attribution.mjs --branch && node scripts/check-attribution.mjs --files
$ vitest run --coverage
 Test Files  13 passed (13)
      Tests  540 passed (540)
```

Exit 0. The sandbox's `ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK` warnings are left out.

**Tests added**, each failing on the code before its fix:

- `src/ui/tokens/font-fallbacks.test.ts`:
  - recomputes every override, at both weights, from the shipped Plex Mono WOFF2 and the recorded Menlo and Courier New metrics. The WOFF2 is read with Next.js's own `fontkit`.
  - checks that the 600 faces name the bold local fonts and the 400 faces do not;
  - checks the Courier New metrics against Next.js's `capsize-font-metrics.json`;
  - checks that the two Plex Mono weights share metrics;
  - checks the stack order, and that the five WOFF2 files are byte-identical to `@fontsource`.
- `src/ui/primitives/primitives.test.tsx`:
  - the error sentence is the field's description;
  - a field's own validation message is used;
  - an invalid field with a blank sentence throws, whether the sentence comes from `errorMessage` or from `validate`;
  - an empty required field shows no error, has `aria-required` and no native `required`, so no browser message;
  - a valid field draws no icon;
  - each tab reserves the selected width;
  - an announced notice's server markup is exactly `<div role="status"></div>`, and the whole notice then arrives.
- `src/features/shell/shell.test.tsx`:
  - the title template;
  - a `$'` and `$&` in a title kept as written;
  - the gallery's one secondary Run with an icon, and its full-width button.

**React Aria's validation**, probed in jsdom before the TextField change: with `validationBehavior="aria"` and `isRequired`, typing then clearing then leaving the field gave `aria-required=true required=false invalid=null`, and no error text. A `validate` that returns `""` left the field valid.

**Metrics.** Measured with `node_modules/next/dist/compiled/@next/font/dist/fontkit` on this machine:

```
IBMPlexMono-Regular   upm 1000  ascent 1025  descent -275  lineGap 0  advance 600
IBMPlexMono-SemiBold  upm 1000  ascent 1025  descent -275  lineGap 0  advance 600
Menlo-Regular         upm 2048  ascent 1901  descent -483  lineGap 0  advance 1233   (/System/Library/Fonts/Menlo.ttc)
Menlo-Bold            upm 2048  ascent 1901  descent -483  lineGap 0  advance 1233   (/System/Library/Fonts/Menlo.ttc)
CourierNewPSMT        upm 2048  ascent 1705  descent -615  lineGap 0  advance 1229   (/System/Library/Fonts/Supplemental/Courier New.ttf)
CourierNewPS-BoldMT   upm 2048  ascent 1705  descent -615  lineGap 0  advance 1229   (/System/Library/Fonts/Supplemental/Courier New Bold.ttf)
```

That gives Menlo `size-adjust: 99.66%`, `ascent-override: 102.85%`, `descent-override: 27.59%`, and Courier New `99.98%`, `102.52%`, `27.50%`, at both weights. Both line-gap overrides are 0.

**Production build** at 13daf3d with the `.env.example` values: `next build` exit 0. The compiled stylesheet has:

```
@font-face{font-family:plex-mono-fallback-menlo;font-weight:400;src:local(Menlo Regular),local(Menlo-Regular);size-adjust:99.66%;ascent-override:102.85%;descent-override:27.59%;line-gap-override:0%}
@font-face{font-family:plex-mono-fallback-courier;font-weight:400;src:local(Courier New),local(CourierNewPSMT),local(Liberation Mono),local(LiberationMono);size-adjust:99.98%;ascent-override:102.52%;descent-override:27.5%;line-gap-override:0%}
@font-face{font-family:plex-mono-fallback-menlo;font-weight:600;src:local(Menlo Bold),local(Menlo-Bold);size-adjust:99.66%;ascent-override:102.85%;descent-override:27.59%;line-gap-override:0%}
@font-face{font-family:plex-mono-fallback-courier;font-weight:600;src:local(Courier New Bold),local(CourierNewPS-BoldMT),local(Liberation Mono Bold),local(LiberationMono-Bold);size-adjust:99.98%;ascent-override:102.52%;descent-override:27.5%;line-gap-override:0%}
```

**Not verified:**

- **Nothing here has run in a browser.** No browser can start in this sandbox. Not run, owner to run: `e2e/phone.spec.ts` (5 tests in each of the 3 phone projects), and the existing gallery and shell specs against these changes.
- **That the swap moves nothing.** It needs a browser with Plex Mono blocked, then loaded, and the two measured.
- **The announcement itself** in VoiceOver or NVDA. The unit test proves the order (region, then notice), not what a screen reader says, nor that one frame is long enough.
- **Liberation Mono's metrics.** It is designed to match Courier New's; not measured here.
- **The `local()` names on Windows and Linux.** `Courier New`, `CourierNewPSMT` and `CourierNewPS-BoldMT` are the full and PostScript names on macOS.
- **Android is not covered** (item 1). Chrome on Android swaps from the system monospace, unmatched.

## Screens

None. These changes have not been seen in a browser. The next screenshot run takes them:

```sh
pnpm test:e2e --project=chromium --project=gallery --project=phone --project=phone-375 --project=phone-360
```

After #3's run of 39 tests, this branch adds 15: 5 in each phone project. The `chromium` and `gallery` counts do not change. It adds 6 screenshots: `phone-gallery-` and `phone-not-found-` at 412, 375 and 360.

antislop Delivery Gate report, antislop active: during (global preference). From source and compiled CSS only.

- R-03 NOT VERIFIED on screen. The tab fix keeps widths fixed; the full-width button is the `block` variant built in #3; `phone.spec.ts` checks overflow and targets at 412, 375 and 360 px.
- R-04 PASS: one new icon, `Play`, for Run, on `DESIGN.md` section 8's list, shown only on the secondary button Run is.
- R-26, R-27 PASS in source: every state shown has behavior. An invalid field carries a sentence: `isInvalid` requires one by type; `validate` cannot return `true`; a blank sentence from either source throws, and tests prove both; `isRequired` never adds the browser's message. Not covered yet: the browser's own check of `type`, `pattern` and `minLength` on a form without `noValidate`. No form exists; the form primitive comes with the first one.
- R-32 NOT VERIFIED: no focus change in this range.
- R-35 FAIL until the owner's run: nothing here was driven in a browser.
- R-39 PASS in source for the tab name read once (`aria-hidden` copy) and the error sentence as the field's description. The live region order is right in source; what a screen reader says needs one.
- R-40 PASS: no new font file; four `local()` faces, no download.
- Everything else in Blocks 1 to 4 is unchanged from #3.

## Reviews

- design-reviewer, round 5 (source only, at bdabec4): CHANGES REQUIRED, 1 MAJOR and 8 MINOR. Report: `docs/reports/reviews/WP-1.4-followups/design-review-5.md`.
  - Fixed: MAJOR 1 (invalid field with no sentence) in da17fe7; MINOR 1 (bold faces) and MINOR 2 (Android recorded as uncovered, not matched) in 9969433; MINORs 4, 5 and 8 (primary Run, the full-width label, `$` in a title) in 087ba32; MINOR 6 (notice drawn whole) in 32d00d5; MINOR 7 (375 and 360 px, hidden controls) in e42bc5d.
  - Open for you: MINOR 3, the `DESIGN.md` line. See "Needs your decision".
- design-reviewer, round 6 (source only, at 13daf3d): APPROVE for the source, no screen approved. 4 MINOR, all fixed in 687e42c. Report: `docs/reports/reviews/WP-1.4-followups/design-review-6.md`.
  - MINOR 1: the TextField comment and the Gate line now claim only what is covered. The form primitive that sets `noValidate` is listed for the first form (WP-2.x sign-in).
  - MINOR 2: tests for a blank sentence from `validate`, and a blank `errorMessage` beside a `validate`.
  - MINOR 3: the target-size test skips only `display: none` (`checkVisibility()`), so a squashed box fails; a phone test measures the open dialog's buttons.
  - MINOR 4: comments rewrapped and shortened; the `announce` doc now gives the right reason.
- code-reviewer, security-reviewer: not run. Not asked for in this task, and the change has no server, data or pipeline code.

## Needs your decision

### 1. The gallery in the server bundle

What is in the bundle, measured on the production build at bdabec4:

- The gallery's words are in no server or browser file: `grep -rl "Every primitive in every state that can be shown" .next/server .next/static` finds nothing.
- What reaches `.next/server/chunks/ssr/` is a client reference stub of about 300 bytes: `registerClientReference(function(){throw Error("Attempted to call PrimitiveGallery() from the server but PrimitiveGallery is on the client…`. The not-found page's client reference manifest names it too. The `.dev.tsx` page itself is not built.

Why it is there: the root layout imports `@/features/shell`, whose `index.ts` exports `PrimitiveGallery` beside `SiteShell`. A route may import a feature only through its `index.ts` (`02-architecture.md` section 4.1).

Options:

1. **Leave it.** The cost is the stub and one manifest entry; nothing of the gallery's code or words ships. **Recommended.** Design review 5 agrees: nothing reaches a learner.
2. **A second entry point**, `features/shell/gallery.ts`, which only `src/app/dev/` may import. That is an exception to the "only through `index.ts`" rule: an ADR plus a lint rule change.
3. **A separate module**, `features/gallery`, with its own `index.ts`. No rule exception, but a new module in section 4's list: a `spec-change`.

By default nothing changes.

### 2. `DESIGN.md` section 5, pending owner decision

`DESIGN.md` says the mono stack ends in "a metric-matched `ui-monospace` fallback". `ui-monospace` cannot be matched: it is SF Mono on Safari, and SF Mono cannot be named in `local()`. What ships is matched Menlo and Courier New faces before `ui-monospace`. Proposed wording, for you to sign or change:

> then metric-matched local faces of Menlo and Courier New (Liberation Mono on Linux), at 400 and 600, then `ui-monospace`

`DESIGN.md` is not edited in this branch. By default it stays as it is, and the code and the document disagree on this one line.

## Owner actions now due

After #3 is merged:

1. Run the browser suite with the phone projects and paste the output:

   ```sh
   pnpm test:e2e --project=chromium --project=gallery --project=phone --project=phone-375 --project=phone-360
   ```

2. Commit the new screenshots, or ask me to.
3. Ask for a `design-reviewer` pass with them.
4. Decide the two items in "Needs your decision".

## Deviations from the plan or the spec

- **The phone projects use the Pixel 7 profile**, Playwright's built-in Chromium phone, at its own 412 px and with the viewport set to 375 and 360 px. Chromium is this suite's screenshot engine.
- **`Play` is exported from `@/ui`** so a feature can pass it to a Button. `ui` exported no icon before.
- **`TextField` no longer takes `validationBehavior`.** It is always `aria`. No form in the product uses the field yet.

## Risks and rollback

Interface primitives only. Revert the merge to roll back. The changes in behavior:

- An announced notice draws one frame after its region. Nothing in the product announces a notice yet.
- An invalid `TextField` with an empty sentence throws, and the error page shows. That is a programming error a unit test should catch first.
- A required `TextField` no longer blocks a form's native submit.

## Definition of Done

- [ ] Every "Done when" line is met. **Not met:** no screenshot or browser run of these changes; `design-reviewer` approval of screens waits on them.
- [x] Every cited requirement has a test that names its ID. The phone tests have not run.
- [x] `pnpm verify` passes. CI has not run on this branch.
- [x] Every state of every changed view exists.
- [x] No stub, dead control, placeholder or invented number.
- [x] No new tables. No new server actions.
- [ ] Every reviewer blocker is fixed. See Reviews.
- [x] No AI attribution in any commit or in this description.

## Opening this pull request

`gh` cannot reach GitHub from the sandbox. After #3 is merged, from your terminal in the repository root:

```sh
gh pr create --base main --head wp/1.4-followups \
  --title "fix(ui): WP-1.4 follow-ups: the mono fallback, invalid fields, live notices, tab widths" \
  --body-file docs/reports/pull-requests/WP-1.4-followups.md
```

To open it now, before #3 merges, use `--base wp/1.4-tokens-primitives-shell` instead. GitHub then retargets it to `main` when #3 merges and its branch is deleted.
