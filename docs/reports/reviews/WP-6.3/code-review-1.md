# WP-6.3 part 1, code review 1

Reviewer: `code-reviewer`. Range: `origin/main..c7fcaf7`. Date: 2026-11-23.

**CHANGES REQUIRED**

The code itself is clean. Boundaries hold, there are no inline strings, and the CSS uses only logical properties. Three things stop approval: nothing has run the e2e spec, the legal text names a vendor the spec never chose, and part 1 would put live text on production that points to a profile page that does not exist yet.

## BLOCKER

- **`e2e/legal.spec.ts` (whole file), `e2e/shell.spec.ts:20`**: Nothing has run these tests, and nothing will before merge. FR-SYS-03 is a Must ("linked from every page"), and NFR-A11Y-02 axe is a required check. The only executed proof is jsdom rendering `SiteShell`. No CI job runs Playwright: `ls .github/workflows` shows `ci.yml deploy.yml`, with no playwright or test:e2e step. The axe, sideways-scroll and 44 px checks, the real `<title>`, the canonical, the robots tag, and the not-found footer have never executed. There are also no screenshots: `docs/reports/screens/WP-6.3/` does not exist in the commit. CLAUDE.md rule 5 requires the Delivery Gate report with this evidence on an interface PR. Fix: the owner runs `pnpm test:e2e --project=chromium e2e/legal.spec.ts e2e/shell.spec.ts` outside the sandbox. Commit the screenshots it writes and attach the Delivery Gate report and the design-reviewer result.

## MAJOR

- **`src/messages/legal.ts:96`, pinned by `src/messages/legal.test.ts:52`**: The text says "Cloudflare runs the check, called Turnstile". The spec has not chosen the bot challenge vendor. `06-security-privacy.md` section 7.2 says only "bot challenge"; `09-evidence.md:265` lists both hCaptcha and Turnstile; WP-2.2 is where the owner creates the keys; no ADR or spec line names Cloudflare. If WP-2.2 picks hCaptcha, the published policy is false, and a test enforces the false claim. Fix: describe the role ("a bot check service") until WP-2.2 decides, or ask the owner to decide now and record it.
- **`src/messages/legal.ts:120`, `:177`**: Both texts tell the reader, in the present tense, to "delete your account ... on your profile page". On main there is no sign-in, no account and no `/profile`; that comes in part 2 and WP-2.x. Merging part 1 deploys these pages to production, where they direct readers to a page that returns 404. That breaks rule 3 (nothing half-present). Separately, FR-SYS-03 requires owner-approved text, and the "Last updated" date (`:45`, `:154`, 23 November 2026) is the draft date, not an approval date. Fix: an owner decision. Either hold the merge until part 2 lands, or have him approve publishing ahead of the feature. In both cases, set the date to the approval day.
- **`src/messages/legal.ts:47`, `:97`**: "We keep nothing that is not on this page" and "Google tells us your email address" follow inventory section 7.1 faithfully. But the auth provider very likely stores more by default: per-session IP address and user agent, an auth audit log with IP, and the Google identity claims (name, picture, subject ID) in the identity and user metadata. This is from the reviewer's knowledge of Supabase Auth, not checked against current documentation. If it holds, the owner would be signing a false statement. Fix: check the current Supabase Auth docs. If it holds, open a `spec-change` PR to the inventory (rule 11) and redraft the two sentences. Do not quietly soften them here.

## MINOR

- **`src/features/shell/shell.test.tsx:110`**: "links only to pages that exist" is a tautology. It compares `FOOTER_LINKS` against a hand-copied set of the same two hrefs, so it still passes if `src/app/privacy/page.tsx` is deleted. Fix: check that `src/app${href}/page.tsx` exists on disk, or delete the test.
- **`src/app/global-error.tsx:20`**: No test renders `GlobalError`. Removing `<SiteFooter />` there leaves every test green. The test at `shell.test.tsx:115` says it covers "the page that replaces the root layout" but renders `SiteFooter` alone. Fix: render `GlobalError` and assert one `contentinfo` with two links.
- **`e2e/legal.spec.ts:78-79`**: The test presses Enter on the Terms link while already on `/terms`, so `toHaveURL(/\/terms$/)` passes even if Enter does nothing. Fix: press Enter on the Privacy link and expect `/privacy`. The same happens at `:54-55` in the `/terms` loop, but the Privacy click after it does prove navigation there.
- **`src/messages/legal.test.ts:80`**: The title cites `[FR-PRF-03]`. That requirement's acceptance is J-10 with checks at database level, which part 1 does not deliver. Fix: retitle it under `[T-17]` or `[FR-SYS-03]`.
- **`src/features/shell/components/legal-page.tsx:32`**: `aria-labelledby` turns every section into a named `region` landmark, eight on the privacy page. Fix: drop `aria-labelledby`, and in the unit test locate each section from its heading.
- **`src/messages/legal.ts:95`**: Resend also sends the deletion record email (ADR-0030, RISK-13), and the owner's mail provider holds that email for 8 days. Fix: mention both.
- **`src/messages/legal.ts:178`, and the privacy text as a whole**: for the owner: the spec gives no way to close another person's account, so "We may close an account" is his call; and the privacy policy gives no way to contact anyone. Nothing in the spec requires one, so no address is invented.

## Checked and fine

- Retention (7 and 8 days), nightly backups, the owner-only key and the public ciphertext match ADR-0030 and `07-operations.md` section 6. Age 13 matches charter A-10 (a placeholder). "Free to use" matches A-02. Analytics without cookies matches `07-operations.md` section 4.3.
- No em dashes, no exclamation marks. Module rules of section 4.1 hold. `LegalPage` is a server component; title, description and canonical are set; no robots tag. No suppressions, skips, TODOs or `.only`. Author and committer are Fahad, with no AI attribution. The new utility classes exist in the built CSS.

## What the reviewer ran

`pnpm verify` (exit 0); `pnpm exec vitest run src/messages/legal.test.ts src/features/shell/shell.test.tsx src/infrastructure/logging` (4 files, 35 tests passed); `git log --format=fuller`; greps of the diff and of the built CSS.

## Not checked

The e2e tests (the sandbox blocks Chromium); a rebuild at this exact commit; whether WebKit and Firefox on macOS move Tab focus onto links; what Supabase Auth actually stores.
