# Security review 1, WP-1.4

Reviewer: `security-reviewer`, fresh context. Range `ef7276c..7bf3939`. 2026-11-16.

Verdict: **CHANGES REQUIRED**.

Most of the work package holds up. The two development pages never reach the production build, and the browser bundle carries no secret, no zod and no gallery code. The error page's reference shows nothing internal, and every dependency is pinned. The problem is the sandbox exclusions in `.claude/settings.json`: they reach further than the commits say, and the record from WP-1.2 now says something that is no longer true.

## Findings

**MAJOR 1: the excluded commands run any code the agent writes outside the sandbox, and that reopens gaps the guardrail report says are closed.**
- Where: `.claude/settings.json:54`, `docs/reports/guardrails.md:184`. Threat T-18.
- The attack: the agent writes a Playwright spec, or a `--config` file, that reads `.env.local`, posts to any host, or rewrites `.claude/settings.json`, `.git/config` (`core.hooksPath`) or `scripts/claude-guard.mjs`, then runs `pnpm test:e2e` or `npx playwright test -c <file>`. Outside the sandbox none of the OS-level read, write or network limits apply. The test servers also start `next build`, `next start` and `next dev` outside the sandbox, and Next.js loads `.env*` by itself through `@next/env`. `guardrails.md:184` lists exactly that case as closed by the sandbox (attempt 17).
- Evidence: the guard (`scripts/claude-guard.mjs`) allows (exit 0) `pnpm test:e2e --config /tmp/other.config.ts`, `npx playwright test -c e2e/x.config.ts`, and `pnpm test:e2e && curl https://example.com`. Whether Claude Code applies an exclusion to a whole command chained with `&&` was not verified. Nothing in `docs/` mentions `excludedCommands`. Commit ec93e27 gives only "Chrome cannot start inside the sandbox" as the reason.
- Fix (owner's decision): either run browser tests only in CI or in a container, or keep the exclusion, write the residual risk into `guardrails.md` and handbook section 2, and correct the claim at line 184. Also make the guard refuse `--config`/`-c` with a path other than `playwright.config.ts`; this narrows the risk, it does not close it.

**MAJOR 2: `gh` outside the sandbox can install and run extensions, and the guard does not block them.**
- Where: `.claude/settings.json:54` (commit 244f00c), `scripts/claude-guard.mjs:636-682`. Threat T-18.
- The attack: `gh extension install <owner>/gh-x`, then `gh x`, runs arbitrary code outside the sandbox. The guard blocks `gh alias set` for the same reason, so extensions are the missing twin.
- Evidence: the guard gives exit 0 for `gh extension install someone/gh-anything` and for `gh anything`, and exit 2 for `gh alias set x --shell "id"`.
- Fix: deny rules `Bash(gh extension *)` and `Bash(gh ext *)`, and block both in `checkGh`; better, allow only known `gh` subcommands. The guard is a locked file, so the owner makes this change outside a session.

**MINOR 3: the request ID shown on the error page comes straight from the client's header.**
- Where: `src/app/layout.tsx:26`, `src/features/shell/request-id.ts:3`. NFR-OBS-01 (log integrity).
- There is no `proxy.ts` on this branch (WP-1.3), so a client can choose its own reference. No XSS: the regex holds and React renders it as text, and a browser cannot put a custom header on a victim's page load.
- Evidence: `curl -H 'x-request-id: ATTACKER_chosen_id_1234' http://127.0.0.1:3190/nope` on the production build reflected the value.
- Fix: when WP-1.3 merges, `proxy.ts` must replace any incoming `x-request-id`, with a test that a client-sent value is not reflected.

**MINOR 4: the production check covers only one of the two development pages.** `e2e/shell.spec.ts:21` checks `/dev/primitives` but not `/dev/error`.

**MINOR 5: the gallery code is in the production server bundle, though no route uses it.** `src/features/shell/index.ts:5`: the root layout and `error.tsx` import the shell index, which also exports `PrimitiveGallery`. The browser copy is an empty stub; the server SSR chunk contains the gallery. Read strictly, "absent from the production build" is not met. Fix: give the gallery its own entry module, with a boundary-rule exception for `*.dev.tsx` pages only.

**MINOR 6: the Playwright servers listen on the whole local network.** `playwright.config.ts:43,51`. Fix: `--hostname 127.0.0.1`.

**MINOR 7: the progress bar adds the app's own inline `style` attribute.** `src/ui/primitives/progress.tsx:31`. WP-1.3's attempt without `style-src-attr 'unsafe-inline'` will fail on the app's own code, not only React Aria. Record it for WP-1.3, or set the width another way.

**MINOR 8: the pnpm store was made writable from the sandbox** (`.claude/settings.json:56`, T-13). A sandboxed process can change the shared package store every project on this machine installs from. Record it in `guardrails.md` with the exclusions above.

## Checks that passed

- Development pages: `pageExtensions` adds `dev.tsx` only in `PHASE_DEVELOPMENT_SERVER`. The production server answers 404 at `/dev/primitives`, `/dev/error`, `/dev` and `/dev/primitives.dev`. The route manifest lists only `/_global-error` and `/_not-found`.
- Secrets: built with a canary `RESEND_API_KEY`; the value appears nowhere in `.next`, and the name in no static chunk. zod is not in the browser bundle.
- Error page: never renders `error.message`. The reference is the Next.js digest or a request ID that passed the regex, rendered as text.
- Dependencies: every new dependency is an exact version. Carbon's only install script (`ibmtelemetry`) stays denied. The five font files are byte-identical to the locked `@fontsource` files. `pnpm audit --prod` finds nothing; one moderate `minimatch` advisory sits under `typescript-eslint` (development only, older than this range).
- `next.config.ts`: `agentRules` and `watchOptions.pollIntervalMs` exist in the Next.js 16.4.6 config schema.
- `playwright.config.ts`: the values it gives the servers are the fake ones from `.env.example`.
- Nothing in the range uses `dangerouslySetInnerHTML`, `eval`, `new Function` or `innerHTML`.

## What the reviewer ran

On a copy of HEAD in its scratchpad: `next build` with the canary secret, `next start` probed with `curl`; `grep` over `.next`; `prettier --check`, `eslint`, `tsc` clean; `vitest run --coverage` 12 files, 507 tests passed; `pnpm audit`; a byte comparison of the fonts. In the repository, `check-attribution.mjs --branch` and `--files` exited 0, and six commands were piped through the guard by hand.

Not checked: browser tests; response headers (WP-1.3); how Claude Code matches `excludedCommands` against chained commands or `VAR=x` prefixes.

## Outcome

| # | Outcome |
|---|---|
| 1, 2 | For the owner. The implementer cannot change `.claude/settings.json` or the guard. Listed in the pull request. |
| 3 | WP-1.3: `proxy.ts` replaces any incoming `x-request-id`, with a test. |
| 4 | Fixed in d5e002d. |
| 5 | Not fixed: needs a boundary-rule exception, which is a spec change. Listed for the owner. |
| 6 | Fixed in d5e002d. |
| 7 | Recorded for WP-1.3. |
| 8 | For the owner, with 1 and 2. |
