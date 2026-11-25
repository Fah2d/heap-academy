# WP-3.3 security review 1

- Reviewer: security-reviewer subagent, fresh context
- Range: 942ff46..1da8b48 on `wp/3.3-grader` (772c468, e3811d1, a80e0ca, 79170b2, 1da8b48)
- Threats in scope: T-01, T-22, T-23, `CLAUDE.md` rule 4 (learner code only in the worker; the Node runner reachable only from tests and scripts), and section 5.1 for the new compiled paths under `/_runtime/worker/`
- Date: 2026-11-20
- Verdict: CHANGES REQUIRED. No blocker, one major, four minors.

The reviewer works read-only; the implementer saved this report from its final message, unchanged. Scratchpad paths of the reviewer's probe scripts are shortened to their file names.

## Questions asked

- **Can a learner program or follow-up code make the harness raise? Yes.** No tampering is needed: a `SystemExit` subclass whose `code` property raises gets past every guard (MINOR 1). The worker then posts `fatal runtime_crashed`, and the page fails that test case as `crashed` and starts a new worker. So the result is wrong but safe. The claim "never raises to its caller" is false.
- **Can it return a forged or malformed result? Yes, both.**
  - Forged: rewrite a closure cell (`result`), or write through `sys._getframe(0).f_back.f_locals` (for example `after_code = ''`, which skips the follow-up code).
  - Malformed: mutate the `escapes` dict reached through `quote.__closure__`.
  - A forged result is accepted, since ADR-0007 already accepts that learners can forge their own results. A malformed one is refused by `parseHarnessResult`, and the worker dies. Confirmed in Pyodide 3.14.2 (314.0.7), which closes WP-3.1 review 3's "not checked in Pyodide".
- **Can a check leak output to the page as a run's output? No, not during the check.** `runChecks` sets the runtime's stdout and stderr to a discard sink (`core.ts:1091-1094`), and `postMessage` is gone after the lock-down. A hook installed during a check (`gc.callbacks`, `sys.addaudithook`, `sys.settrace`) can write into the output of a later run. That run is the same learner's on the same worker, so it is part of MAJOR 1's persistence, not a new leak path.
- **Can it escape the output cap? Inside Python, yes. To the page, no.**
  - Three ways past the cap: write a `str` subclass (`kind_of(text) is not to_text` sends it straight to `StringIO.write`), set `sys.stdout.room = 10**9`, or call `io.StringIO.write(sys.stdout, …)`.
  - The backstop holds: `parseHarnessResult` refuses output over 64,000 characters, so nothing oversized reaches the page. The test case becomes `crashed` instead of `output_limit` (MINOR 2).
- **Can one test case affect a later one? Yes, on purpose.** Confirmed on one interpreter:
  - A rewritten `result` cell made a later `raise ValueError` and a later failing `assert` both come back as passes.
  - A `gc.callbacks` entry injected text into a later, innocent test case's output.
  - An audit hook recorded the source and follow-up code of every later case.
  - `sys.settrace` and stdlib attribute changes (`math.pi = 3`) persist. The stdlib changes are accepted by ADR-0004; the hooks and the harness's closure are not mentioned there.
  - For learners this only touches their own results. For Validate it is MAJOR 1.
- **Does the page trust anything it should not? Nothing material.**
  - The controller checks the order of the results and recomputes the summary (`controller.ts:506-539`).
  - It drops malformed messages. A dropped result leads to `crashed` at the next result or at `check_done`.
  - It does not re-check `harnessVersion` per result, but the worker refuses any other version at `init` and for every harness result.
  - `error.message` (up to 1,000 characters) and `missingName` (up to 200) are learner-controlled text. WP-5.2 must render them as text.
- **Does any production path import the Node runner? No.**
  - Only `src/grader/harness.test.ts`, `src/grader/node-runner/runner.test.ts`, `e2e/grader-parity-runtime.spec.ts` and the lint rule's tests import it.
  - `.next/server` and `.next/static` contain no `node-runner`, `loadHarness` or `createNodeRunner`. That is the build present on disk (BUILD_ID 06:40); the reviewer did not rebuild.
  - The lint rule can be bypassed in two ways (MINOR 4).
- **Does the worker's response policy cover the new compiled paths? Yes.**
  - `runtimeHeaders` matches `${WORKER_DIRECTORY}:path*` (`security-headers.ts:141-146`), so `/_runtime/worker/grader/*.js` gets the worker policy and `no-cache`. The worker rule is still last. `next.config.ts`, `src/proxy.ts` and `vercel.json` are unchanged apart from test paths.
  - `public/_runtime/worker/` holds exactly the 11 expected files. No `example-lesson`, `parity-cases` or `node-runner` file is compiled in.
  - Only a module worker's entry response decides its policy, and the e2e test reads that entry through `WORKER_URL`.

## Findings

**MAJOR 1** `src/runtime/controller.ts:561-573` (`check` reuses the worker, and status goes back to `ready` at `:537`), `src/grader/harness.ts:10-15`, `docs/reports/pull-requests/WP-3.3.md:132`. Threats T-22 and T-23.
- **Problem:** the only Validate isolation that holds (WP-3.1 review 3, MAJOR 1) is recorded only in this PR's "Not fixed" list. WP-4.3's "Done when" (`08-delivery-plan.md:151-155`) does not mention it, and `check` is the API WP-4.3 must use ("never write a second grading path").
- **Wording problems:**
  - The PR's heading says "fresh worker for each case", but its body says "before each program". Only "before each program validated" (each check) protects other lessons.
  - No worker isolation stops a hostile imported lesson from forging its own Validate pass.
  - The harness header says the state is "restored … before the next case". That covers builtins, modules and streams only.
- **Attack:** imported lesson A's follow-up code rewrites `check`'s `result` cell and adds an audit hook. The owner then validates lesson B on the same controller. B's starter "fails" and its solution "passes" whatever they really do, so a broken B gets past the publish rule. The hook also sees B's solution and wrong answers.
- **Evidence:** probe 2 in Pyodide 314.0.7, through `loadHarness()` (one interpreter):
  - `D next case raises | {"version":"1","stage":"program","output":"Hello, Sara!\n","truncated":false}`
  - `D next case after_code fails | {"version":"1","stage":"after_code",…,"truncated":false}`
  - `G read | … [b"secret = 'SOLUTION_TEXT'", b'print(secret)', …]`
  - `F next case (innocent) | … "output":"INJECTED INJECTED …`
- **Fix:**
  - Propose a `spec-change` that adds to WP-4.3's "Done when": a new worker before each validated program, and a test that a tampering program in one validation does not change the next one's verdict.
  - Better, add it to the controller now, for example `check(source, tests, { freshWorker: true })` with a controller test, so WP-4.3 cannot miss it.
  - Add to the T-23 row (or the residual risks in section 6) that Validate is no evidence for hostile imported code. The control is that the owner reads imported code before pressing Validate.
  - Correct the harness header to name what is restored, and point to ADR-0004 for the rest.

**MINOR 1** `src/grader/harness.ts:176-180`, called outside any `try` at `:214` and `:221`. Threat: robustness of the "never raises" contract.
- **Problem:** `finished(error)` reads `error.code`, and a learner property can raise there. That exception leaves `check()` before `restore()` runs.
- **Evidence:** `class E(SystemExit): @property def code(self): raise ValueError('x')` gave `A SystemExit.code raises | HARNESS RAISED: PythonError`. The worker then dies (`core.ts:1100-1103`). It fails closed, but the case is reported as `crashed`, and the claim at `harness.ts:4` and in the PR is false.
- **Fix:** guard `finished` (treat a raise as "not finished"), wrap the body of `check` in a final `except base_exception` that returns a fixed `runtime` result, and add a harness test for this program.

**MINOR 2** `src/grader/harness.ts:99-117`. Threat: the FR-RUN-03 cap in checks.
- **Problem:** the cap is advisory inside Python. A `str` subclass skips the size check (`kind_of(text) is not to_text`), `room` and `truncated` are writable instance attributes, and `io.StringIO.write` can be called directly. Past the cap, the program keeps growing memory until the clock stops it, and the case ends as `crashed`, not `output_limit`.
- **Evidence:**
  - `B str subclass past cap | parsed: REFUSED | raw len: 200085`
  - `B2 print obj __str__ returns subclass | REFUSED | raw len: 100091`
  - `C room attr | REFUSED`
- **Fix:**
  - Convert any `str` instance with `to_text.__str__(text)` before counting, instead of passing subclasses through.
  - Keep `room` and `truncated` in closure cells, not instance attributes.
  - In `check`, cut `text` to `output_limit` and set `truncated` when it was longer, so a bypass still ends as `output_limit`.
  - Test the `str` subclass case.

**MINOR 3** `src/grader/grade.ts:169-176` and `src/grader/harness.ts:168-172`. Threat: parser consistency.
- **Problem 1:** the harness does not bound `missingName`, so an empty or very long name crashes the worker. A program can raise `NameError(name='')` or `NameError(name='a'*300)` from a function the follow-up code calls. `grade.ts:126` refuses an empty name and one over 200 characters, so the worker posts `fatal runtime_crashed` and the case is `crashed`, not `after_code_error`.
- **Problem 2:** the worker and the page disagree on where a name may appear. `parseHarnessResult` accepts a name at stage `program` (it always passes `true`), but `parseTestResult` on the page refuses `missingName` for `program_error`. A result the worker accepts can be one the page drops.
- **Evidence:** `M long NameError name in after_code | parsed: REFUSED`; `M empty name | parsed: REFUSED`.
- **Fix:** in the harness, keep `name` only when it is 1 to 200 characters. In `parseHarnessResult`, pass `stage === "after_code"` instead of `true`. Test both.

**MINOR 4** `scripts/eslint/module-boundaries.mjs:141-148` and `:201-205`. `CLAUDE.md` rule 4, ADR-0032.
- **Problem:** the Node runner can be reached from production in two ways. Both need a deliberate change to the repository.
  - A `.test.ts` file may import the runner, and a production file may import a `.test` file.
  - A template-literal `import()` is not checked.
- **Evidence:** through the repository's ESLint configuration (`lintText`, type checking off, as `rules.test.ts` does):
  - `src/features/workspace/server/a.ts | export { x } from "./launder.test"; => NO ERRORS`
  - `…/launder.test.ts | export { createNodeRunner as x } from "../../../grader/node-runner/runner"; => NO ERRORS`
  - ``a.ts | import(`@/grader/node-runner/${p}`) => NO ERRORS``
- **Fix:**
  - Report a non-test file under `src/` that imports a `.test` module.
  - Report an `import()` under `src/` whose source is not a string literal.
  - Optionally, check after `pnpm build` that `.next/server` and `.next/static` contain no `node-runner` or `pyodide` reference.
  - `pyodide` is in `dependencies`. It is used only at build time and by the runner, so `devDependencies` would keep it out of traced server bundles if it were ever imported. That is a lockfile change; the owner decides.

## Checked and holding

- **The runtime's own streams during a check:** discarded (`core.ts:1091-1094`), and `execute` sets them again for each run (`core.ts:178-186`).
- **Result IDs:** each `testCaseId` comes from the page's test case, not from Python (`grade.ts`).
- **Order and summary:** the controller enforces the order and recomputes the summary. A dropped or out-of-order result ends in `crashed` (`controller.ts:506-529`, `:213-216`).
- **Harness version:** a stale worker is refused at `init` (`core.ts:1121-1123`), and every harness result's version is checked (`core.ts:1105`).
- **Message size:** 1 to 50 test cases, every field bounded, and the source within `SOURCE_LIMIT`.
- **Load order:** the harness is evaluated before the lock-down, and it imports nothing that reaches JavaScript.
- **Solutions and wrong answers (T-21):** `example-lesson.ts` holds a solution and a wrong answer. Only `parity-cases.ts` imports it, and only tests and e2e import `parity-cases.ts`. It is not in `public/_runtime/worker/`.

## Outside the range, for the owner

- The working tree has an uncommitted change to `.claude/settings.json`:
  - `excludedCommands: ["gh", "pnpm test:e2e", "pnpm test:e2e *", "npx playwright *"]`, which runs those commands outside the sandbox;
  - `allowWrite: ["~/Library/pnpm/store"]`;
  - `allowLocalBinding: true`.
- It is not in this range and not part of WP-3.3. The owner should confirm he made it. `npx playwright *` outside the sandbox runs whatever the Playwright configuration loads.

## What the reviewer ran

- `git diff 942ff46..1da8b48`, plus the full `harness.ts`, `grade.ts`, `test-case.ts`, `compare.ts`, the `node-runner/` files, `core.ts`, the relevant parts of `controller.ts`, `security-headers.ts:80-155`, `module-boundaries.mjs`, ADR-0032, `02-architecture.md` 5.5, `04-content-system.md` 2.2 and 2.4, the T-01, T-22 and T-23 rows, WP-4.3 and WP-6.4 in the plan, and `docs/reports/pull-requests/WP-3.3.md`.
- `pnpm verify`: exit 0. Prettier clean, `Test Files 32 passed (32)`, `Tests 786 passed (786)`. The PR says 785; the reviewer did not find the extra test.
- Two Pyodide 314.0.7 (Python 3.14.2) probes under Node 26.13.1 through `src/grader/node-runner/host.ts` (`probe.mjs`, `probe2.mjs`). They covered:
  - `SystemExit.code`, the `str` subclass, `room` and `truncated`;
  - `f_locals` write-through, closure rewrite, `escapes` mutation;
  - `gc.callbacks`, audit hook, `settrace`, stdlib attributes, recursion limit;
  - `NameError` names, and a `__str__` that raises.
- An ESLint probe through the repository configuration (`lint.mjs`).
- `grep` of `.next/server` and `.next/static` for Node-runner symbols: none found.
- A listing of `public/_runtime/worker/`.

## Not checked

- Any browser. The reviewer did not run the worker policy or the header order on the new grader paths in a real response, the lock-down during a check, `e2e/grader-parity-runtime.spec.ts`, or whether messages posted mid-check reach the page's clock in each engine.
- `pnpm build`. Not run, because it rewrites `public/_runtime/` and `.next/`. The reviewer relied on the PR's statement and the build output on disk.
- Whether `pyodide_js` (reachable from Python) gives a check any route back to the page. This is WP-3.1 territory and was not re-probed.
- Vercel's header merge for `/_runtime/worker/:path*` in production.
