# WP-3.4 security review 1 (condensed)

Reviewer: security-reviewer, of 36f4372. Verdict: CHANGES REQUIRED. Production cannot ship `/dev/runtime` by any realistic route (built with `VERCEL_ENV` unset, `production`, `Preview`: no `dev/` route; only exactly `preview` adds it).

- MAJOR 1 (T-02): a program can pause the page's clock and keep computing. It takes `request_line` out of the reader's closure and calls it, suspends once on its own promise (`run_sync(js.Promise.new(lambda res, rej: js.setTimeout(res, 20)))`), the queued task posts a real `input_request`, the controller pauses the clock (`awaitingInput`), and Python resumes and loops. Reproduced with the compiled worker core and real Pyodide 314.0.7 under Node: 3 s of computing after the page was told the program waits. Impact: CPU and battery until the learner answers or presses Stop; the tab stays responsive. The comment at `core.ts:258-264` ("never yields, so nothing is posted") is false once the program yields once. Fix: a liveness ping while waiting for input, answered by the core through the bound `post` Python cannot reach; no answer within a short bound resumes the clock. Or the owner accepts it in an ADR and the comment and test name are corrected.
- MINOR 2: nothing tests that a production build or the deployed artifact lacks `/dev/runtime`. Add it to the 404 list in `e2e/shell.spec.ts`; fail `deploy.yml` if `.vercel/output` has a `dev/` route.
- MINOR 3: `VERCEL_ENV` could come from a force-committed `.env.production` if the pulled Vercel env lacks it. Set `VERCEL_ENV: production` on the deploy workflow's Build step.
- Note: the preview page's client bundle holds the public example lesson's solution (spec section 7). Keep `example-lesson.ts` out of any seed.
- Informational: a `js.setInterval` left by one run fires during a later run's input wait; under Node it crashed the runtime. Not checked in a browser.
- Checked and holding: `postMessage` removed in the lock-down; untrusted events dropped; answers accepted only after the page asked, no newline, length-limited; only the controller sets `ended`; output rendered as text.

Ran: `pnpm verify` (1055 tests), `pnpm build` four ways, two Node probes against real Pyodide. Not run: browser tests (the development server failed on FSEvents, then `EMFILE`), the Vercel CLI.
