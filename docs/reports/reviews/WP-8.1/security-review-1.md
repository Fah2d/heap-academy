# WP-8.1 security review 1

Reviewer: `security-reviewer`, fresh context. The second-step QR change. Verdict: CHANGES REQUIRED.

| # | Severity | Finding | Answer |
|---|---|---|---|
| 1 | BLOCKER | The parse refused the real QR code (GoTrue's SVGo declaration and comment), so the owner could not set up an authenticator. It failed closed. | Fixed as code review 1, finding 1, with the reviewer's pattern. |
| 2 | MAJOR | The unit fixture did not match what the auth service sends. | Fixed: GoTrue's real start, with cases for the declaration and the comment. |
| 3 | MINOR | The setup screen was captured before the fix. | Recaptured after it. |

Found safe: the SVG is shown through `<img src="data:…">` (next/image `unoptimized`), which runs no script and fetches nothing; `img-src 'self' data:` allows it and `script-src` stays nonce-only. The secret and the QR code travel only in the `startSetup` result to the setup page's state; the action's log line holds only allow-listed fields. No other change to the admin gate.

Not checked by the reviewer: what the hosted auth service sends (the same GoTrue, so the same header is expected).
