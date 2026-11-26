# WP-3.3 code review 4

- Reviewer: code-reviewer subagent, fresh context, read-only. The implementer saved this report from its final message and added the "Fixed in" lines.
- Range: df1c7bb, the merge of `wp/3.1-python-worker` (aec6c83) into `wp/3.3-grader` (6091856): the conflict resolution in `src/runtime/controller.ts` and `src/runtime/controller.test.ts`, and the `isDisposed()` guards the merge added to the check paths.
- Date: 2026-11-24
- Verdict: **CHANGES REQUIRED**, for MINOR 1 only. The reviewer found no path left that starts a worker, starts a timer, sends an event or changes the status after a listener disposes the controller. The code could be approved as it stands.

## Findings

**MINOR 1** `docs/reports/pull-requests/WP-3.3.md` and the df1c7bb commit message: both said "Ten new tests". The merge added nine, and the list of what they cover left out the waiting-check test. Evidence: `vitest run src/runtime/controller.test.ts --reporter=verbose | grep -cE "runtime controller: checks > .*dispose"` printed `9`.

- Fixed in the follow-up commit: the description gives the exact count and lists every test. The commit message stays as it is, because changing it would rewrite a pushed branch; this report records the correction.

**MINOR 2** `src/runtime/controller.ts`, `check()` with `freshWorker`: when the `restarting` listener disposed the controller during the call, `check()` still returned `{ ok: true, runId }` for a check that would never send `check_done`. Probe: `fresh+restarting returns {"ok":true,"runId":"run-2"} {"status":"disposed","workers":1,"alive":0,"timers":0,"events":["restarting"]}`.

- Fixed in the follow-up commit: `check()` returns `{ ok: false, error: "not_ready" }` in that case. The test asserts it; removing the guard fails 1 test.

**MINOR 3** `src/runtime/controller.test.ts`: the merged helper had two listener mechanisms, WP-3.3's `onEvents` array (used by one T-22/T-23 test) and WP-3.1's `listen` listeners. The resolution was correct, but two ways to do one thing is clutter.

- Fixed in the follow-up commit: `onEvents` is gone; the T-22/T-23 test passes an `onEvent` listener to `started()`.

**MINOR 4** Test gap, no defect: nothing tested dispose from the `ready` event that has just sent a waiting check. It is safe because `onEvent` comes last and `dispose` clears the clock `send` started.

- Fixed in the follow-up commit: a test disposes from that `ready` event and expects no live worker and no timer. Moving the `ready` event before `send` fails 2 tests.

## What the reviewer checked

- Probes that dispose at each listener call: `stop()` with a waiting check, `ready` sending a waiting check, `check()` with `freshWorker`, an out-of-order `test_result`, a report while a check waits, and the second test case's clock. Each left status `disposed`, 0 live workers and 0 timers.
- Each guard removed in turn: restart start 8 tests fail, after `restarting` 9, `crashed` start 4, the waiting-check branch 1, `run_done` 1, `test_result` 1, `check_done` 1.
- The test helper: both listener kinds run after the event is recorded; all 24 WP-3.1 test titles are in the merged file.
- `CLAUDE.md`: only rule 1 (MINOR 1). Format, lint, types and the attribution check pass on a `git archive df1c7bb` copy; vitest 42 files, 1065 tests.
- Not checked: the browser tests, the coverage thresholds, how `use-runtime.ts` calls `dispose`.
