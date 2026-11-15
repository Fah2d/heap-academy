---
paths:
  - "src/runtime/**"
  - "src/grader/**"
  - "scripts/**"
---

# Python runtime and grader

Learner code is untrusted (`CLAUDE.md` rule 4). The design is in `docs/spec/02-architecture.md` sections 5 and 6 and `docs/spec/04-content-system.md` sections 2 and 3. The prototypes and the traps they found are in `docs/spec/09-evidence.md`.

## Worker

- Pyodide in a module worker only. The files come from the pinned npm package, are copied at build time to `/_runtime/pyodide/<version>/`, and are served immutable. One setting holds the base path.
- Every message in both directions is parsed by a schema. Drop and report anything else. Never send `null`; use `undefined` or an explicit field (architecture section 14, pitfall 2).
- The page owns the clock. Stopping means terminating the worker and starting a new one. Never ask the worker to stop itself.
- Time spent waiting for the learner's input does not count against the 5 second limit.
- Output is batched and capped at 64,000 characters. Truncation is reported.
- Isolation per run is exactly section 5.5, including restoring builtins without calling a builtin by name.
- After loading, remove network and spawning APIs from the worker's global scope and its whole prototype chain. The worker script's response carries its own policy with `connect-src 'self'`. Prove both from inside the worker in a test.
- Choose the input strategy by detecting the capability at `ready`. Never by user agent.

## Harness

- Pure Python, standard library only, versioned. It never raises to its caller; every outcome is a structured result.
- Each test case is its own isolated run: standard input, the learner's program, then the follow-up code in the same namespace.
- The same harness file runs in the browser and in the Node runner. The parity suite proves the verdicts match.
- The dashboard validates lessons with the same worker and harness learners use. Never write a second grading path.

## Never

- Execute learner or lesson code on a server, in a route handler, in a server action, or on the page's main thread.
- Use `eval`, `new Function`, or `unsafe-eval` anywhere in production code.
- Enable cross-origin isolation (ADR-0005).
