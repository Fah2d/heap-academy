# WP-2.3 code review 1 (condensed)

Reviewer: code-reviewer, of a0359dd. Verdict: CHANGES REQUIRED, no blocker. Shortened; the response is in the pull request description.

- MAJOR 1: the setup page enrolled a new factor on every render (outside the action wrapper, with a read-only client), so a reload, back and forward, a prefetch or a refresh replaced the QR code the admin had just scanned.
- MAJOR 2: the only limit on wrong codes is Supabase's 15 a minute per network address, and the address it sees is the app server's; an attacker with a phished `aal1` session can keep guessing (a few percent a day per address, computed, not measured). Count failures per user, or put the residual risk to the owner.
- MAJOR 3: no test called the two exported actions; removing `forListedAdmin` from either would fail nothing.
- MINOR: the gate's comment says verify shows the provider-down notice on load (it shows it after a code is sent); the issuer `Heap Academy` was written in a component; `"/admin"` written out instead of `ADMIN_PATHS.allow`; a bare `catch` in the form; the empty state must be replaced in WP-4.1.
- On the `__next_error__` 404: no cleaner fix found that keeps the layout guard; record it as a decision.
- Checked: no AI credit in the five commits; `pnpm verify` 46 files, 935 tests; no suppression, `.skip` or `.only`.
