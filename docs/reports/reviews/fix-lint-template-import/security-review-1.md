# Security review 1, wp/fix-lint-template-import (uncommitted first version)

Reviewer: `security-reviewer`, fresh context, 2026-11-24. Report saved verbatim. The first version it reviewed was replaced before commit (see the pull request description, "Review").

CHANGES REQUIRED

The change does what it says. A backtick string with no `${}` is now checked like a quoted one, and `src/content` refuses computed names. But `import()` can still be bypassed outside `src/content`. And `origin/wp/5.2-workspace-laptop` already has a stricter version of this same fix, which conflicts with this one.

**MAJOR**, `/private/tmp/claude-501/night-b/scripts/eslint/module-boundaries.mjs:197-201`, T-21 / CLAUDE.md rule 8
- **Attack:** a feature file or a client component writes `await import("@/infrastructure/db/" + "privileged")` or ``import(`@/infrastructure/db/${n}`)`` and lint stays clean. Webpack normally works out joined strings, and turns a `${}` prefix into a bundle of every file in that folder. I did not run a build to confirm that here.
- **Evidence:** I put both shapes through the real config as `src/features/catalog/components/list.tsx`. Neither produced a `heap/module-boundaries` error. Neither did `const p = "@/…/privileged"; import(p)`.
- **Fix:** refuse every `import()` whose name is not fixed, everywhere, except the one worker file. On 5.2 that is `COMPUTED_IMPORT_ALLOWED = "runtime/worker/python-worker"`, which matches `python-worker.ts:51` on 3.1. Then add tests for joined strings and `${}` outside `src/content`. The test at `rules.test.ts:~77` ("allows a module name computed at run time outside src/content") currently writes the bypass into the tests as allowed behaviour.

**MAJOR**, process: the same fix exists on another branch and the two conflict
- `origin/wp/5.2-workspace-laptop` already changes this rule. Its `fixedText` is the same as `staticString` here, it refuses computed `import()` and `require()` everywhere except the worker, and it has the content-session rule.
- I simulated the merges with `git merge-file`: `module-boundaries.mjs` has 1 conflict with `wp/5.1-catalog` and 2 with 5.2. `rules.test.ts` has none.
- Resolving those conflicts by hand could bring back the weaker version. Either rebase this branch onto 5.2's approach, or drop it in favour of 5.2.

**MINOR**, `module-boundaries.mjs:191-193`
- The comment says `content` "must never load a session client". On this branch, `import("@/infrastructure/db/server")` and ``import(`next/headers`)`` from `src/content` both pass. That rule (`CONTENT_INFRASTRUCTURE`) exists only on 5.1 and 5.2. Make the comment match what this branch enforces.

**What already holds:**
- `require` in any form (`require?.()`, `import x = require()`) is caught everywhere by `@typescript-eslint/no-require-imports`.
- `module.require` and `r = require; r()` pass `heap/module-boundaries`, but `no-require-imports` probably still catches them. My probe did not show which rule reported what for those two.
- `typeof import()` is type-only.
- `String.raw` and joined strings are refused in `src/content`.

**Open branches:** I linted every `src` file on them with this rule.
- `wp/5.1-catalog` (196 files) and `origin/wp/3.1-python-worker` (86 files): no new errors.
- 5.2: the only errors are two `node:worker_threads` imports in `src/grader/node-runner/`. Those come from linting 5.2 code with this branch's older rule, which lacks 5.2's own `NODE_RUNNER` exemption. They are not real failures.

**What I ran:**
- `git diff`, and diffs of the rule on all three branches.
- `./node_modules/.bin/vitest run scripts/eslint`: 143 passed.
- An ESLint API probe with 15 bypass shapes, through the repo config with type-aware rules off. Scripts are in `$TMPDIR/probe`.
- Lint of all three branches' `src`.
- `git merge-file` merge simulations.

**What I could not check:**
- Whether webpack or Turbopack actually bundles the bypass shapes (no build).
- `pnpm verify`.
- Your report that the new tests fail against `origin/main`'s rule; I did not rerun that.
