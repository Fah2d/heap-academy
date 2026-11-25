# WP-2.3 design review 1 (condensed)

Reviewer: design-reviewer, of a0359dd. Verdict: CHANGES REQUIRED. antislop active: during (global preference). From source only.

- BLOCKER 1: no screenshots. The e2e spec saves four states at 1280 px; the empty and failed course list, checking, too many tries, the setup error and the narrow-screen sentence are not captured. Suggests a development gallery page for them.
- BLOCKER 2: no Delivery Gate report.
- MAJOR 3: below 1024 px the frame hides the page's `h1`, and at 200% zoom on a laptop the sentence "Open it on a larger screen" does not help. Give the narrow view a heading and say what to do (wider window, zoom out, larger screen).
- MINOR 4: the empty state does not say what to do first (WP-4.1 closes it with Create a course).
- MINOR 5: "Continue" does not name the action.
- MINOR 6: focus is lost after a rejected code.
- MINOR 7: the manual key is one unbroken string and is not tied to its label.
- Checked: semantic tokens only; amber only on the primary button and focus; `text-sm` table, `tabular-nums`; error notices with icon and word; no em dash; the QR code works with `img-src data:`; noindex; no brand asset created.
