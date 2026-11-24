<!-- No AI attribution in this description or in any commit: no co-author trailer, no "Generated with" line, no session link (CLAUDE.md rule 15). -->

**Base: `wp/3.3-grader`; merges after WP-3.1, WP-3.2 and WP-3.3.** `wp/3.2-live-input` is merged into this branch (312bf29), and `wp/3.3-grader`, which carries `main` at 0efe863, is merged (last in a9c8c0c, at a35dc80). Until those merge, this pull request also shows their commits. It is a **draft**: the browser tests have run in Chromium only (39 runtime tests and 16 shell tests pass after the selector fix in 64bb6c3), not in Firefox or WebKit, and the phone check is the owner's.

## What and why

The workspace statechart of `02-architecture.md` section 6, the driver that connects it to the runtime controller, and the development page on Vercel previews where the owner runs Python on real phones.

1. **The statechart** (FR-WSP-07, FR-WSP-17): `src/runtime/workspace-chart.ts`, a typed reducer with no library (ADR-0020 left the choice to this package). Two regions: the runtime, transition for transition as the architecture diagram draws it, and the lesson (`untouched`, `inProgress`, `passed`). A Run or Check pressed while Python loads or restarts is kept as the one pending intent and fires on ready.
2. **The driver**: `src/runtime/workspace-driver.ts`. Maps controller events to chart events and chart effects to controller calls. `dispatchEvent` applies an event, performs its effects, and when the controller refuses the Run or Check a transition started (a program over 100,000 characters, more than 1,000 batch lines, an input line over 10,000 characters), brings the chart back to `ready` by the diagram's own `RUN_DONE` or `CHECK_DONE` edge (review 1, BLOCKER 1).
3. **The development page** `/dev/runtime` runs through the chart: a program with input, the example lesson's check, and a runaway loop. It is a page only on the development server and on Vercel previews (`.preview.tsx`, built when `VERCEL_ENV` is exactly `preview`), never in production.
4. **The spike report** `docs/reports/spikes/runtime-devices.md`: the phone check's method and an empty results table for the owner.

## Work package

- Work package: WP-3.4 The statechart and the phone check.
- Requirements: FR-WSP-07, FR-WSP-17; NFR-COMPAT-01 and NFR-COMPAT-02 wait for the phone check.
- Time box 2 hours. Over the box: the work ran across four sessions, first commit 2026-11-21 05:56, last 2026-11-22 07:00, with the WP-3.2 merge inside it. Hours of work not measured. Reported here as the handbook section 3.4 asks. Nothing was cut to fit.

## Up to date with main

`wp/3.3-grader` at a35dc80 is merged in a9c8c0c. It adds WP-3.3 security review 4 and its fixes (203b6bb, 6a4f0f8, 839707a, f4c7a16, 7468f65, 3fa2bd3): between test cases the harness frees the `sys.monitoring` tools, restores `gc.callbacks`, the `sys` hooks, the import lists, the importer cache, the line cache, the digit limit and the async generator hooks, checks them by identity, and raises `NotRestored` when the state is not back. `HARNESS_VERSION` is now "3". One conflict, `docs/reports/local-build-progress.md`: each copy had one section the other lacked, so both are kept, newest first. `src/grader/harness.ts` and its tests merged with no conflict.

This branch has no code that depends on the harness version: `grade.ts` reads `HARNESS_VERSION` from the harness, and no test or browser test expects "2". No reviewer has seen a9c8c0c (a clean code merge).

`main` is still 0efe863, which `wp/3.3-grader` carries.

`pnpm verify` on a9c8c0c, exit 0:

```
 Test Files  46 passed (46)
      Tests  1213 passed (1213)
```

`pnpm build` with CI's fake public values on a9c8c0c, exit 0 (`runtime: pyodide 314.0.7, 13531207 bytes, 5464072 with Brotli (budget 6500000)`, `runtime: worker compiled`); the built harness has `HARNESS_VERSION = "3"`. `node scripts/check-bundle.mjs .next/static` and `node scripts/check-static.mjs .next`: exit 0. Not run on the merge: the browser tests.

## How it was verified

`pnpm verify` on the last commit (round 2 fixes), exit 0:

```
 Test Files  41 passed (41)
      Tests  1066 passed (1066)
```

`pnpm build` with CI's values (`VERCEL_ENV` unset), then the two checks, on a884853:

```
build=0
bundle=0
static=0
┌ ƒ /_not-found
├ ƒ /api/csp-report
└ ƒ /api/health
```

The same build with `VERCEL_ENV=preview`:

```
build=0
No prerendered page in .next, apart from /_global-error, which Next.js always prerenders.
┌ ƒ /_not-found
├ ƒ /api/csp-report
├ ƒ /api/health
└ ƒ /dev/runtime
```

Mutants run after the review fixes: dropping the refusal event in `dispatchEvent` fails 3 tests; dropping `ended` from a check the page ended (`completeCheck(results, summarize(results))`, review 1 MAJOR 2) fails 1; running the effects before storing the state fails 1.

**Tests added**, each title carrying its requirement:

- `src/runtime/workspace-chart.test.ts`: every transition of the table; every unlisted pair a no-op with no effect; the diagram in `02-architecture.md` parsed and compared to the table; the restart reason; the pending intent (kept, replaced, fired on ready, forgotten after a stop); the lesson region (edit, Run and Check mark it in progress; a passing check completes it once; a failing check or a stray `CHECK_DONE` does not; a pass is never taken back; a Run or Check from `idle`, `failed`, `running`, `awaitingInput` or `checking` leaves an untouched lesson untouched; a Run kept as the pending intent marks it in progress); generated paths reach every state and fire every transition; the controls.
- `src/runtime/workspace-driver.test.ts`: every controller event mapped; how a check ended read only from the controller; a new worker read as CRASH only at rest; effects in order, Stop only for the learner's STOP; the refusal events. With the real controller, a fake worker and a fake clock: Run kept while loading; input; a runaway loop to the time limit and the next run; Stop; a passing check completes once; memory; a check pressed during a restart; a refused Run and a refused Check back to ready; a refused pending Run; a check that asks for a new worker seen as checking, never as a crash; a check at the time limit; a crash during a check; a crash at rest; a failed load, Retry, and a run.
- `e2e/statechart-runtime.spec.ts` (passed in Chromium on 64bb6c3): Run pressed while Python loads (Python's files held by a context route until the click; the test fails if the route never sees them), the example solution passes, a runaway loop is stopped by the time limit and the next run works.
- `e2e/shell.spec.ts` (passed in Chromium on 64bb6c3): `/dev/runtime` answers 404 in the production build.

**Browser tests in Chromium, on 9414a88 and 64bb6c3.** Chromium 159.0.8154.6 with `--no-sandbox --single-process`, one test per Playwright process, through a temporary configuration outside the repository with no web servers. The runtime tests ran against `next dev --webpack` (with `WATCHPACK_POLLING=true`) on port 3257, after `node scripts/build-runtime.mjs`; `e2e/shell.spec.ts` ran against `next start` of a `pnpm build` with CI's fake public values on port 3258.

- On 9414a88: `e2e/grader-parity-runtime.spec.ts` 13 of 13 passed. `e2e/statechart-runtime.spec.ts` 1 of 4 passed and `e2e/live-input-runtime.spec.ts` 0 of 7 passed, each failure a strict mode violation: `getByRole('button', { name: 'Run' }) resolved to 2 elements` (the other is **Runs forever**, added by this package in dc12bd3), and, once that was fixed, `getByLabel('Answer') resolved to 2 elements` (the other is the field **Input, one line per answer**).
- 64bb6c3: the Run button and the Answer field are matched with `exact: true` in `e2e/runtime.spec.ts`, `e2e/live-input-runtime.spec.ts` and `e2e/statechart-runtime.spec.ts`. No product code changed.
- On 64bb6c3: `e2e/runtime.spec.ts` 15 of 15, `e2e/live-input-runtime.spec.ts` 7 of 7, `e2e/statechart-runtime.spec.ts` 4 of 4 passed. `e2e/shell.spec.ts` 16 of 16 passed, twice, including `/dev/runtime` answering 404 in the production build.
- `pnpm verify` on 64bb6c3: exit 0, 46 files, 1148 tests. `pnpm build` with CI's fake public values: exit 0.

**Not run, owner to run:** Firefox and WebKit (not installed here), and Chromium through `pnpm test:e2e` with its own servers:

```sh
pnpm test:e2e e2e/statechart-runtime.spec.ts e2e/live-input-runtime.spec.ts e2e/grader-parity-runtime.spec.ts e2e/runtime.spec.ts e2e/shell.spec.ts
```

## Screens

The development page is not a learner screen and is not in `DESIGN.md`'s scope; no screenshots.

## Reviews

Round 1 of 36f4372, condensed in `docs/reports/reviews/WP-3.4/`:

- code-reviewer: CHANGES REQUIRED. BLOCKER 1 fixed (`dispatchEvent`, tests through the real controller). MAJOR 2 and 3 fixed (tests above; both mutants now fail). MINOR 4 answered under Deviations. MINOR 5 fixed (the spike report cites ADR-0004, ADR-0005, ADR-0020). MINOR 6 fixed (the route gate). MINOR 7 answered under Risks. MINOR 8 fixed (every edit on the page sends `CODE_EDITED`). MINOR 9 fixed (the sample is named by what it is).
- security-reviewer: CHANGES REQUIRED. MAJOR 1 (T-02, a program that yields once computes while the page waits for its input) answered by ADR-0034, Proposed: the reviewer's liveness ping is defeated by a program that yields briefly every half second, so the ADR accepts the risk with Stop as the control and the false comment and test name are corrected. MINOR 2 fixed (`/dev/runtime` in the 404 test; `deploy.yml` fails if the production output has a `dev` route). MINOR 3 fixed (`VERCEL_ENV: production` on the deploy Build step). The note on the example lesson's solution in the preview bundle: `example-lesson.ts` is in no seed.

Round 2 of a884853, condensed in the same folder:

- code-reviewer: APPROVE. Three minors, all fixed in the last commit: the deploy check narrowed to the route folders; a test that the chart's state is stored before the effects run (the order mutant now fails); a second way to compute during a wait added to ADR-0034.
- security-reviewer: APPROVE, on the condition that the owner accepts ADR-0034. Its minors fixed: "not verified" on the untested claim, the `js.setInterval` note under Consequences, the narrowed deploy check. Its first `pnpm verify` failed 1 of 1066 tests without naming it; four more runs passed. A flaky test is possible and not identified. Found later (on 9730a70): `scripts/repository.test.ts > lint for type escapes > [NFR-MAINT-01] fails lint for any` times out at 5000 ms when several suites run on the machine at once. Its first `lintText` loads `eslint.config.mjs`, which took 855 ms in a single `pnpm test`. Six single runs: all 1148 passed. Three rounds of four runs at once, with coverage: two rounds failed in all four runs, each with this test alone, one round passed. The reviewer's failing test was not named, so that it was this one is likely, not proven. The test is unchanged from `main` (939f9a0) and not specific to this branch. Not changed: its timeout stays (CLAUDE.md rule 2). A fix for the owner to choose: load the configuration once in a `beforeAll`, so the test case times only the lint.

Round 3 of 64bb6c3 (the browser test selector fix), `docs/reports/reviews/WP-3.4/code-review-3.md`:

- code-reviewer: APPROVE. The fix is correct and complete and weakens no check. One optional MINOR, not changed: the Send, Check and Stop buttons are still matched by substring; they are unique on the page today.

Open MAJOR findings for the owner to waive: none open; ADR-0034 needs the owner's decision.

## Try it on the preview

1. Open the pull request's preview through its shareable link, at `/dev/runtime`.
2. Press **Run** before Python is ready: the page says Run waits for Python, then runs.
3. Press **The example lesson's solution**, then **Check**: both test cases pass and the lesson shows passed.
4. Press **Runs forever**, then **Run**: after 5 seconds the page explains the time limit and Python restarts; Run works again.
5. On phones: `docs/reports/spikes/runtime-devices.md`, "Method".

## Owner actions now due

1. The phone check: `docs/reports/spikes/runtime-devices.md`, on a real iPhone and a real Android phone, in the browser and inside the TikTok and Instagram in-app browsers, then fill its table.
2. Decide ADR-0034 (accept the input-wait risk, or ask for another control).
3. Run the browser tests above in Firefox and WebKit, and in Chromium through `pnpm test:e2e`.

## Deviations from the plan or the spec

- **Proposed spec change, section 6.** A worker the controller replaced on purpose after a memory error or the output cap reaches the chart as `CRASH` with a `reason` (`memory` or `output_limit`), because the diagram draws only `ready --> restarting: CRASH`. Section 6 defines CRASH as the worker dying unasked. Proposed: name the edge `CRASH or REPLACED` in the diagram, or add a `REPLACED` event. Until the owner decides, the reason keeps the learner's explanation true.
- **The phone check** is the owner's; the spike report's table is empty until then. The Done-when line on phones is not met by this pull request.

## Risks and rollback

- CI builds only the production page set; a build failure that only the preview page set has shows first on the Vercel preview (review 1 MINOR 7). The preview build above passed locally. Rollback: revert the merge; nothing persists.

## Definition of Done

- [x] Every transition is tested (`workspace-chart.test.ts`).
- [ ] The phone check: the owner's.
- [x] Every cited Must requirement has a passing test that names its ID.
- [ ] `pnpm verify` passes; the browser checks pass in Chromium here, not run in Firefox or WebKit.
- [x] No stub, dead control, placeholder, commented-out code, or invented number.
- [x] Every reviewer blocker is fixed.
- [x] No AI attribution in any commit or in this description.

```sh
gh pr create --draft --base wp/3.3-grader --head wp/3.4-statechart --title "WP-3.4 The statechart and the phone check" --body-file docs/reports/pull-requests/WP-3.4.md
```
