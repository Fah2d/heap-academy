# WP-7.5 code review 1

Reviewer: `code-reviewer`, fresh context. Range 5dcc577..bfc09bd. Verdict: CHANGES REQUIRED.

| # | Severity | Finding | Answer |
|---|---|---|---|
| 1 | BLOCKER | `code-editor.tsx`: the last symbol-row key was inserted again whenever the editor was rebuilt (crossing 768 px, as when a phone rotates), and saved. | Fixed in 3f2ba8f: the editor ignores a request it saw before it was built. Test in `symbol-row.test.tsx`; it fails with the guard removed. |
| 2 | MAJOR | `home-editor.tsx`: a failed download of CodeMirror's chunk reached the root error page and replaced the whole home page. | Fixed: a local error boundary keeps the program as plain text, says the editor did not load, and keeps Run. Unit test, and an e2e that aborts the chunk at three widths. |
| 3 | MAJOR | `compare.ts`: `\p{P}` counted a decimal point or a minus sign as punctuation, so "35" for "3.5" read as a punctuation slip. | Fixed: punctuation beside a digit is not stripped. Tests for `3.5`, `-5`, `1,000`. |
| 4 | MAJOR | `compare.ts`: in exact mode a missing last line never fired for output `print` writes (trailing line break). | Fixed: a line break both texts end with is dropped before the line comparison. Test with print-shaped output. |
| 5 | MAJOR | States and screens short of "Done when": home editor failed, unsupported, too large; widths; no Delivery Gate. | Fixed: eight home-editor states and three near-miss kinds, each at 375, 768 and 1280 px. The Delivery Gate is in `pull-requests/WP-7.5.md`. |
| 6 | MINOR | "Reviewed by the owner like lesson text" claimed a review that has not happened. | Removed; the review is an owner action in the description. |
| 7 | MINOR | Wrong spec file named in a test comment. | Fixed. |
| 8 | MINOR | `data-home-program` read by nothing. | Removed. |
| 9 | MINOR | The box-height test checks a class only; the no-runtime-request assertion did not wait for the network. | The e2e now waits for network idle. CLS is measured by Lighthouse (0 on three runs), recorded in the description. |
| 10 | MINOR | `courseForEditor`'s counts-error branch untested. | Tested. |

Not changed: `goToLine` replays on a rebuild in the same way; it predates this range.
