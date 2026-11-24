# Security review 2, wp/fix-lint-template-import (commit 01c8227)

Reviewer: `security-reviewer`, fresh context, 2026-11-24. Report saved verbatim.

APPROVE

The commit does what round 1 asked for. Every `import()` or `require()` whose source is not a fixed string is refused, except in the Python worker, and the three merges resolve cleanly. The two findings below are small and can go in a follow-up.

**Correctness, checked with ESLint probes run through the repository's real config.** Each of these was flagged with `computedImport` in `list.tsx`:
- joined strings, `"@/infrastructure/db/" + "privileged"` (a BinaryExpression, confirmed)
- `${}` templates
- `a ? b : c`
- `String.raw` templates
- `require("a" + "b")`

Fixed strings that only look different still reach `check()` and get the `privileged` message: `(("…"))`, a `p` escape, `/./privileged`, a `.ts` ending, and a second argument to `import()`. The worker exemption is narrow. `src/runtime/worker/python-worker.ts` may use a computed `import()`, but a fixed forbidden string there is still flagged, a computed `require` there is still flagged, and `python-worker.test.ts` gets no exemption. `import x = require(...)` gets past this rule but is caught by `@typescript-eslint/no-require-imports`, and tsc rejects it with module `esnext`.

**Findings**

- **MINOR** `scripts/eslint/rules.test.ts:193-211`: round 1 asked for a test of joined strings, and there isn't one. Only `${}`, a bare identifier and `require(name)` are tested. The probe shows `"a" + "b"` is caught, but nothing stops it coming back later. Fix: add `void import("@/infrastructure/db/" + "privileged");` to the computed-import loop. Also add a check that a fixed forbidden string in `python-worker.ts` is still flagged.
- **MINOR** `scripts/eslint/module-boundaries.mjs:225` (already on main, not added by this commit): `const r = require; r("@/infrastructure/db/privileged")`, `require.call(null, …)`, `module.require(…)` and `createRequire(import.meta.url)(…)` all pass every lint rule. Fix in a follow-up: add `no-restricted-globals` for `require` and `module`, or flag any `require` identifier that is not the callee.

**Test strength:** I put origin/main's rule back under the new tests and got 6 failed, 134 passed. With the change, 140 pass.

**Merges:** I resolved each merge in a copy under `$TMPDIR` and ran the rule tests on it.
- **wp/5.1-catalog:** keep both sides (`testImport`, `computedImport` and `contentSession`). Taking only 5.1's side would drop `computedImport`. 141 pass.
- **wp/4.3-validate-publish and origin/wp/5.2-workspace-laptop:** taking their side in every conflict is safe, because their side contains everything in this commit. 143 pass on each. No test names are duplicated.

**What I ran:** `git show 01c8227`, `git diff 01c8227 bce0f08`, `vitest run scripts/eslint` (140 passed), the probe script `$TMPDIR/probe.mjs`, `git merge-tree` against the three branches with the resolutions above, and the origin/main rule under the new tests.

**Not run by me:** `pnpm verify`. The 725-test, exit-0 figure is the implementer's. I also could not test against a real `python-worker.ts`, because that file is not on main.
