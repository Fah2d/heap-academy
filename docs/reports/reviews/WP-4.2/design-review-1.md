CHANGES REQUIRED

antislop active: during (global preference).

This review is from the code only. You told me no screenshots exist (`docs/reports/screens/WP-4.2/` is missing). My standing procedure is to ask and stop in that case, so this review does not replace looking at the screens. I could not check how anything actually renders.

## Findings

**BLOCKER 1. The code editor ignores the design's colours and fonts. CodeMirror's built-in light theme wins.**
- Files: `/private/tmp/claude-501/night-a/src/ui/code.css:7` and `:46-104`, and `/private/tmp/claude-501/night-a/src/features/workspace/components/code-editor-extensions.ts:103-125`.
- Cause: the editor's style rules sit inside `@layer components`. CodeMirror adds its own built-in light theme with the nonce, outside any layer. Browser rules say a style outside any layer always beats one inside a layer, however specific the selector. So the light theme wins wherever both set the same property. I checked against the installed `@codemirror/view` 6.43.15. What would actually show:
  - Focus ring: CodeMirror's `outline: 1px dotted #212121` replaces the 2 px amber ring. That is 1.16:1 on the editor, so focus is effectively invisible.
  - Caret: `borderLeft: 1.2px solid black`, which is 1.12:1 on `#121215`.
  - Selected text: background `#d7d4f0` under `#F2F0EC` text, which is 1.27:1.
  - Gutter: a light `#f5f5f5` strip. The active line number sits on `#e2f2ff` at 1.0:1.
  - Font: `.cm-scroller` gets `font-family: monospace; line-height: 1.4`, not Plex Mono at 1.55.
- `DESIGN.md` section 4.4 asked for a browser check of the editor in WP-4.2. The CSP test in `e2e/lesson-editor-journey.spec.ts` only proves these styles load. Loading them is exactly what lets them win.
- Fix: move the `.cm-*` rules into `EditorView.theme({...}, { dark: true })`, built from the existing CSS variables, or move them out of any `@layer`. Then add an e2e check of the computed styles: gutter background, caret colour, `.cm-focused` outline, selection background and the scroller's font family.

**BLOCKER 2. Screenshots, an axe run and the Delivery Gate report are all missing.**
- `docs/reports/screens/WP-4.2/` does not exist.
- Commit 4a29dc6 says the e2e and axe checks were not run.
- `docs/reports/pull-requests/` holds only `WP-4.2-part-1.md`. There is no Gate report for this part.
- `.claude/rules/ui-design.md` requires all three before review. I cannot approve without them.

**MAJOR 3. An invalid code field is not designed and not accessible.**
- File: `/private/tmp/claude-501/night-a/src/features/admin/components/lesson-editor.tsx:117-121` and `:400-423`, with `code-editor.tsx:68` and `code-editor-extensions.ts:107-111`.
- `aria-invalid` sits on a plain wrapper `div` (line 419).
- `focusFirstInvalid` picks that div when the starter or solution is the first invalid field. Calling `.focus()` on it does nothing.
- The error sentence and the hint are not linked to the editor. Only the "Escape, then Tab" hint is announced.
- The border stays `--color-border-control`. `DESIGN.md` 4.5 requires `--color-fail` for an invalid field.
- There is no `ErrorFilled` icon, unlike `TextField`.
- Fix: give `CodeEditor` `invalid` and extra `describedBy` ids. Set `aria-invalid` on `.cm-content` through `contentAttributes`. Use `border-fail` when invalid, add the icon, and focus the editor itself.

**MAJOR 4. Keyboard focus is lost when wrong answers are added or removed.**
- File: `lesson-editor.tsx:368-372` and `:375-390`.
- Remove takes its own focused button out of the page. Adding the third wrong answer hides the Add button. In both cases focus drops to the page body.
- Fix: after Add, focus the new row's label field. After Remove, focus the next row's label field, or the Add button if no row is left.

**MAJOR 5. Several states are missing from the gallery and the screenshot plan.**
- The learner-facing lesson content is never shown in any gallery state. That covers highlighted code blocks, the copy control ("Copied", "Could not copy. Select the code and copy it."), tables, quotes and the external link. `samplePreview` (`admin-state-gallery.tsx:75-88`) has only a heading and a paragraph, and nothing else renders `LessonContent`.
- Lesson rows: every gallery chapter has at most one lesson (`admin-state-gallery.tsx:98-115`). So moving a lesson, and a failed move, can never be shown. The add-lesson invalid, pending and failed states are not in `e2e/admin-gallery.spec.ts`.
- Lesson editor: the plain "Save failed" (`unavailable`) state from section 8 is missing; only the "newer version" refusal is shown. Also missing: address already taken (`slug_taken`), an invalid code field, three wrong answers with Add hidden, and "Updating the preview".

**MINOR 6. The preview jumps while the owner types.**
- File: `instructions-preview.tsx:65-67`.
- The status line switches between hidden and visible, so the preview box moves down and up after each pause in typing. Screen readers also hear "Updating the preview" after every pause.
- Fix: keep the space for that line at all times, or put it in the Preview heading row. Announce only a failure.

**MINOR 7. The preview breaks the page's heading order.**
- Files: `lesson-editor.tsx:281` and `lesson-content.tsx:102-110`.
- The lesson's own `h2` and `h3` headings render under the editor's `h3` "Preview". They end up as siblings of "Instructions" and "Code" in the page outline.
- Fix: give `LessonContent` a heading-level offset that changes only the tag, not the classes. The preview then still looks exactly like the learner's view.

**MINOR 8. The code fields are laid out differently from the other fields.**
- File: `lesson-editor.tsx:415-420`.
- The hint sits above the editor. In `TextField`, `TextArea` and `SelectField` it sits below the control. With RHYTHM 1, fields of the same kind should share one structure.
- Line 455 passes `hint=""`, which renders an empty `<p>`.
- Fix: use the same order as the other fields, and render the hint only when there is one.

**MINOR 9. The table wrapper is a tab stop with no name.**
- File: `lesson-content.tsx:127`.
- `div tabIndex={0}` has no role and no accessible name, so a screen reader announces nothing when it gets focus.
- Fix: add `role="region"` and an `aria-label` from `src/messages`.

**MINOR 10. Three wording issues.**
- `/private/tmp/claude-501/night-a/src/messages/lesson.ts:12-13`: the code block's accessible name repeats the fence tag as typed, so it says "Code in python" or "Code in py". When `isPython` is true it should say "Code in Python".
- `lesson-editor.tsx:316` with `/private/tmp/claude-501/night-a/src/messages/admin.ts:220`: the notice reads "Published: This lesson is published. …", which says the same thing twice. Use a neutral label such as "Note".
- `slug_taken` appears twice, once in the notice and once under the field (lines 141-145 and 238-242), so it is announced twice.

**MINOR 11. Two comments are wrong.**
- `code-editor-extensions.ts:119-120` cites "section 6.8" for Escape then Tab. It is `03-experience.md` section 6.2.
- `code.css:46-47` says these rules "set the palette". They do not today (see BLOCKER 1).

## What looks right in the code
- There is one primary action, "Save lesson". Amber is used only for Save, links and focus.
- Lesson numbers in the lesson rows use Plex Mono, as the identity motif asks.
- No illustrations or brand assets.
- The new messages have no em dashes or buzzwords. Buttons name their action: "Save lesson", "Add a wrong answer", "Add lesson", "Copy code", "Reload the page".
- "Unsaved changes" is shown in words and weight, not colour alone.
- A stale save is refused, what was typed is kept, and a reload button is offered.
- The nonce is passed to the editor.
- The Preview action is correctly left out until its route exists in WP-5.4.

## What only screenshots can confirm
- The editor once BLOCKER 1 is fixed:
  - gutter, caret, selection and focus ring
  - Plex Mono, and keyword weight 600
  - whether `print(` shows in the built-in colour or the function colour
- The editor layout at 1280 px, and at the 1024 px minimum:
  - the two-column Instructions/Preview and Starter/Solution widths
  - the sticky top bar against the admin header
  - the side list's sticky offset
  - section headings landing below the sticky bar when jumped to
- The step from the preview surface to the code block surface, and where the copy button sits.
- Focus rings on the code `pre` and the table wrapper.
- How dense the course editor gets with an add-lesson form in every chapter.
- How the native chapter select looks on the dark theme.

## Screenshots looked at
None. `/private/tmp/claude-501/night-a/docs/reports/screens/WP-4.2/` does not exist.
