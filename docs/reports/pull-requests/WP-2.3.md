<!-- No AI attribution in this description or in any commit: no co-author trailer, no "Generated with" line, no session link (CLAUDE.md rule 15). -->

## Up to date with main

`main` at 7875ee2 (#12, WP-2.1 merged) is in this branch through `wp/2.2-sign-in`, which has it (4c297fc): merge commit d3a05da. No conflict. #12's merge commit changes no file against `wp/2.1-schema-policies`, which this branch already had. The merge also brings WP-2.2's and WP-2.1's approved spec changes. WP-2.1 is merged, so once WP-2.2 merges this pull request's base becomes `main`.

With the merge and this package's approved spec changes, `pnpm verify`, exit 0:

```
All matched files use Prettier code style!
 Test Files  53 passed (53)
      Tests  1019 passed (1019)
```

`next build` with CI's public values, exit 0. `check-bundle` (22 files) and `check-static`: exit 0. Not run: `pnpm test:db` (no Docker) and e2e (no browser).

`main` at 81fdc39 (#10 on top of #5 to #8) is in this branch through `wp/2.2-sign-in`, which has it (30dbedc): merge commit d6dfb0c. No rebase, no force push. One file conflicted, `docs/reports/local-build-progress.md`: the copy from `wp/2.2-sign-in`, which holds every section of this branch's copy (this branch's copy differed only in older lines of the same session). No test failed and no code changed.

On d6dfb0c, `pnpm verify`, exit 0:

```
 Test Files  53 passed (53)
      Tests  1019 passed (1019)
```

`next build` on d6dfb0c with CI's public values, exit 0, the same eight routes. `check-bundle` (22 files) and `check-static`: exit 0. Not run: `pnpm test:db` (no Docker) and e2e (no browser).

The earlier merge of `main` at 0efe863 follows.

`main` at 0efe863 (#5, #6, #7, #8) is in this branch through `wp/2.2-sign-in`, which already has it (2f45f1d, with 6bf689e): merge commit a9d23f1. No rebase, no force push.

- One file conflicted: `docs/reports/local-build-progress.md`. The copy from `wp/2.2-sign-in` was taken; it holds this branch's sections word for word and the newer ones. `playwright.config.ts` merged on its own, with `main`'s `phone` projects (decision A of WP-2.2 applies here too).
- One test file failed after the merge: 4 tests in `src/features/admin/components/second-step-form.test.tsx` (`AssertionError: expected '' to contain 'That code did not work. A code change…'`). Same cause as WP-2.2: `main`'s `Notice` puts an announced notice in a `LiveRegion` that is in the page first and gets its words one frame later. Fixed in 1fb08e1: the tests wait for the same words in the same `alert` region (`waitFor`). No assertion was removed or loosened, and the form itself is unchanged.
- The same race was in `src/features/admin/components/setup-flow.test.tsx`: it passed on this branch, then failed 2 of its tests in the `wp/4.1-courses-chapters` merge run (`AssertionError: expected '' to contain 'The QR code could not be made right n…'`). Fixed here in 39c22f1 the same way.

On 39c22f1, `pnpm verify`, exit 0:

```
 Test Files  53 passed (53)
      Tests  1010 passed (1010)
```

`next build` with CI's public values (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` from `.github/workflows/ci.yml`), exit 0, routes `/_not-found`, `/admin`, `/admin/setup`, `/admin/verify`, `/api/csp-report`, `/api/health`, `/auth/callback`, `/sign-in`. `node scripts/check-bundle.mjs .next/static`: "No server variable (RESEND_API_KEY, HEAP_RELEASE) in 22 files under .next/static." `node scripts/check-static.mjs .next`: "No prerendered page in .next, apart from /_global-error, which Next.js always prerenders."

Not run on the merge: `pnpm test:db` (no Docker on this machine) and e2e (no browser here).

No new decision: the merge took no choice beyond WP-2.2's decision A.

## What and why

The admin gate (ADR-0025, `02-architecture.md` section 11.2): only an admin on the list who has passed the second sign-in step reaches the dashboard. Everyone else gets the standard not-found page at every `/admin` address.

- **The guard.** `src/features/admin/server/gate.ts` decides once per request (React `cache`): not signed in or not on the list gives not-found; on the list with no authenticator gives setup; at `aal1` with one gives verify; at `aal2` the dashboard. The pure decision is `src/domain/admin/gate.ts`. The `/admin` layout runs it and keeps strangers out. Each page runs it again for its own stage, because Next.js renders a page beside its layout. `guard-coverage.test.ts` fails if a new admin page forgets to.
- **The list check.** The caller's session cannot read `admins`, and `private.is_admin()` answers false below `aal2`. So a new `security definer` function `private.is_on_admin_list()` answers one boolean about the caller only, with a public invoker-rights wrapper (migration `20261121040000_admin_list_check.sql`, pgTAP `08`, 14 assertions). It grants nothing: every admin policy still requires `private.is_admin()` at `aal2`.
- **The second step** through Supabase's multi-factor API (`src/infrastructure/auth/second-step.ts`). Factors come from `listFactors()`, which asks the auth service (`getUser`). The browser never names a factor. Three wrapped server actions, access `signed-in` because the caller is below `aal2`; each asks the list check first and answers anyone else `not_found`:
  - `startSecondStepSetup`: replaces any unfinished setup with one new factor and returns its QR code and key. It runs only on a press, never on a page render (code review MAJOR 1).
  - `confirmSecondStepSetup`, `verifySecondStep`: a six-digit code only.
- **Pages.**
  - `/admin/setup`: Show the QR code, then the QR code and the key in groups of four, then the first code.
  - `/admin/verify`: one code field.
  - `/admin`: the course list with status and published and draft lessons, read through the admin's own session, with an honest empty state and a load failure.
  - Every state is in `src/messages/admin.ts`. Below 1024 px a heading and one sentence ask for a wider window.
- **No caching.** `proxy.ts` sends every `/admin` address with `cache-control: private, no-store`, because setup shows the key (security review MAJOR 2).
- **Runbooks.** `docs/runbooks/admin-access.md`: make the owner the admin, with the first-setup window closed; a lost authenticator; removing an admin; watching for code guessing. Plus `infrastructure-setup.md` section 10 step 8, the multi-factor setting.

## Work package

- Work package: WP-2.3 The admin gate (`docs/spec/08-delivery-plan.md`), stacked on WP-2.2 (`wp/2.2-sign-in`).
- Requirements and threats covered: FR-ADM-01, FR-ADM-02, NFR-SEC-06, T-19, T-20; journey J-12.
- Time box 2.5 hours:
  - A session at about 06:00 on 2026-11-21 left the first draft uncommitted in its scratch folder.
  - This session (10:33 to about 11:00) reviewed it, completed it, ran the three reviews, and fixed their findings.
  - Total under the box, as far as the timestamps show.

## How it was verified

- `pnpm verify`, exit 0: Prettier, ESLint, `tsc`, attribution, `Test Files  49 passed (49)`, `Tests  959 passed (959)`.
- `next build` with the fake values of `.env.example`: exit 0, routes `/admin`, `/admin/setup`, `/admin/verify` dynamic. `check-static` ("No prerendered page") and `check-bundle` ("No server variable ... in 22 files") pass. The development gallery is not in `.next/static`.
- The production server, probed with `curl` (no browser here):
  - `/admin`, `/admin/setup`, `/admin/verify` and `/admin/courses/x` answer `404` with the title `Page not found | Heap Academy`, as `/no-such-page` does.
  - `/admin` and `/admin/setup` carry `cache-control: private, no-store`.
  - `/dev/admin` answers 404 in production.
- Database: the PGlite harness, every migration, then every test, with the seed: `01` 33 ok, `02` 80, `03` 57, `04` 54, `05` 47, `06` 8, `07` 6, `08_admin_list_check` 14 ok, 0 not ok. **Not run on the Supabase image.**
- Supabase facts read on 2026-11-21 (rate limits, TOTP, error codes):
  - challenge and verify are limited to 15 a minute per address, with bursts to 30, and the limit is not configurable;
  - TOTP is on by default;
  - the `mfa_*` codes used in `second-step-outcomes.ts`.
- Unit tests added (requirement IDs in titles):
  - the gate decision, and the server guard with each visitor;
  - the list check;
  - the three actions through the real wrapper: guest, learner at either level (the provider is never called), oversized input, admin;
  - the provider adapter and its outcomes;
  - the form (every failure, focus back to the field, checking state, one-time-code);
  - the setup flow (nothing made until the press, groups of four, failures);
  - the course list;
  - the proxy's `no-store`;
  - the guard on every page.
- End to end and axe: **written, not run** (no browser in this session):
  - `e2e/admin-gate.spec.ts`: a guest at four admin addresses gets the same status, title and main text as `/no-such-page`.
  - `e2e/admin-gate-journey.spec.ts`, `stack` project:
    - A learner gets not-found everywhere, and a direct insert into `courses` and an update of a lesson through the data API are refused.
    - An admin gets setup, and is refused at `aal1`.
    - A wrong code is refused; the right code opens the dashboard at `aal2`.
    - A new session is sent to verify and passes it.
    - Repeated wrong codes reach "Too many tries".
  - `e2e/admin-gallery.spec.ts`, `gallery` project: the states the journey cannot reach.

## Screens

None yet: no browser can run here. When CI runs, the `e2e` job saves these to `docs/reports/screens/WP-2.3/`:

- `admin-setup-1280`, `admin-setup-code-rejected-1280`, `admin-dashboard-1280` and `admin-verify-1280`;
- `admin-states-1280`: the empty and failed course list, the setup error, too many tries, and checking;
- `admin-narrow-375` and `admin-narrow-800`.

antislop Delivery Gate report, antislop active: during (global preference). From source only; every line that needs a rendered page is NOT VERIFIED until the `e2e` job runs.

- Block 1:
  - PASS:
    - R-02: no em dash in `src/messages/admin.ts`.
    - R-17, R-18, R-36, R-38: the only numbers are the real 6 digits, 1024 px and "a minute", and that one is from Supabase's limit.
    - R-23: the QR code is the provider's data; nothing drawn.
    - R-24: no fake content in the product; the gallery's sample row is development-only.
    - R-27: every state of the views is in source, unit tests and the gallery.
    - R-33, R-34, R-37.
  - PASS by code:
    - R-26: every button acts. Create a course is absent, not dead.
    - R-39: labels; one `h1`, the narrow view included; a table caption; `th scope`.
    - R-40: the QR image has width and height.
  - PARTIAL: R-32. React Aria controls; focus goes back to the field after a refusal. The focus ring is NOT VERIFIED.
  - NOT VERIFIED: R-03, R-25.
  - NOT DONE: R-35.
- Block 2: no gradient, glow, shadow, badge or arrow. The light square behind the QR code has a written reason (scanning). PASS by code.
- Block 3:
  - Dials: ENERGY 1, RHYTHM 1, MOTION 1.
  - Focal point: the primary button of each step.
  - The dashboard has no focal point until WP-4.1 adds Create a course.
- Block 4: C-1, C-2, C-3, C-5 PASS. C-4 NOT VERIFIED until screenshots exist.

## Reviews

Saved in `docs/reports/reviews/WP-2.3/`. All three are round 1, on a0359dd. None has re-reviewed the fixes.

- **code-reviewer (1): CHANGES REQUIRED, no blocker.**
  - MAJOR 1 (setup enrolled on render): fixed in f53bc04 and b8e62ed. Setup now makes its factor only on a press, through a wrapped action.
  - MAJOR 2 (wrong codes limited per server address): decision 2. An app-side counter cannot help, because a phished session can call the provider directly.
  - MAJOR 3 (actions untested): `actions.test.ts` through the real wrapper.
  - MINORs:
    - The gate's comment: corrected.
    - The issuer: moved to messages.
    - `ADMIN_PATHS.allow`: used.
    - The empty state: listed below for WP-4.1.
    - The bare `catch`: kept with a comment. No client error reporter exists yet; the person sees the provider-down state.
- **security-reviewer (1): CHANGES REQUIRED, no blocker.**
  - MAJOR 1: decision 2, and the runbook's section 4 (watch `mfa_verification_failed`, revoke sessions).
  - MAJOR 2: `no-store` in the proxy, with unit and e2e tests.
  - MAJOR 3: `actions.test.ts`.
  - MINOR 4: setup is now a press.
  - MINOR 5: the runbook signs out other sessions first, stops if sent to verify, and checks for one verified factor.
  - MINOR 6: `guard-coverage.test.ts`.
  - MINOR 7: two more pgTAP assertions.
- **design-reviewer (1): CHANGES REQUIRED.**
  - BLOCKER 1 (no screenshots): cannot be met here. The journey and the new `/dev/admin` gallery now capture every state; CI saves them.
  - BLOCKER 2: the Delivery Gate report above.
  - MAJOR 3: the narrow view has its heading and says what to do.
  - MINOR 4: the empty state, below.
  - MINOR 5: "Check code".
  - MINOR 6: focus goes back to the field.
  - MINOR 7: the key in groups of four, in a `dl`.

## Try it on the preview

Do the owner actions below first. Then sign in, open `/admin`, and you are sent to `/admin/setup`. Press Show the QR code, scan it, and enter the code. The course list opens. Sign out and in again: `/admin` asks for a code. In a private window, `/admin` is the not-found page.

## Owner actions now due

1. Everything WP-2.2 still waits for, the lockfile first; this branch is stacked on it.
2. `docs/runbooks/infrastructure-setup.md` section 10 step 8 for both projects: TOTP on for enrollment and verification.
3. After the merge, on production: `docs/runbooks/admin-access.md` section 1. Sign in, add your admin row, enroll your authenticator app (the plan's owner step for WP-2.3).

## Your decisions

Approved by you on 2026-11-24: both recommendations below, and every proposed spec change. The spec changes are written into `docs/spec` on this branch, each marked **"Approved by the owner on 2026-11-24"**:

- Decision 1: the not-found page at `/admin` stays as built; no spec text changes.
- Decision 2: `06-security-privacy.md` section 6, a residual risk row for code guessing with a stolen session (T-19); `docs/runbooks/admin-access.md` section 4 now says the risk is accepted.
- Deviation 1: `02-architecture.md` section 9.1, the three second-step actions, and section 8.3, `private.is_on_admin_list()`.
- Deviation 2: `03-experience.md` section 7.1, the button before the QR code.

The questions as they were put:

1. **The not-found page at `/admin` is not byte-identical.**
   - What happens: Next.js renders a `notFound()` thrown by a layout as an error shell that the browser fills in. Status, title and visible page match `/no-such-page`.
   - What differs: the HTML shape, a blank page without JavaScript, and a link to the admin area's script chunk. The repository is public, so this reveals nothing new.
   - The alternative: the proxy rewrites strangers to a missing path. That path then shows in the sign-in link and the router state, and it cannot be tested here without a browser.
   - Recommendation: accept, and keep the layout guard the spec names. Default: as built.
2. **Guessing codes with a stolen session (T-19 residual risk).**
   - The risk: Supabase limits code checks per network address only. Someone with one of your sessions (a phished email code) can call the provider from many addresses. That is roughly 6% a day per address, computed by the security reviewer, not measured.
   - Why the app cannot fix it: an app-side counter does not apply to direct calls. The provider's MFA verification hook does, but it needs a paid plan, and nothing is bought here.
   - Recommendation: accept the risk, watch the auth logs as the runbook's section 4 says, and record it in `06-security-privacy.md` section 6 (spec-change). Default: listed here and in the runbook only.

## Deviations from the plan or the spec

1. `startSecondStepSetup`, `confirmSecondStepSetup` and `verifySecondStep` are not in the action table of `02-architecture.md` section 9.1. `private.is_on_admin_list()` is not in the table of section 8.3. Spec-change proposed; approved by you on 2026-11-24 and written into the spec.
2. `/admin/setup` shows a button before the QR code (`03-experience.md` section 7.1 says "a QR code and a manual key"), so that loading the page changes nothing. Spec-change proposed; approved by you on 2026-11-24 and written into the spec.
3. The dashboard's empty state says "There are no courses yet." and offers no action. Section 7.2's "says what to do first" and its one action, Create a course, come with WP-4.1, which builds that action. Rule 3 forbids a dead control.
4. `e2e/sign-in-helpers.ts` takes the code helpers out of `e2e/sign-in-journey.spec.ts`, so both journeys share them.

## Risks and rollback

- Nothing has run against Supabase: neither the multi-factor calls nor the policies on the real image. Unit tests use a fake of the auth client's shape, read from `@supabase/auth-js` 2.119.2.
- `mfa_ip_address_mismatch`: Supabase refuses a verification whose challenge came from another address. The challenge and the verification are made in one action call (`challengeAndVerify`), so they should share an address. If Vercel ever splits them, the admin sees "not working right now" and the runbook says to try again.
- Rollback: revert the merge. Data: one function, `public.is_on_admin_list()`. Nothing else depends on it.

## Definition of Done

- [ ] Every "Done when" line is met. **No:** J-12 is written, not run.
- [x] Every cited Must requirement has a passing test that names its ID.
- [ ] `pnpm verify` and every required check pass. `pnpm verify` passes; CI fails until WP-2.2's lockfile is committed.
- [x] Every state of every changed view exists.
- [x] No stub, dead control, placeholder, commented-out code, or invented number.
- [x] New server actions use the wrapper. No new table; the new function has policy tests.
- [ ] Every reviewer blocker is fixed. Design BLOCKER 1 needs the screenshots from CI. No reviewer has re-reviewed the fixes.
- [x] No AI attribution in any commit or in this description.

Create with:

```sh
gh pr create --draft --base wp/2.2-sign-in --head wp/2.3-admin-gate --title "WP-2.3 The admin gate" --body-file docs/reports/pull-requests/WP-2.3.md
```
