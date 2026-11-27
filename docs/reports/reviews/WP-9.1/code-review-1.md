# WP-9.1 code review 1

Reviewer: `code-reviewer`, fresh context. Commit 5587e1f on `wp/9.1-visual-polish`. Verdict: CHANGES REQUIRED.

| # | Severity | Finding | Answer |
|---|---|---|---|
| 1 | MAJOR | The JS chose the widget's size at 300 CSS px, but the CSS reserved its height at `18.75rem`, which follows the browser's font size. At a 20 px or 12 px default the two disagree. The reserved space is then too tall, or the widget grows when it appears. | Fixed. The threshold and both heights are in px: `--container-challenge: 300px` in the theme, giving the `@max-challenge:` variant, and `--challenge-height` 65px and `--challenge-height-compact` 140px. Cloudflare draws the widget in CSS px whatever the font size. In a browser, with the root font size set to 16, 20 and 12 px, the reserved height is 140px for columns of 288, 280 and 296 px (a 320 px window), and 65px for columns of 343, 335 and 351 px (a 375 px window). That matches the JS choice each time. |
| 2 | MINOR | `clientWidth` is rounded; the container query is not. | Fixed. The JS measures `getBoundingClientRect().width`. |
| 3 | MINOR | No boundary test. | Added: 299.5 px is compact, 300 px is flexible. |
| 4 | MINOR | The size is fixed at first render, so a phone rotated from landscape to portrait keeps the flexible widget. | Recorded under "Risks" in `pull-requests/WP-9.1.md`. Re-rendering the widget clears its token, so it is not done here. |
| 5 | MINOR | `saveScreen` left the page scrolled to the top in the screenshot projects only. | Fixed. The scroll position is restored after the capture. |
| 6 | MINOR | No work package in the plan. | The owner gave this instruction in the session. The report says so, and carries the Delivery Gate and the design review. |
