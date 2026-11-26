# WP-5.4 code review 5

On a0e14ab (part 5: the admin lesson preview), a fresh-context subagent. The reviewer is read-only; the implementer saved this report and wrote the answers.

## Code review 5 (`code-reviewer`): CHANGES REQUIRED, 1 BLOCKER, 3 MAJOR, 3 MINOR

Found sound: the read names no solution or wrong answer and sends the browser what a learner's page sends; row level security keeps drafts to an admin at aal2; the guards for recording, durability and previous or next each fail a test when removed; words in `src/messages`; logical CSS; module boundaries; `/admin/` no-store; the leave warning covers the Preview link; the `waitFor` in `course-status.test.tsx` waits for state set inside the transition. Format, lint, types and attribution pass; vitest 129 files, 2314 tests, exit 0.

| # | Severity | Finding | Answer |
|---|---|---|---|
| 1 | BLOCKER | No test that a learner or a guest gets not-found at `/admin/lessons/[id]/preview` (WP-5.4 "Done when"); `ADMIN_ADDRESSES` in `e2e/admin-gate.spec.ts:13` and `e2e/admin-gate-journey.spec.ts:20` unchanged. | Fixed: both lists hold `/admin/lessons/<uuid>` and its `/preview` (the journey list covers the learner). `e2e/j8-add-lesson-journey.spec.ts` checks a guest gets 404 and the not-found heading at a real lesson's preview. `lesson-preview-page.test.tsx` checks the guard runs first and nothing is read when it refuses. |
| 2 | MAJOR | `workspace.test.tsx:676` passes with the in-memory code store guard removed (no `indexedDB` in the test environment). | Fixed: the test stubs `indexedDB`; with `previewing \|\|` removed it fails, with it it passes. |
| 3 | MAJOR | A preview with no test case: the worker refuses a check of none, so Check does nothing under "Check runs these tests on your code." A dead control. | Fixed: with no test case Check is disabled, its shortcut presses nothing, and the tests panel says "This lesson has no test case yet, so Check has nothing to run." Unit test added. |
| 4 | MAJOR | `LessonPreviewPage` untested: admin stage, not-found for a malformed ID or no row, the load-failed state. | Fixed: `lesson-preview-page.test.tsx`, 5 tests (guard first and no read on refusal; malformed ID with no read; no row; load failed with the back link; the workspace with the back link). |
| 5 | MINOR | Below 1024 px the hidden workspace still mounts, boots Python, and makes `body:has([data-workspace])` lock the page height from 768 px. | Accepted. The admin area is made for 1024 px and wider (section 7); between 768 and 1023 px the page shows one heading and one sentence, which fit the window. Loading Python unseen costs an admin some bandwidth only. |
| 6 | MINOR | `previewBody` says "as learners will see it", though the preview shows no previous or next, invitation or XP. | Fixed: "This is the lesson's last saved version in the learners' workspace. Nothing here is recorded: not your code, and not a pass." |
| 7 | MINOR | No browser check and no Delivery Gate screenshots of the preview or the editor's Preview link yet. | Fixed: `/dev/admin/preview` journey in Chromium (banner, back link, no page scroll in the admin frame, a pass that writes nothing to IndexedDB, axe), screens `admin-preview-passed-1280.png` and `admin-lesson-editor-preview-link-1280.png`. The real route needs the local stack (J-8, CI only). |
