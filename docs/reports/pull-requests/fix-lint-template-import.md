<!-- No AI attribution in this description or in any commit: no co-author trailer, no "Generated with" line, no session link (CLAUDE.md rule 15). -->

## What and why

On `main`, the module boundary lint rule checked an `import()` only when its module name was a quoted string. The same name written in backticks, joined from parts, or held in a variable passed unseen. For example, `` import(`@/infrastructure/db/privileged`) `` passed lint anywhere, although the quoted form is refused outside the account deletion use case (CLAUDE.md rule 8). Security review 2 of WP-5.1 found this (MINOR A, `docs/reports/reviews/WP-5.1/security-review-2.md` on `wp/5.1-catalog`). The gap is older than WP-5.1. On 2026-11-24 you approved fixing it as its own small branch from `main` (WP-5.1 owner action 5), before WP-6.x adds `privileged.ts`.

The fix already exists on the open branches: bce0f08 on `wp/3.3-grader` (also on 3.4, 4.3 and 5.2). This branch brings it to `main` without its Node runner parts. Those need 772c468 and `src/grader`, which are not on `main`.

1. **A backtick string with no `${}` part is checked like a quoted string** (`fixedText` in `scripts/eslint/module-boundaries.mjs`), for `import()` and for `require()`. Every existing rule applies to it: the allowed modules, a feature's index, client imports, the privileged client, and pure modules.
2. **An `import()` or `require()` whose module name is not fixed in the source is refused** (`computedImport`). This covers a variable, a joined string, and a backtick string with `${}`. The one exception is `src/runtime/worker/python-worker.ts`, which loads Pyodide by URL (WP-3.1, ADR-0033). That file is not on `main` yet.
3. **Only a test may import a test file** (`testImport`), as on the open branches. The message names the grader's Node runner, which arrives with WP-3.3. On `main` today the rule refuses nothing new: no file in `src` imports a test.

## Work package

- Work package: none. A fix you approved on 2026-11-24 (WP-5.1 owner action 5).
- Requirements and threats covered: NFR-MAINT-05 (module boundaries), T-21 (private data in a public response), CLAUDE.md rules 8 and 9.
- Time box, and time taken: no box. About 1 hour, including two review rounds.

## How it was verified

- Tests in `scripts/eslint/rules.test.ts`:
  - From bce0f08: "lets only a test import a test file" and "refuses an import whose source is computed". One assertion in the second test was changed. bce0f08 expected a backtick import of `@/grader/node-runner/runner` from `src/runtime` to fail. Without the Node runner rule, `runtime` may import `grader`, so the assertion now uses `@/content/published`, which `runtime` may not import.
  - New: "[T-21] fails lint for a forbidden import() or require() with a backtick string in %s". It covers `src/domain` importing the database client by `import()` and by `require()`, `src/content` importing a feature, and a feature component importing the privileged client.
  - New: "[T-21] allows a backtick import() the rules allow".
  - New, from security review 2: "[T-21] refuses a joined module name, and keeps the worker's other imports checked". A joined name such as `"@/infrastructure/db/" + "privileged"` is refused in a feature. In the worker file, a fixed forbidden name and a computed `require()` are still refused. This test fails against `main`'s rule (`Tests  1 failed | 1 passed | 139 skipped (141)` with `-t "joined"`).
- The tests run against `main`'s rule (that file restored from `origin/main`, the tests kept):

```
     × [T-21] fails lint for a forbidden import() or require() with a backtick string in src/domain/ids.ts
     × [T-21] fails lint for a forbidden import() or require() with a backtick string in src/domain/ids.ts
     × [T-21] fails lint for a forbidden import() or require() with a backtick string in src/content/queries.ts
     × [T-21] fails lint for a forbidden import() or require() with a backtick string in src/features/catalog/components/list.tsx
     × [NFR-MAINT-05] lets only a test import a test file, so the Node runner cannot be passed on (ADR-0032)
     × [NFR-MAINT-05] refuses an import whose source is computed
      Tests  6 failed | 134 passed (140)
```

  With the change, before the review 2 test was added: `Tests  140 passed (140)`. With it: `Tests  141 passed (141)`.

- `pnpm verify` on the final change, exit 0:

```
$ prettier --check .
All matched files use Prettier code style!
$ eslint --max-warnings=0 .
$ tsc --noEmit
$ node scripts/check-attribution.mjs --branch && node scripts/check-attribution.mjs --files
$ vitest run --coverage
 Test Files  28 passed (28)
      Tests  726 passed (726)
```

- Open branches:
  - `git grep` for an `import(` or `require(` without a quoted name in `src` (on `wp/5.1-catalog`, `wp/4.3-validate-publish`, `origin/wp/3.1-python-worker` and `origin/wp/5.2-workspace-laptop`) finds only `import(url)` in the allowed worker file.
  - `git grep` for an import of a `.test` file from a non-test file (on 2.3, 4.2, 5.1, 3.1 and 6.3) finds none.
- Not run: `next build` (no file the build reads changed), `pnpm test:db`, e2e.

## Merging into the open branches

`git merge-tree` shows conflicts in `scripts/eslint/module-boundaries.mjs` with `wp/5.1-catalog`, `wp/4.3-validate-publish` and `origin/wp/5.2-workspace-laptop`, and in `rules.test.ts` with 4.3 and 5.2. They are next to the same lines, not different rules.

- On branches that carry bce0f08 (3.3, 3.4, 4.3, 5.2), take their version: it is this one plus the Node runner rule.
- On `wp/5.1-catalog`, keep both sides: this branch's import handling and 5.1's `CONTENT_INFRASTRUCTURE` rule.

This is written down so that a hand resolution cannot bring back the weaker check.

## Review

- Security review 1 (`docs/reports/reviews/fix-lint-template-import/security-review-1.md`): **CHANGES REQUIRED** on a first, uncommitted version, which refused computed names only in `src/content`.
  - MAJOR 1 (a joined string or `${}` passed outside `src/content`): fixed by item 2.
  - MAJOR 2 (the same fix exists on 5.2, and the two would conflict): fixed by taking bce0f08's text.
  - MINOR (a comment claimed more than the branch enforces): that comment is gone.
- Security review 2 (`security-review-2.md`, on 01c8227): **APPROVE**, two MINORs.
  - MINOR 1 (no test for a joined name or for the worker's fixed imports): fixed by the new test above.
  - MINOR 2 (`const r = require; r(...)`, `require.call`, `module.require` and `createRequire(...)(...)` pass every lint rule): older than this branch and not changed here. It is listed under "Not in this branch".
  - The reviewer resolved each merge in a copy and ran the rule tests: 141 pass on 5.1 with both sides kept, and 143 pass on 4.3 and on 5.2 with their side taken.

## Decisions taken with a safe default

1. **Branch name** `wp/fix-lint-template-import`, from `origin/main` at 7875ee2, like `wp/fix-smoke-and-runtime`.
2. **Take bce0f08's text rather than write a new rule.** That keeps one version of the check across the branches.
3. **`testImport` comes along.** It is part of bce0f08 and refuses nothing on `main` today.

## Not in this branch

- Calling `require` through another name passes lint: `const r = require; r(...)`, `require.call(...)`, `module.require(...)` and `createRequire(import.meta.url)(...)`. This is security review 2's MINOR 2, and it is older than this branch. `src` is ES modules and no file uses `require` today. Recommendation: in a follow-up, refuse any use of `require` that is not a direct call, and refuse `createRequire` in `src`.

- The rule that `src/content` may import only the session-less client, the environment schema and the logger, and never `next/headers` (`CONTENT_INFRASTRUCTURE`, `contentSession`), is on `wp/5.1-catalog` and `wp/5.2-workspace-laptop`. It reaches `main` with them.
