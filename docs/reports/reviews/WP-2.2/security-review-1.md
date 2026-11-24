# WP-2.2 security review 1 (condensed)

Reviewer: security-reviewer, of 87eeaf6..0d17244. Verdict: CHANGES REQUIRED. Shortened; the response is in the pull request description.

- BLOCKER 1: password pre-registration. A stranger signs up with the victim's address and a password; the victim later confirms the address with a code; on auth v2.197.0 (the image of the pinned CLI 2.122.1) the stranger's password survives, because `ClearUnconfirmedPassword` first shipped in v2.198.0 (2026-11-16). For the owner before TOTP enrollment this could reach admin. Asked for: refuse password sign-in whatever the auth version, a stack test, a newer CLI, and an `infra:verify` check of the hosted auth version.
- MAJOR 2: the layout's identity check had no time limit, and after a proxy timeout it could refresh a token whose rotated cookies a read-only client drops.
- MAJOR 3: no CSRF test: a server action from a foreign origin, a spoofed forwarded host, a callback without the PKCE verifier.
- MINOR 4: `requestOrigin` trusted `x-forwarded-host`; a value like `"a, b"` made `new URL` throw.
- MINOR 5: the Google form cannot work without JavaScript under `form-action 'self'`; the comment claimed it did.
- MINOR 6: account enumeration by response time (a new address costs a bcrypt hash).
- Checked sound: 15 crafted return paths, the return-path cookie, the proxy, identity from `getClaims()` only, the wrapper, `public.is_admin()`, the CSP, the e2e job; no secret committed.
