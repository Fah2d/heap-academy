# WP-6.3 account deletion: one review round, on be53e38

## Code review: CHANGES REQUIRED

| Severity | Finding | Outcome |
|---|---|---|
| Blocker | No J-10 and no database deletion test | `supabase/tests/database/13_account_deletion.test.sql` added. J-10 is not written. |
| Major | Production could ship with no delete control; runbook silent | Runbook updated. No automated launch check. |
| Major | CI gave no marker value for the secret key | Added to the `build` job, pinned by a test. |
| Minor | A lost answer leaves no record for restores | Logged as `error:deletion-unclear`; runbook says to check by hand. |
| Minor | The dialog can be dismissed while deleting | Open. |
| Minor | The deleted state shows only briefly | Open. |
| Minor | An old session is reported only after typing, with no control in the dialog | Open. |
| Minor | A failed claims read looked like an old session | Fixed. |
| Minor | The action had no test | `actions.test.ts` added. |

## Security review: CHANGES REQUIRED, no blocker

| Severity | Finding | Outcome |
|---|---|---|
| Major | A stolen session could enroll a TOTP factor and count as recent | Fixed: `totp` no longer counts. |
| Major | The auth audit log probably keeps the email address (not verified) | Open, for the owner. |
| Major | Missing database, journey and action tests | Database and action tests added. J-10 is not written. |
| Major | No marker for the secret key in the bundle check | Fixed. |
| Minor | The server does not end the session itself | Open. Signing out inside the action redraws the page before the confirmation shows. |
| Minor | Any 404 counted as deleted | Fixed: only `user_not_found`. |
| Minor | The only admin can delete their account | Documented in the runbook; for the owner. |
| Minor | Repeated sign-up and delete spends the daily email allowance | Open: no rate limiter exists yet. |
| Minor | Deletion silently absent without the variables | Runbook updated. |

The fixes were not reviewed again.
