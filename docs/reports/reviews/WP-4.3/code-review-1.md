CHANGES REQUIRED

Range `938a05d..1443296` (parts 1 to 5).

## Findings

**BLOCKER: a test case with a problem makes Validate say Python could not run.** `src/features/admin/components/lesson-editor.tsx:262-266`, `src/features/admin/client/controller-checks.ts:47-52`. `validate()` passes `contentOf(fields)` to the runner without `testCaseProblems`. The worker protocol parses the test cases again with `parseTestCases`, which refuses a blank name or a field over its limit; `controller.check` returns `invalid`, `begin()` settles `undefined`, and the result is `{ kind: "unavailable" }`. "Add a test case" creates one with an empty name, so the first Validate is likely to show a false runtime error that Try again never clears. Same after "Fill from solution" pushes the expected output past 5,000 characters. Breaks FR-ADM-05 ("clear messages") and FR-ADM-07. A probe with the real `parsePageMessage`: `EMPTY NAME {"ok":false,"error":"invalid_field"}`, `NAMED true`. The editor tests miss it because their fake CheckProgram never parses test cases. Fix: check with `testCaseProblems` first and show the problem as Save does, or as a rule-1 failure; add a test through the real parser.

**MAJOR: three J-13 assertions will fail.** `e2e/j13-publish-journey.spec.ts:106, 114, 124` use `getByText(lessonStatus.now(...), { exact: true })`, but `lesson-status.tsx:72-74` puts `now` and `explain` in one `<p>`. Fix: `exact: false`, or the sentence in its own element. Then run J-13.

**MAJOR: three of four "Done when" lines unproven.** J-13 and the publish path have not run; the editor and a real Pyodide worker have never run together; no screenshot, axe result or Delivery Gate report.

**MINOR:** `src/features/admin/client/validation-runtime.ts:76-78`: `report: () => undefined` drops controller reports (`malformed_message`, `unexpected_message`, `fatal`, `worker_error`); `.claude/rules/runtimes.md` says report them, and the workspace does (`use-runtime.ts:104`).

**MINOR:** `lesson-editor.tsx:381-399`, `:404-430`: during Save's validation on a published lesson, the status buttons stay enabled; a status move then updates `loadedAt`, and the save that follows uses the old one and is refused as stale.

**MINOR:** `lesson-editor.tsx:120-122` with `:339-361`: `covers()` compares the raw validated title with the editor's, and `store` trims the title, so a trailing space makes Publish disappear after a save with "You changed the lesson after this validation".

**MINOR:** `src/features/admin/validation-view.ts:98-108`: `truncated` is read only from failed results; a passing result cut at the limit (possible with `contains`) shows no note and offers Fill with cut output over the 5,000 limit.

**MINOR:** `test-case-list.tsx:180`: each verdict is inside a collapsed disclosure whose title does not show it; section 7.5 says one action "shows each verdict". Question for design.

**MINOR:** the description's open decision 1 says "in part 3", which is done. Decision 9 is a real conflict between sections 4.4 and 7.6; as built, a typo fix on a published lesson needs Python and a passing checklist, and the runbook sends the owner down that path.

## What holds

- All 14 commits authored and committed by Fahad, no attribution.
- The server computes the hash from the parsed draft and test cases; labels trimmed the same way on both sides.
- `04_triggers.test.sql:156-159` refuses a changed test case on a published lesson.
- `setLessonStatus` uses the wrapper and the session client, checks `canMoveStatus` and `updated_at`, maps `lesson_not_validated`, expires the cache only on success.
- No suppressions, skipped tests, TODOs or boundary violations; `src/grader` stays pure; test titles cite IDs.

## What was run

`pnpm verify`: exit 0, 96 files, 1811 tests (pnpm's pre-run install blocked by the sandbox lock; nothing changed). The protocol probe in `$TMPDIR`.

## Not checked

No e2e, browser, local Supabase or database tests. No screenshots or axe. The dev gallery only in passing. `test-case-list.test.tsx` and `validation-panel.test.tsx` by their titles.
