# WP-7.5 design review 2

Reviewer: `design-reviewer`, fresh context, antislop during. Commit 3f2ba8f and its 41 screens. Verdict: CHANGES REQUIRED, no blocker. Every review 1 fix was found in the screens.

| # | Severity | Finding | Answer |
|---|---|---|---|
| 1 | MAJOR | home-editor-failed: the answers box said the browser cannot pause a program, when Python never started and nothing was tested. | Fixed in `console-panel.tsx`, for the workspace too: the box shows only in ready, running, waiting for input, checking and restarting, when Python has said it cannot pause. Test for idle, loading and failed. |
| 2 | MAJOR | near-miss-spaces-375: the expected output wrapped at the space that differs, so a missing space read as a line break. | Fixed: test case outputs never wrap (`whitespace-pre`) and scroll sideways; each block is focusable and named, for the keyboard and axe. Test. |
| 3 | MAJOR | symbol-row-keyboard: the screens showed no code, and the test's claim that the editor keeps room above was not proven. | The claim is withdrawn. CodeMirror scrolls the cursor inside the visual viewport (`windowRect` in `@codemirror/view`), and an emulated phone has no keyboard to shrink it, so no emulated test can show it. The journey now asserts only that the whole bar sits above the 300 px keyboard, and the screen is the area above it. Where the cursor lands with a real keyboard is for the owner, on a phone. |
| 4 | MINOR | The h1 moved when the editor's output grew at 1280 px. | Fixed: the two columns align to the top. This brings back review 1's MINOR 7, empty space under the h1, as the lesser of the two. |
| 5 | MINOR | No-editor state: "Change it" above "cannot be changed"; the note cut the program at 375 px. | Fixed: heading "A Python program you can run" and "Press Run to run it." in that state; the note is under the box, not inside it. |
| 6 | MINOR | Unsupported state: the heading named a program that is not shown. | Fixed: no heading; the notice alone. |
| 7 | MINOR | starting-375: the Python status pushes Stop to a second row in one state. | Not changed: the PythonStatus layout predates this package, and the same as design review 1 MAJOR 4. For the owner. |
| 8 | MINOR | The seed lesson's example is an indented code block, which renders as a paragraph. | Not changed: the seed predates this package and is read by other packages' journeys and screens. For the owner. |
| 9 | (carried) | Review 1 MAJOR 2 (tests pane height) and MAJOR 4 (phone bar height). | Still for the owner. |
