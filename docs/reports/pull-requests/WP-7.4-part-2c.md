<!-- No AI attribution in this description or in any commit (CLAUDE.md rule 15). -->

**Base: `wp/7.4-journeys-part-2b` at d728f0c, with `origin/wp/6.3-account-deletion` at f89420c merged in** (de082c8; only `local-build-progress.md` conflicted). This pull request merges after WP-7.4 part 2b and WP-6.3's account deletion; until then review the commits after de082c8. WP-7.4 part 2c.

## What

J-10 (delete my account), FR-PRF-03, T-17, and WP-6.3's "Done when: J-10 passes with database assertions on every table":
- `e2e/j10-delete-account-journey.spec.ts` (`stack` project). A learner signs in, passes a lesson and changes their display name, so the profile, a completion with its code, an identity, a session and a refresh token exist. In a 375 px window they open "Delete my account" on the profile: `delete` in lower case is refused, `DELETE` is accepted. Then:
  - the browser is home and signed out, `/profile` asks for a sign-in, and the course page shows 0 of 1 (device cleared);
  - the auth user is gone, and every table in `public` and `auth` with a `user_id` column holds no row of theirs (found from the system catalog, so a later table is inspected too and an unreadable one fails; the list must still hold the five tables above and `public.admins`); their sessions' `auth.mfa_amr_claims` rows are gone; no identity holds the address;
  - the same address signs up again as a new, empty account (new ID, 0 XP, no completion, not the old name).
  - the audit log rows that name the user or address are counted and reported as a test annotation, not asserted (decision 3).
  - axe on the open dialog.
- `.github/workflows/ci.yml`, `e2e` job: a step reads the local stack's `SECRET_KEY` from `supabase status -o env`, masks it, and sets it with two `example.test` notice addresses, so the delete control exists in CI. `scripts/workflows.test.ts` checks the step.
- `playwright.config.ts`: comment only. Playwright hands its servers its whole environment, so the CI values reach them; unset elsewhere, the profile shows no delete control, as before.

## How it was verified

- `pnpm verify` on 9a8aa1c: exit 0, `Test Files  147 passed (147)`, `Tests  2524 passed (2524)` (pnpm warns its pre-run install cannot take the store lock in this sandbox; the checks ran after it).
- `next build` with the CI `build` job's marker values (including `SUPABASE_SECRET_KEY: ci_marker_secret_key_not_a_real_key`): exit 0. The marker fails the schema's `sb_secret_` rule, but only server start parses it, and the build job never starts a server.
- `playwright test --list --project=stack`: 30 tests in 10 files, the new one among them. `pnpm verify` after the review fixes: exit 0, `Test Files  147 passed (147)`, `Tests  2524 passed (2524)`.
- **Not run:** the journey itself (no Docker here). Its first run is CI's `stack` job. Firefox and WebKit (speed mode).

## Reviews

Code review 4: CHANGES REQUIRED, 1 MAJOR, 9 MINOR; the major and seven minors fixed, two minors answered here (decisions 1 and 2). Report: `docs/reports/reviews/WP-7.4/code-review-4.md`. No security review: the change is a test and a CI step that hands the local stack's own key to the app on the runner (speed mode).

## antislop Delivery Gate report

antislop active: during (session override, CLAUDE.md rule 5). No page changed; tests only. Block 1: axe runs on the delete dialog. Blocks 2 to 4: no change.

## Decisions (safe defaults)

1. The "sign in again" answer to a session older than 5 minutes is not walked: the time comes from the verified token, so the journey would wait 5 minutes. Unit tests cover the rule and the answer.
2. In CI the deletion notice goes to Resend with the fake key of `.env.example`, which refuses it; the deletion goes on and logs `error:deletion-notice` (ADR-0030). That is a real third-party call from a test, which `.claude/rules/testing.md` does not allow without your acceptance (For the owner 2). The journey cannot see the email.
3. `auth.audit_log_entries` names the user in a JSON payload, not a `user_id` column. The journey reports how many of its rows name the deleted user or address after the deletion (CI's HTML report, test annotation) but does not fail on them: whether deletion must erase them is your open action 2 on WP-6.3's account deletion description.
4. Saved code on the device stays after deletion, as at sign-out (WP-6.3 decision 6); the journey checks only that completions are cleared.

## For the owner

1. Open a draft pull request from `wp/7.4-journeys-part-2c` with this body (base: the part 2b branch, or `main` once the stack merges), and check CI's `stack` job passes `j10-delete-account-journey.spec.ts`, and read its audit log annotation.
2. Accept, or refuse, J-10's notice call to Resend with the fake key in CI (decision 2).
3. Decide on the audit log (decision 3): if deletion must erase it, the journey's annotation becomes an assertion.
