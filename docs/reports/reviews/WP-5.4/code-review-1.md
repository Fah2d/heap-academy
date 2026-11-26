# WP-5.4 code review 1

Reviewer: `code-reviewer` subagent, fresh context. Commits: afbd72d (merge of `wp/5.1-catalog`) and f78c583 (progress store). Verdict: CHANGES REQUIRED, 1 BLOCKER, 2 MAJOR, 4 MINOR. The merge itself was found sound: nothing from either side lost, the boundary test's exception is an exact list (not a weakening), and the lesson read's cache key is right.

Answers in 8368967.

| # | Severity | Finding | Answer |
|---|---|---|---|
| 1 | BLOCKER | `e2e/workspace-runtime.spec.ts`: the saved-code journey opened the database at version 1, which fails with `VersionError` once the workspace has opened version 2. | Fixed: opened with no version, with `onerror`, and closed after the read. The journey passes in Chromium (below). |
| 2 | MAJOR | A failed read counted as no completions: marks vanish and a repeat pass counts as first; a closed connection was kept for good. | Fixed: the store keeps what it last read and uses it when a read fails; a failed request or a close forgets the connection, so the next call opens again. Tests: a read that fails after one that worked; a closed connection; another tab's upgrade. |
| 3 | MAJOR | Check and write were separate transactions and `put` overwrote the first pass, so two tabs could both count as first. | Fixed: `add`, and a `ConstraintError` means the lesson is already stored (not first, its row kept). Test: two stores over one database. |
| 4 | MINOR | No cache test for the lesson read. | Fixed: "keeps a lesson of two databases apart" and the `published-lesson` duplicate key part. |
| 5 | MINOR | A made-up lesson under a real course still costs one query and a cached `null` (T-14, T-25). | Not fixed: recorded as decision 6 in the description, accepted until WP-7.1's firewall rule, as WP-5.1 first did for courses. |
| 6 | MINOR | A stale comment in `src/features/workspace/index.ts` and a lost blank line in `src/messages/gallery.ts`. | Fixed. |
| 7 | MINOR | A test comment claimed browser tests for completions; three exports unused; a throwing listener rejected a kept pass. | Fixed: the comment says what exists; the unused exports dropped; listeners run in a microtask after the store answers, with a test. |

Gate on 8368967: `pnpm verify` exit 0, `Test Files  122 passed (122)`, `Tests  2231 passed (2231)`. Browser: the 15 journeys of `e2e/workspace-runtime.spec.ts`, one per Playwright process, Chromium, against `next dev --webpack` on `localhost:3264`: 15 of 15 passed.
