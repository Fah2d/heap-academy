# Code review 3 of WP-7.1 part 3 (condensed): per-action rate limits (T-14)

- Reviewer: code-reviewer subagent, fresh context, read-only. It returned the report in its reply and did not write files; this file records it.
- Range: `origin/main...39f258d` on `wp/7.1-rate-limits` (one commit). Date: 2026-11-25.
- Verdict: CHANGES REQUIRED. No blocker, 3 MAJOR, 9 MINOR.
- Reviewer ran: `pnpm verify` at 39f258d, exit 0, 56 files, 1035 tests; 5 targeted test files, 55 tests. It checked that `plan(32)` matched 32 assertions, and that each T-14 control has a test with a T-14 title.
- Reviewer's note: a stray `git checkout -q 39f258d` detached HEAD once; it checked the branch out again at the same commit, with no file changed.

| # | Finding | Resolution |
|---|---|---|
| MAJOR 1 | Sign-out is counted, so a refused or unanswered count leaves the session on the device (FR-AUTH-05). | `perMinute: "uncounted"` for sign-out only; tests that the wrapper skips the counter and that the real `signOut()` ends the session without calling it. |
| MAJOR 2 | `/api/csp-report` is not counted. | Counted; see security review 3, MAJOR 2. |
| MAJOR 3 | `02-architecture.md` sections 8, 8.2, 8.3 and 9.1 and `.claude/rules/server.md` do not describe the table, the two definer functions or the wrapper's new order. | Proposed as a spec change in the pull request (rule 11), not edited here. |
| MINOR 1 | `database.types.ts` not regenerated. | Owner action: needs the local stack. |
| MINOR 2 | No test of the real wiring (header, key, function name). | `google-flow.test.ts` now sets `x-real-ip` and a different `x-forwarded-for` and asserts the counter call's arguments. |
| MINOR 3 | Each call deletes old rows across the table, so calls queue at each minute boundary. | Deletes at most 100 old rows a call with `for update skip locked`. |
| MINOR 4 | Shared `unknown` bucket locally and in e2e; IPv6 per /128. | IPv6 by /64. The e2e suite was not run: whether it stays under 30 sign-in calls a minute is not measured (pull request). |
| MINOR 5 | No time in the signature; variable-time comparison. | Fixed; see security review 3, MINOR 4. |
| MINOR 6 | A refused code check says to ask for a new code; a refused Google start shows the general failure. | Not changed (copy work). Proposed wording in the pull request. |
| MINOR 7 | No `09-evidence.md` entries for `x-real-ip` or `[db.vault]`. | Proposed entries with sources in the pull request. |
| MINOR 8 | A preview of this branch runs against a staging database without the migration. | Stated in the pull request. |
| MINOR 9 | A long header comment line; no blank line before the new tests. | Fixed. |
