<!-- No AI attribution in this description or in any commit: no co-author trailer, no "Generated with" line, no session link (CLAUDE.md rule 15). -->

## Up to date with main

`main` at 0efe863 (#5, #6, #7, #8) is in this branch through `wp/2.1-schema-policies`, which already has it (9077917): merge commit 2f45f1d. No rebase, no force push.

- Two files conflicted. `docs/reports/local-build-progress.md`: the copy from `wp/2.1-schema-policies`, the newer one. `playwright.config.ts`: both new projects kept, this branch's `stack` journeys and `main`'s three `phone` projects; the desktop projects ignore the gallery, phone and stack specs (decision A).
- One test file failed after the merge: 10 tests in `src/features/auth/components/sign-in-view.test.tsx`. `main`'s `Notice` now puts an announced notice in a `LiveRegion` that is in the page first and gets its words one frame later, so a test that read the alert at once found it empty (`AssertionError: expected '' to contain 'Sign-in is not working right now. Try…'`). Fixed in 6bf689e: the tests wait for the same words in the same `alert` region (`waitFor`), and `challengeNeeded` with `findByText`. No assertion was removed or loosened, and the sign-in view itself is unchanged.

On 6bf689e, `pnpm verify`, exit 0:

```
All matched files use Prettier code style!
 Test Files  42 passed (42)
      Tests  918 passed (918)
```

`next build` with CI's public values (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` from `.github/workflows/ci.yml`), exit 0, routes `/_not-found`, `/api/csp-report`, `/api/health`, `/auth/callback`, `/sign-in`. `node scripts/check-bundle.mjs .next/static`: "No server variable (RESEND_API_KEY, HEAP_RELEASE) in 21 files under .next/static." `node scripts/check-static.mjs .next`: "No prerendered page in .next, apart from /_global-error, which Next.js always prerenders."

Not run on the merge: `pnpm test:db` (no Docker on this machine) and e2e (no browser here).

Decisions taken with a safe default during the merge:

- A. The CI `e2e` job still runs `--project=chromium --project=stack --project=gallery`. `main`'s `phone` projects are not added to it: `main` runs no e2e in CI, and adding a job's work is outside a merge. Run `pnpm test:e2e --project=phone --project=phone-375 --project=phone-360` locally, or ask for them to be added to CI.

## What and why

Sign-in for learners, with Google and with a six-digit code sent by email (ADR-0017), built on Supabase Auth through `@supabase/ssr`:

- **Clients.** A session client for the caller's own cookies (`src/infrastructure/db/session-client.ts`), so row level security decides. No browser database client: ADR-0027 says the browser never talks to the database, and nothing in the browser needs one (deviation 1).
- **Session refresh in `proxy.ts`.** A request with no session cookie makes no call to the auth service. With one, `getClaims()` refreshes it, and the page never waits more than 1.5 s: it is then served as for a signed-out visitor, a `session-refresh:timed-out`, `:failed` or `:no-claims` warning is logged, and the proxy marks the request so the page asks the auth service nothing more (`page-identity.ts`). Pages' own identity checks use the same bounded fetch.
- **Identity** from `getClaims()` only (`verified-identity.ts`), parsed by WP-2.2 part 1's `identityFromClaims`.
- **The action wrapper's real context** (`server-action.ts`): the request ID from `proxy.ts`, identity, `public.is_admin()` (a new invoker-rights wrapper of `private.is_admin()`, with 8 pgTAP assertions), and the sign-in provider bound to this request's session.
- **Email code**: request with the Turnstile token, verify, sign out on this device, through the wrapper. Sign-ups stay on, so a known and an unknown address get the same answer (T-11).
- **Google**: a server action starts the PKCE flow and keeps the safe return path in a 10-minute, httpOnly cookie scoped to `/auth/callback`; `GET /auth/callback` exchanges the code and follows the path, made safe again, or returns to sign-in with a notice.
- **The sign-in page** (`/sign-in`, not indexed) with every state of `03-experience.md` section 8, the in-app browser order of FR-AUTH-03, and Google's own dark button, unaltered (`public/third-party/google/`, with its source).
- **The account control** in the header: "Sign in" carrying the current page and query, or "Sign out".
- **The `e2e` job**: Chromium journeys on the production build, and, after `supabase start`, the email code journey that reads the code from the stack's mail catcher.
- **No stranger's password survives** (T-11). The auth service still accepts a password sign-up through its public endpoint. **Confirm email is on** (`supabase/config.toml`, runbook section 10), so such an account stays unconfirmed and cannot sign in, and a new migration (`20261121030000_clear_password_on_confirm.sql`, 6 pgTAP assertions) clears the password whenever an address becomes confirmed, because auth releases before v2.198.0, including the local CLI's v2.197.0, keep it (security review 1, BLOCKER 1). A trigger refusing every password was drafted first and dropped: the auth service gives every new code account a random password (`internal/api/magic_link.go`, read 2026-11-21), so it would have broken code sign-up.

## Work package

- Work package: WP-2.2 Sign-in (`docs/spec/08-delivery-plan.md`), stacked on WP-2.1 (`wp/2.1-schema-policies`), which brings the `profiles` trigger.
- Requirements and threats covered: FR-AUTH-01 to FR-AUTH-06, NFR-COMPAT-02 (owner check), T-11.
- Time box 3.5 hours. Part 1 (2026-11-20) and this session (2026-11-21, 05:32 to about 06:10) together: about 4 hours of work. Over the box, under 1.5 times.

## How it was verified

- `pnpm verify`, exit 0: Prettier, ESLint, `tsc`, attribution, `Test Files  38 passed (38)`, `Tests  867 passed (867)` (last run before the final commit). pnpm prints that its install step failed; see "Risks".
- `next build` with the fake values of `.env.example`: exit 0, routes `/auth/callback` and `/sign-in` dynamic, then `scripts/check-static.mjs` ("No prerendered page") and `scripts/check-bundle.mjs` ("No server variable ... in 21 files") pass.
- The production server, probed with `curl` (no browser can run here): `/sign-in` answers 200 with "Sign in with Google", "Email address", "Send code" and `noindex`; the header link on `/no-such-page` is `/sign-in?returnTo=%2Fno-such-page`; `/auth/callback?error=access_denied` answers 303 to `/sign-in?failed=google&returnTo=%2Fcourses` and logs `error:google-failed`.
- Database: PGlite harness, every migration, then every test, with and without the seed: `01` 33 ok, `02` 80, `03` 57, `04` 54, `05` 47, `06_is_admin_wrapper` 8, `07_password_on_confirm` 6 ok, 0 not ok. The harness's stub of `auth.users` gained the real `encrypted_password` and `email_confirmed_at` columns for test 07. **Not run on the Supabase image.**
- Tests added (requirement IDs in titles): session refresh (no client without a session cookie, chunked cookie names, cookies and cache headers passed on, timeout drops late cookies), the proxy (no `fetch` without a session cookie, fails open at the timeout), the Supabase adapter, the Google use cases and their Next.js glue (cookie flags, path, deletion, tampered cookie), the session client's bounded fetch, the env variable, the view (every state, focus, one-use tokens, the resend cooldown, an unreachable action), the shell's account landmark, the `e2e` job's order.
- End to end and axe: **written, not run** (no browser in this session): `e2e/sign-in.spec.ts` (states without the stack, axe and 44 px at four widths, overflow) and `e2e/sign-in-journey.spec.ts` (`stack` project: sign in with a code, return, sign out; wrong code; the same answer for a known and an unknown address).

## Screens

None yet: no browser can run here. The `e2e` job saves `sign-in-{320,375,768,1280}`, `sign-in-google-failed-*`, `sign-in-in-app-browser-*`, `sign-in-code-1280` and `sign-in-code-rejected-1280` to `docs/reports/screens/WP-2.2/`.

antislop Delivery Gate report, antislop active: during (global preference). From source only; every line that needs a rendered page is NOT VERIFIED until the `e2e` job runs.

- Block 1: R-02 PASS (no em dash in `src/messages/sign-in.ts`). R-03 NOT VERIFIED (one column, `max-w-dialog`, 16 px gutters in source; the 44 px and overflow tests are written). R-17, R-18, R-36, R-38 PASS (no numbers but the real 6 digits and 10 minutes from `config.toml`). R-23 PASS (Google's mark is Google's file, allowed by `DESIGN.md` section 8; nothing created). R-24 PASS (the header shows only Sign in or Sign out, both real). R-25 NOT VERIFIED (tokens only). R-26 PASS by code (every button has an action; the Google form posts without JavaScript). R-27 PASS (every state of section 8 in source and in unit tests). R-28 N/A. R-32 PARTIAL (native and React Aria controls, focus moved on step changes, tested in jsdom; focus ring NOT VERIFIED). R-33, R-34 PASS. R-35 NOT DONE: not clicked through in a browser. R-37 PASS (signed `DESIGN.md`). R-39 PASS by code (labels, names, `nav` landmark named "Account", one `h1`). R-40 PASS by code (the Google image has width and height; the challenge's 65 px is reserved; Turnstile loads async after the page).
- Block 2: no gradient, glow, shadow, badge or arrow; Carbon icons only in notices. PASS by code.
- Block 3: dials ENERGY 1 / RHYTHM 1 / MOTION 1; one focal point, the primary button of the active step; amber only on the primary button and focus.
- Block 4: C-1, C-2, C-3, C-5 PASS. C-4 NOT VERIFIED until screenshots exist.

## Reviews

Saved in `docs/reports/reviews/WP-2.2/`.

- **design-reviewer (1): CHANGES REQUIRED.** BLOCKER 1, no screenshots: cannot be met here; the specs now capture every state that can be reached without stubbing the actions (Google failed, in-app, code, rejected code), and the transient sending and checking states are covered by unit tests only. BLOCKER 2, no Delivery Gate: above. MAJOR 3 (errors off-screen on phones), 4 (focus dropped), 5 (used token kept): fixed in 0143d53. MINOR 6 to 9 and 11 fixed in 0143d53. MINOR 10 ("Continue" in spec 5.4): deviation 4. MINOR 12 (Sign out heavier than Sign in): kept; an action is a button, and the screenshot will show whether it needs a quieter variant.
- **code-reviewer (1): CHANGES REQUIRED, no blocker.** MAJOR 1 (pages' `getClaims` unbounded): fixed in e1fbbcc. MAJOR 2 (Google cookie untested): `google-flow.test.ts`. MAJOR 3 (loading states untested): tests added. MAJOR 4 (Supabase's per-address limits see every learner as one caller): runbook corrected, decision 2. All MINORs fixed in e1fbbcc, except none.
- **security-reviewer (1): CHANGES REQUIRED.** BLOCKER 1 (a stranger's password survives confirmation on auth v2.197.0): the confirmation trigger and test 07; the password-verification hook it suggested is a paid-plan hook (ADR-0029), so the database does it instead; the CLI bump and the hosted-version check are decision 3. MAJOR 2: bounded page client plus the proxy's auth-unavailable marker, tested. MAJOR 3: e2e tests for a foreign-origin server action and a callback without the PKCE verifier (written, not run); the forwarded-host case is a unit test. MINOR 4: `requestOrigin` takes the first forwarded value and falls back to `host`. MINOR 5: the no-JavaScript claim is removed. MINOR 6: decision 4.

## Try it on the preview

After the owner actions below: open the preview, press "Sign in" in the header, request a code to your address, type it, and see the page you came from with "Sign out" in the header. Then try Google. Previews use Turnstile's test key, which always passes.

## Owner actions now due

1. **Install the Supabase packages and commit the lockfile** (pnpm cannot install in this session). In a checkout of `wp/2.2-sign-in`: `pnpm install && git add pnpm-lock.yaml && git commit -m "build: lock the Supabase clients" && git push`. Until then every CI job fails at `pnpm install --frozen-lockfile`.
2. Section 10 of `docs/runbooks/infrastructure-setup.md` for both projects, now with **Confirm email on**, and the Turnstile split of step 7 (real keys in production only; test keys for Preview and staging).
3. Vercel: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` for Production (real) and Preview (test key). The build fails without it.
4. Branch protection: add `e2e` to the required checks (handbook section 10 already lists it).
5. After the merge: email code inside the TikTok and Instagram in-app browsers on production (NFR-COMPAT-02, ADR-0029).

## Decisions for the owner

1. **Rate limits seen from the server.** Every request reaches Supabase from Vercel, so Supabase may count all learners as one caller (not measured). Recommendation: measure on staging with 31 wrong codes; if it is shared, raise "Token verifications" and record the value. Default: the runbook's current values.
2. **Wrong and expired codes share one message**, because Supabase reports both as `otp_expired` as far as its documentation says. Recommendation: accept, and change `03-experience.md` section 8 to one state "code not accepted" (spec-change). Default: one message.

3. **The auth version.** The pinned CLI 2.122.1 runs auth v2.197.0. Recommendation: move the CLI to the first release that ships auth v2.198.0 or later in WP-7.1, and add the hosted auth version to `infra:verify`. The trigger closes the hole on any version meanwhile. Default: no change now.
4. **Timing.** A new address costs the auth service a bcrypt hash and a known one does not, so response time may tell them apart (not measured). Recommendation: record it as a residual risk in `06-security-privacy.md` section 6 (spec-change). Default: listed here only.

## Deviations from the plan or the spec

1. No browser database client (the plan's "browser database clients"): ADR-0027 outranks the plan. Spec-change proposed.
2. `startGoogleSignIn` is a server action not listed in `02-architecture.md` section 9.1. Spec-change proposed.
3. The Google return path waits in a cookie, not in the callback address, because the provider's allow-list holds the bare `/auth/callback`.
4. The email button says "Send code", not "Continue" (`03-experience.md` section 5.4), because section 9 asks buttons to name the action. Spec-change proposed.
5. The 1.5 s limit for the auth service is this package's number; no spec gives one.

## Risks and rollback

- **The lockfile.** `package.json` names `@supabase/ssr` 0.12.7 and `@supabase/supabase-js` 2.119.2; `pnpm-lock.yaml` does not. They were type-checked and tested here against copies installed by npm into `node_modules`, not by pnpm. Owner action 1 fixes it.
- Rollback: revert the merge. No data migration except the `public.is_admin()` function, which nothing else depends on.

## Definition of Done

- [ ] Every "Done when" line is met. **No:** both methods on the preview against staging, and the e2e journeys, have not run.
- [x] Every cited Must requirement has a passing test that names its ID.
- [ ] `pnpm verify` and every required check pass. `pnpm verify` passes; CI fails until owner action 1.
- [x] Every state of every changed view exists.
- [x] No stub, dead control, placeholder, commented-out code, or invented number.
- [x] New server actions use the wrapper. No new table.
- [ ] Every reviewer blocker is fixed. Security BLOCKER 1 fixed; design review BLOCKER 1 needs the screenshots from CI. No reviewer has re-reviewed the fixes.
- [x] No AI attribution in any commit or in this description.

Create with:

```sh
gh pr create --draft --base wp/2.1-schema-policies --head wp/2.2-sign-in --title "WP-2.2 Sign-in" --body-file docs/reports/pull-requests/WP-2.2.md
```
