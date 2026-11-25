# WP-3.4 code review 1 (condensed)

Reviewer: code-reviewer, of 36f4372. Verdict: CHANGES REQUIRED. The chart matches the architecture diagram edge for edge, a test checks that, and every listed transition has a test.

- BLOCKER 1 (FR-WSP-07): a Run or Check the controller refuses (`{ok:false, error:"invalid"}`: a program over 100,000 characters, more than 1,000 batch lines, an input line over 10,000 characters) leaves the chart in `running` or `checking` with the controller `ready`. Stop moves the chart to `restarting`, the controller does nothing, and no event ever arrives: stuck until reload. Reproduced with the real chart, driver and controller. Add a refusal edge back to `ready` (a spec-change to the diagram), or check the request before the transition; add a driver test through the real controller.
- MAJOR 2: nothing tests that the controller reports how a check ended (`ended`): the mutant `completeCheck(results, summarize(results))` survives all 231 runtime tests. No driver test of a check that hits the time limit, a crash during a check, a crash at `ready`, or a failed load then Retry.
- MAJOR 3: the 3adb4a0 fix "a refused Run leaves the lesson untouched" has no test (dropping `&& taken` survives). Test from `failed`, `running`, `idle`; test a pending Run marking the lesson `inProgress`.
- MINOR 4: a deliberate worker replacement (`memory`, `output_limit`) is sent as `CRASH`, which section 6 defines as dying unasked. The code says this is proposed as a spec change in the description, which does not exist yet; ADR-0020's library-or-reducer choice is only in a comment.
- MINOR 5: the spike report cites only ADR-0020; Pyodide in a worker is ADR-0004 and live input ADR-0005.
- MINOR 6: `e2e/statechart-runtime.spec.ts:22-26` races: if Python finishes loading before the click, "Run waits for Python" never shows.
- MINOR 7: CI builds only the production page set; a preview-only build failure shows up first on Vercel.
- MINOR 8: editing the program never sends `CODE_EDITED` on the development page.
- MINOR 9: `grade.test.ts:229` magic index 4.
- Checked and right: the WP-3.2 and WP-3.3 merge in the controller and worker core; `vercel build --prod` sets `VERCEL_ENV=production`, so the page stays out of production.

Ran: `pnpm verify` (1055 tests), two mutants (both survived), scratch scenario tests. Not run: e2e, a Vercel preview build, the phone check.
