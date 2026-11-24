CHANGES REQUIRED

WP-4.2 (The lesson editor), commits 7ac42e4..be24f80. Part 1 (d7a5f36..26d7f62) was only checked where the new code depends on it.

### Findings

- **BLOCKER**, `src/features/admin/components/lesson-editor.tsx:150-162`: **text typed while a save is in flight is silently thrown away, and the bar then says "All changes saved".** This breaks FR-ADM-10 (Must): "Unsaved changes are never lost silently".
  - **Cause:** on success, `onSubmit` builds `clean` from `fields` as they were when Save was pressed, then calls `setFields(clean)` and `setSaved(snapshot(clean))`. While the save is pending, Save is disabled but the inputs are not, so anything typed in that window is overwritten. Because `CodeEditor` puts a new `value` into the document, keystrokes in the starter, solution and wrong-answer editors are wiped from the screen too.
  - **Evidence:** I ran a throwaway test outside the repository with the real `LessonEditor` and a save that resolves only when the test says so. It typed " one", pressed Save, typed " two", then let the save finish:
    ```
    TITLE AFTER SAVE: "Ask one" | unsaved shown: false
    AssertionError: expected 'Ask one' to be 'Ask one two'
    ```
  - **Fix:** after the save, set the saved snapshot to the submitted draft, but merge with the current fields, for example `setFields(current => ...)` that rewrites the trimmed title, hint and label values only where the field still holds the submitted value. Leave `unsaved` true if anything changed meanwhile. Add a test with the same arrange/act/assert as above, titled `[FR-ADM-10]`.

- **MAJOR**, `src/features/admin/components/lesson-rows.tsx:162-164`: **"Add lesson" leaves the course editor with `router.push`, which skips the leave warning.** `useLeaveWarning` (`leave-warning.ts`) only catches `beforeunload`, link clicks in the capture phase, and `popstate`. A programmatic push gets none of them.
  - **Effect:** if the owner has unsaved course details or an unsaved chapter rename, then adds a lesson, they are taken to the lesson editor and the other edits are lost with no question (FR-ADM-10).
  - **Evidence:** from reading the code only, not run. `AddLessonForm` clears only its own `formKey`, then pushes. `course-editor.tsx:45` holds `detailsUnsaved || chaptersUnsaved`, but nothing consults it before the push.
  - **Fix:** before `createLesson`, ask the same question when another form is unsaved (pass in a confirm from the course editor), or disable "Add lesson" until the other forms are saved. Add a test for it.

- **MAJOR**, Done-when evidence: **two "Done when" lines have no executed evidence, and the interface steps are still missing.**
  - "The editor's styles load with no policy violation": the only check that runs is the unit test that the `cspNonce` facet holds the nonce. The real check (`securitypolicyviolation` listener in `e2e/lesson-editor-journey.spec.ts`) has not run.
  - "Leaving with unsaved changes warns" is unit-tested for `beforeunload` only. Link click and Back in the real router are only in the unrun e2e.
  - Missing: `docs/reports/screens/WP-4.2/` does not exist, there is no axe run, no Delivery Gate report, and no `design-reviewer` pass. `CLAUDE.md` rule 5 and `.claude/rules/ui-design.md` require all of these for an interface pull request.
  - **Fix:** run both e2e specs locally or in CI, commit the screenshots, then the Delivery Gate and design review. Until then, the pull request must say "not verified" for these two lines.

- **MAJOR**, `package.json` (seven new `@codemirror/*` and `@lezer/*` dependencies): **`pnpm-lock.yaml` has no entry for any of them.** `grep -c codemirror pnpm-lock.yaml` gives `0`. CI runs `pnpm install --frozen-lockfile` (`.github/workflows/ci.yml:113, 135, 162, 210`), so every CI job will fail at install. This is already known to you; the installed versions in `node_modules` do match the pins. The lockfile must be committed before review in CI.

- **MAJOR**, `supabase/migrations/20261122010000_lesson_order.sql:52-58`: **stale-save detection now depends on an untested path.** `updated_at` is now kept when only `position` changes, which also covers a save that writes the same lesson row. So for a save that changes only the solution or the wrong answers, the version now moves only through `lesson_solutions_after_write` → `update lessons set gradable_changed_at` → the `gradable_changed_at` difference.
  - I followed the logic and it works, but neither `12_lesson_order.test.sql` nor `04_triggers.test.sql` asserts it. A later edit to either trigger could let a second tab overwrite a solution-only change without notice.
  - **Fix:** add pgTAP assertions:
    - `save_lesson` with only `p_solution_code` changed returns a newer `updated_at`.
    - A second `save_lesson` with the old copy then raises `lesson_changed_since_loaded`.

- **MINOR**, `src/features/admin/server/lesson-store.ts:71-77` and `:113-118`: **two database errors are dropped.**
  - When moving to another chapter, the "last position" query error is ignored and the lesson silently goes to position 0.
  - In `createLesson`, an error on the chapter lookup becomes `chapter_not_found` ("That chapter is no longer in this course").
  - Both should return `lessonFailure(error)` (`.claude/rules/typescript.md`: typed results, no silent failure).

- **MINOR**, `src/features/admin/server/lesson-store.ts:121-136`: **a slug race in `createLesson` shows the wrong message.** If two creates race, the `23505` becomes `slug_taken`, and the add-lesson form then says "Choose a different one" about an address field it does not have. Map it to a retry or `unavailable` in this path.

- **MINOR**, `src/features/admin/components/lesson-editor.tsx:205-207, 223, 244, 330`: **section IDs are fixed constants.** The gallery renders four editors, so `lesson-details`, `lesson-instructions` and `lesson-code` each appear four times. The side-list links and `aria-labelledby` of editors 2 to 4 point at editor 1. axe 4.14 files `duplicate-id-aria` as review-on-fail, so the gallery's `violations` assertion will not catch it. Prefix the IDs with `useId()`.

- **MINOR**, `src/features/admin/components/lesson-editor.tsx:403` (`CodeField`): **an invalid code field is not reachable or announced.**
  - `aria-invalid` sits on a plain `div`, so `focusFirstInvalid` (`:120`) calls `.focus()` on something that cannot take focus.
  - The error text is not linked to the editor (its `aria-describedby` is only the leave hint).
  - **Fix:** pass `aria-invalid` and the error ID through `contentAttributes`, and focus the `.cm-content`.

- **MINOR**, `src/features/workspace/components/copy-code-button.tsx:19`: **copy can fail with no message.** `navigator.clipboard.writeText` throws synchronously when `navigator.clipboard` is undefined (an insecure context, or some in-app browsers), so the "failed" state never shows. Wrap the call in `Promise.resolve().then(...)` or check for the API first.

- **MINOR**, `src/messages/admin.ts` (`previewEmpty`): **"Write the instructions on the left"** names a physical side. That is wrong in a right-to-left layout and against the spirit of the logical-properties rule. Say "in the Markdown field" instead.

- **MINOR**, spec consistency: **the lesson-content component is not where the rule says.** `.claude/rules/react-next.md` says Markdown "is rendered by the one component in `src/content`". `LessonContent` lives in `src/features/workspace`, which is the only place the module rules allow, since `content` may not import `ui` or `messages`. Propose a `spec-change` to the rule; do not leave the two disagreeing.

- **MINOR**, `src/features/workspace/components/code-editor.test.ts:9`: **the comment points to a test that does not exist.** It says keyboard behaviour is checked in `e2e/lesson-editor.spec.ts`. That file does not exist, and `e2e/lesson-editor-journey.spec.ts` has no Escape or Tab step. Either add the step or correct the comment. NFR-A11Y-03 itself belongs to WP-5.2.

- **MINOR**, `src/features/admin/server/structure-store.ts:183`: **a comment is attached to the wrong declaration.** The doc comment "Moves one course or chapter a place" now sits on `MoveTarget`, not on `move`, and does not mention lessons.

- **MINOR**, `src/features/admin/components/lesson-editor.tsx:290`: **the "No test case yet" empty state is not built.** `docs/spec/03-experience.md` section 8 lists it for the lesson editor; the page shows "This lesson has 0 test cases." Acceptable if WP-4.3 owns it, but say so in the pull request.

### Checked and found sound

- **Server actions:** all three actions use `defineAction` with `access: "admin"`, a strict schema and a byte cap. The tests cover guest, learner, aal1 and aal2 callers, and assert that the database is never called for refused callers.
- **Session client:** only the session client is used. There is no privileged import.
- **Stale save:** `p_validated` is always `false`, and `loadedAt` is passed through as Postgres's own text, microseconds included.
- **No HTML sink:** there is no `dangerouslySetInnerHTML`. Every Markdown string becomes a text node. All 27 `MALICIOUS` fixtures run through `renderMarkdown` and the real `LessonContent` against an element allow-list.
- **Nonce:** `proxy.ts:56` puts the policy on the request headers, and `requestNonce` reads it back from there.
- **Checks intact:** no suppression comments, skipped tests, `TODO`, physical CSS or raw values in the diff.
- **Attribution:** `git log --format=fuller` shows all 14 commits authored and committed by Fahad. Grepping for claude, anthropic, co-authored and generated found nothing.

### What I ran

- `pnpm verify`: exit 0. Format, lint with `--max-warnings=0`, typecheck, the attribution check on the branch and the files, and 67 test files / 1247 tests passed. This matches your figures.
- The throwaway in-flight-save test described in the BLOCKER, kept in `$TMPDIR` and deleted afterwards. The repository is unchanged.
- Installed CodeMirror and Lezer versions compared with `package.json`, and a lockfile grep.
- The axe-core 4.14 rule definition for `duplicate-id-aria`.

### What I did not check

- I did not run the pgTAP suite: `supabase test db` needs the local stack, and the PGlite runner is not in the repository. The trigger reasoning above is from reading the SQL.
- I did not run the e2e specs or `next build`, and did not check bundle size or `check-static`.
- I did not look at the interface itself: tokens, contrast, screenshots and copy tone are left to `design-reviewer`.
- I did not re-review the part-1 parser beyond what `renderMarkdown` and `LessonContent` rely on.
