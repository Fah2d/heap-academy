**Part of WP-6.3.** Account deletion. Stacked on `wp/6.3-profile-page`.

## What and why

A signed-in learner can delete their account from the profile (FR-PRF-03, J-10): a destructive button, a dialog that says what is erased, the word `DELETE` typed, and a sign-in no older than 5 minutes. The auth user is deleted, every row of theirs cascades, you get one email with the user ID (ADR-0030), the device's completions are cleared, and the session is signed out.

## What changed

- `src/infrastructure/db/privileged.ts`: the first use of the secret key, imported only by the deletion use case (lint rule).
- `deleteAccount` action and use case; `src/domain/auth/recent-sign-in.ts`; the notice email through Resend.
- Three server variables, all or none: `SUPABASE_SECRET_KEY`, `DELETION_NOTICE_FROM`, `DELETION_NOTICE_TO`. With none, the profile shows no delete control.
- `13_account_deletion.test.sql`; CI build markers; setup runbook.

## Verification

- `pnpm verify`: exit 0, 147 files, 2518 tests.
- `pnpm build`, `check-bundle` (with markers), `check-static`: exit 0.
- Database tests on PGlite, not Supabase: all files pass, with and without the seed; the new file 11 of 11 (run before the later code fixes, which touched no SQL).
- **Not run:** J-10 (not written), a real deletion against an auth service, browser tests, the antislop Delivery Gate, `pnpm test:db`.

## Reviews

One round: code and security, both CHANGES REQUIRED. See `docs/reports/reviews/WP-6.3/account-deletion-reviews.md`. Fixes not reviewed again.

## Decisions taken (safe defaults)

1. "Recent" means an `amr` entry of `otp`, `oauth`, `magiclink` or `email/signup` within 5 minutes. `totp` and token refresh do not count.
2. The variable names above; unset means the feature is absent.
3. An old session is told to sign out and in again; there is no re-authentication inside the dialog.
4. An admin may delete their own account. Say if admins should be refused.
5. The client signs out after the confirmation, not the action.
6. Saved code on the device is kept, as at sign-out.

## Owner actions before launch

1. Create the production secret key and set the three variables (`docs/runbooks/infrastructure-setup.md`).
2. Delete a test account on staging or production, then check `auth.audit_log_entries` for its email address. If it is there, decide: turn off audit logging, or state the retention in the privacy text.
3. The privacy and terms pages are on `wp/6.3-legal-pages-footer`, not in this stack.
