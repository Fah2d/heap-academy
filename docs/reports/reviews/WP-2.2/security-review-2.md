# WP-2.2 security review 2 (condensed): the CI fixes for #13

Reviewer: security-reviewer, of 9161501 and 8949c89. Verdict: APPROVE. Shortened; the response is in the pull request description, "CI fixes for #13".

- Checked sound: on this branch the header's "Sign in" link is the only client-side way into `/sign-in` (no `useRouter`, no `router.push`; the server redirects go away from sign-in or to `/`; Google's failure comes back by a 303; the code step leaves by `window.location.assign`). The return path handling is unchanged: the same address string, `safeReturnPath` on the server, `URLSearchParams` encoding.
- MINOR: the fix lives in one component; a later `next/link`, `router.push` or `redirect` to `/sign-in` would block the challenge again (a failure for real users, not a bypass). Suggested: one exported sign-in address with a full load, a `no-restricted-syntax` rule against a `"/sign-in"` literal elsewhere, and perhaps a non-OK answer in `proxy.ts` to a Next.js data request for `/sign-in`.
- MINOR: the new e2e test depended on Cloudflare; check the navigation response's `content-security-policy` instead. `SignInLink` has no unit test.
- NOTE: leaving `/sign-in` by the logo keeps the sign-in policy (`frame-src` for Cloudflare) and the loaded Turnstile script on later signed-out pages. Older than this change; low impact.
- NOTE: on `/sign-in` the current link now reloads the page and loses the typed email and the code step.
- NOTE: the 15 s waits depend on Turnstile's `cf-turnstile-response` field, which Turnstile may change.
- Ran: `pnpm verify` (43 files, 929 tests); four unit files, 63 tests; `curl` showed `frame-src https://challenges.cloudflare.com` on `/sign-in` only.
