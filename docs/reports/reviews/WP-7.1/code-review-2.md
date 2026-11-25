# WP-7.1 code review 2

Of c0c3bbc (part 2: `docs/reports/day-7-security.md`, the whole-history secret scan and the audit, and `[T-02]` on four fault journeys). The reviewer was a fresh-context subagent and read-only. The implementer saved this report and wrote the answers. One round (speed mode). No security review: a report and test titles only.

## Code review 2 (`code-reviewer`): CHANGES REQUIRED, 1 MAJOR, 6 MINOR

Found sound: every path in the report exists; the four `[T-02]` titles are on tests that exercise T-02; nothing filters tests by the old titles; the gitleaks and audit results reproduce (the re-run scanned 1190 commits, one more because the report commit itself was new); the T-14 and T-17 gaps are true on every branch; no attribution.

| # | Severity | Finding | Answer |
|---|---|---|---|
| 1 | MAJOR | T-25: the `anon` grants test is already on this branch (`supabase/tests/database/05_limits.test.sql`, "each role holds exactly the table privileges the policies expect"), not only on the 6.x branches. | Fixed in 9a4b774: the test is tagged `[T-25]` and the row names it. |
| 2 | MINOR | T-22: "three more" should be four; J-13's title has no `[T-22]`. | Fixed: J-13 tagged `[T-22]`, "four more". |
| 3 | MINOR | The report's naming rule does not allow the untagged unit tests listed under T-02. | Fixed: the rule also allows a journey or fixture the spec names, and those files are marked untagged. |
| 4 | MINOR | The loop fixture in `e2e/runtime.spec.ts` was left untagged. | Fixed: tagged `[T-02]`. |
| 5 | MINOR | T-17: `src/messages/legal.test.ts` on `wp/6.3-legal-pages-footer` covers the retention text. | Fixed: listed; the gap stays for J-10. |
| 6 | MINOR | T-14: two files are not size limits; `wp/7.3-operations`'s client error tests and the database size constraints are missing. | Fixed: relabelled and added. |
| 7 | MINOR | The scan line does not say which commit or refs it covered. | Fixed: every local and remote branch, at be19f9b. |
