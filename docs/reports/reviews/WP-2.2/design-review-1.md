# WP-2.2 design review 1 (condensed)

Reviewer: design-reviewer, of 0d17244, by reading code (no browser). Verdict: CHANGES REQUIRED. This file keeps each finding in the reviewer's order, shortened; the response is in the pull request description.

- BLOCKER 1: no screenshots in `docs/reports/screens/WP-2.2/`; the e2e spec saved only the default page, not the states of 03-experience section 8.
- BLOCKER 2: no Delivery Gate report (`docs/reports/pull-requests/WP-2.2.md` missing).
- MAJOR 3: every message rendered at the top of the page, out of view on a phone with the keyboard open.
- MAJOR 4: focus dropped to the body by "Use a different email" and "Show Google sign-in anyway".
- MAJOR 5: after the step change, the used challenge token stayed in state and the loading line stayed hidden.
- MINOR 6: Google's button showed no state while pending.
- MINOR 7: the challenge widget stayed on the code step the whole time.
- MINOR 8: the loading line's removal shifted the layout.
- MINOR 9: "below the field" in the challenge copy named a position.
- MINOR 10: "Send code" against spec 5.4's "Continue": record a spec-change.
- MINOR 11: `--spacing-challenge` belonged in `components.css`.
- MINOR 12: Sign out (bordered button) heavier than Sign in (nav link).
- Checked fine in code: no em dash, real numbers, plain copy, amber only on primary and focus, Google button name and source.
- Not verified: anything rendered.
