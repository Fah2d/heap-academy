# Security review 1: fix-smoke-and-runtime, the CSP e2e test

- Reviewer: security-reviewer, fresh context, on fe08e92.
- Scope: `e2e/csp.spec.ts`, the second test, which now injects an inline script without the nonce into the server's HTML instead of inserting one from code.
- Verdict: **APPROVE**, 3 MINOR.
- The reviewer is read-only; this file was written by the implementer from the reviewer's report.

## Findings

1. **MINOR, `e2e/csp.spec.ts:82-83`.** The comment cited ADR-0028 and called the behaviour Chromium's. ADR-0028 says nothing about it. The rule is in the CSP3 editor's draft, section 6.7.3.3: "If expression is the 'strict-dynamic' keyword-source: If type is "script", and element is not parser-inserted, return "Matches"." The earlier code review that said `'strict-dynamic'` does not allow inline scripts added by code was wrong. **Fixed in 33ac7f7:** the comment cites CSP3 section 6.7.3.3. The reviewer also suggested recording the fact in `docs/spec/09-evidence.md`; that is a spec change, so it is left for the owner.
2. **MINOR, `e2e/csp.spec.ts:99-101`.** The wait accepted any `script-src` violation, not only the injected script's. **Fixed in 33ac7f7:** it now needs a `script-src` violation whose blocked URI is `inline`. The `data-injected` check was already the deciding assertion.
3. **MINOR, `e2e/csp.spec.ts:87`.** An `expect` inside the route handler fails as a handler error and a navigation timeout. **Fixed in 33ac7f7:** the handler records whether `</body>` was found, and the test asserts it after navigation.

## Answers to the questions asked

- **Is the test sound?** Yes. The reviewer ran it against the real response from a `next start` of this commit, with the policy header swapped. With `script-src 'self' 'unsafe-inline'` (no nonce) or with an added `script-src-elem 'self' 'unsafe-inline'`, the injected script ran and the test failed. With `'unsafe-inline'` beside the nonce, or with `'strict-dynamic'` removed, the script was blocked and the test passed, which is correct. A report-only header fails the header check. `'unsafe-eval'` and a fixed nonce are outside this test and are caught by `security-headers.test.ts`, `src/proxy.test.ts` and `scripts/infra-verify.test.ts`.
- **Is the behaviour a finding against the policy?** Not a defect: it is the residual risk `'strict-dynamic'` brings. Trusted code that turns attacker text into a script element runs it. The same already holds for an attacker-chosen `src`. In Chromium 159.0.8154.6 under the real policy, `createElement` plus `textContent` and `Range.createContextualFragment` run; `innerHTML` and `document.write` are blocked. Without `'strict-dynamic'` all are blocked.
- **Exposure today:** none found. `src` has no `createContextualFragment`, `innerHTML`, `insertAdjacentHTML`, `document.write` or script creation, and the built chunks have no `createContextualFragment`. Script elements are created only by Turbopack's chunk loader, React's script loading, and Next's `self.__next_s` loader (which sets `innerHTML` from `children`; the one gadget to watch).

## Suggested follow-ups (owner's decision, no policy change now)

- Record this residual risk in ADR-0028 and under T-06 and T-07 through a `spec-change` pull request.
- Lint rules against `createContextualFragment` and against creating script elements in `src`.
- An ADR that weighs Trusted Types (`require-trusted-types-for 'script'`), which would close these string-to-script paths in Chromium.

## What the reviewer ran

- `git show fe08e92`; read `e2e/csp.spec.ts`, `src/infrastructure/http/security-headers.ts` and its tests, `src/proxy.ts`, ADR-0028, `docs/spec/06-security-privacy.md` section 5.2.
- `curl` of `/no-such-page` on the local server: the policy header, one `</body>` at the end, all 16 scripts with the nonce.
- Playwright 1.65.1, Chromium 159.0.8154.6, one test per run: both tests passed.
- 12 one-off Node runs for the policy swaps and insertion paths above.
- `pnpm verify`: exit 0, 27 test files, 710 tests.
- Not checked: Firefox and WebKit (not installed), `pnpm infra:verify` against a deployed site.
