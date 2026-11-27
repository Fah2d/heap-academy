# WP-7.5 design review 1

Reviewer: `design-reviewer`, fresh context. Range 5dcc577..bfc09bd. Verdict: CHANGES REQUIRED.

| # | Severity | Finding | Answer |
|---|---|---|---|
| 1 | BLOCKER | `near-miss-punctuation-768.png` did not show the sentence: the tests pane clipped it, and `toBeVisible` does not check scroll clipping. | Fixed: the journey scrolls the sentence into view and asserts `toBeInViewport` before each screen. |
| 2 | MAJOR | At 768 and 1280 px the tests pane is too short to show the near miss beside the outputs it explains. | Not changed: the workspace layout predates this package. For the owner. |
| 3 | MAJOR | Home editor states without screens (unsupported, failed, too large, input), and single widths. | Fixed: every state at three widths. |
| 4 | MAJOR | The phone action bar is tall while Python starts (row, buttons, status); the status wraps. | Not changed: the status layout predates this package. For the owner, with `symbol-row-keyboard-*.png`. |
| 5 | MINOR | The symbol row sat above Run and Check, not on the keyboard. | Fixed: the row ends the bar. |
| 6 | MINOR | Row captures never showed the first keys. | Fixed: captured at scroll start. |
| 7 | MINOR | Empty area under the home heading at 1280 px. | Fixed: `lg:items-center`. |
| 8 | MINOR | "Try it" close to a generic call to action; "in your browser" three times. | Fixed: "A Python program you can change", "Change it, then press Run." |
| 9 | MINOR | The home page has no primary action. | For the owner: Run primary on the home page only, or as is. |
| 10 | MINOR | The explanation was separated from the message by the line button, and muted. | Fixed: directly under the message, in the text color. |
| 11 | MINOR | AttributeError sentence too hard. | Replaced. |
| 12 | MINOR | Test data in the screens. | Fixed: recaptured on a clean seed with one worker. |
| 13 | MINOR | No screen of a missing last line. | Stated: the seed's expected outputs are one line each; unit and component tests cover it. |
