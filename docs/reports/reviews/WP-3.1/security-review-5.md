# WP-3.1 security review 5: the proxy matcher

- Reviewer: security-reviewer subagent, fresh context, read-only
- Range: f8af00a, then c03a7d0 (round 2, by the same reviewer)
- Threats: T-15, T-01, NFR-SEC-02 (sections 5.1 and 5.2), NFR-OBS-01
- Date: 2026-11-24
- Condensed by the implementer from the reviewer's two reports.

**Verdict: APPROVE** after round 2. No blocker and no major.

## Round 1, on f8af00a: CHANGES REQUIRED, 3 MINOR

f8af00a anchored the matcher's exclusions (`_next/static/`, `_next/image$`, `favicon\.ico$`) for security review 2, MINOR 7, and moved the matcher test to Next.js's own `unstable_doesMiddlewareMatch`.

1. **MINOR, blocks closing MINOR 7.** `/favicon.ico` was still excluded. The app has no icon (ADR-0031), so the path rendered the HTML not-found page, with scripts and no policy and no `frame-ancestors`. It was also reachable as `/favicon.ico?x` and `/_next/data/<buildId>/favicon.ico.json`. The test's `toBe(false)` pinned the gap. Fix: remove the exclusion and expect a match.
2. **MINOR.** The unit test models only how Next.js compiles the pattern, with an empty `nextConfig`; nothing on the production server asked for a prefixed or excluded path. Fix: an end-to-end or `infra:verify` check, and a comment stating the assumption.
3. **MINOR.** Mutants that exclude a page prefix (`admin`, `sign-in|courses|learn`) survived. Fix: assert the real route prefixes.

Checked and fine: built files, the image optimizer and `/_runtime/` still skip the proxy; trailing slashes get a 308 before the proxy; the matcher is case-sensitive and a different case gets the page policy; encoded paths and dot segments only widen the match; with a `basePath` the exclusions still hold; `$` inside the lookahead is the documented form. Not a finding: `/_runtime%2Fworker/...` serves the worker script with the page policy, as before this commit; it cannot be exploited.

## Round 2, on c03a7d0: APPROVE, 1 MINOR (note)

| Item | Status |
|---|---|
| 1 | Fixed. The matcher is `/((?!_next/static/\|_next/image$\|_runtime/).*)`, the same in the build manifest. `/favicon.ico`, `/favicon.ico?x` and its data-route form return 404 with the nonce policy, `frame-ancestors 'none'` and a request ID. Putting the exclusion back fails the unit test. |
| 2 | Fixed. The test comment states the assumption. The new request test in `e2e/csp.spec.ts` was run by the reviewer against a `next start` of this build, through a temporary Playwright config with no web servers: 1 passed. |
| 3 | Fixed for top-level routes; the `admin` mutant fails. |

**MINOR 1 (note, does not block).** Mutants that exclude `admin/` or `courses/` (with the slash) still pass, because only top-level paths are asserted. Add one nested path for each when those routes land (`/admin/courses`, `/courses/<slug>/<lesson>`).

**Process note.** Ports 3100 and 3197 already had servers on them. Locally, `reuseExistingServer` is on, so a local `pnpm test:e2e` would test whatever build holds port 3100. Stop it first. CI is not affected.

Side effect accepted: if the owner supplies an icon, the proxy puts the page policy on the image response, which does no harm, and the new end-to-end test, which expects 404, fails and forces a second look.

Not checked by the reviewer: `pnpm verify` and `pnpm build` (the implementer's runs were relied on), the other tests in `e2e/csp.spec.ts`, Firefox and WebKit, Vercel's edge router, `pnpm infra:verify` against a deployment.
