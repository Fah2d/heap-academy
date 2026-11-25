# WP-2.2 code review 1 (condensed)

Reviewer: code-reviewer, of 0d17244. Verdict: CHANGES REQUIRED, no blocker. Shortened; the response is in the pull request description.

- MAJOR 1: the layout's `getClaims()` had no time limit, so a slow auth service held every page after the proxy's 1.5 s, and a read-only refresh threw away rotated tokens.
- MAJOR 2: the Google return-path cookie and the callback had no test (0% coverage of both files).
- MAJOR 3: no test for the "Sending code" and "Checking code" states.
- MAJOR 4: every request reaches Supabase from the server, so its per-address limits may count all learners as one caller (not verified); the outage runbook's "one network address" is wrong.
- MINOR: a used challenge token could be sent again; `failed` never happened with the real client (`getClaims()` resolves `{data: null, error: null}` when fetch fails); a thrown action replaced the page with the error page; the return path dropped the query string; a stale comment in `provider-outcomes.ts`; the Turnstile hostname list covered all of `vercel.app`.
- On the owner-free decisions: no browser client, the Google server action, the cookie, one message for both codes, sign-out going home, and the 1.5 s limit judged acceptable with spec-changes or a note.
- Checked: no attribution, no suppression or skipped test; `pnpm verify` 847 tests; auth-js `_signOut` clears local first.
