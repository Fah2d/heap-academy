# WP-3.1 security review 6: the worker's header rule

- Reviewer: security-reviewer subagent, fresh context, read-only
- Range: the change committed as e340e4f, reviewed before the commit, plus the comment and test changes made for its minors
- Threats: T-15, T-01, NFR-SEC-02 (sections 5.1 and 5.2)
- Date: 2026-11-24
- Condensed by the implementer from the reviewer's report.

**Verdict: APPROVE.** No blocker and no major.

The change closes security review 2, MINOR 3: the worker's rule was `/_runtime/worker/:path*`, so a miss under that folder got the worker's policy, which has no `sandbox`, instead of the runtime's static policy. The rule is now `/_runtime/worker/:path+.js`.

Checked and fine:

- The build manifest's regex is `^/_runtime/worker(?:/((?:[^/]+?)(?:/(?:[^/]+?))*))\.js(?:/)?$`. It matches all seven compiled files (`worker/python-worker.js`, `worker/core.js`, `worker/run-support.js`, `protocol.js`, `manifest.js`, `output.js`, `lockdown.js`). `tsconfig.worker.json` writes no source maps and no declarations, so nothing else lands in that folder.
- No browser can break: a module worker takes its policy from its top-level script response, `python-worker.js`, which gets the same header as before. The imported modules' policy headers are ignored either way; they still get `no-cache`.
- Mutants die: `:path*` (the `no-such-file` case), `:path*.js` (`/_runtime/worker.js`), `:path+` (`page.html`), a single-segment `:file.js` (`python-worker.js`), `worker/:path+.js` (`protocol.js`), dropping `Cache-Control`, and moving the worker's rule earlier.

| Finding | Status |
|---|---|
| MINOR 1: a miss ending in `.js` still gets the worker's policy, and the server matches without case, so `/_runtime/worker/CORE.JS` does too. That not-found page has `default-src 'none'`, `script-src 'self' 'wasm-unsafe-eval'`, `frame-ancestors 'none'`, no `sandbox`; it reflects no input and inline scripts are blocked. Low risk. The new comment said every miss keeps the static policy. | Comment corrected. The residual is recorded under "Not fixed" in the description. Naming the seven files in the rule was not done: the list would then live in two places. |
| MINOR 2: `unstable_getResponseFromNextConfig` matches with case; the server does not. | A comment in `scripts/next-config.test.ts` states the gap. |
| MINOR 3: the test checked 3 of the 7 compiled files. | The test now checks all seven, the list `scripts/build-runtime.test.ts` pins. |

Not checked by the reviewer: real browsers, Vercel's edge router, `pnpm infra:verify` against a deployment, `pnpm verify` (the implementer's runs were relied on).
