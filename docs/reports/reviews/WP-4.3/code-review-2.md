CHANGES REQUIRED

Range `e1f1ce9..HEAD` at c5902d0, without `pnpm-lock.yaml`. Code commits: e51304f, ecbb815, 87af7ec. The round 1 fixes in e1f1ce9 were also checked.

The code in this range is sound. No new BLOCKER or MAJOR. The verdict stays CHANGES REQUIRED because one MAJOR from round 1 is still open: no e2e test has run, so there are no screenshots, no axe results and no Delivery Gate report.

## Round 1 BLOCKERs and MAJORs at HEAD

- **Code BLOCKER (Validate with a test case problem): fixed.** `lesson-editor.tsx:271-282`: `validate()` now runs `findTestCaseProblems` first, opens the test case, focuses the field and runs nothing. The editor tests' fake check now refuses whatever `parseTestCases` refuses (`lesson-editor.test.tsx:94-98`). The test at `:523` covers the case.
- **Code MAJOR (J-13 `exact: true` on half a line): fixed.** `e2e/j13-publish-journey.spec.ts:44-45` builds the whole status line, and that matches the single `<p>` at `lesson-status.tsx:75-77`. The fix has not been run.
- **Code MAJOR (Done when lines not proven): still open.** See finding 1.
- **Security MAJOR (T-07): fixed.** The output and Python's message go through `consoleText` (`validation-view.ts:83, 106`), and cleaned output is never offered to Fill.
- **Design MAJORs 2, 3 and 4: fixed.** Separate pending flags (`savePending`, `statusPending`); a failed start uses `unavailableStart`, which points to Try again, and shows as a `Notice kind="error"` with Try again (`validation-panel.tsx:137-148`).
- **Design BLOCKER 1 (screenshots, axe, Delivery Gate): still open.** Same as finding 1.

## Findings

**MAJOR 1, still open from round 1: three of the four Done when lines are not proven.** J-13 and the publish path end to end have never run. The new gallery e2e test from ecbb815 (`e2e/admin-gallery.spec.ts:415-503`) has never run either. No screenshots, axe results or Delivery Gate report exist (`ls docs/reports/screens/WP-4.3` gives `No such file or directory`). The editor has never run against a real Pyodide worker. Fix: run `pnpm test:e2e` for `admin-gallery.spec.ts` and `j13-publish-journey.spec.ts` against the local stack, fix whatever fails, commit the screenshots and write the Delivery Gate report. If this sandbox still cannot do that, the owner has to.

**MINOR 2: the Open button labels can point to the wrong position.** `src/features/admin/components/validation-panel.tsx:53-68, 128`. The label is numbered from `state.checked.testCases`, the order at the last validation. The button opens the test case by its ID in the current list. After a reorder, "Open test case 2 (Doubles)" opens the item the list now calls "Test case 1: Doubles". Fix: number the labels from the editor's current order, or hide the Open buttons while the panel is outdated.

**MINOR 3: no test checks that the focus request runs only once.** `src/features/admin/components/focus-after-commit.ts:19-22`. If the effect lost its dependency array, it would steal focus back after every render, and every current test would still pass. Fix: after `slug_taken`, click Title, type, and assert the characters land in Title and focus stays there. Also, `course-details-form.test.tsx:76` still waits one animation frame before asserting focus; that wait belonged to the old mechanism.

**MINOR 4: one limit in the same copy is still a literal.** `src/messages/admin.ts:324-325`: `nameHint` says "1 to 80 characters." with the number written in. It duplicates `TEST_CASE_LIMITS.name` (`src/grader/test-case.ts:29`). Fix: make it a function of the limit, like `problem.tooLong.name`.

**MINOR 5: `testCaseList.title` is now used only by tests.** `src/messages/admin.ts:317-322`. The component builds the title from `group(n)` and `titleName(name)`, so the rule for a blank name exists in two places. Fix: define `title` from `group(n)` and `titleName(name)`, or drop it.

**MINOR 6: the description is out of date.** `docs/reports/pull-requests/wp/4.3-validate-publish.md`: the opening still says "Parts 1 to 6", the Work package line says "parts 1 to 5"; "Left for part 8" lists design MINOR 11 as not done although ecbb815 built it; ecbb815's e2e test and `gallery-runtimes.test.ts` are missing from "How it was verified"; the open decisions are numbered 14, 16, 15; the time box leaves out the 17:08 to 17:24 session.

## The points asked about

- **`useFocusAfterCommit`: correct.** The request is set in the same synchronous tick as the state that marks the field, so both render in one commit. The parent's passive effect runs after its children's effects and after React Aria's layout effect that removes `hidden`. A new object on every request means a repeat request for the same selector still runs. The five changed component test files ran 6 times in a row (91 passed each time), and `course-details-form` and `lesson-editor` ran in 6 parallel processes (62 passed in each). No failures.
- **Verdict in the title and the Open buttons.** The accessible name "Test case 1: Doubles, Passed" comes from an `aria-hidden` `Status` plus `sr-only` text. The tests would catch a verdict shown for an outdated test case, a missing filter for removed test cases, an opener that does not open, and focus on the wrong element. Test case IDs are pattern-checked, so the selector cannot be malformed.
- **Limits.** `TIME_LIMIT_MS` is the limit the admin controller runs with; `HARNESS_OUTPUT_LIMIT` is the harness limit; `CHECK_TEST_LIMIT` is the parser's limit.
- **Gallery leak: none.** The production build in `.next` (built 17:23, after 87af7ec) has no `/dev` route, and `grep -rlF` for gallery strings in `.next/static` found nothing.

## What the reviewer ran

- `pnpm verify`: exit 0; 98 files, 1837 tests passed (pnpm's pre-run install was blocked by the sandbox store lock, so it ran on the existing `node_modules`).
- Repeated and parallel `npx vitest run` passes; `git log --format=fuller` (every commit by Fahad, no AI credit); searches of the `.next` build output.

## Not checked

No e2e tests, browser, local Supabase or database tests, no screenshots. No rebuild. Mutations were reasoned through, not run (read-only review).
