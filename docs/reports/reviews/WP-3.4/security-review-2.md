# WP-3.4 security review 2 (condensed)

Reviewer: security-reviewer, of a884853. Verdict: APPROVE, on the condition that the owner accepts ADR-0034; until then MAJOR 1 stays open as a decision.

- MAJOR 1 (T-02): ADR-0034's reasoning holds (a ping proves Python yields, not that it waits) and the residual risk is honestly stated. The comment and the test name are now accurate.
- MINOR: "not possible without patching the runtime" was not tested. Fixed: marked "not verified".
- MINOR: the `js.setInterval` note of round 1 belongs under Consequences. Fixed.
- MINOR 2: the `find` check was correct but wider than needed (vercel 65.16.0 records traced `dev` files by reference; `--standalone` would copy them). Fixed: only the route folders are checked.
- MINOR 3: holds. Next's dotenv loading does not override an already set `VERCEL_ENV`.

Ran: `pnpm verify` (first run: 1 of 1066 failed, not identified; four more `pnpm test` runs passed 1066 of 1066), `VERCEL_ENV=production pnpm build`, the pinned vercel CLI's source. Not run: a real `vercel build`, browsers.
