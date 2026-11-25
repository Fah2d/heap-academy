# WP-6.3 part 1, design review 1

Reviewer: `design-reviewer`. Range: `origin/main..c7fcaf7`. Date: 2026-11-23.

**CHANGES REQUIRED**

A review of the words and the code only. No visual review was possible: `docs/reports/screens/WP-6.3/` does not exist, and there is no axe result, so nothing visual is approved. The reviewer checked the markup and the built CSS by running `next start` on port 3650 (stopped in the same command) and fetching `/privacy`, `/terms` and `/nope` with curl.

## BLOCKER

1. **No screenshots and no axe run.** `e2e/legal.spec.ts:78-84` would save `privacy-*` and `terms-*` at 320, 375, 768 and 1280 px, but it has never run. Missing: both legal pages at every width, the footer on a short page (not-found) at 375 and 1280 px, the footer focus state, and the global-error page with its new footer. Fix: run `pnpm test:e2e` where Chromium can start, commit the screenshots, paste the axe output, then ask for a review again.

## MAJOR

2. **The policy says it lists everything, and it does not.** `src/messages/legal.ts:47` says "We keep nothing that is not on this page." Not listed: Supabase Auth's sign-in times and session or audit records that can include the network address and browser; the Postgres rate-limit counters keyed on the client network address (`07-operations.md:120-123`, T-14); what Vercel Web Analytics records beyond a count (page, referrer, country, browser or device type, from Vercel's documentation, not checked). Fix: list these, or remove the promise. Section 7.1 of `06-security-privacy.md` has the same gaps and needs a `spec-change` pull request.
3. **Google sends more than an email address.** `legal.ts:97`. By default Supabase's Google sign-in stores the Google profile in `auth.identities` (name and picture URL), and ADR-0030 includes `auth.identities` in the backups. Fix: limit the scopes in WP-2.2, or name the data here and in section 7.1.
4. **The pages describe features that do not exist on this branch** (`legal.ts:54`, `:108`, `:120`). Once merged, production publishes statements that are false today (section 1.6, CLAUDE.md rule 3). Fix: the owner decides whether to hold the merge until these features ship or to approve publishing early.
5. **The age limit of 13 is not in any source.** `legal.ts:169`. Fix: the owner supplies the rule, or the section is removed until he does.
6. **The policy never says who "we" are or how to reach them.** `legal.ts:41-149`. No named operator, no contact address, and the text switches between "we" and "the owner" (`:108`, `:123`). Fix: the owner supplies the identity and a contact; pick one subject and use it throughout.

## MINOR

7. Hard words for a 13-year-old reading English as a second language: "What every visit leaves" (`:80`); "runs the check, called Turnstile, that you are a person" (`:96`); "get around" (`:206`); "at your midnight" (`:69`).
8. The date is the drafting date (`:45`, `:154`); it should be the approval day.
9. The terms mention the privacy policy without linking to it (`:187`). Add an inline link block.
10. Resend also sends the deletion email (ADR-0030) (`:95`, `:123`).
11. The intro promises "where", but the text names vendors, not regions (`:47`).
12. "We may close an account" (`:178`) has no tool behind it, and "belong to Heap Academy" (`:196`) is a legal ownership question: the owner confirms both.
13. `legal-page.tsx:33`: `aria-labelledby` makes each section a region landmark, about eleven landmarks on one text page. Drop it; test by heading.
14. `site-footer.tsx:22`: no `aria-current="page"` on the footer link of the current page.
15. `site-shell.tsx:32` puts the footer on every page, which will include the workspace (principle 1.1, the fixed phone action bar of FR-WSP-13). Decide in WP-3.x or 4.x where the footer goes there.

## What is fine

No em dashes, no exclamation marks, no buzzwords, no blame. Second person, short sentences. The backup custody line matches ADR-0030; the 7-day and 8-day periods match section 7.1. Type roles match `DESIGN.md` (`h1` `text-xl`, `h2` `text-lg`, "Last updated" `text-xs` muted at 7.86 to 1, body `text-base`). The page holds to `max-inline-prose` and lines up with the header gutter. No amber on these pages; the footer links are muted `nav` links with 44 px targets. Semantic tokens and logical properties only. The footer is a `contentinfo` landmark after `main`, also on the not-found page (checked in the served HTML).

## Screenshots looked at

None. The served HTML of `/privacy`, `/terms` and `/nope` and the built CSS in `.next/static/chunks/` were read instead.
