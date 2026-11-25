# WP-7.4 code review 4 (part 2c: J-10)

Reviewer: `code-reviewer`, fresh context, on 9a8aa1c (branch `wp/7.4-journeys-part-2c`). The reviewer is read-only, so the implementer saved its report here; the findings are its words, shortened, with what was done about each.

Verdict: **CHANGES REQUIRED**. No BLOCKER, 1 MAJOR, 9 MINOR.

## Findings and what was done

| # | Severity | Finding | Done |
|---|---|---|---|
| 1 | MAJOR | The title claimed "no row of theirs is left in any table", but the query finds only `user_id` columns. `auth.audit_log_entries` names the user in its JSON payload (actor ID, email), so the email could stay while the test passes (FR-PRF-03, T-17, rule 1). | Fixed the claim: the title and header now say "no table keeps a row with their user ID". The journey counts audit log rows naming the user or address after the deletion and reports the number as a test annotation; whether deletion must erase them is the owner's open action 2 on WP-6.3's account deletion, now also listed in this pull request. |
| 2 | MINOR | `playwright.config.ts`: the pass-through block did nothing, since Playwright already hands each server its whole environment; "none of them is a secret" was no longer true in CI. | Fixed: block removed, comment rewritten to say what happens. |
| 3 | MINOR | Each run POSTs the deletion notice to `api.resend.com` with the fake key, a real third-party call from a test (`.claude/rules/testing.md`, "no real network"). | Not changed (pointing the notice elsewhere changes the feature); listed for the owner's acceptance in the description. |
| 4 | MINOR | "Nothing of the account is left on the device" overstated: only completions are cleared; saved code stays, as at sign-out. | Fixed the comment. Keeping saved code is WP-6.3's decision 6. |
| 5 | MINOR | `information_schema` hides tables the role cannot access, so one could drop out silently. | Fixed: tables come from `pg_attribute`, `pg_class` and `pg_namespace`; an unreadable table now fails the count. |
| 6 | MINOR | The old-session answer is not walked end to end. | Not changed: disclosed in the spec header and the description; unit and action tests cover it. |
| 7 | MINOR | Run locally without the three variables, J-10 times out with no hint. | Fixed: the spec header says what to export. |
| 8 | MINOR | The workflow test checked substrings only. | Fixed: it checks the mask comes before the `GITHUB_ENV` write and that `sed` reads `^SECRET_KEY=`. |
| 9 | MINOR | Journey files are named `jNN-...`. | Fixed: renamed to `e2e/j10-delete-account-journey.spec.ts`. |
| 10 | MINOR | Laptop size only; the dialog's stacked buttons below `md` never walked. The SQL-removed course carries review 3's cache risk. | Fixed the first: the dialog part runs in a 375 px window, with axe. The cache risk stays as named in part 2b's description. |

## Checked and correct (reviewer)

The dynamic count SQL and its quoting; the checks cannot pass vacuously (non-zero counts before, same table list after); selectors against the messages and components; the sign-in rate limit, the 5-minute rule and the URL wait; cleanup order; the CI step fails loudly, masks the key and never echoes it. No check weakened; no attribution.

## Not checked

The journey was not run (no Docker here). Whether audit log rows exist after a deletion, whether `postgres` can read every auth table with a `user_id` column, and whether CLI 2.122.1 prints `SECRET_KEY` are the reviewer's reading, not observed.
