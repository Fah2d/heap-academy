# WP-7.3 part 1, security review 1

- Reviewer: `security-reviewer`, of `origin/main..7845ed8` on `wp/7.3-operations`.
- Verdict: **APPROVE**, with five minor findings.
- The reviewer is read-only; the implementer saved this report from its answer. The response is at the end.

No blocker and no major problem. Free text cannot reach the log line, and the report carries no personal data. A cross-site page in a browser cannot post a report. The request ID shown to the learner reveals nothing. Sending no release from the browser is sound.

## Findings

**MINOR 1. A slowly sent body holds the handler open.** `read-capped.ts:15-16`, T-16, 07-operations section 7.
- A script sends a few bytes at a time under 8 kB and keeps one invocation alive per connection. The CSP report endpoint shares the reader, so this was already true.
- Evidence: one space every 500 ms, 40 times, against `next start -p 3219`: `status 204 after 20.109 s`. Whether the host buffers request bodies before calling the function was not checked.
- Fix: a read deadline in `readCapped` (cancel the reader, answer 408), with a test. Rate limits stay in WP-7.1.

**MINOR 2. Anyone outside a browser can write fake error lines.** `client-error.ts:52`, T-16, NFR-OBS-02.
- `curl` posts unlimited `{code, route}` reports, two lines each, one at `error`, which inflates error counts. Content stays limited to allowlisted values.
- Evidence: with `Origin: https://evil.test` and `Sec-Fetch-Site: cross-site`, the server answered 204 and logged `"level":"error"`.
- What stops browsers: a cross-site JSON post needs a preflight, answered `204 allow: OPTIONS, POST` with no `access-control-allow-origin`; a cross-site `text/plain` post gets 415.
- Fix: none in this part. WP-7.1 should name `/api/client-error` and `/api/csp-report` as callers of its Postgres counter; route handlers do not go through the action wrapper.

**MINOR 3. The spec and the code disagree on where the release comes from.** `07-operations.md:89` versus `src/domain/client-error.ts:4`, NFR-OBS-02.
- The server's way is better for security: the browser cannot forge the release, `HEAP_RELEASE` stays a server variable, and `/api/health` already publishes it. The catch: a tab on the old bundle after a deploy is logged under the new release. Skew protection on this plan not checked.
- NFR-OBS-01 and 07-operations section 4.1 still say "a browser error shows no reference until `/api/client-error` exists" and "the error page shows the digest only".
- Fix: a `spec-change` pull request (CLAUDE.md rule 11).

**MINOR 4. The size cap test does not test what its name says.** `client-error.test.ts:107-110`. `new Request(url, { body: string })` has no content-length (`content-length: null`), so the early refusal on the declared length is never run by a unit test. Fix: a case with `content-length: 9000` that checks the body is never read.

**MINOR 5. The e2e test does not link the shown reference to the log line.** `e2e/client-error.spec.ts:19,55`. It checks only the shape of `x-request-id`, and was not run. By hand: a report sent with `x-request-id: attacker_chosen_id` got back `x-request-id: 1e60cce5-...`, and the `client-error:worker-crashed` line carries that same ID and the build's release. Fix: keep as recorded manual evidence, or assert on the web server's output.

## Points checked that hold

- Log injection: `code` is one of three values; `logRoute` keeps only the app's own segments; the logger re-checks `route`, `outcome` and `requestId`. `/x\n{"level":"info"}`, `/a b/c`, `//evil.test/x`, `/API` and `/ada@example.com/x?token=s` all reduce to `:param` segments; the live line was `"route":"GET /:param/:param"`.
- Extra fields: `__proto__` or `constructor` keys are refused by the strict schema; nothing is polluted.
- Personal data: the reporter sends only `{code, route}` with `credentials: "omit"`; query and fragment are dropped in the browser and on the server; the handler reads no cookie.
- Large bodies: 413 for a chunked 20 kB body.
- The request ID shown: a server-made random UUID that replaces anything the client sends, shown only if it matches `^[A-Za-z0-9_-]{8,64}$`, rendered as React text.
- CSP: `connect-src 'self'` covers the request; nothing inline added.

## What the reviewer ran

The diff and the code it calls; `vitest run` on the system, logging, http, proxy, domain and shell tests (10 files, 71 tests passed); `node --experimental-strip-types` probes of `logRoute` and the schema; `next start` on ports 3218 and 3219 (stopped), with the probes above. Not checked: host body buffering and function duration limits, skew protection, e2e, `pnpm infra:verify`, `pnpm verify`. Two earlier attempts left `next start -p 3217` running, which the sandbox cannot stop.

## Response (implementer)

- MINOR 1: not changed in this part. A deadline needs an injected clock in `readCapped` and a decision on its value; listed for WP-7.1 with the rate limits, which bound the same cost.
- MINOR 2: listed for WP-7.1 in the description.
- MINOR 3: owner decisions A and B in the description.
- MINOR 4: fixed. A declared `content-length: 9000` with a stream that is never pulled is refused with 413, and the test checks the stream was not read; removing the declared check fails it.
- MINOR 5: kept as manual evidence, recorded in the description with the curl output.
