> Archived. Not in force. This file belongs to the original ten-phase plan and is kept for work after the first release. Do not build from it unless the owner says so. The plan in force is in `docs/spec/`.

# 03 Experience

How the product looks, reads, and behaves. Section 9 is the brief the owner uses to author `DESIGN.md` in WP-0.4. `DESIGN.md` is the source of visual direction; antislop is the filter applied on top of it; this document supplies structure and behavior.

## 1. Principles

1. **The lesson is the page.** Nothing competes with the text, the code, and the result. Chrome recedes.
2. **Useful before complete.** A learner can read and type while things load. No screen waits on the slowest part.
3. **Say what happened, in their words.** Every result and error is a sentence a beginner understands, with the line number and what to try.
4. **Earned, not sprinkled.** One accent, one moment of acknowledgement per lesson, no decoration without a job.
5. **Same on a phone.** The phone layout is designed, not derived. Most first visits are on one.
6. **Honest.** No invented numbers, no dark patterns, no blocking prompts. Asking for sign-up waits until the learner has something to save.

## 2. Reference model

The owner named Codedex as the reference for how a course platform works. It was walked through in a real browser on 2026-11-11 (E-12). The model is adopted; the look is not (antislop R-30).

| Observed on Codedex | Heap Academy |
|---|---|
| Course page: numbered chapters, each listing exercises; the first exercise of each chapter can be started, later ones are locked until the previous is done; a side panel with exercise count, XP, and badges. | Same structure and unlock rule (FR-CRS-03). Side panel shows lessons, XP, chapters. No badges in 1.0. |
| Lesson: instructions on the left with a concept section, an Instructions section, and a Help section (hint, video, solution, AI companion); editor with a file tab on the right; terminal below; Run and Submit answer buttons. | Same split. Sections are Concept, Watch out, Your task, Hints. Run and Check. Output has Console or Preview, plus a Tests panel. |
| No visible test cases. Expected output is described in the instructions. | Test cases are visible, each with expected and actual values. This is the owner's explicit requirement. |
| Exercise 02 asked for "Hello World!" and accepted `print('Hello')` as correct. | Every lesson must reject a named wrong answer in CI (FR-GRD-05). |
| Code runs on their servers; a connection indicator sits in the top bar. | Code runs in the browser. No connection needed to run. |
| After the first pass as a guest, a modal covers the screen asking to sign up. | An inline, dismissible invitation below the result (FR-AUTH-07). |
| HTML lessons: three columns, with a browser-style preview that renders on Run. | Preview on Run, live preview as a should-have. Layout decided in `DESIGN.md`, not copied. |
| Phone: a Learn, Code, Output switch at the top and a full-width button to start coding. | Three views with a fixed action bar (FR-WSP-13). |
| Pixel-art adventure theme, characters, item unlock popups. | Heap's own identity. No popups that interrupt work. |

## 3. Information architecture

| Route | Purpose | Indexed |
|---|---|---|
| `/` | Landing for signed-out visitors | Yes |
| `/courses` | Catalog | Yes |
| `/courses/[course]` | Course outline | Yes |
| `/learn/[course]/[lesson]` | Workspace | Free published lessons only |
| `/sign-in` | Google and email code | No |
| `/auth/callback` | Sign-in return | No |
| `/profile` | Progress and account | No |
| `/privacy`, `/terms` | Legal | Yes |

Navigation shows only destinations that exist (antislop R-24): Courses, and either Sign in or the learner's menu (Profile, Sign out). The footer holds legal links and the community link when configured.

## 4. Global shell

- Header: Heap mark and wordmark (from `/brand`) linking home, Courses, then the account control. A skip link is the first focusable element.
- In the workspace the header shrinks to one compact bar: back to course, lesson title, chapter progress, outline control, account control.
- Landmarks on every page: `header`, `nav`, `main`, `footer`. One `h1` per page. Document `lang` and `dir` set from locale configuration.
- A site notice region above the header appears only when a notice is configured (FR-SYS-05).

## 5. Screens

### 5.1 Landing

Content, in order, each present because the product needs it:

1. One sentence that says what this is, and a live editor preloaded with a few lines of Python. Run works. This is the focal point.
2. The courses, with real lesson counts, each leading to its first lesson.
3. One short paragraph on how a lesson works, written for someone who has never coded.
4. Footer.

No hero illustration of a fake product, no statistics, no testimonials, no logo wall, no feature card grid.

### 5.2 Catalog

A short list, not a marketplace: 1.0 has two courses. Each course is a wide row or card with title, description, level, lesson count, estimated time, progress, and one action. The resume row sits above when the viewer has progress.

### 5.3 Course page

- Top: title, one-paragraph intro, "You will be able to" list (three to five outcomes from `course.yaml`), primary action (begin or continue).
- Body: chapters in order. Each chapter shows its title, one-line description, and its lessons as rows (FR-CRS-02).
- Side panel at 1024 px and wider, a tab below that: lessons completed, XP earned of total, chapters completed.

### 5.4 Workspace

Specified in section 6.

### 5.5 Sign-in

One column. Google button and an email field with a Continue action. After Continue, the same view asks for the six-digit code with one input that accepts paste and auto-advances, a resend control with a visible cooldown, and a way to change the email. In an in-app browser the email path leads and a sentence explains that Google does not allow sign-in inside this app's browser (FR-AUTH-03).

### 5.6 Profile

Display name (editable in place), XP, current and longest streak, per-course progress, completed lessons grouped by course. Account section: time zone, download my data, delete my account.

### 5.7 System pages

Not found, error (with reference ID), unsupported browser, and legal pages. Each says what happened and offers the next step.

## 6. Workspace specification

### 6.1 Regions (768 px and wider)

```
+--------------------------------------------------------------+
| back  Lesson title            chapter progress  outline  me  |
+---------------------------+----------------------------------+
| Instructions              | Editor (file tabs)               |
|  Concept                  |                                  |
|  Watch out                |                                  |
|  Your task                +----------------------------------+
|  Hints                    | Run  Check  Stop   runtime status|
|  Help                     +----------------------------------+
|                           | Console or Preview | Tests       |
+---------------------------+----------------------------------+
| previous                              next                   |
+--------------------------------------------------------------+
```

- Default split is 40 percent instructions, 60 percent work; editor 60 percent of the work pane. Minimum instruction width 320 px.
- Each region is a labeled landmark region. Focus order follows reading order: header, instructions, editor, actions, output, footer.
- The instructions pane and the output pane scroll independently. The page itself does not scroll at these widths.

### 6.2 Keyboard

Proposed bindings. WP-5.7 validates them against browser and screen reader shortcuts on Windows, macOS, and Linux before they are final.

| Action | Keys |
|---|---|
| Run | Ctrl or Cmd + Enter |
| Check | Ctrl or Cmd + Shift + Enter |
| Stop | Stop button; Ctrl + C when the Console has focus and no text is selected |
| Next region, previous region | F6, Shift + F6 |
| Leave the editor by keyboard | Esc, then Tab |
| Open the shortcut sheet | ? when focus is not in a text field; also in the Help area |
| Close a dialog or drawer | Esc |

The editor's "Esc then Tab" instruction is exposed as the editor's accessible description and shown in the shortcut sheet.

### 6.3 Console (Python)

- Output appears as it is produced. Standard error is distinguishable by a label and style, not color alone.
- When the program asks for input, an input line appears at the end of the output with the program's prompt as its label. Focus moves there only if focus was already inside the workspace. Enter submits; the answer is echoed into the transcript.
- With the batch strategy, an Input field sits above the Console, labeled "Program input, one answer per line", with a sentence explaining why.
- Empty state: one line telling the learner what Run does. No fake prompt, no blinking cursor decoration.
- When a run ends, a polite live region announces the outcome and the number of output lines. Streaming text is not announced chunk by chunk.
- Truncation is stated inline: "Output stopped after 64,000 characters."

### 6.4 Preview (web)

- A plain framed area that shows the rendered page. No imitation browser window (antislop R-05).
- Empty state explains that Run renders the page.
- A cancelled link or form shows a short inline note inside the preview: links do not open here.

### 6.5 Tests panel

- Before the first Check: the list of test names with a neutral "not run" state, so the learner can see what will be checked.
- After Check: a summary line ("3 of 5 tests passed"), announced through a live region and focused. Each test is a disclosure. A failed test shows expected, actual, and the author's hint. The first failure is expanded.
- Expected and actual for text output are shown in a monospace block with visible whitespace differences (trailing spaces, missing newline) called out in words, because beginners cannot see them.
- Hidden tests show name and verdict only.

### 6.6 Errors

One component renders every learner error with the same shape: a heading in plain words, the Python or browser message, the line (a button that moves the editor cursor there), and one suggestion. The filtered traceback is behind a disclosure.

| Kind | Heading | Body pattern |
|---|---|---|
| `syntax` | Python could not read line 3 | The message, then the line, with a caret under the column. |
| `runtime` | The program stopped on line 7 | `ZeroDivisionError: division by zero`, then one sentence on what that error means. |
| `input_ended` | The program asked for more input than it got | Explains the Input field or the test's input. |
| `time_limit` | The program ran for more than 5 seconds | Mentions loops that never end. Python restarts by itself. |
| `output_limit` | The program printed too much | States the limit. |
| `memory` | The program used too much memory | |
| `stopped` | You stopped the program | |
| `crashed` | Python stopped unexpectedly | Restarting. Includes the reference ID. |

Explanations for common Python error types are content, kept in the message catalog, and reviewed like lesson text.

### 6.7 Completion moment

When all tests pass: the tests list shows every test passed, one line states "Lesson complete" and the XP earned, and the primary action becomes "Next" with the next lesson's title. One restrained acknowledgement defined in `DESIGN.md` plays once (see the signature element proposal in 9.6) and is static under reduced motion. No modal, no confetti, no sound.

For a guest, after the first completion only, an inline card below the result offers to save progress with an account. It can be dismissed and does not return in that session.

### 6.8 Runtime status

A status element next to the actions, present only when the runtime is not ready:

- Loading: "Starting Python" with a determinate bar from real byte counts.
- A pending intent is shown in the button itself: Run becomes "Runs when Python is ready".
- Failed: one sentence and a Retry button. The lesson and editor stay usable.
- Restarting: "Restarting Python".

### 6.9 Below 768 px

- Three views switched by a tab list at the top: Lesson, Code, Output. The current view is the whole screen below the header.
- A fixed action bar holds Run and Check. It sits above the on-screen keyboard using the visual viewport, never under it.
- In the Code view, a symbol row above the keyboard offers characters that are slow to reach on phones. Python: Tab, `:`, `(`, `)`, `[`, `]`, `"`, `'`, `=`, `#`, `_`. Web: Tab, `<`, `>`, `/`, `"`, `=`, `{`, `}`, `:`, `;`, `#`, `.`.
- Run switches to Output and shows the Console or Preview. Check switches to Output and shows Tests.
- The Lesson view ends with one full-width action that switches to Code.
- Touch targets are at least 44 by 44 px. No hover-only affordance exists.

## 7. States

Every data-bearing view implements all applicable states (antislop R-27). The state matrix lives next to the component as stories.

| View | Loading | Empty | Error | Other |
|---|---|---|---|---|
| Catalog | Skeleton rows sized to content | Not applicable (courses exist at build) | Progress unavailable: show courses without progress, with a note | Offline |
| Course page | Static content needs none; progress shimmer in rows | New learner: nothing completed | Progress unavailable | Locked by order, locked by tier |
| Workspace | Runtime loading | Console empty; Tests not run | Runtime failed; learner errors; API unavailable | Pending sync; draft restored; unsupported browser |
| Sign-in | Sending code; verifying | | Wrong code; expired code; too many attempts; provider down | In-app browser |
| Profile | Skeleton | No completions yet | Could not load | Deleting; deleted |

## 8. Words

Copy is written with `antislop-copywriting` loaded and lives in message catalogs (NFR-I18N-01).

- Voice: a patient person sitting next to the learner. Second person. Present tense. Short sentences. No exclamation marks in errors.
- Reading level: a 13-year-old reading English as a second language. No idioms, no sarcasm, no culture-specific jokes.
- Buttons name the action: Run, Check, Stop, Reset code, Show a hint, Show the solution, Next: Variables.
- Never blame: "Python could not read line 3", not "You made a syntax error".
- No em dashes, no buzzwords, no generic calls to action (antislop R-02, R-15, R-16).
- Numbers shown to learners are real or absent.

## 9. Design brief for `DESIGN.md`

Everything in this section is a **proposal for the owner to accept, edit, or reject** during the direction interview in WP-0.4. The owner is the author of `DESIGN.md`; the implementer transcribes the answers (antislop R-37). Values marked (brand) are what is known of the Heap identity and must be checked against the brand book in `/brand`, which wins wherever it differs.

### 9.1 Identity

- Heap is named after the heap data structure. (brand)
- Visual language: a CRT phosphor monitor. Amber on CRT black. (brand)
- Mark: a binary heap of seven blocks. Wordmark set in Handjet. (brand)
- Mascot: a pixel-art character with a dark cube CRT head and white chevron eyes; the body and outfit vary, the head does not. (brand)
- Known colors: amber `#D4A017`; warm off-white text `#FFEBD1`; a deep burgundy `#520423` used as a background in Heap videos. (brand, confirm)

### 9.2 Character

A focused instrument. Closer to a well-made terminal than to a marketing site. The CRT reference shows up in structure and restraint (phosphor amber as the single accent, the console as a real terminal, pixel-grid precision in spacing), not in overlays: no scanlines, no screen curvature, no flicker.

Proposed Design Read: *Reading this as: a coding practice tool for beginners arriving from short videos, in a CRT phosphor instrument style, dial ENERGY 2 / RHYTHM 2 / MOTION 1.*

### 9.3 Color

- One accent: amber. Used for the primary action, focus, progress, and the current item. Never for decoration.
- Text on amber is near-black, never white. Measured ratios (E-19): near-black on amber 8.28 to 1; white on amber 2.38 to 1, which fails.
- Cream text on near-black measures 16.92 to 1; amber on near-black 8.28 to 1; cream on burgundy 12.89 to 1; amber on burgundy 6.31 to 1.
- Semantic colors for pass, fail, and warning are chosen in WP-0.4, each at AA contrast on every surface it appears on, and each paired with an icon or word.
- Syntax highlighting uses a small palette derived from the brand colors, defined as tokens, each color AA on the editor background. A stock editor theme is not used.

### 9.4 Tokens

Three tiers, all CSS custom properties:

1. **Primitive**: raw values (`--amber-500`). Never used in components.
2. **Semantic**: purpose (`--color-action`, `--color-text`, `--color-surface-raised`, `--space-4`, `--radius-control`). Components use only these.
3. **Component**: only where a component needs its own knob.

A lint rule forbids raw color, spacing, or radius values in component code. This is the theme contract that makes a second theme a token file, not a refactor (ADR-0015).

### 9.5 Type

- Handjet for the wordmark and a few display numerals (XP, streak) only. (brand)
- One sans family for interface and lesson prose and one monospace for code, chosen in WP-0.4 from the brand book. If the brand book names none, the proposal is the IBM Plex family: Plex Sans for text, Plex Mono for code. Reason: it comes from terminal-era computing, which fits the CRT identity; it has an Arabic companion (Plex Sans Arabic) so a future Arabic interface keeps one type voice; and it is openly licensed for self-hosting.
- Lesson prose: at least 16 px, line height about 1.6, measure 60 to 75 characters. Code: at least 14 px desktop, 16 px on phones to avoid zoom on focus.
- Fonts are self-hosted, subset, and preloaded for the first view only.

### 9.6 Signature element (proposal)

The seven-block heap mark as the progress glyph. A course's chapters map to blocks; a block fills with amber when its chapter is complete; completing a lesson pulses the current chapter's block once. It is the identity motif: specific to Heap, repeated on the catalog, the course page, the workspace header, and the completion moment. It needs the owner's approval and, for courses that do not have seven chapters, a rule the owner agrees to.

### 9.7 Shape, depth, motion

- Radius: small and consistent, set per element role. Nothing pill-shaped by default.
- Depth on a dark interface comes from surface steps and hairline borders. Shadows only for elements that float above content (dialogs, menus).
- Motion: 120 to 200 ms, ease-out, for state changes only. No entrance animations on scroll. Everything non-essential stops under reduced motion.

### 9.8 Icons and illustration

- Icons: few, each naming a real action or state. The set is chosen in WP-0.4 for fit with the pixel-grid identity, not for a familiar library look (antislop R-04). The owner decides between a set drawn on the brand's pixel grid and an existing openly licensed pixel-grid set.
- Illustration: only the mascot, only from brand assets, only where it adds meaning: empty states, the completion moment, not-found. Never generated by the implementer (antislop R-23).

### 9.9 Never

Purple or blue gradients, glass effects, glow on more than the focused element, sparkle or magic icons, emoji as icons, a fake terminal as a hero, bento grids, capsule badges that announce nothing, uppercase labels with wide tracking, stock illustration, anything that could be mistaken for another product with the logo swapped.
