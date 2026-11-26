# Code review 1: WP-5.2 part 2

Reviewer: `code-reviewer`, fresh context, read-only, on `wp/5.2-workspace-laptop` at b386309 (range 49546a8..b386309), 2026-11-24. The reviewer noted that the worktree already held uncommitted part 3 work (the development page, the browser spec, a first change to `console-panel.tsx`), and reviewed b386309 from git objects.

Verdict: **CHANGES REQUIRED**, 2 BLOCKER, 4 MAJOR, 14 MINOR, 3 NIT.

## Findings and what was done (bd36501)

| Finding | What was done |
|---|---|
| BLOCKER 1: the four workspace tokens were written straight inside `@media (width >= 48rem)`, outside any rule, so the build dropped them and the grid read undefined values. Confirmed in the built CSS. | Moved into `:root`. `src/ui/tokens/token-use.test.ts` checks that every token a utility names (`-(--name)`) is declared inside a rule; it fails on b386309's `components.css` (`--workspace-columns`, `--workspace-rows`, ...) and passes now. The built CSS has `--workspace-columns:minmax(20rem, 2fr) 3fr`. |
| BLOCKER 2: no component tests for NFR-A11Y-04, T-07, FR-WSP-17, FR-WSP-22, FR-WSP-11, FR-WSP-10, FR-WSP-12. | `workspace.test.tsx` (FR-WSP-12 labels and keys, a held key, NFR-A11Y-04 live region for a run and a check, FR-WSP-10 reset and undo, FR-WSP-04 refusal, FR-WSP-08 batch lines), `workspace-parts.test.tsx` (FR-WSP-17 progress, failed with Retry, restarting, ready; FR-WSP-22 no hints, one at a time; FR-WSP-11 disabled end and the next link), `workspace-output.test.tsx` (T-07). Two mutants checked: pressing on a held key, and the batch split without the trailing-line rule; each fails one test. |
| MAJOR 1: focus fell to the body when Run, Check, Stop or Reset became disabled; the input line then never took focus. | The four buttons use React Aria's `isPending` while unavailable: focusable, `aria-disabled="true"`, no press. The `Button` primitive styles `data-pending` as it styles `data-disabled`. The input line takes focus back after an answer from the input line (the line goes away between prompts). J-3 asserts focus on both prompts; with the old rule the first assertion fails (`Received: inactive`). |
| MAJOR 2: the summary took focus each time the tests panel mounted. | Focus moves only when a check ends while the panel is shown (a new summary, and the last thing that ended was a check). |
| MAJOR 3: a refused Run or Check did nothing visible. | The workspace checks the protocol's own limits before sending (`tooLarge` in `workspace-view.ts`, with tests) and shows the reason in an error notice that is announced, until the code or the input changes. Browser test `[FR-WSP-04]`. |
| MAJOR 4: "Back to {course}" links to `/courses/<slug>`, which this branch does not have. | Not changed. Decision 10 in the description: WP-5.1 merges before WP-5.2. |
| MINOR: a held Ctrl or Cmd + Enter added blank lines. | The shortcut is kept from the editor on repeat too; only the press is skipped. Tested. |
| MINOR: Ctrl+Enter ran code while the reset dialog was open. | Keys count only when their target is inside the workspace in the DOM. |
| MINOR: a trailing line break in the batch field added an empty answer. | `inputLines` drops one trailing line break. Tested. |
| MINOR: the reset notice's live region was inserted with its text. | An always-present status region; Undo is outside it. |
| MINOR: the summary is said twice (live region and focus). | Not changed: the live region serves a learner whose focus is elsewhere, and FR-WSP-06 asks for the first failure to be focused. Listed for the design review. |
| MINOR: punctuation written in components. | The full stop after the unsupported-browser title moved into the message. The `: ` after a kind label follows the `Notice` primitive's own pattern and is left as it is. |
| MINOR: the unsupported-browser warning was labelled "Information". | Labelled "Warning" (`warningKind`). |
| MINOR: the `kbd` text was part of the button's name. | `aria-hidden` on both `kbd`; the keys are in `aria-keyshortcuts`. |
| MINOR: the lesson ends were not exposed as disabled controls. | `role="link"` with `aria-disabled="true"` and no `href`. Tested. |
| MINOR: `supportsPython` ran on every render. | Worked out once, lazily, at module level. |
| MINOR: the work section had no overflow at short heights. | `overflow-auto` on the work section. Not yet seen at a short height in a browser. |
| NIT: the test title format. | `[FR-WSP-02]`. |
| NIT: the announced line count includes echoed input; typing before IndexedDB answers drops the saved code silently. | Not changed; listed in the description. |
