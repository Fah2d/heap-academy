---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "e2e/**"
  - "supabase/tests/**"
  - "src/grader/**"
---

# Tests

The full strategy is in `docs/spec/05-engineering-handbook.md` section 8.

- A test title starts with the requirement IDs it verifies: `[FR-WSP-07] stops a runaway program and recovers`. A threat test cites the threat: `[T-21] no solution token in any guest response`.
- Test behavior through the public surface. One reason to fail. Arrange, act, assert.
- Deterministic: inject the clock, seed randomness, no real network, no sleeps. Wait for a condition, never for time.
- Property-based tests for streak, merge, and output normalization.
- Test a fallback by removing the capability in the test page, never by faking a user agent.
- A bug fix starts with a test that fails because of the bug.
- Database: every table and operation is tested as four callers: anonymous, a learner, an admin at `aal1`, and an admin at `aal2`. Every trigger has a test that tries to break its rule.
- The Python harness is tested by running it in Pyodide through the Node runner, not by mocking Python.
- End to end: one file per journey (`e2e/j01-video-to-first-run.spec.ts`), with axe on every screen and state the journey passes through.
- Never: skip, weaken, or delete a test to get a green run; raise a timeout or add a retry to hide a race; replace assertions with a large snapshot; mock the unit under test; lower a threshold.
- A flaky test is a defect. Fix it the same day or report it to the owner. Never rerun until it passes.
