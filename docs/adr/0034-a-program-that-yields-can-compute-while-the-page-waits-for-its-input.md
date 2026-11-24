# ADR-0034: A program that yields once can compute while the page waits for its input; the risk is accepted with Stop as the control

- Status: Proposed (WP-3.4, pending owner decision)
- Decision due: WP-3.4
- Date proposed: 2026-11-22
- Decider: the owner
- Relates to: FR-RUN-02, FR-WSP-07, FR-WSP-08, T-02; ADR-0004, ADR-0005, ADR-0020

## Context

The page owns the clock and does not count the time a program waits for input (`02-architecture.md` section 5.4). The worker posts `input_request` from a task of its own, which runs only once Python has suspended. Security review 1 of WP-3.4 showed that a program can take `request_line` out of the reader's closure, call it, suspend once on a promise of its own (`run_sync` on a `js.setTimeout` promise), and then compute: the request is posted, the page pauses the clock, and Python keeps running. Reproduced with the compiled worker core and Pyodide 314.0.7 under Node: 3 s of computing after the page showed the input line.

A second way needs no stolen function: during an honest wait for input, a Python callback the program queued earlier with `js.setTimeout` or `js.setInterval` still runs when its time comes, and can compute (security review 1, informational note).

The impact is CPU and battery on the learner's own device until the learner answers or presses Stop. The tab stays responsive, because the program runs in the worker. Only code the learner runs in their own browser can do this.

## Decision

- The page keeps trusting `input_request` to pause the clock. No liveness protocol is added.
- Stop stays enabled while the program waits for input (`canStop` in `src/runtime/workspace-chart.ts`), and terminates the worker as for any run.
- The comment in `src/runtime/worker/core.ts` and the test in `src/runtime/worker/interactive.test.ts` say what holds: a program that never yields asks the page nothing; one that yields can compute while the page waits.

## Consequences

- Gain: no protocol change; the input path stays as WP-3.2 built and tested it.
- Cost: a deliberately written program can use the learner's CPU while the input line shows, until the learner answers or presses Stop. Accepted under T-02, because the tab stays usable and Stop ends it.
- Cost: a `js.setInterval` left by one run keeps firing during a later run's input wait. Under Node it crashed the runtime (security review 1); not checked in a browser. Stop, or the restart that follows a crash, ends it.

## Alternatives considered

- **A liveness ping while waiting** (the reviewer's first proposal): the page asks the worker every second whether the program still waits, and resumes the clock or restarts the worker when no answer comes. It loses because a program that yields briefly every half second lets the worker answer between its stretches of computing, so the ping proves only that Python yields, not that it waits. A queued callback during an honest wait beats it too. It adds two protocol messages and a false-restart risk on phones that freeze a background tab.
- **A ceiling on the wall time of a whole interactive run.** It would end a learner's honest program that waits a long time for an answer, which section 5.4 promises is free.
- **Removing every way Python can suspend except the input wait** (`run_sync` on other promises, `js.setTimeout`, `js.Promise`). Pyodide uses these internally; locking them down from Python is believed not possible without patching the runtime (not verified).

## Evidence

Security review 1 of WP-3.4 (`docs/reports/reviews/WP-3.4/security-review-1.md`), with its Node probe against Pyodide 314.0.7. Not measured in a browser.

## Revisit when

Lessons can contain code the learner did not write and runs without reading, or a report shows a learner's device slowed by a program waiting for input.
