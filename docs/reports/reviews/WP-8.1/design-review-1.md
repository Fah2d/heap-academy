# WP-8.1 whole-application design review 1

Reviewer: `design-reviewer`, fresh context, antislop during. `main` at 5dcc577, 223 screens recaptured that day. It opened 77 of them across all 13 folders. Verdict: CHANGES REQUIRED.

| # | Severity | Finding | Answer |
|---|---|---|---|
| B1 | BLOCKER | The dashboard setup page's QR code was a broken image. auth-js returns `qr_code` as a `data:image/svg+xml;utf-8,` address, and `setup-flow.tsx` added a second prefix. The journey only checked visibility. | Fixed. `second-step.ts` removes the prefix and accepts only the shape the auth service sends: an optional XML declaration and comments (SVGo writes both), then `<svg`. The unit fixture is the auth service's real start. A first version that required bare `<svg` was caught by the code and security reviews before commit. The journey asserts `naturalWidth > 0`; `admin-gate-journey.spec.ts` in `stack`: 2 passed, and `admin-setup-1280.png` shows the code. |
| B2 | BLOCKER | 71 workspace screens were not from this commit: `runtime-chromium` was not in `SCREENSHOT_PROJECTS`. 13 `WP-5.2/*-375.png` files are written by no test and show the old phone layout. | Fixed. `runtime-chromium` saves screens. The 13 stale files are deleted. All screens recaptured. |
| B3 | BLOCKER | The profile has no screens: filled, empty, could not load, deleting, deleted, the delete dialog, the name error. | Not done here. For the owner: the next session adds the captures, then a second review. |
| B4 | BLOCKER | From 768 px up the workspace is framed by four bars (site header, title bar, previous/next, footer). At 1280×720 the editor gets about 65 to 100 px. | Not changed: structural, the shell and workspace layout. Recorded for the owner with the reviewer's proposed fix. |
| M1 | MAJOR | Nine dashboard screens are 17,000 px whole-gallery captures; the named states cannot be judged; dialogs are captured full page. | Not done here. For the owner: capture per region and dialogs at window size, then a second review. |
| M2 | MAJOR | Sign-in states without screens: sending, verifying, too many attempts, too many codes, the code step at 375 px. | Not done here. For the owner, as M1. |
| M3 | MAJOR | DESIGN.md's current-item marker (2 px amber inline-start border, weight 600, `aria-current`) is used nowhere; the course page's "Next up" row is the case it describes. | Fixed. `LessonRow` marks the next lesson with the border, weight 600 and `aria-current="step"`. Unit test. The `ChevronRight` status glyph is unchanged (minor 9). |
| M4 | MAJOR | Python's traceback shows before the plain-words error card. | Not changed: `console-panel.tsx` is changed on `wp/7.5-polish`, so the order is left for the owner to decide after that merge. |
| m1 | MINOR | An invalid field loses its red border under the pointer (hover is more specific). | Fixed in `text-field.tsx` and `text-area.tsx`. Unit test. |
| m2 | MINOR | A rejected sign-in code leaves the field neutral. | For the owner. |
| m3 | MINOR | The actions row wraps at 768; the Python status breaks across lines. | For the owner, with WP-7.5 MAJOR 4. |
| m4 | MINOR | Lesson code examples cut long lines with no sign they scroll. | For the owner. |
| m5 | MINOR | Hints show Markdown backticks literally. | For the owner (plain-text hints or inline code). |
| m6 | MINOR | An empty console box above the time-limit error. | For the owner. |
| m7 | MINOR | Two links to one place per course row. | For the owner. |
| m8 | MINOR | The error page says "Try again." above a "Try again" button. | For the owner (copy). |
| m9 | MINOR | `InformationFilled` and `ChevronRight` (as a status) are not in DESIGN.md's icon list. | For the owner (record or remove). |
| m10 | MINOR | The gallery's reset dialog says "You cannot undo this"; the workspace offers Undo. | For the owner (development gallery only). |
| m11 | MINOR | On a phone the unsupported warning sits below the lesson. | For the owner. |
| m12 | MINOR | Full-page phone captures paint fixed bars mid-page. | For the owner, with M1. |
| m13 | MINOR | One physical property, `border-b`, in `lesson-editor.tsx`. | Fixed: `border-be`. |
