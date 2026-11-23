<!-- No AI attribution in this description or in any commit: no co-author trailer, no "Generated with" line, no session link (CLAUDE.md rule 15). -->

## What and why

The lesson editor (FR-ADM-04, FR-ADM-10, NFR-SEC-07, T-06): the Markdown renderer, the one lesson-content component, the code editor, and the admin editor that saves a draft through `save_lesson`.

- **Markdown** (`src/content/markdown/`): part 1's allowlisted parser (`docs/reports/pull-requests/WP-4.2-part-1.md`), plus Python highlighting on the server (`highlight.ts`), which returns text runs. Nothing becomes an HTML string; React renders each run as a text node.
- **One lesson-content component** (`src/features/workspace/components/lesson-content.tsx`). The learner view and the editor's preview both use it. It renders headings, lists, tables, quotes, external links and highlighted code blocks with a Copy code control. Copy code says when the browser has no clipboard. A table's scrolling box is a named region. The preview moves the lesson's headings one level down, under its own heading; only the tag changes, not the look.
- **The code editor** (`code-editor.tsx`): CodeMirror 6 (ADR-0013) with a dark theme built from the tokens. Its styles carry the nonce of the policy the document was loaded with, so they still load after a move inside the app. It shares the Python palette. Escape, then Tab, leaves the editor.
- **The lesson editor** (`/admin/lessons/[id]`): Details (title, address, chapter, XP), Instructions with a live preview, hints, starter, solution, and up to three wrong answers. It warns before leaving with unsaved text, refuses a stale save and offers Reload, and keeps text typed while a save is in flight. A refused field is marked and focused, code fields included. Focus stays on the wrong answers when one is added or removed.
- **Lessons in the course editor**: lesson rows open the editor, Move up and Move down (`reorder_lessons`, migration `20261122010000_lesson_order.sql`), and Add lesson. Add lesson asks first when other text in the course editor is unsaved.
- **Versions**: a move keeps the lesson's `updated_at`, so an open editor can still save. A version supplied by a caller is ignored. A save that changes only the solution still gives a new version. A save keeps the lesson's place in its chapter (migration `20261123010000_save_lesson_keeps_place.sql`), so a move made while the editor was open is not undone.
- **Server actions** `saveLesson`, `createLesson`, `renderInstructionsPreview` and the lesson `reorder` run through the wrapper with access `admin`. `p_validated` is always `false`; validation is WP-4.3.
- **Zod** is set to `jitless` for every schema a browser loads (`src/domain/schema.ts`), so its `new Function` probe never runs under the script policy. A lint rule makes `src/domain` and `src/features/*/components` import `z` from there.

## Work package

- Work package: WP-4.2 The lesson editor (`docs/spec/08-delivery-plan.md`). Stacked on `wp/4.1-courses-chapters`, which `wp/4.2-lesson-editor` merges (d9e03ac). It contains part 1 (`wp/4.2-markdown-part-1`), so this pull request supersedes part 1's; do not open that one.
- Requirements and threats covered: FR-ADM-04, FR-ADM-10, NFR-SEC-07, T-06.
- Time box: 3.5 hours. Spread over sessions on 2026-11-20, 2026-11-22 and 2026-11-23, some of which left no record of their length. Total working time: not measured.

## How it was verified

- `pnpm verify` on 8b289f3, exit 0: Prettier, ESLint `--max-warnings=0`, `tsc`, attribution, `Test Files  69 passed (69)`, `Tests  1269 passed (1269)`.
- `next build` with the fake values of `.env.example`, on 8b289f3: exit 0. `check-static`: "No prerendered page in .next, apart from /_global-error, which Next.js always prerenders." `check-bundle`: "No server variable (RESEND_API_KEY, HEAP_RELEASE) in 22 files under .next/static."
- Database: the PGlite harness, every migration, then every test, with and without the seed. All 12 files pass, 0 not ok: `01` 33, `02` 80, `03` 57, `04` 54, `05` 47, `06` 8, `07` 6, `08` 14, `09` 22, `10` 6, `11` 11, `12_lesson_order` 27. **Not run on the Supabase image.** The new save-keeps-place assertion failed before the migration (`have: 0`, `want: 3`) and passes after it.
- Unit tests, with requirement IDs in their titles. They cover:
  - the renderer and `LessonContent` against the 27 malicious fixtures (no element outside the allowlist);
  - highlighting;
  - the copy control, including no clipboard;
  - the code editor's state, its nonce taken from the document, and its theme;
  - the lesson editor: a save in flight keeps typed text, a stale save, a refused field focused, wrong answers and their focus, the leave warning;
  - lesson rows: open, move, add, and the question before leaving;
  - the actions through the real wrapper for a guest, a learner, an admin at `aal1` and at `aal2`;
  - the store's error mapping;
  - `src/domain/schema.test.ts`: with `Function` replaced by a spy that throws, building and parsing the course and lesson schemas never calls it. The test fails without `jitless`.
- End to end and axe: **written, not run.** This sandbox has no working browser.
  - `e2e/lesson-editor-journey.spec.ts`: create a course and chapter, add a lesson, every malicious fixture in the preview, save, a stale save from a second tab, the leave question with unsaved text, and no `securitypolicyviolation` throughout.
  - `e2e/admin-gallery.spec.ts`: the lesson editor's and lesson rows' states.

## Screens

None. No browser runs here. `docs/reports/screens/WP-4.2/` is filled when the `e2e` job runs, at 1280 px.

antislop Delivery Gate report, antislop active: during (global preference). It is from the source only. Every line that needs a rendered page is NOT VERIFIED.

- Block 1:
  - PASS by code:
    - R-02: no em dash in the new messages.
    - R-17, R-18, R-36, R-38: the only numbers are the real limits.
    - R-23, R-24: no brand asset or illustration added.
    - R-27: the gallery shows a draft that saves and previews, a new empty lesson, a stale save with a failed preview, a published lesson whose save is pending, a failed save with three wrong answers and Add hidden, a taken address, an over-limit starter, two lessons to move, and the lesson content as learners see it. "Updating the preview" is in source and unit tests only.
    - R-32: focus as described above.
    - R-39: the preview's headings sit under its own heading. The table region has a name. Code fields are labelled and described.
  - NOT VERIFIED: R-03, R-25, R-26/R-35 (click-through), and the focus ring.
- Block 2: no gradient, glow or shadow. Amber is used only for Save lesson, links and focus. PASS by code.
- Block 3: ENERGY 1, RHYTHM 1, MOTION 1. The focal point is Save lesson.
- Block 4: C-4 NOT VERIFIED until screenshots exist.

## Reviews

Round 1 was run on be24f80 and is saved in `docs/reports/reviews/WP-4.2/`. No reviewer has re-reviewed the fixes. Part 1's reviews are in `docs/reports/reviews/WP-4.2-part-1/`.

- **code-reviewer (1): CHANGES REQUIRED.**
  - BLOCKER (text typed during a save lost): fixed in 88b1a41, with a test.
  - MAJOR (Add lesson skips the leave warning): fixed in c5a58dd.
  - MAJOR (Done-when evidence): still open. It needs CI's browsers. Said as "not verified" here.
  - MAJOR (lockfile): still open. Owner action 1.
  - MAJOR (solution-only save untested): fixed in 6525b30 (pgTAP).
  - MINORs:
    - The chapter read error and the slug race: fixed in a9f895c.
    - Section IDs per editor, and the invalid code field: fixed in 00d6336.
    - Copy with no clipboard, and "on the left": fixed in 9f24e34.
    - The comments in `code-editor.test.ts` and `structure-store.ts`: corrected.
    - Where `LessonContent` lives: decision 2.
    - "No test case yet": the test case list is WP-4.3's, and so is that empty state. The editor says how many test cases the lesson has.
- **security-reviewer (1): CHANGES REQUIRED, no blocker.**
  - MAJOR 1 (nonce after a move inside the app): fixed in 0088b4f. The editor reads the nonce from the document's own scripts, and uses the server's only when none is found. Not confirmed in a browser. The rule text is decision 1.
  - MAJOR 2 (packages copied in, no lockfile): still open. Owner action 1.
  - MINOR 1 (Zod's eval probe): fixed in 8b289f3.
  - MINOR 2 (a move during a save is undone): fixed in 3b1bcf8. `save_lesson` keeps the row's position unless the chapter changes. pgTAP `12` covers it.
  - MINOR 3 (no test that tries to set the version): fixed in 8b57cbb.
- **design-reviewer (1): CHANGES REQUIRED.**
  - BLOCKER 1 (CodeMirror's light theme wins): fixed in 6b799fe. The chrome is now an `EditorView.theme` with `dark: true`, built from the tokens. The computed styles are checked only in the unrun e2e.
  - BLOCKER 2 (no screenshots, axe or Gate report): still open. The Gate report is above; screenshots and axe need CI.
  - MAJOR 3 (invalid code field) and MAJOR 4 (focus on wrong answers): fixed in 00d6336.
  - MAJOR 5 (missing gallery states): fixed in 7db29ac.
  - MINOR 6 (the preview jumps), 7 (heading order), 9 (unnamed table region) and 10 (Python's name, the repeated "Published"): fixed in 9f34f75 and 00d6336.
  - MINOR 8: code fields now put the hint below the editor, and render it only when there is one.
  - MINOR 11: the comments are corrected.

Open MAJOR findings for the owner: the lockfile (owner action 1), and the Done-when lines that need a browser.

## Try it on the preview

1. After the owner actions of WP-2.2, WP-2.3 and WP-4.1: sign in, pass the second step, and open the seeded sample course.
2. Open a lesson. Change its instructions and watch the preview. Add a wrong answer, then save.
3. Open the same lesson in a second tab and save there. Save again in the first tab: it is refused, with Reload.
4. Type in a field, then press Back: you are asked before leaving.
5. In the course editor, move a lesson while its editor is open in another tab, then save that editor: the lesson keeps its new place.

## Owner actions now due

1. **The lockfile.** In a checkout of `wp/4.2-lesson-editor`, with dependencies installed, run `pnpm install && git add pnpm-lock.yaml && git commit -m "build: lock the CodeMirror packages" && git push`. Until then, every CI job fails at `pnpm install --frozen-lockfile`. Then compare the resolved transitive versions with those the security review lists: `@codemirror/autocomplete` 6.20.4, `@lezer/common` 1.5.6, `@lezer/lr` 1.4.12, `style-mod` 4.1.5, `crelt` 1.0.7, `w3c-keyname` 2.2.8, `@marijn/find-cluster-break` 1.0.4.
2. Everything WP-2.2, WP-2.3 and WP-4.1 still wait for. This branch is stacked on them.
3. After CI runs the `e2e` job: commit the screenshots, then ask `design-reviewer` for round 2.

## Decisions for the owner

1. **Where the editor's nonce comes from.** `.claude/rules/react-next.md` says to read the nonce from the request headers on the server and pass it down. After a move inside the app, that nonce is not the document's, and the browser refuses the styles. The editor now reads the nonce from the document's own scripts first. Recommendation: a `spec-change` to the rule, saying a client component uses the nonce of the loaded document. Default: as built, with the rule unchanged until you decide.
2. **Where the lesson-content component lives.** The rule says Markdown is rendered "by the one component in `src/content`". The module rules do not let `src/content` import `src/ui` or `src/messages`, so the component is in `src/features/workspace`, and the parser and highlighter stay in `src/content`. Recommendation: a `spec-change` to the rule. Default: as built.
3. **`save_lesson` ignores `p_position` unless the chapter changes.** The signature is unchanged, so its grants stay. Recommendation: accept. Default: as built.

## Deviations from the plan or the spec

1. The two rule texts in decisions 1 and 2.
2. A new lint rule: `src/domain` and `src/features/*/components` import `z` only from `src/domain/schema.ts`.

## Risks and rollback

- Nothing has run in a browser: the nonce fix, the theme and the leave warning for links and Back are proven only by the unrun e2e specs.
- Nothing has run against Supabase or PostgREST.
- The dependency tree that was tested was copied in from an npm install, not resolved by pnpm (owner action 1).
- Rollback: revert the merge. Data: the `reorder_lessons` function, the replaced `lessons_before_write` trigger, and `save_lesson` replaced in place. Reverting the code leaves them harmless. To restore the old position behaviour, re-apply `20261120120500_save_lesson.sql`'s function body.

## Definition of Done

- [ ] Every "Done when" line is met. **No.** The malicious fixtures are neutralized, and the preview and the learner view are the same component (unit tests). A stale save is refused (unit and pgTAP). The leave warning is unit-tested for closing the tab only; links and Back are e2e, not run. "The editor's styles load with no policy violation" is e2e, not run.
- [x] Every cited Must requirement has a passing test that names its ID.
- [ ] `pnpm verify` and every required check pass. `pnpm verify` passes. CI fails at install until owner action 1.
- [x] Every state of every changed view exists.
- [x] No stub, dead control, placeholder, commented-out code, or invented number.
- [x] New server actions use the wrapper. The new function and the trigger have policy tests.
- [ ] Every reviewer blocker is fixed. Code BLOCKER and design BLOCKER 1 are fixed. Design BLOCKER 2 needs CI's browsers. No reviewer has re-reviewed the fixes.
- [x] No AI attribution in any commit or in this description.

Create with:

```sh
gh pr create --draft --base wp/4.1-courses-chapters --head wp/4.2-lesson-editor --title "WP-4.2 The lesson editor" --body-file docs/reports/pull-requests/WP-4.2.md
```
