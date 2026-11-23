# WP-6.3 part 1, code review 2

Reviewer: `code-reviewer`. Range: `c7fcaf7..9872009` (the fixes for round 1), with `origin/main..9872009` for context. Date: 2026-11-23.

**CHANGES REQUIRED**

Most round 1 fixes are correct. The round 1 e2e blocker is still open, and the fix commit adds two new problems to the privacy text: it contradicts itself about location, and it still leaves out what the sign-in provider's audit log keeps.

## BLOCKER

- **`e2e/legal.spec.ts` (whole file), `docs/reports/screens/WP-6.3/` (missing)**, carried over from round 1: the e2e and axe checks have never run, and there are no screenshots or Delivery Gate evidence. The fix commit adds interface behavior that only e2e covers: the current footer link with the `nav` variant's amber bottom border, the inline `/privacy` link in the terms, and the Enter keypress between pages. The new e2e tests (`:76-97`) have not run either. Fix: the owner runs `pnpm test:e2e --project=chromium e2e/legal.spec.ts e2e/shell.spec.ts` outside the sandbox, commits the screenshots, and attaches the Delivery Gate report and the design-reviewer result.

## MAJOR

- **`src/messages/legal.ts:149` against `:96`**: the policy contradicts itself. Line 96 says the host records "your rough location" with each page view; line 149 says "we do not ask for your location. Your time zone tells us roughly where you are, and nothing more." Vercel's page (https://vercel.com/docs/analytics/privacy-policy) lists "Geolocation: US, California, San Francisco" under "Data point information", which is city level, so line 149 is false. It also breaks inventory 06 section 7.1 ("no location beyond what a time zone implies"). Fix: rewrite line 149 to match line 96, and include this in the section 7.1 spec-change.
- **`src/messages/legal.ts:82`, `:85`, `:134`**: the auth audit log is missing. https://supabase.com/docs/guides/auth/audit-logs ("Updated Oct 31, 2026") says audit logs "are automatically captured for all authentication events": sign-ups, sign-ins, token refreshes, sign-outs. Each entry holds `timestamp`, `user_id`, `action` and `user_agent`, and an `ip_address` for some events. Entries are kept in external log storage and optionally in `auth.audit_log_entries`. `user_deleted` is itself a logged action, so entries keyed by the user's ID outlive the account. "We keep these until you delete your account" (`:85`) and "Deleting it erases ..." (`:134`) read as complete. Not verified: whether this project writes audit logs to Postgres, whether the payload carries the email, and the free plan's log retention. Fix: name the audit log and how long it is kept, or decide in the spec-change that database storage is off. This also bears on T-17: if the table is on, a row stays after deletion and goes into the nightly backups; flag it to the work package that writes the deletion test.

## MINOR

- **`legal.ts:98`**: the request count does not say who holds it or for how long, and the Postgres counters and firewall rule arrive in WP-7.1, so the sentence describes something not yet built (the owner's timing call). Fix: name the holder and the period, or hold the sentence until WP-7.1.
- **`legal.ts:134`**: what deletion erases still names only the original four items. Fix: add the new ones, or point at "When you have an account".
- **`legal.ts:83`**: the Google identity also stores `provider_id`, the user's Google account ID (https://supabase.com/docs/guides/auth/identities). Fix: add it.
- **`legal.ts:137`**: the mailbox that holds the ID for 8 days is not named as a holder. Fix: say it is our own inbox, or have the owner name the provider.
- **`legal.test.ts:47`**: `if (text === ".") continue;` does nothing, because `"."` passes both assertions anyway. Fix: delete it.
- **`src/app/global-error.tsx:14`**: the body is tested, but the wiring is not; replacing `<GlobalErrorBody …/>` with `null` leaves every test green (the file is at 0 percent coverage). Acceptable for a file this thin; noted so nobody counts it as covered.
- **`legal.ts:56`, `:168`, `:134`, `:192`** (open from round 1, owner's decision): the draft date, and the profile page that does not exist yet.

## Checked and fine

`Link` sets `aria-current="page"` only for `nav`. The client footer reads only `usePathname`. The not-found page cannot cause a hydration mismatch. Mutations: dropping `current=` fails the current-link test; inverting the comparison fails the null assertions; removing the footer from `GlobalErrorBody` fails its test; deleting `src/app/privacy/page.tsx` fails the `existsSync` test. The sections are no longer regions. The keyboard test starts on `/privacy` and proves Enter navigates. The vendor is no longer named; "we" is defined; the FR-PRF-03 test is retitled. The Vercel fields and one-day visitor hash match Vercel's page. No suppressions, skips or `.only`. Both commits by Fahad, no AI attribution.

## What the reviewer ran

`git diff c7fcaf7..9872009`; `git log --format=fuller origin/main..HEAD`; `pnpm verify` (exit 0, 28 files, 718 tests); `curl` of the Supabase audit-logs, sessions and identities pages and the Vercel analytics privacy page; greps of the spec, ADR-0029 and `07-operations.md`.

## Not checked

e2e and axe; a rebuild; whether `auth.sessions` has `user_agent`; the project's audit-log storage setting; the free plan's log retention.

## Response (implementer, 660ffdc)

- Location: the page-view line says "the place you are in (such as your city)", and the closing section says we learn roughly where you are only from the time zone and from that place. Added to deviation 1.
- Audit log: a paragraph names the sign-in provider's log of account events (time, account ID, device and browser type, sometimes the network address) and says it can stay after deletion for as long as the provider keeps its logs. The storage setting and its period are owner action 8; the T-17 note is in "What is left for part 2".
- Request count: names the host and the database as holders; the period is set in WP-7.1 (owner action 8).
- Deletion now erases "everything listed under 'When you have an account', except the log of account events". The Google account ID is added. The deletion email is "in our own inbox".
- The `"."` line is removed.
- `global-error.tsx` wiring: left as is, as the review allows.
- Not reviewed again.
