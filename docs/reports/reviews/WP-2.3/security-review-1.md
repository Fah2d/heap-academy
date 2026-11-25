# WP-2.3 security review 1 (condensed)

Reviewer: security-reviewer, of a0359dd. Verdict: CHANGES REQUIRED, no blocker: nothing lets a non-admin change content or read a solution.

- MAJOR 1 (T-19): guessing codes is limited only per network address. With a phished email code, an `aal1` session can call the Supabase MFA API directly from several addresses; about 6% a day per address (computed, not measured). Record it in `06-security-privacy.md` section 6 through a spec-change, and add log watching and session revocation to the runbook.
- MAJOR 2: no test that `/admin` pages are sent with `no-store`, and `/admin/setup` shows the TOTP secret. Set `private, no-store` in `proxy.ts` and assert it.
- MAJOR 3 (T-20): no test of the two actions with a learner session, a guest, or an oversized input.
- MINOR 4: the setup page changes factors on a plain GET.
- MINOR 5: the runbook leaves a window at first setup: another `aal1` session of the owner could enroll first. Delete other sessions first, stop if sent to verify, check exactly one verified factor after.
- MINOR 6: `aal2` is checked per page, not in the layout; a future page that forgets the `allow` stage would render for an `aal1` admin (the database still refuses the data). Add a test or a lint rule.
- MINOR 7: pgTAP 08 lacks an admin at `aal2` (true) and a learner at `aal1` (false).
- The `__next_error__` shell: acceptable; record it as a decision.
- Checked: definer only in `private` with `search_path = ''`; invoker wrapper; `anon` revoked; strict input; `aal` from `getClaims()`; guard before reads; no code or secret logged; the QR SVG inside `<img>`.
