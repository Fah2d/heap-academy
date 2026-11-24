<!-- No AI attribution in this description or in any commit: no co-author trailer, no "Generated with" line, no session link (CLAUDE.md rule 15). -->

**Base: `wp/3.4-statechart`, with `origin/wp/4.2-lesson-editor` merged in (48ee7b3). `wp/3.4-statechart` at a3957a7, which carries `main` at 7875ee2 (#12), is merged in 49546a8. Merges after WP-3.1, WP-3.2, WP-3.3, WP-3.4 and WP-4.2 (and so after WP-2.1, WP-2.2 and WP-2.3, which WP-4.2 carries).** Until those merge, this pull request also shows their commits. It is a **draft**, built in parts. Part 1 added the data and the rules the workspace needs, with tests. Part 2 (b386309) adds the lesson page and every region of the workspace. The browser tests, screenshots, axe, the Delivery Gate report and the reviews are part 3; no reviewer and no browser has seen part 2.

## What and why

WP-5.2 builds the lesson workspace on a laptop: `/learn/[course]/[lesson]`, with instructions, the editor, Run, Check and Stop, the console, the tests panel, errors, hints, Python's status, reset with undo, previous and next, shortcuts, the unsupported-browser message, and saved code on the device.

Part 1:

- `src/content`: `publishedLesson(course, lesson)`, the session-less, cached read of one published lesson of a published course (02-architecture.md section 7.3). It asks only for the public columns of `lessons`; solutions and wrong answers live in `lesson_solutions`, which it never touches. An address no lesson can have is answered with no query. The test cases are returned as stored: `content` may not import `grader`, so the workspace will parse them with the grader's schema.
- `src/domain/workspace/neighbours.ts`: previous and next across chapters (FR-WSP-11).
- `src/domain/workspace/shortcuts.ts`: Run on Ctrl or Cmd + Enter, Check with Shift added, and the `aria-keyshortcuts` value (FR-WSP-12).
- `src/messages/workspace.ts`: the heading and suggestion for each kind of learner error in `03-experience.md` section 6.5 (FR-WSP-09).
- `scripts/next-config.test.ts`: the test from WP-3.1 stubbed only the Supabase public values; the sign-in work (WP-2.2, through WP-4.2) made `NEXT_PUBLIC_TURNSTILE_SITE_KEY` required, so the merged branch failed to load `next.config.ts` in that test. 5bcd59c gives it the same fake value Playwright uses. No assertion changed.

Part 2 (b386309, 2026-11-24):

- `src/app/learn/[course]/[lesson]/page.tsx`: the route. It imports `LessonPage` and `lessonMetadata` from `src/features/catalog` (decision 7).
- `src/features/catalog/components/lesson-page.tsx`: reads the lesson and its course through `src/content` with no session, parses the test cases with the grader's schema, works out previous and next, and renders the instructions on the server. An address with no published lesson or course gets the standard not-found page. A failed read, test cases that do not parse, or a course whose order does not hold the lesson throws, so the request ends on the shared error page with status 500 (decision 8). The page and its metadata share one read per request.
- `src/features/workspace/components/workspace.tsx`: the workspace at 768 px and wider (`03-experience.md` section 6.1): the instructions beside the work, the editor above the actions and the output, previous and next below. The page does not scroll; each pane does. Below 768 px the regions follow one another in reading order until WP-5.3. The browser support check and the system's keys are read with `useSyncExternalStore`, so the server renders as if neither were known.
- `console-panel.tsx` (the output as text, the input line, the batch field), `tests-panel.tsx`, `learner-error-view.tsx` (with "go to line"), `hints.tsx`, `python-status.tsx` (download progress in megabytes, Retry), `reset-code.tsx` (with undo), `lesson-nav.tsx`.
- `src/ui`: `Tabs` takes a controlled `selectedKey` and can fill its box; `Button` sets `aria-keyshortcuts`; three Carbon icons (Checkmark, Reset, StopFilledAlt); four component tokens for the workspace grid in `src/ui/tokens/components.css`.
- Tests added: `src/features/catalog/components/lesson-page.test.ts` (7, FR-WSP-02: the ready lesson with its neighbours across chapters, null for an unpublished lesson or course, and a throw for each failure). The components have no unit tests yet; part 3 covers them with the browser journeys J-2, J-3 and J-4.

### The merge of WP-4.2 (48ee7b3)

Six conflicts, all two sides adding beside each other:

- `playwright.config.ts`, `scripts/eslint/module-boundaries.mjs`, `src/features/workspace/index.ts`: taken from `origin/wp/4.3-validate-publish`, whose copies are exactly this branch's plus WP-4.2's additions (checked with `diff`; WP-4.3 merged an older WP-3.4 in 938a05d, and none of these files changed on the WP-3.x side since).
- `src/infrastructure/http/security-headers.test.ts`, `src/proxy.test.ts`: both sides' imports and test blocks kept, unchanged.
- `docs/reports/local-build-progress.md`: this branch's copy kept (the `night-a` copy). The `night-b` copy on WP-4.2 is unchanged on its own branch.

### The merge of `wp/3.4-statechart` with `main` at 7875ee2 (49546a8)

`main` moved to 7875ee2 (#12, WP-2.1), which this branch already held through WP-4.2 apart from the merge commit itself. `wp/3.4-statechart` brought it with the approved spec changes of WP-3.3 and WP-3.4 (2026-11-24). One conflict, `docs/reports/local-build-progress.md`: `wp/3.4-statechart`'s copy held every line of this branch's, so it was taken.

- `pnpm verify` on 49546a8: exit 0, `Test Files  95 passed (95)`, `Tests  1880 passed (1880)`.
- `pnpm build` on 49546a8 with CI's fake public values and the Turnstile test key: exit 0, `runtime: worker compiled`. `check-bundle` and `check-static`: exit 0.
- Not run: the browser tests and `pnpm test:db`. No reviewer has seen 49546a8.

## Work package

- Work package: WP-5.2 The workspace on a laptop (`docs/spec/08-delivery-plan.md`).
- Requirements and threats covered so far: FR-WSP-02 (the lesson read), FR-WSP-09 (the words), FR-WSP-11 (neighbours), FR-WSP-12 (shortcut rules), T-21 (no solution in the read), T-25 (no query for an impossible address). Still to cover: FR-WSP-01, 03, 04, 05, 07, 08, 10, 17, 22, FR-SYS-02, NFR-PERF-03, NFR-A11Y-03, NFR-A11Y-04, T-07, and the rest of FR-WSP-02, 09, 11 and 12 in the interface.
- Time box, and time taken: 4 hours. Part 1: about 10 minutes, including the merge. Part 2: an interrupted run's work in progress (about 1,240 lines, kept in a stash), then about 10 minutes here to make it pass the gate and to move the server part.

## How it was verified

Part 2, on b386309:

- `pnpm verify`: exit 0, `Test Files  100 passed (100)`, `Tests  1917 passed (1917)`.
- `pnpm build` with CI's fake public values and the Turnstile test key: exit 0, the route listed as `ƒ /learn/[course]/[lesson]`. `check-bundle`: `No server variable (RESEND_API_KEY, HEAP_RELEASE) in 24 files under .next/static.` `check-static`: exit 0.
- Before the fixes, the work in progress failed the gate: Prettier on 5 files; lint, 5 errors (four arbitrary values for the grid, `heap/no-raw-values`, and a state update inside an effect, `react-hooks/set-state-in-effect`); `lesson-editor.test.tsx` failed to load (`This module cannot be imported from a Client Component module`); and `pnpm build` failed with 11 errors (`You're importing a module that depends on "next/headers"`), from the import trace `lesson-page.tsx` to `workspace/index.ts` to the admin's `lesson-editor.tsx`.
- Not run: the browser tests, axe, screenshots and `pnpm test:db`. No reviewer has seen part 2.

Part 1:

- `pnpm verify` on c86b7b4: exit 0, `Test Files  95 passed (95)`, `Tests  1880 passed (1880)`.
- `pnpm verify` on 5bcd59c (the merge and the config test fix): exit 0, `Test Files  92 passed (92)`, `Tests  1858 passed (1858)`. On 48ee7b3 alone, before 5bcd59c: `FAIL  scripts/next-config.test.ts`, `EnvironmentError: Invalid environment. See .env.example.` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY: required`.
- `pnpm build` on 5bcd59c with CI's fake public values: exit 0, `runtime: worker compiled`. `check-bundle` and `check-static`: exit 0.
- Tests added: `src/domain/workspace/neighbours.test.ts` (4, FR-WSP-11), `src/domain/workspace/shortcuts.test.ts` (6, FR-WSP-12), `src/messages/workspace.test.ts` (5, FR-WSP-09), and in `src/content/published.test.ts` 7 (FR-WSP-02, T-21, T-25). Run together with the changed tests: `Test Files  6 passed (6)`, `Tests  59 passed (59)`.
- Supabase's documentation was checked for the filter on the embedded course (`courses!inner(slug, title)` with `.eq("courses.slug", …)`): `!inner` drops lessons whose course does not match, and a many-to-one embed is an object.
- Not run: `pnpm test:db` (no database change), the browser tests (no interface yet).

## Screens

None yet: part 2 built the page with no browser available to this run; screenshots of every state are part 3.

antislop Delivery Gate report: due with part 3.

## Reviews

None yet. Due in part 3: `code-reviewer`, `security-reviewer` (the runtime, the content read) and `design-reviewer`.

## Try it on the preview

Open `/learn/<course>/<lesson>` for a published lesson. A preview built from this branch reads the staging database, so it shows a lesson only if one is published there. Not tried by this run: `gh` and the preview cannot be reached from this sandbox.

## Owner decisions of 2026-11-24

Every recommended default in this description was approved, so decisions 1 to 6 below stand. Decision 6 departs from `03-experience.md` section 6.5, so it is written there with the note "approved by the owner on 2026-11-24". The open default for part 2 (saved code in IndexedDB with a memory fallback, sharing WP-5.4's database) is approved too.

## Owner actions now due

None for part 1.

## Decisions taken without the owner (safe defaults)

1. Base: `wp/3.4-statechart` (which carries WP-3.1 to WP-3.3 and, since 49546a8, `main` at 7875ee2) with `origin/wp/4.2-lesson-editor` merged, as the owner's task list asked. `wp/4.3-validate-publish` is not merged: WP-5.2 does not depend on it.
2. WP-3.1's run fixes that wait on its security review 8, round 3, are not here, because `wp/3.4-statechart` does not carry them.
3. Shortcuts: on Apple systems both Cmd and Ctrl work (Ctrl + Enter is no browser key there); on Windows and Linux only Ctrl, because the system key belongs to the system. A held key does not run again, and Enter that ends input-method composition is not a shortcut. The check against browser shortcuts on each system is in part 3.
4. The published-lesson read returns the stored test cases unparsed. The architecture's rule that `content` imports only `infrastructure` and `domain` keeps the grader's schema out of it; the workspace parses them before any use.
5. FR-WSP-23 (one sentence per common error type, a Should) is not in WP-5.2's list and is left out. A runtime error shows the Python message as is.
6. Section 6.5 asks for a caret under the column of a syntax error. The worker protocol (version 1) carries a line and no column, so part 2 shows the line only (approved on 2026-11-24).
7. **The lesson page's server part lives in `src/features/catalog`, not in `src/features/workspace`** (part 2). The admin's client components import `CodeEditor` and `LessonContent` from the workspace's `index.ts`, and a feature may import another only through its index (`02-architecture.md` section 4.1). With the server page exported there too, the admin's client bundle pulled in `next/headers` and the build failed. The catalog already holds the other public pages that read published content on the server (WP-5.1), so the lesson page joins them, and the workspace's index exports only what runs in the browser: `Workspace`, `LessonContent`, `CodeEditor`, `RuntimeConsole` and `learnPath`. The other way out, a second entry for a feature's server code, changes the lint rule and the spec. `src/features/catalog/index.ts` is new here and also exists on `wp/5.1-catalog`; the merge keeps both sets of exports.
8. **A failed read of a lesson ends on the shared error page with status 500** (part 2), as WP-5.1 decided for the catalog's pages (approved by the owner on 2026-11-24, `03-experience.md` section 8 on that branch). A crawler comes back later instead of keeping a page that says nothing. The work in progress had its own "This lesson could not be loaded" view; it and its four strings are removed. The same holds when a published lesson's test cases do not parse, or when its course's order does not hold it: both mean the stored content is wrong, and the log line says which.
9. **The lesson page is not in the sitemap yet** (part 2). The sitemap is WP-5.1's and is not on this branch; its description says lesson pages join it when they are built, which is for whichever of the two merges second.

## Left for part 2 and part 3

- Part 2: done in b386309 (saved code on the device was done in 3d6d2d1).
- Part 3: J-2, J-3 and J-4 on Chromium, the keyboard and throttled-runtime checks, screenshots of every state at 375, 768 and 1280 px, axe, the Delivery Gate report, and the three reviews.

## Deviations from the plan or the spec

- The base is not `main`: WP-3.4 and WP-4.2 are not merged yet (the owner's task list asked for this).
- Decision 6 above, approved on 2026-11-24 and written into `03-experience.md` section 6.5.
- Decision 7 above: the lesson page's server part is in `src/features/catalog`, though the plan names the lesson page under the workspace.

## Risks and rollback

- `src/content/published.ts` is also changed on `wp/5.1-catalog` (night-b). Merging the two will conflict in that file; both add beside each other.
- Rollback: the branch is unmerged; nothing to roll back.

## Definition of Done

- [ ] Every "Done when" line is met, with evidence above. (Part 1 only.)
- [ ] Every cited Must requirement has a passing test that names its ID. (Part 1's do.)
- [x] `pnpm verify` and every required check pass.
- [ ] Every state of every changed view exists. (Built in part 2; not yet seen in a browser.)
- [x] No stub, dead control, placeholder, commented-out code, or invented number.
- [x] New tables have policies and policy tests. New server actions use the wrapper. (None added.)
- [ ] Every reviewer blocker is fixed. (No review yet.)
- [x] No AI attribution in any commit or in this description.
