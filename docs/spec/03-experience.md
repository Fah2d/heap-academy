# 03 Experience

How the product looks, reads, and behaves. Section 10 was the brief for the WP-1.1 direction interview, which produced the signed `DESIGN.md`. `DESIGN.md` is the source of visual direction; antislop is the filter applied on top of it; this document supplies structure and behavior.

## 1. Principles

1. **The lesson is the page.** Nothing competes with the text, the code, and the result. Chrome recedes.
2. **Useful before complete.** A learner can read and type while things load. No screen waits on the slowest part.
3. **Say what happened, in their words.** Every result and error is a sentence a beginner understands, with the line number and what to try.
4. **Earned, not sprinkled.** One accent, one moment of acknowledgement per lesson, no decoration without a job.
5. **Same on a phone.** The phone layout is designed, not derived. Most first visits are on one.
6. **Honest.** No invented numbers, no dark patterns, no blocking prompts. Asking for sign-up waits until the learner has something to save.
7. **The dashboard is a tool.** The owner writes lessons there every day. It is fast, plain, and never loses work.

## 2. Reference model

The owner named Codedex as the reference for how a course platform works. It was walked through in a real browser on 2026-11-11 (E-12). The model is adopted; the look is not.

| Observed on Codedex | Heap Academy |
|---|---|
| Course page: numbered chapters, each listing exercises, later ones locked. | Chapters and lessons in order. Nothing locked in this release. |
| Lesson: instructions on the left, editor on the right, terminal below, Run and Submit. | Same split. Run and Check. Console plus a Tests panel. |
| No visible test cases. | Test cases are visible, each with input, expected, and actual output. This is the owner's explicit requirement. |
| One exercise accepted `print('Hello')` for "Hello World!". | A lesson cannot be published until its starter fails and its solution passes (FR-GRD-05). |
| Code runs on their servers. | Code runs in the browser. |
| After the first pass as a guest, a modal asks to sign up. | An inline, dismissible invitation below the result (FR-AUTH-07). |
| Phone: a Learn, Code, Output switch. | Three views with a fixed action bar (FR-WSP-13). |
| Pixel-art adventure theme and popups. | Heap's own identity. No popups that interrupt work. |

## 3. Information architecture

| Route | Purpose | Indexed |
|---|---|---|
| `/` | Home | Yes |
| `/courses` | Course list | Yes |
| `/courses/[course]` | Course page | Yes |
| `/learn/[course]/[lesson]` | Workspace | Yes |
| `/sign-in` | Google and email code | No |
| `/auth/callback` | Sign-in return | No |
| `/profile` | Progress and account | No |
| `/privacy`, `/terms` | Legal | Yes |
| `/admin` | Dashboard: courses | No |
| `/admin/courses/[id]` | Course editor | No |
| `/admin/lessons/[id]` | Lesson editor | No |
| `/admin/lessons/[id]/preview` | A draft in the real workspace | No |
| `/admin/setup`, `/admin/verify` | Second sign-in step | No |

Navigation shows only destinations that exist: Courses, and either Sign in or the learner's menu (Profile, Sign out). Nothing in the learner interface links to `/admin`; the owner opens it by address.

## 4. Global shell

- Header: the text wordmark "Heap Academy" linking home, Courses, then the account control. A skip link is the first focusable element.
- In the workspace the header shrinks to one compact bar: back to course, lesson title, account control.
- Landmarks on every page: `header`, `nav`, `main`, `footer`. One `h1` per page. Document `lang` and `dir` set from configuration.
- Footer: privacy and terms links.

## 5. Learner screens

### 5.1 Home

Content, in order, each present because the product needs it:

1. One sentence that says what this is. When FR-LND-01 is built, a live editor preloaded with a few lines of Python sits beside it, and Run works. Until then the sentence stands with the course list; nothing fake takes the editor's place.
2. The courses, with real lesson counts, each leading into the course.
3. One short paragraph on how a lesson works, written for someone who has never coded.
4. Footer.

No hero illustration of a fake product, no statistics, no testimonials, no logo wall, no feature card grid.

### 5.2 Course list

A short list, not a marketplace: the first release has one course. Each course is a wide row with title, summary, lesson count, progress, and one action. When nothing is published yet, one honest sentence says so.

### 5.3 Course page

- Top: title, summary, the "You will be able to" list when the owner has written outcomes, primary action (begin or continue).
- Body: chapters in order. Each chapter shows its title, its one-line summary, and its lessons as rows (FR-CRS-02).
- Progress summary: lessons completed and XP earned of total (FR-CRS-05).

### 5.4 Sign-in

One column. Google button and an email field with a "Send code" action. After "Send code", the same view asks for the six-digit code with one input that accepts paste, a resend control with a visible cooldown, and a way to change the email. In an in-app browser the email path leads and a sentence explains that Google does not allow sign-in inside this app's browser (FR-AUTH-03).

> **Approved by the owner on 2026-11-24 (proposed in WP-2.2):** the email action says "Send code", not "Continue", because section 9 asks a button to name its action.

### 5.5 Profile

Display name (editable in place), XP, current and longest streak, per-course progress. Account section: sign out, delete my account.

### 5.6 System pages

Not found, error (with the server error's digest as reference; a browser error has none until `/api/client-error` exists), unsupported browser, and legal pages. Each says what happened and offers the next step.

## 6. Workspace specification

### 6.1 Regions (768 px and wider)

```
+--------------------------------------------------------------+
| back  Lesson title                                       me  |
+---------------------------+----------------------------------+
| Instructions              | Editor                           |
|  (the lesson's Markdown)  |                                  |
|                           |                                  |
|  Hints                    +----------------------------------+
|                           | Run  Check  Stop    Python status|
|                           +----------------------------------+
|                           | Console            | Tests       |
+---------------------------+----------------------------------+
| previous                              next                   |
+--------------------------------------------------------------+
```

- Split is 40 percent instructions, 60 percent work; editor 60 percent of the work pane. Minimum instruction width 320 px.
- Each region is a labeled landmark region. Focus order follows reading order: header, instructions, editor, actions, output, footer.
- The instructions pane and the output pane scroll independently. The page itself does not scroll at these widths.

### 6.2 Keyboard

| Action | Keys |
|---|---|
| Run | Ctrl or Cmd + Enter |
| Check | Ctrl or Cmd + Shift + Enter |
| Stop | Stop button |
| Leave the editor by keyboard | Esc, then Tab |
| Close a dialog | Esc |

The editor's "Esc then Tab" instruction is exposed as the editor's accessible description. WP-5.2 checks the bindings against browser shortcuts on Windows, macOS, and Linux.

### 6.3 Console

- Output appears as it is produced. Standard error is distinguishable by a label and style, not color alone.
- When the program asks for input, an input line appears at the end of the output with the program's prompt as its label. Focus moves there only if focus was already inside the workspace. Enter submits; the answer is echoed into the transcript.
- With the batch strategy, an Input field sits above the console, labeled "Program input, one answer per line", with a sentence explaining why.
- Empty state: one line telling the learner what Run does. No fake prompt, no blinking cursor decoration.
- When a run ends, a polite live region announces the outcome and the number of output lines. Streaming text is not announced chunk by chunk.
- Truncation is stated inline: "Output stopped after 64,000 characters."

### 6.4 Tests panel

- Before the first Check: the list of test case names with a neutral "not run" state, so the learner can see what will be checked.
- After Check: a summary line ("3 of 5 tests passed"), announced through a live region and focused. Each test case is a disclosure. A failed one shows its input, expected output, actual output, and the owner's hint. The first failure is expanded.
- Expected and actual are shown in monospace blocks. When FR-GRD-07 is built, differences a beginner cannot see (trailing spaces, letter case, a missing last line) are named in words.
- A test case with follow-up code shows that code under the label "Then this runs", so the learner knows what produced the output.

### 6.5 Errors

One component renders every learner error with the same shape: a heading in plain words, the Python message, the line (a button that moves the editor cursor there), and one suggestion.

| Kind | Heading | Body pattern |
|---|---|---|
| `syntax` | Python could not read line 3 | The message, then the line, with a caret under the column. |
| `runtime` | The program stopped on line 7 | `ZeroDivisionError: division by zero`, then one sentence on what that error means (FR-WSP-23). |
| `input_ended` | The program asked for more input than it got | Explains the Input field or the test case's input. |
| `time_limit` | The program ran for more than 5 seconds | Mentions loops that never end. Python restarts by itself. |
| `output_limit` | The program printed too much | States the limit. |
| `memory` | The program used too much memory | |
| `stopped` | You stopped the program | |
| `crashed` | Python stopped unexpectedly | Restarting. Includes a reference once `/api/client-error` exists (WP-7.3). |

### 6.6 Completion moment

When every test case passes: the tests list shows each one passed, one line states "Lesson complete" and the XP earned, and the primary action becomes "Next" with the next lesson's title. The acknowledgement is the 160 ms state change defined in `DESIGN.md` section 7, with no animation beyond it. No modal, no confetti, no sound.

For a guest, after the first completion only, an inline card below the result offers to save progress with an account. It can be dismissed and does not return in that session.

### 6.7 Python status

A status element next to the actions, present only when Python is not ready:

- Loading: "Starting Python" with a determinate bar from real byte counts.
- A pending intent is shown in the button itself: Run becomes "Runs when Python is ready".
- Failed: one sentence and a Retry button. The lesson and editor stay usable.
- Restarting: "Restarting Python".

### 6.8 Below 768 px

- Three views switched by a tab list at the top: Lesson, Code, Output. The current view is the whole screen below the header.
- A fixed action bar holds Run and Check. It sits above the on-screen keyboard using the visual viewport, never under it.
- When FR-WSP-21 is built, a symbol row above the keyboard in the Code view offers Tab, `:`, `(`, `)`, `[`, `]`, `"`, `'`, `=`, `#`, `_`.
- Run switches to Output and shows the console. Check switches to Output and shows Tests.
- The Lesson view ends with one full-width action that switches to Code.
- Touch targets are at least 44 by 44 px. No hover-only affordance exists.

## 7. Admin dashboard

Built for 1024 px and wider. Below that it shows one sentence asking the owner to use a larger screen. It uses the same tokens and primitives as the learner interface, with denser spacing.

### 7.1 Getting in

- `/admin/setup`: a button that shows a QR code and a manual key for an authenticator app, then a field for the first six-digit code. Shown once, to an admin with no second step yet. Loading the page changes nothing; the key is made on the press.
- `/admin/verify`: one field for the six-digit code. Shown at the start of each admin session.
- Anyone who is not on the admin list sees the standard not-found page at every `/admin` address.

> **Approved by the owner on 2026-11-24 (proposed in WP-2.3):** `/admin/setup` shows a button before the QR code, so that loading the page creates no factor.

### 7.2 Courses

`/admin` lists every course with its status, and the number of published and draft lessons. One action creates a course. With no course yet, the page says what to do first.

### 7.3 Course editor

- Details: title, address, summary, outcomes (up to five lines).
- Structure: chapters in order, each with its lessons in order. Each row shows the lesson's title, status, and when FR-ADM-13 is built, its completion count.
- Reordering uses Move up and Move down buttons that work with a keyboard. No drag and drop in this release.
- Actions: add a chapter, add a lesson (creates a draft and opens it), publish, unpublish, or archive the course.

### 7.4 Lesson editor

One page, with a side list that jumps between its sections. A top bar shows the lesson's status, whether there are unsaved changes, and the Save and Preview actions.

| Section | Contents |
|---|---|
| Details | Title, address, chapter, XP. |
| Instructions | A Markdown field and, beside it, the preview rendered exactly as learners will see it. Hints as a short list below. |
| Code | Starter and solution, side by side, each in the same editor learners use. Wrong answers below: up to three, each with a label saying what the mistake is. |
| Test cases | The list described in 7.5. |
| Publish | The checklist described in 7.6. |

### 7.5 Test cases

- A list of test cases. Each one opens to: name, input, expected output, comparison mode, hint, and an optional field for follow-up code.
- Field labels say what a beginner author needs to know. Input: "What the program is given, one answer per line." Expected output: "Exactly what the program must print." Follow-up code: "Python that runs after the learner's program, for checking a variable or calling a function."
- One action runs the solution against every test case and shows each verdict with the actual output.
- Next to an expected output field, "Fill from solution" copies the solution's actual output into it. The owner then reads it and corrects it if the solution was wrong.
- Actions per test case: duplicate, move up, move down, delete.

### 7.6 Validate and publish

A checklist with a state per rule, each with the reason when it fails:

1. The lesson has a title, an address, instructions, and at least one test case.
2. The solution passes every test case.
3. The starter fails at least one test case.
4. Every wrong answer fails at least one test case.
5. No run reached the time limit.

Validate runs the checklist. Publish is available only when the checklist passed for the content now in the editor. On a published lesson, Save does the same: it validates, then saves. Unpublish and Archive ask for confirmation and say what learners will see.

### 7.7 Preview

`/admin/lessons/[id]/preview` shows the lesson in the real workspace with a banner that says it is a preview. Passing it records nothing.

## 8. States

Every data-bearing view implements all applicable states.

| View | Loading | Empty | Error | Other |
|---|---|---|---|---|
| Course list | Server-rendered; no spinner | No published course | Could not load | |
| Course page | Server-rendered | New learner: nothing completed | Could not load | |
| Workspace | Python loading | Console empty; tests not run | Python failed; learner errors; server unreachable | Unsynced completion; saved code restored; unsupported browser |
| Sign-in | Sending code; verifying | | Code not accepted; too many attempts; provider down | In-app browser |
| Profile | Server-rendered | No completions yet | Could not load | Deleting; deleted |
| Dashboard: courses | Server-rendered | No course yet | Could not load | |
| Dashboard: lesson editor | Python loading | No test case yet | Save failed; newer version exists; validation failed | Unsaved changes; saving; validating |
| Dashboard: second step | Verifying | | Wrong code; too many attempts | |

> **Approved by the owner on 2026-11-24 (proposed in WP-2.2):** a wrong code and an expired code on the sign-in screen are one state, "code not accepted", with one message. The auth service reports both as `otp_expired`, so the screen cannot tell them apart.

## 9. Words

Copy is written with `antislop-copywriting` loaded and lives in `src/messages` (NFR-I18N-01).

- Voice: a patient person sitting next to the learner. Second person. Present tense. Short sentences. No exclamation marks in errors.
- Reading level: a 13-year-old reading English as a second language. No idioms, no sarcasm, no culture-specific jokes.
- Buttons name the action: Run, Check, Stop, Reset code, Show a hint, Next: Variables, Validate, Publish, Fill from solution.
- Never blame: "Python could not read line 3", not "You made a syntax error".
- No em dashes, no buzzwords, no generic calls to action.
- Numbers shown to learners are real or absent.
- The dashboard speaks to the owner as a colleague: what will happen, what went wrong, what to change.

## 10. Design brief for `DESIGN.md`

This section was the brief for the direction interview in WP-1.1. The owner answered it on 2026-11-15, and `DESIGN.md` holds the result. `DESIGN.md` wins wherever it differs from this section. There is no brand kit (ADR-0031).

### 10.1 Identity

- Heap is named after the heap data structure.
- The wordmark is the live text "Heap Academy" in IBM Plex Sans. There is no logo, mark, or mascot.
- Amber `#D4A017` is kept from Heap's videos as the single accent. The CRT style and burgundy are not used.

### 10.2 Character

Formal, clean, and professional. A focused tool, closer to a well-made terminal than to a marketing site.

Design Read: *Reading this as: a coding practice tool for beginners arriving from short videos, in a formal, clean, professional style, dial ENERGY 1 / RHYTHM 1 / MOTION 1.*

### 10.3 Color

- One accent: amber. Used for the primary action, focus, progress, and the current item. Never for decoration.
- Text on amber is near-black, never white. Measured ratios: `#0E0E10` on amber 8.12 to 1 (`DESIGN.md` section 4.3); white on amber 2.38 to 1 (E-19), which fails.
- The measured pairs for every token in use are in `DESIGN.md` section 4.3.
- Pass and fail have their own colors, each at AA contrast on every surface it appears on. Warning has no hue of its own. All three are paired with an icon and a word (`DESIGN.md` section 4.2).
- Syntax highlighting uses a small palette that does not use amber; keywords are set apart by weight. It is defined as tokens (`DESIGN.md` section 4.4), each color AA on the editor background. A stock editor theme is not used.

### 10.4 Tokens

Three tiers, all CSS custom properties:

1. **Primitive**: raw values (`--amber-500`). Never used in components.
2. **Semantic**: purpose (`--color-action`, `--color-text`, `--color-surface-raised`, `--space-4`, `--radius-control`). Components use only these.
3. **Component**: only where a component needs its own knob.

A lint rule forbids raw color, spacing, or radius values in component code. This is the theme contract that makes a second theme a token file, not a refactor (ADR-0015).

### 10.5 Type

- IBM Plex Sans for the interface, lesson prose, the wordmark, and the XP and streak numerals. IBM Plex Mono for code. Handjet is not used. Reason: it is IBM's typeface for technical interfaces, with a monospace companion; it has an Arabic companion so a future Arabic interface keeps one type voice; and it is openly licensed for self-hosting.
- Lesson prose: at least 16 px, line height about 1.6, measure 60 to 75 characters. Code: at least 14 px desktop, 16 px on phones to avoid zoom on focus.
- Fonts are self-hosted, subset, and preloaded for the first view only.

### 10.6 Signature element

The seven-block progress glyph is dropped (ADR-0031). The identity motif is typographic: IBM Plex Mono for structural labels, and a 2 px amber bar on the current item (`DESIGN.md` section 2).

### 10.7 Shape, depth, motion

- Radius: small and consistent, set per element role. Nothing pill-shaped by default.
- Depth on a dark interface comes from surface steps and hairline borders. Shadows only for elements that float above content (dialogs, menus).
- Motion: 120 to 160 ms, ease-out, for state changes only. No entrance animations on scroll. Everything non-essential stops under reduced motion.

### 10.8 Icons and illustration

- Icons: IBM Carbon icons, few, each naming a real action or state (`DESIGN.md` section 8).
- Illustration: none anywhere in the product. Empty states, the completion moment, and the not-found page are text and actions.

### 10.9 Never

Purple or blue gradients, glass effects, glow on more than the focused element, sparkle or magic icons, emoji as icons, a fake terminal as a hero, bento grids, capsule badges that announce nothing, uppercase labels with wide tracking, stock illustration, anything that could be mistaken for another product with the logo swapped.
