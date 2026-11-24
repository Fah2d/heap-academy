<!-- No AI attribution in this description or in any commit: no co-author trailer, no "Generated with" line, no session link (CLAUDE.md rule 15). -->

**Base: `wp/3.4-statechart`, with `origin/wp/4.2-lesson-editor` merged in (48ee7b3). `wp/3.4-statechart` at a3957a7, which carries `main` at 7875ee2 (#12), is merged in 49546a8. Merges after WP-3.1, WP-3.2, WP-3.3, WP-3.4 and WP-4.2 (and so after WP-2.1, WP-2.2 and WP-2.3, which WP-4.2 carries).** Until those merge, this pull request also shows their commits. It is a **draft**, built in parts. Part 1 (this push) adds the data and the rules the workspace needs, with tests. The lesson page and every screen are part 2; the browser tests, screenshots, axe, the Delivery Gate report and the reviews are part 3.

## What and why

WP-5.2 builds the lesson workspace on a laptop: `/learn/[course]/[lesson]`, with instructions, the editor, Run, Check and Stop, the console, the tests panel, errors, hints, Python's status, reset with undo, previous and next, shortcuts, the unsupported-browser message, and saved code on the device.

Part 1:

- `src/content`: `publishedLesson(course, lesson)`, the session-less, cached read of one published lesson of a published course (02-architecture.md section 7.3). It asks only for the public columns of `lessons`; solutions and wrong answers live in `lesson_solutions`, which it never touches. An address no lesson can have is answered with no query. The test cases are returned as stored: `content` may not import `grader`, so the workspace will parse them with the grader's schema.
- `src/domain/workspace/neighbours.ts`: previous and next across chapters (FR-WSP-11).
- `src/domain/workspace/shortcuts.ts`: Run on Ctrl or Cmd + Enter, Check with Shift added, and the `aria-keyshortcuts` value (FR-WSP-12).
- `src/messages/workspace.ts`: the heading and suggestion for each kind of learner error in `03-experience.md` section 6.5 (FR-WSP-09).
- `scripts/next-config.test.ts`: the test from WP-3.1 stubbed only the Supabase public values; the sign-in work (WP-2.2, through WP-4.2) made `NEXT_PUBLIC_TURNSTILE_SITE_KEY` required, so the merged branch failed to load `next.config.ts` in that test. 5bcd59c gives it the same fake value Playwright uses. No assertion changed.

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
- Time box, and time taken: 4 hours. Part 1: about 10 minutes, including the merge.

## How it was verified

- `pnpm verify` on c86b7b4: exit 0, `Test Files  95 passed (95)`, `Tests  1880 passed (1880)`.
- `pnpm verify` on 5bcd59c (the merge and the config test fix): exit 0, `Test Files  92 passed (92)`, `Tests  1858 passed (1858)`. On 48ee7b3 alone, before 5bcd59c: `FAIL  scripts/next-config.test.ts`, `EnvironmentError: Invalid environment. See .env.example.` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY: required`.
- `pnpm build` on 5bcd59c with CI's fake public values: exit 0, `runtime: worker compiled`. `check-bundle` and `check-static`: exit 0.
- Tests added: `src/domain/workspace/neighbours.test.ts` (4, FR-WSP-11), `src/domain/workspace/shortcuts.test.ts` (6, FR-WSP-12), `src/messages/workspace.test.ts` (5, FR-WSP-09), and in `src/content/published.test.ts` 7 (FR-WSP-02, T-21, T-25). Run together with the changed tests: `Test Files  6 passed (6)`, `Tests  59 passed (59)`.
- Supabase's documentation was checked for the filter on the embedded course (`courses!inner(slug, title)` with `.eq("courses.slug", …)`): `!inner` drops lessons whose course does not match, and a many-to-one embed is an object.
- Not run: `pnpm test:db` (no database change), the browser tests (no interface yet).

## Screens

None yet: part 2 builds the page.

antislop Delivery Gate report: due with part 3.

## Reviews

None yet. Due in part 3: `code-reviewer`, `security-reviewer` (the runtime, the content read) and `design-reviewer`.

## Try it on the preview

Nothing to try yet: no route is added in part 1.

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
6. Section 6.5 asks for a caret under the column of a syntax error. The worker protocol (version 1) carries a line and no column, so part 2 will show the line only, unless the owner wants the protocol changed (a spec change).

## Left for part 2 and part 3

- Part 2: the route and page; the panes; the editor with a "go to line" for errors; Run, Check, Stop and the console with the input line and the batch field; the tests panel; the error component; hints; Python's status; reset with undo; previous and next; shortcuts; the unsupported-browser message; saved code on the device. Open decision for part 2: `02-architecture.md` section 10 keeps saved code in IndexedDB, and WP-5.4 builds the progress store there. The default is a small saved-code store in IndexedDB with a memory fallback, built so WP-5.4's store can share the database.
- Part 3: J-2, J-3 and J-4 on Chromium, the keyboard and throttled-runtime checks, screenshots of every state at 375, 768 and 1280 px, axe, the Delivery Gate report, and the three reviews.

## Deviations from the plan or the spec

- The base is not `main`: WP-3.4 and WP-4.2 are not merged yet (the owner's task list asked for this).
- Decision 6 above, approved on 2026-11-24 and written into `03-experience.md` section 6.5.

## Risks and rollback

- `src/content/published.ts` is also changed on `wp/5.1-catalog` (night-b). Merging the two will conflict in that file; both add beside each other.
- Rollback: the branch is unmerged; nothing to roll back.

## Definition of Done

- [ ] Every "Done when" line is met, with evidence above. (Part 1 only.)
- [ ] Every cited Must requirement has a passing test that names its ID. (Part 1's do.)
- [x] `pnpm verify` and every required check pass.
- [ ] Every state of every changed view exists. (No view yet.)
- [x] No stub, dead control, placeholder, commented-out code, or invented number.
- [x] New tables have policies and policy tests. New server actions use the wrapper. (None added.)
- [ ] Every reviewer blocker is fixed. (No review yet.)
- [x] No AI attribution in any commit or in this description.
