antislop active: during (global preference).

APPROVE

# Design review 6, WP-1.4 follow-ups (re-review of fixes)

Reviewer: `design-reviewer`, fresh context. Range `bdabec4..13daf3d` on `wp/1.4-followups`, six commits: da17fe7, 32d00d5, 9969433, 087ba32, e42bc5d and 13daf3d (the saved review 5). 2026-11-17.

**What this approval covers.** It covers the source of the fix commits and nothing else. There are no screenshots for this range, and nothing has run in a browser. My procedure says a review without screenshots is not a review of screens, so this report approves no screen. The pull request still cannot merge as interface work until the captures listed at the end exist and have been reviewed. Its own R-35 line (FAIL until the owner's browser run, as of round 5) still applies.

**How I read the files.** I read every file through git at 13daf3d. I checked them against `DESIGN.md` (signed, revision 2), the experience spec sections 1, 4, 5.6, 6.8, 8, 9 and 10.9, and the antislop core, ui, copywriting, layoutmobile and code skills. I also checked React Aria's installed source (react-aria-components 1.22.1, react-aria 3.53.1).

**What I did not read.** I did not read the draft description at `docs/reports/pull-requests/WP-1.4-followups.md`. It is untracked, and you told me to read nothing from the working tree. So I have not checked the Delivery Gate lines or the proposed `DESIGN.md` wording for round-5 MINOR 3.

## Findings on the round-5 fixes

- **MAJOR 1: resolved, for the cases it named.**
  - `validate` is now typed `(value: string) => string | null | undefined`, so it cannot return `true`.
  - `validationBehavior` is left out of the props and forced to `"aria"`.
  - In the installed `useTextField.mjs`, lines 61 and 62 set `required` only when the behavior is native, and `aria-required` only when it is aria. This matches the new test.
  - React Aria treats a falsy result from `validate` as "valid", so `""` is valid.
  - A trimmed empty sentence now throws.
  - One path to a browser-written message is still open. See MINOR 1.
- **MINOR 1 of round 5 (bold faces): resolved, and I measured it myself.** I ran Next's fontkit on this machine:
  - `Menlo-Bold` ("Menlo Bold"): upm 2048, ascent 1901, descent -483, gap 0, advance 1233. Same as Regular.
  - `CourierNewPS-BoldMT` ("Courier New Bold"): upm 2048, ascent 1705, descent -615, gap 0, advance 1229. Same as Regular.
  - `IBMPlexMono-SemiBold`: upm 1000, ascent 1025, descent -275, gap 0, advance 600. Same as 400.
  - The `local()` names in the CSS match these full names and PostScript names exactly.
  - The 400 and 600 descriptors line up with the two Plex Mono faces in `fonts.ts`.
- **MINOR 2 (Android): resolved as recorded.** Android is named as uncovered in `font-fallbacks.css` and `fonts.ts`, with the reason.
- **MINOR 3 (`DESIGN.md` section 5): not checked.** It lives in the untracked draft.
- **MINOR 4 (primary Run): resolved.** Only the secondary Run with `Play` remains, and a test asserts it has no `bg-action`.
- **MINOR 5 (full-width label): resolved.** The new label, "Full width, as on a phone", is plain.
- **MINOR 6 (notice drawn in two steps): resolved.** `LiveRegion` is a bare `<div role>`, and the whole box mounts one frame later. The server-markup test asserts exactly `<div role="status"></div>`.
- **MINOR 7 (375 and 360 px): resolved in source.**
  - The `phone-375` and `phone-360` projects are added to `SCREENSHOT_PROJECTS`.
  - The file names carry the width (`phone-gallery-375.png`), so the three projects do not overwrite each other.
- **MINOR 8 (`$` in page titles): resolved.** `pageTitle` uses a replacer function, and a test covers `$'` and `$&`.

## New findings

### MINOR 1. A browser-written message can still reach the page, through `type`, `pattern` and `minLength`

- **Files:** `/Users/fahad/heap-academy/src/ui/primitives/text-field.tsx` (the doc comment: "no browser-written message (\"Please fill out this field.\") reaches the page").
- **What is wrong:**
  - In aria mode, `useTextField` still passes `type`, `pattern`, `minLength` and `maxLength` to the `<input>` (`useTextField.mjs` lines 50, 51, 73 and 74).
  - The browser checks those itself when a form is submitted, unless the form has `noValidate`.
  - React Aria's `<Form>` sets `noValidate` only when its own `validationBehavior` is not `"native"`, and its default is `"native"` (`Form.mjs` lines 21 and 23). A plain `<form>` never sets it.
  - Every gallery field is `type="email"`, and sign-in (experience spec 5.4) will put an email field in a form. Submitting "learner.example.com" there would show the browser's "Please include an '@'…" bubble. That text is not from `src/messages`, it may be in another language than the page, and it comes with no red border, because React Aria listens for `invalid` events only in native mode.
  - Nothing in the product has a form yet, so nothing visible is wrong today.
- **Fix:**
  - Before the first form ships, add a `Form` primitive in `src/ui` that always passes `validationBehavior="aria"`, so `noValidate` is always set.
  - Add a test that a `TextField type="email"` inside it sits in a form with `noValidate`.
  - Until then, narrow the comment to "`isRequired` never adds the browser's message".
  - If the draft's Gate line claims that no browser message can appear at all, reword it the same way.

### MINOR 2. The throw is tested only for `errorMessage`, not for `validate`

- **Files:** `/Users/fahad/heap-academy/src/ui/primitives/text-field.tsx`, `/Users/fahad/heap-academy/src/ui/primitives/primitives.test.tsx`
- **What is wrong:**
  - A `validate` that returns `" "` is truthy, so React Aria counts it as an error. The trimmed sentence is then empty, and the field throws while the learner types. No test covers this path.
  - A blank `errorMessage` on the valid branch (`errorMessage=" "` plus a `validate` that returns a real sentence) also throws. That is because `errorMessage ?? …` keeps the blank string, so it wins over the real sentence.
  - Both are programming errors, and refusing them is right. But in production the throw replaces the page with the error page, and that loses what the learner typed. So each path should fail in a test, not on a learner's screen.
- **Fix:** add tests for `validate={() => " "}` and for a blank `errorMessage` combined with `validate`.

### MINOR 3. The target-size test's visibility skip is wider than its comment says

- **File:** `/Users/fahad/heap-academy/e2e/phone.spec.ts`
- **What is wrong:**
  - Playwright's `isVisible()` is false for any element with an empty bounding box. So a control squashed to zero width or zero height is skipped, and that is exactly the failure this test exists to catch.
  - The comment says a hidden control "is measured where it is shown". No phone test opens the dialog, so its two buttons are never measured on a phone.
  - Today the skip changes nothing. In the gallery's `main`, the closed disclosure holds only text, and the inactive tab panels and the dialog content are not mounted.
- **Fix:**
  - Skip only what is really not drawn: `element.checkVisibility()` is false for `display: none` but true for a box of zero size.
  - Add a phone test that opens the dialog and measures its buttons, or reword the comment.

### MINOR 4. Comments: broken wrapping, one claim that is wrong, and one header that runs long

- **Files:**
  - `/Users/fahad/heap-academy/src/ui/tokens/font-fallbacks.css`
  - `/Users/fahad/heap-academy/e2e/phone.spec.ts`
  - `/Users/fahad/heap-academy/src/ui/primitives/notice.tsx`
- **What is wrong:**
  - **`font-fallbacks.css`:** the header breaks mid-sentence ("The / values come / from Next.js's formula"), and the Courier New line runs past the wrap. The header is now about 25 lines (antislop-code, "The Over-Explained Comment").
  - **`phone.spec.ts`:** the header's third line was not rewrapped and runs to about 130 characters.
  - **`notice.tsx` (`announce`):** the doc says "a notice present on load is never announced". That does not follow from the code. With `announce` set, a notice present on load is missing without scripts. After hydration it mounts into a region that already exists, so a screen reader would probably announce it. The instruction (leave it unset) is right; the reason given is wrong.
- **Fix:**
  - Rewrap both headers, and cut the font header down to the overrides' source and the gap on Android.
  - For `announce`, write: "Leave unset for a notice present on load: an announced notice is drawn only after scripts run, one frame after its region."

## Each fix: what the source shows, and what needs a browser

1. **TextField.**
   - From source: correct, as described above.
   - Needs a browser: the invalid-field screenshot again, and the email field inside a form once MINOR 1 is addressed.
2. **LiveRegion and Notice.**
   - From source: nothing is half-drawn. Nothing is on screen until the whole box is.
   - One point to check in a browser: inside a flex or grid container with `gap`, the empty region still takes one gap (12 px in a `gap-3` column) for one frame. So "the layout changes once" holds only outside such containers. This is not a finding until a screenshot or trace shows it.
   - Needs a screen reader: whether one frame is enough for VoiceOver with Safari and NVDA with Firefox. This is still not verified.
3. **Mono bold faces.**
   - From source and my own measurement: correct for macOS and Windows. Liberation Mono Bold is assumed metric-compatible with Courier New and was not measured.
   - Needs a browser: the swap with Plex Mono blocked and then allowed, for weight 600 text such as keywords and current-item labels.
4. **Gallery.**
   - From source: one secondary Run with an icon, and a full-width Check under a plain label. No new icon.
   - Needs a browser: everything visual.
5. **Phone projects.**
   - From source: sound. Pixel 7 keeps `screen` at 412 px while the viewport is 375 or 360. Media queries use the viewport, so this only affects `window.screen`, which the site does not use.
   - Needs a browser: every run.
6. **`pageTitle`.** Correct. Nothing is visible to check.

**Words.** The added user-facing string is "Full width, as on a phone". It is plain and short and has no em dash, buzzword or invented number. I found no em dash or en dash in any added line of the range. There is no brand asset, no illustration, and nothing from section 10.9.

## Delivery Gate

Not checked this round. The draft is untracked, and I was told not to read the working tree. Before the owner reads the description, check two things:

- The R-26 and R-27 line should claim what MAJOR 1's fix covers (`true`, a blank sentence, `isRequired`) and should not claim that no browser message can ever appear (MINOR 1).
- R-35 stays FAIL until the screenshots exist.

## Screenshots looked at

None. No screenshots exist for this range. These must be captured and reviewed before the screens can be approved:

- `phone-gallery-412.png`, `phone-gallery-375.png`, `phone-gallery-360.png`
- `phone-not-found-412.png`, `phone-not-found-375.png`, `phone-not-found-360.png`
- The gallery's buttons (secondary Run with icon, full-width Check) at 375, 768 and 1280 px
- The invalid text field at 375, 768 and 1280 px
- The tabs before and after selection at 375 px
- An announced notice, and an unannounced one, for comparison
