antislop active: during (global preference).

CHANGES REQUIRED

# Design review 5, WP-1.4 follow-ups

Reviewer: `design-reviewer`, fresh context. Range `wp/1.4-tokens-primitives-shell..bdabec4` (25b2f49, 8b164d2, 799181b, fa69250, bdabec4) on `wp/1.4-followups`. 2026-11-17.

I reviewed the source only, as asked. I checked it against `DESIGN.md` (signed, revision 2), `docs/spec/03-experience.md` sections 4, 5.6, 6.8, 8, 9 and 10.9, the antislop core, ui, copywriting, layoutmobile, human and code skills, the production stylesheets in `.next/static/chunks/` (built from bdabec4), and the draft description at `docs/reports/pull-requests/WP-1.4-followups.md` (untracked). There are no screenshots for this range. `docs/reports/screens/WP-1.4/` holds 17 files from #3 and no `phone-*` file. So nothing in this review approves a screen.

The verdict is CHANGES REQUIRED because of one MAJOR finding: a Delivery Gate line says more than the source does. The draft's own R-35 line is honestly marked FAIL until the owner's browser run, so the pull request cannot ship its screens yet in any case.

## Findings

### MAJOR 1. A field can still be invalid with no sentence, so the Gate line "always carries its sentence" is wrong

- Files: `/Users/fahad/heap-academy/src/ui/primitives/text-field.tsx`, and the Gate in `/Users/fahad/heap-academy/docs/reports/pull-requests/WP-1.4-followups.md`, line "R-26, R-27 PASS: … the invalid state now always carries its sentence."
- What is wrong:
  - **`validate` can return `true`.** React Aria allows `validate` to return `ValidationError | true | null | undefined` (`@react-types/shared` `inputs.d.ts` line 42). `true` means "invalid, no message", which leaves `validationErrors` as `[]`.
  - **An empty `errorMessage` passes the type.** `errorMessage: ""` is allowed, and `"" ?? …` stays `""`.
  - **What the learner sees.** In both cases the new code draws nothing below the field (confirmed: `FieldError` returns null when its children are null, `react-aria-components/dist/private/FieldError.mjs` line 41). `data-invalid:border-fail` still applies, so the field is marked by a red border alone. That is color only, which `DESIGN.md` 4.2 forbids. Section 4.5 asks for the `--color-fail` border plus an error sentence.
  - **The browser's own message can appear.** With `isRequired` and React Aria's default `validationBehavior="native"`, the fallback shows the browser's message, such as "Please fill out this field." That text does not come from `src/messages`, does not follow the voice in section 9, and can be in a different language from the document's `lang`.
- Fix, either of these:
  - Close the gap in the primitive. Wrap `validate` so its type excludes `true`. Treat an empty sentence as a programming error that fails a test, not as "draw nothing". Require `validationBehavior="aria"`, or require `errorMessage` whenever `isRequired` is set, so no browser text reaches the page. Add a test for each case.
  - Or change the Gate line to say exactly what is covered: `isInvalid` requires a sentence; the `validate → true`, empty-string and native-message cases are open.

### MINOR 1. The mono fallback has no weight-600 face

- File: `/Users/fahad/heap-academy/src/ui/tokens/font-fallbacks.css`
- What is wrong:
  - Both `@font-face` rules have no `font-weight`, so they are regular faces only. Nothing sets `font-synthesis` (I searched `src/ui` and the compiled CSS).
  - Mono text at weight 600 is therefore faux-bolded from Menlo Regular or Courier New Regular until Plex Mono loads. That covers the syntax keywords (`--syntax-keyword-weight: var(--font-weight-semibold)`) and the current-item structural labels (`DESIGN.md` section 2).
  - Faux bold looks heavier and blurrier than the real bold. Some engines also widen each glyph's advance for synthetic bold (I believe Firefox does), and then the swap would move bold mono text. That last point needs a browser to confirm.
- Fix: add a weight-600 face for each family, using the bold local names:
  - `local("Menlo Bold"), local("Menlo-Bold")`
  - `local("Courier New Bold"), local("CourierNewPS-BoldMT"), local("Liberation Mono Bold"), local("LiberationMono-Bold")`

  Give them the same overrides. Extend the test so it measures the bold advances too. The test already shows that Plex Mono 600 shares metrics with 400.

### MINOR 2. Android phones get no matched mono fallback

- Files: `/Users/fahad/heap-academy/src/ui/tokens/font-fallbacks.css`, `/Users/fahad/heap-academy/src/features/shell/fonts.ts`
- What is wrong:
  - Android ships none of Menlo, Courier New or Liberation Mono, and Chrome does not support `ui-monospace`. Chrome on Android therefore falls through to `monospace` (Droid Sans Mono or the system mono), which is not matched.
  - The spec says most first visits are on a phone (experience spec, principle 5). Plex Mono is not preloaded, and on a slow mobile connection the fallback is on screen for longest. So the uncovered platform is the one that matters most.
  - The description's "Not verified" list names Windows and Linux but not Android.
- Fix: add a face for the Android system mono (`local("Droid Sans Mono"), local("DroidSansMono")`, plus Noto Sans Mono if that is the face on current Android), with metrics measured from the font file and added to the test. Or record Android as uncovered in the description and in `fonts.ts`.
- Needs a device: whether Chrome on Android resolves `local()` to those names.
- Related, outside this range: `plexSans Fallback` is `local(Arial)` only, and Android has no Arial either.

### MINOR 3. `DESIGN.md` section 5 no longer describes what ships

- Files: `/Users/fahad/heap-academy/DESIGN.md` section 5, and `/Users/fahad/heap-academy/src/features/shell/fonts.ts`
- What is wrong:
  - `DESIGN.md` says "then a metric-matched `ui-monospace` fallback".
  - What ships is matched Menlo and Courier New faces, placed before `ui-monospace`. On Safari, `ui-monospace` is SF Mono, so Safari now shows Menlo during the swap where it used to show SF Mono. That is acceptable: SF Mono cannot be matched through `local()`.
  - Still, the signed document and the code now disagree.
- Fix: propose a one-line `spec-change` to `DESIGN.md` section 5 for the owner to sign, for example: "then metric-matched local faces of Menlo and Courier New (Liberation Mono on Linux), then `ui-monospace`". Do not edit it silently.

### MINOR 4. The gallery shows Run as a primary button

- Files: `/Users/fahad/heap-academy/src/features/shell/components/primitive-gallery.tsx` ("With an icon"), `/Users/fahad/heap-academy/src/messages/gallery.ts`
- What is wrong:
  - `DESIGN.md` 4.5 lists Run among the secondary buttons. The primary button in the workspace is Check, then Next, and experience spec section 6.8 puts Run beside Check in the phone action bar.
  - The gallery's own header says its examples "are written as they would read in the product". A primary Run never occurs in the product, so this example teaches the wrong pairing.
- Fix: keep only the secondary Run with `Play`. If the primary-with-icon state must be shown, use an action that is primary in the product. If that is Check with a Carbon check icon, that is a new icon use, and it needs the owner's decision under `DESIGN.md` section 8. Otherwise drop the primary example.

### MINOR 5. "Full width, the phone action of a view" is not plain, and does not match section 6.8

- Files: `/Users/fahad/heap-academy/src/messages/gallery.ts` (`fullWidth`), and the matching doc comment on `block` in `/Users/fahad/heap-academy/src/ui/primitives/button.tsx`
- What is wrong:
  - "The phone action of a view" is in-house shorthand. A reader who is not on the project cannot parse it (section 9: plain and short).
  - Section 6.8's one full-width action is the Lesson view's action that switches to Code. Check sits in the action bar beside Run, so the example and its label also do not match the spec.
- Fix: use a label such as "Full width, as on a phone". Either keep Check, or show the Lesson view's action once its words exist in `src/messages`.

### MINOR 6. An announced notice shows a box with only an icon for one frame

- Files: `/Users/fahad/heap-academy/src/ui/primitives/live-text.tsx`, `/Users/fahad/heap-academy/src/ui/primitives/notice.tsx`
- What is wrong:
  - The box (border, fill and icon) renders at once, and the kind word and sentence arrive one frame later. For one frame the notice is an icon with no words, and the box then grows, moving content below it a second time.
  - Without JavaScript, or before hydration, an announced notice has no text at all. The doc comment ("A notice present on load is not announced") is the only guard, and nothing enforces it.
- Fix: make the live region the outer wrapper. Render an empty wrapper with the role, then render the whole box inside it one frame later. Nothing is visible until it is complete, the layout changes once, and the region is still in the page before its content.
- Needs a screen reader: whether one animation frame is enough for VoiceOver with Safari and for NVDA with Firefox to register the region. The description already says this is not verified.

### MINOR 7. The `phone` project does not check 375 px

- Files: `/Users/fahad/heap-academy/playwright.config.ts`, `/Users/fahad/heap-academy/e2e/phone.spec.ts`
- What is wrong: Pixel 7 is 412 px wide. The review standard is 375 px, and 360 px is the common Android width. The deviation is recorded honestly. But Chromium can emulate a narrow phone, so WebKit is not the obstacle the description gives.
- Fix: add a second Chromium phone project, using the Pixel 7 profile with `viewport: { width: 375, height: 667 }` (and optionally one at 360), and save screenshots for each. A hidden control in `main` would make `boundingBox()` return null and fail the size test with an unclear message. Skip hidden controls on purpose, or assert that they are visible first.

### MINOR 8. `pageTitle` uses a string replacement, so `$` patterns in a title are expanded

- File: `/Users/fahad/heap-academy/src/messages/shell.ts`
- What is wrong: `titleTemplate.replace("%s", title)` treats `$&`, `$'` and `` $` `` in `title` as replacement patterns. For example, `pageTitle("Cost: $'")` returns `Cost:  | Heap Academy | Heap Academy`. The two error titles are safe today. The function is exported for general use, though, and lesson titles written by the owner may later reach it.
- Fix: `shell.titleTemplate.replace("%s", () => title)`, plus a test with a `$` in the title.

## Each change: what source and CSS show, and what needs a browser

1. **Mono fallback.**
   - From source and CSS: I recomputed the overrides by hand from the recorded metrics: Menlo 99.66 / 102.85 / 27.59, Courier New 99.98 / 102.52 / 27.50. Both match the file. The compiled CSS has both faces (minified to unquoted `local(Menlo Regular)`, which is valid), and `--font-plex-mono` is `"plexMono", plex-mono-fallback-menlo, plex-mono-fallback-courier, ui-monospace, monospace`. No new download (R-40 holds).
   - Needs a browser: that the swap moves nothing, with Plex Mono blocked and then allowed; that `local()` resolves on Windows, Linux, iOS and Android; how bold renders before the swap (MINOR 1).
   - Open: MINOR 1, 2, 3.
2. **TextField.**
   - From source: the `isInvalid: true` branch of the type requires `errorMessage`. The sentence becomes the field's description (the test uses `getByRole({ description })`). A valid field draws no icon. React Aria renders no empty error element, so there is no stray gap.
   - Needs a browser: nothing beyond #3's invalid-field screenshot, which should be retaken.
   - Open: MAJOR 1.
3. **Notice.**
   - From source: the order (region first, then text) is right, and the server-markup test shows it.
   - Needs a browser and a screen reader: the announcement itself, and the one-frame flash.
   - Open: MINOR 6.
4. **Tabs.**
   - From source and CSS: the compiled CSS has `.grid`, `.invisible{visibility:hidden}`, `.col-start-1`, `.row-start-1` and `.font-semibold`. The copy is hidden with `aria-hidden` and `visibility:hidden`, so the name is read once and find-in-page does not match it twice. The cell is as wide as the bold title, and the visible title inherits `data-selected:font-semibold`. The fix is correct.
   - Needs a browser: a screenshot pair, before and after selection, at 375 px, to show the neighbors do not move.
   - No finding.
5. **Error titles.**
   - From source: both error pages now use the one template.
   - Needs a browser: nothing.
   - Open: MINOR 8 (robustness).
6. **`semantic.css` comments.**
   - From source: both are now accurate. `components.css` line 44 sets the 14 px code size. No bare `--spacing` and no `--spacing-9` is defined, so `p-9` really emits nothing.
   - No finding.
7. **Gallery.**
   - From source: `Button` hides the icon wrapper from assistive technology (`aria-hidden`). Carbon `Play` at 16 px uses `currentColor`. `block` gives `w-full` (in the compiled CSS). Carbon `Play` for Run is on `DESIGN.md` section 8's list.
   - Needs a browser: how the icon sits next to the label, and the full-width button at 375 px.
   - Open: MINOR 4, 5.
8. **`phone` project.**
   - From source: the spec is sound (no sideways scroll, 44 px targets, axe, the full-width button spans the column). It has not run.
   - Needs a browser: all of it.
   - Open: MINOR 7.
9. **`guardrails.md`.** Not interface work. The wording is plain and has no design issue.

**Gallery in the server bundle** (for the owner): from a design point of view, option 1 ("leave it") is fine. The gallery's words reach no server or browser file, and the only trace in the build is a reference to a client component. Nothing is visible to a learner.

## Delivery Gate in the draft description, line by line

- **R-03 NOT VERIFIED:** accurate.
- **R-04 PASS:** accurate for the icon. The primary Run example is MINOR 4.
- **R-26, R-27 PASS:** not accurate as written. See MAJOR 1.
- **R-32 NOT VERIFIED:** accurate. Nothing in the range changes focus.
- **R-35 FAIL:** accurate and honest. The pull request does not ship its screens until the owner's run.
- **R-39 PASS in source:** accurate for the tab name and the error sentence. The live region needs a screen reader to confirm.
- **R-40 PASS:** accurate. No new file, only `local()` faces.
- **"Everything else … unchanged from #3":** consistent with the diff. No em dash in any added line or in the description. No buzzword, no invented number (the 5.5 MB in the gallery is cited to E-02 and is unchanged), no brand asset, nothing from section 10.9.

## Screenshots looked at

None. No screenshots exist for this range, and none were provided. Before these changes can be approved, the following need capturing and a new review:

- `phone-gallery-412.png` and `phone-not-found-412.png` (plus 375 px and 360 px captures if MINOR 7 is taken up)
- the gallery's buttons, text fields (invalid) and tabs (before and after selection) at 375, 768 and 1280 px
- an announced notice
