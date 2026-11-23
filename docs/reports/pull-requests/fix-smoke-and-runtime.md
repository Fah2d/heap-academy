<!-- No AI attribution in this description or in any commit: no co-author trailer, no "Generated with" line, no session link (CLAUDE.md rule 15). -->

## What and why

Three fixes found after the last merges to `main`:

1. **The deploy smoke waits for the promoted release.** A production deploy failed because the smoke step ran about 2 s after `vercel promote`, while the address still served the previous release. With `--release`, `scripts/infra-verify.mjs` now asks `/api/health` every 5 s for up to 60 s until it names the expected release, and only then runs the other checks, so they test the new deployment and not the old one. If the release never appears, the check fails as before, and its detail line says how many requests were made and over how long. A refused or failed health request inside the 60 s is asked again; the last error is reported if the wait ends on it.
2. **A leftover `public/_runtime` cannot break the build.** `scripts/build-runtime.mjs` on `wp/3.1-python-worker` writes Pyodide and the compiled worker to `public/_runtime/`. On a branch without WP-3.1's ignore entries, a leftover copy was type-checked (it holds `.mjs` files and `tsconfig.json` includes `**/*.mjs` with `checkJs`). Measured on this machine with `main`'s `tsconfig.json`: 2 files from `public/_runtime` in the project, 14927 error lines naming `_runtime`. With this branch: 0 files. The folder is now excluded from TypeScript, ESLint, Prettier and git, with the same lines as `wp/3.1-python-worker`, so merging that branch brings no conflict.
3. **`e2e/csp.spec.ts` checked for scripts in a way that can only pass if they did not run.** The first test waited for `self.__next_f` to be a non-empty array and `window.next` to be set. Next 16's client entry empties that array and replaces its `push` as soon as it starts (`node_modules/next/dist/client/app-index.js`, lines 124 to 130; the same code is in the built chunk: `R.forEach(L),R.length=0,R.push=L`). So once the client entry ran, the array stayed empty and the wait could never succeed. The site was fine; the test was wrong. An init script now counts every inline flight push, before and after Next replaces `push`, and passes each one on unchanged. The test waits for at least one push, `window.next.version`, and a complete document.

   The second test (an injected inline script must be reported) has no proven cause. No browser can start in this sandbox (Chromium stops with `bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer...: Permission denied (1100)`), so neither test was run here. The old test injected right after `load`, while the client may still be starting. It now waits until the page's own scripts have run and then injects, and still polls the document listener (which also gets the event when the element is gone by then, as CSP3 "Report a violation" sends it to the document). The code review also ruled out three causes by reading the sources: Playwright does not bypass the policy (`bypassCSP` is not set), React keeps `SCRIPT` nodes when it clears the body, and `'strict-dynamic'` does not allow inline scripts added by code. The real cause needs the failure message from a browser run.

## Work package

- Work package: none. Maintenance fixes asked for by the owner on 2026-11-23.
- Requirements and threats covered: NFR-REL-04 (the smoke and rollback), NFR-SEC-02 (the script policy), NFR-MAINT-01 (the build gates).
- Time box, and time taken: no box; about 1 hour.

## How it was verified

- `pnpm verify` on 1829ec6, exit 0:

```
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
$ eslint --max-warnings=0 .
$ tsc --noEmit
$ node scripts/check-attribution.mjs --branch && node scripts/check-attribution.mjs --files
$ vitest run --coverage
 RUN  v5.1.0 /private/tmp/claude-501/night-a
 Test Files  27 passed (27)
      Tests  710 passed (710)
```

- Tests added, written first and seen failing before each change:
  - `scripts/infra-verify.test.ts`: "[NFR-REL-04] waits up to 60 s for a promoted release to go live"; "asks again until the address serves the new release, then checks it" (three old answers, then the new one: passes after 4 requests); "asks again after a refused or failed health request inside the wait"; "keeps asking until the wait is over, then fails"; "gives up when every health request fails until the wait is over"; "asks the health endpoint once when no release is given". Four of them failed before the change (the one without a release passed before and after; the "gives up" test came from the review, and it fails with a 5 s test timeout when the bound in the retry is removed, checked by mutation). The existing "fails when the address serves another release" test now passes a 300 ms wait so it does not take 60 s.
  - `scripts/repository.test.ts`: "[NFR-MAINT-01] is outside the TypeScript project", "is ignored by ESLint", "is ignored by Prettier". All three failed before the change, with the leftover `public/_runtime` folder present in this checkout.
- `pnpm build` with CI's fake public values: exit 0. A `curl` of `/no-such-page` on that build shows the policy header's nonce on all 20 tags that carry a nonce.
- End to end: **not run**. `e2e/csp.spec.ts` was changed and has never run anywhere in its new form. CI has no e2e job yet, so nothing else runs it either.

## Reviews

- code-reviewer, round 1 on 714227f: CHANGES REQUIRED, no blocker.
  - MAJOR 1: the element listener added in the CSP test missed exactly the case its comment named (an element no longer in the document gets no event; the document does). **Fixed:** the element listener removed, the document listener polled, the comment corrected.
  - MAJOR 2: no test covered health requests that fail past the wait, so a lost bound would poll forever. **Fixed:** a new test, seen failing by mutation. The reviewer also suggested a step timeout; the `production` job already has `timeout-minutes: 20`, so the smoke cannot run longer than that. Not changed.
  - MINOR: the "waits up to 60 s" test only checks the constant. Kept: it pins the 60 s the owner asked for; the behaviour is covered by the other wait tests.
  - MINOR: a trial merge with `wp/3.1-python-worker` conflicts in `scripts/infra-verify.mjs` (both add code after `securityHeaderChecks`). Task 2 of this run resolves it when it merges `main` into that branch.
  - Asked: the init script does not change page behaviour (`nextServerDataCallback` takes one argument and does not use `this`; nothing else in `next/dist/client` reads `__next_f`), and it cannot hide a policy failure.
- security-reviewer: not run. The change touches a test of the policy and the deploy smoke, not the policy itself.

## Owner actions now due

1. Run `pnpm test:e2e --project=chromium e2e/csp.spec.ts` (and `--project=firefox`, `--project=webkit` if installed). If the second test still fails, the message now shows either `no violation within 5 s` (the browser fired no event at the element) or a list from the document listener that differs from the element's event; please paste it into this pull request.
2. A `next start` server from this session may still listen on port 3190 (the sandbox cannot stop it): `lsof -ti:3190 | xargs kill`.

## Decisions taken with a safe default

1. **The whole smoke waits, not only the release check.** The health request comes first, and the page, header and report checks run after the release is live. Otherwise they would test the previous deployment during the first seconds.
2. **5 s between health requests, 60 s in total.** At most 13 requests. Each request keeps its own 15 s limit, so a hung address can stretch the wait to about 75 s; the deploy job's timeout is 20 minutes, so this fits.
3. **A failed health request inside the wait is retried**, because a promotion can briefly refuse connections. Without `--release` nothing is retried, as before.
4. **`.gitignore` also gets `/public/_runtime/`**, with the line WP-3.1 uses, so a leftover folder cannot be committed by mistake.

## Risks and rollback

- A deploy that never goes live now takes up to 60 s longer to fail and roll back. Rollback: revert 8ce22ea.
- The init script in `e2e/csp.spec.ts` replaces `self.__next_f` with an array whose `push` is an accessor. It passes every call through and accepts Next's replacement, so the page sees the same behaviour. It runs only in the test browser.

## Definition of Done

- [x] Every asked fix is made: (a) the 60 s wait, (b) the ignore entries, (c) the cause of test 1 found and fixed in the test.
- [ ] (c) for test 2: cause not proven; the e2e spec has not run.
- [x] Every new test names its requirement ID.
- [x] `pnpm verify` passes. CI has not run on this branch.
- [x] No stub, dead control, placeholder or invented number.
- [x] No new tables. No new server actions.
- [x] No AI attribution in any commit or in this description.

## Opening this pull request

From your terminal in the repository root:

```sh
gh pr create --base main --head wp/fix-smoke-and-runtime \
  --title "fix: wait for the promoted release in the smoke, ignore public/_runtime, correct the CSP e2e check" \
  --body-file docs/reports/pull-requests/fix-smoke-and-runtime.md
```
