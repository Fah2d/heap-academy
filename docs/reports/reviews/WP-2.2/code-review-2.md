# WP-2.2 code review 2 (condensed): the CI fixes for #13

Reviewer: code-reviewer, of 9161501 and 8949c89. Verdict: CHANGES REQUIRED. Shortened; the response is in the pull request description, "CI fixes for #13".

- MAJOR 1: the new `chromium` test in `e2e/sign-in.spec.ts` waited for a Turnstile token, so it needed Cloudflare to answer on every pull request (handbook section 8.2: no real network), and it also runs in `firefox` and `webkit`. Asked for: check the sign-in document's policy header instead.
- MAJOR 2: every caller has to remember `fullLoad`; a later link to `/sign-in`, or a server `redirect("/sign-in")` during a client-side navigation, would bring the bug back without an error. Asked for: make the rule structural (a link to the sign-in path always loads in full, or one sign-in link is the only way there), and a spec note in `06-security-privacy.md` section 5.2.
- MINOR: `link.test.tsx` cited ADR-0014, which says nothing about navigation.
- MINOR: comments in `return-path.test.ts`, `sign-in-journey.spec.ts` and `account-buttons.tsx` were too long or cited history.
- MINOR: the two new 15 s waits need the owner's OK (decision L); the 15 s figure was not measured (2,320 ms locally).
- NOTE: the 60 s limit is owner-ordered only per the description; a sweep that collects failures and asserts once might fit 5 s (not measured).
- Checked sound: the `link.test.tsx` mock, `exact: true`, no string literals, CSS, boundary breaks, skips or suppressions; author and committer Fahad, no trailers. `pnpm verify`: 43 files, 929 tests.
