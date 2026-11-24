# Code review 1: WP-5.3 part 1

Reviewer: `code-reviewer`, fresh context, read-only, on `wp/5.3-workspace-phone` at 1536808 (parent 3f5f1bb), 2026-11-24. The reviewer ran `pnpm verify` (exit 0, 1959 tests) and could not start the development server in its own sandbox, so its two focus findings were reasoned from the code. Speed mode: this is the only round.

Verdict: **CHANGES REQUIRED**, 2 BLOCKER, 5 MAJOR, 8 MINOR, 1 NIT.

## Findings and what was done (63a1097)

| Finding | What was done |
|---|---|
| BLOCKER 1: the views' tab list was written by hand, against ADR-0014 and `.claude/rules/ui-design.md`. | Removed. The `Tabs` primitive has a new `kind="views"`: React Aria's `Tabs` with `shouldForceMount`, so the panels stay mounted, hidden (`data-inert:hidden`) and inert. Below 768 px the workspace renders its own tree around those tabs; at 768 px and wider the old one. |
| BLOCKER 2: a shortcut in the editor switched to Output, the focused editor became hidden, focus fell to the body, and the next shortcut did nothing. | When the view changes and the focus is on the body or inside an inert panel, the selected tab takes it. Unit test: Ctrl+Enter in the editor twice gives two `RUN` and focus on the Output tab; it fails with the effect switched off (2 tests fail). |
| MAJOR: the server renders the wide layout, so a phone jumps after hydration. | Until the width is known, everything below the lesson is `max-md:hidden`: a narrow screen first shows the title and the lesson, the first view it gets. What remains is the tab list appearing above the lesson. Not measured on a slow phone. |
| MAJOR: "Go to line shows the Code view" was untested. | Unit test: a syntax error on line 2, Go to line in the Output view, the Code view is selected and the editor shown. |
| MAJOR: the bar above the keyboard was tested only as a pure function; the page's room for the bar not at all. | Unit test: a stubbed `visualViewport` (460 of 800 px) sets `--keyboard-inset: 340px` on the workspace, a resize sets `0px`, unmounting removes the listeners. Browser test: scrolled to its end, the last element of the Output and Lesson views ends above the bar; it fails without the page's bottom padding (`Received: -60.5625`). |
| MAJOR (likely): the fixed bar could hide the cursor while typing. | The editor's `scrollMargins` keeps `--action-bar-size` at the bottom (0 outside the phone layout). The bar now fits one row at 320 px: below 768 px its buttons have no icons and no key labels. Not checked with a real on-screen keyboard. |
| MINOR: `useSyncExternalStore` re-rendered the workspace on every viewport scroll. | The inset and the bar's height are written as CSS variables from listeners, with no state. |
| MINOR: the Chrome on Android comment was out of date; `innerHeight` follows pinch zoom. | Comment corrected (`resizes-visual` since Chrome 108). The layout height is `document.documentElement.clientHeight`. |
| MINOR: the unsupported browser below 768 px had no test. | Browser test at 375 px with no `Worker`: the notice, no views, axe. |
| MINOR: arrow keys worked from the selected view, not the focused tab. | Gone with the hand-written list; React Aria handles the keys. Unit test for ArrowRight. |
| MINOR: the spec ran in all three phone projects and raced on screenshots. | Its own project, `phone-workspace` (Pixel 7); the `phone` projects no longer match it. |
| MINOR: J-1 runs on `/dev/workspace`, not the real route. | Said in the spec's header comment and the description: the real-route journey (`e2e/j01-video-to-first-run.spec.ts`) is WP-7.4's. |
| MINOR: the commit overwrote WP-5.2's 375 px screens. | WP-5.2's files restored from 3f5f1bb. The desktop journeys now file their 375 px screens under `WP-5.3/`. |
| NIT: previous and next follow the Lesson view's last action. | Kept; decision 2 in the description. |

## Found while fixing

- Crossing 768 px rebuilt the action bar, and React Aria's announcement of a pending button then named an element no longer in the page (axe `role-img-alt` in J-2). The workspace's children are keyed and the bar is one of them in both layouts, so React moves it. The wide layout's grid now has rows for the editor, the actions and the output.
- The same rebuild lost the console's "answered" flag, so the second input line in J-3 did not take focus. The flag lives in the workspace now.
- The console's answer field was squeezed to about 55 px at 375 px. It keeps `--console-answer-min` (10 rem); Send and End input wrap.
