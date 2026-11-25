<!-- No AI attribution in this description or in any commit: no co-author trailer, no "Generated with" line, no session link (CLAUDE.md rule 15). -->

**Part 1 of WP-6.3.** The legal pages and the footer only. Branched from `main` at 0efe863; it depends on nothing that is not merged. **Open as a draft, and hold the merge until the owner has approved the text (owner action 1) and decided owner action 2.**

## What and why

FR-SYS-03 asks for privacy and terms pages that are linked from every page and carry text the owner approved. `docs/spec/06-security-privacy.md` section 8 asks WP-6.3 to draft that text from the data inventory and the processor list (section 7), in plain words, with the date it was last updated. `docs/spec/03-experience.md` section 4 asks for a footer with these two links on every page; WP-1.4 left the footer out until it had destinations (WP-1.4 decision 2).

The profile page, display name editing and account deletion need the database and sign-in (WP-2.1 and WP-2.2, not merged), so they are part 2.

## Work package

- Work package: WP-6.3 Profile, account deletion, legal pages, part 1.
- Requirements and threats covered: FR-SYS-03 (whole); the text parts of NFR-PRIV-01 (the inventory is stated) and T-17 ("Backup retention is stated in the privacy policy"). Not covered here: FR-PRF-01, FR-PRF-02, FR-PRF-03, J-10, the T-17 deletion test.
- Time box 3 hours for the whole package. Part 1 took from 23:40 on 2026-11-23 to about 00:10 on 2026-11-24 of building, plus three review reports (about 0.6 of the box).

## What changed

| Item | Where |
|---|---|
| The privacy policy and the terms, as data: sections with paragraphs, lists, and one sentence with a link. | `src/messages/legal.ts` |
| `/privacy` and `/terms`, each with its title, description and canonical address, and indexed (experience section 3). | `src/app/privacy/page.tsx`, `src/app/terms/page.tsx` |
| `LegalPage`: the title, "Last updated" with a `<time>`, the introduction, then each section under an `h2`, at the reading measure. | `src/features/shell/components/legal-page.tsx` |
| `SiteFooter`: the `contentinfo` landmark after `main`, with Privacy and Terms in the header navigation's muted style, and `aria-current="page"` on the link of the open page. A client component only to read the address. | `src/features/shell/components/site-footer.tsx`, `site-shell.tsx`, `src/messages/shell.ts` |
| The page that replaces a failed root layout now shows the footer too. Its body moved to `GlobalErrorBody` so a test can render it. | `src/features/shell/components/global-error-body.tsx`, `src/app/global-error.tsx` |
| `privacy` and `terms` added to the logged route segments, so their log lines name them instead of `:param` (the test that checks the list against `src/app` failed until they were). | `src/infrastructure/logging/route.ts` |
| Screenshots now go to `docs/reports/screens/WP-6.3/`, because the footer changes every screen. | `e2e/screens.ts` |

### What the privacy policy says, and where each line comes from

| Line | Source |
|---|---|
| Guests: code runs in the browser; saved code and guest progress stay there. | Inventory 7.1, principle 7.2 |
| Account: email address, display name, time zone, completions with the code that passed; kept until deletion. | Inventory 7.1 |
| The sign-in provider's log of account events (time, account ID, device and browser type, sometimes the network address), which can outlive the account. | **Not in the inventory.** supabase.com/docs/guides/auth/audit-logs, checked 2026-11-23 (code review 2). |
| The last sign-in time and the network address of each signed-in device, kept by the sign-in provider. | **Not in the inventory.** Supabase's documentation: `last_sign_in_at` on `auth.users` (supabase.com/docs/guides/auth/users) and the `ip` column of `auth.sessions` (supabase.com/docs/guides/auth/audit-logs), checked 2026-11-23. |
| With Google sign-in, Google's profile: email address, name, profile picture, Google account ID. | **Not in the inventory.** Supabase requests the `userinfo.profile` scope and stores the provider's data in `identity_data` (supabase.com/docs/guides/auth/social-login/auth-google, /identities), checked 2026-11-23. |
| A session cookie keeps you signed in; no advertising or tracking cookies. | Architecture section 9 (session cookies), NFR-PRIV-02 |
| Page views counted without cookies; what each view records, including the place (such as the city); one-day visitor hash. | Inventory 7.1, operations 4.3, and vercel.com/docs/analytics/privacy-policy, checked 2026-11-23 |
| Server logs and error reports at the host; a log line can hold the network address and the page. | Inventory 7.1 |
| Requests counted per network address to stop abuse. | **Not in the inventory.** Operations section 7 and T-14 (built in WP-7.1) |
| Processors: Vercel, Supabase, Resend (both emails), a bot check service, Google, GitHub. | Principle 7.2, ADR-0029, ADR-0030, RISK-13 |
| Nightly encrypted backups kept 7 days; only we hold the key; anyone can copy the public ciphertext. | Inventory 7.1, ADR-0030 |
| Self-service deletion; one email with the account's ID, deleted after 8 days. | Principle 7.2, inventory 7.1, T-17, ADR-0030 |
| No advertising identifiers or contact lists; location only from the time zone and the page-view place. | Inventory 7.1, corrected for the host's analytics |

The terms: free (A-02), an account needs age 13 (charter A-10, a placeholder until legal review), your code is yours, our lessons are ours, three rules of use, no guarantee, changes by date.

## How it was verified

`pnpm verify` on 660ffdc, exit 0:

```
$ pnpm format:check && pnpm lint && pnpm typecheck && pnpm attribution && pnpm test
$ prettier --check .
All matched files use Prettier code style!
$ eslint --max-warnings=0 .
$ tsc --noEmit
$ node scripts/check-attribution.mjs --branch && node scripts/check-attribution.mjs --files
$ vitest run --coverage
 Test Files  28 passed (28)
      Tests  718 passed (718)
```

pnpm's own install check failed on the sandbox's store lock (`ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK`) and the run went on with the installed `node_modules`.

`next build` with the fake values of `.env.example`, on 660ffdc, exit 0:

```
Route (app)
┌ ƒ /_not-found
├ ƒ /api/csp-report
├ ƒ /api/health
├ ƒ /privacy
└ ƒ /terms
```

```
$ node scripts/check-static.mjs .next
No prerendered page in .next, apart from /_global-error, which Next.js always prerenders.
$ node scripts/check-bundle.mjs .next/static
No server variable (RESEND_API_KEY, HEAP_RELEASE) in 20 files under .next/static.
```

The served pages from `next start` (curl), at 9872009:

```
/privacy 200
<a aria-current="page"  href="/privacy">Privacy</a>
<a  href="/terms">Terms</a>
/terms 200
<a  href="/privacy">Privacy</a>
<a aria-current="page"  href="/terms">Terms</a>
<a  href="/privacy">privacy policy</a>
/no-such-page 404
<a  href="/privacy">Privacy</a>
<a  href="/terms">Terms</a>
<a  href="/">Go to the home page</a>
```

At c7fcaf7, each page also had its `<title>` (`Privacy policy | Heap Academy`, `Terms of use | Heap Academy`), its description, `<link rel="canonical" href="/privacy"/>` (and `/terms`), a `content-security-policy` header, and the eight `h2` headings in order. Every new utility class is in the built CSS, for example `.max-inline-prose{max-inline-size:var(--container-prose)}` and `.border-bs{border-block-start-style:var(--tw-border-style);border-block-start-width:1px}`.

**Tests added**, each title carrying its requirement:

- `src/features/shell/shell.test.tsx`: the footer is `contentinfo`, after `main` and outside it, with Privacy then Terms; every footer link has a `page.tsx` under `src/app`; the open page's link is marked current and the other is not; the global error page shows the footer; each legal page shows its title, date, introduction, every section heading in order, every paragraph, list item and link, and no `region` landmark.
- `src/messages/legal.test.ts`: the date is a real day and is written out the same; section anchors are unique; no empty text, em dash or exclamation mark; every processor is named; each kind of data in the inventory, and the three additions, are stated; the 7-day and 8-day periods and the public ciphertext are stated (T-17); deletion needs no contact; the terms link to `/privacy`.
- `e2e/legal.spec.ts`: both pages answer 200 with title, date, headings, description, canonical and no robots tag; the footer on `/privacy`, `/terms` and the not-found page leads to both pages; the footer marks the current page; the terms' link leads to the privacy policy; keyboard: skip link, wordmark, then the footer links, and Enter follows a link; axe, no sideways scrolling, and screenshots at 320, 375, 768 and 1280 px; footer links at least 44 px. `e2e/shell.spec.ts`: the not-found page has the `contentinfo` landmark.

**Not run: every e2e test.** The sandbox stops Chromium at launch: `FATAL:base/apple/mach_port_rendezvous_mac.cc:159] Check failed: kr == KERN_SUCCESS. bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer...: Permission denied (1100)`. The one test that needs no browser passed against the build: `✓ [chromium] › e2e/shell.spec.ts:23:1 › [WP-1.4] the development-only pages are absent from the production build`. CI has no e2e job yet, so nothing has driven these pages in a browser.

## Screens

**None.** `docs/reports/screens/WP-6.3/` does not exist yet; see owner action 3.

antislop Delivery Gate report, antislop active: during (session override, from `CLAUDE.md` rule 5). The gate is **not passed**: R-03, R-25, R-32, R-35 and C-4 need the screenshots and the axe run.

Block 1, Hard Gate:

- R-02 PASS: no em dash in the new text; `legal.test.ts` fails on one.
- R-03 NOT VERIFIED: the sideways-scroll tests at 320 to 1280 px are written, not run. The layout is one column at `max-inline-prose` with the 16 px gutter, and the footer list wraps (`flex-wrap`).
- R-17, R-18, R-36, R-38 PASS: no statistics or testimonials. Every claim in the text has a source in the table above; three come from vendor documentation and are not yet in the spec (deviation 1).
- R-23 PASS: no asset created.
- R-24 PASS: the footer links to `/privacy` and `/terms`, which exist (a test checks the files). The text names the profile page without linking to it (owner action 2).
- R-25 NOT VERIFIED by axe. The pairs in use are in `DESIGN.md` 4.3: text on bg 16.94, muted on bg 7.86, amber on bg 8.12.
- R-26, C-2 PASS: two footer links and one inline link, each a real address.
- R-27 PASS: the pages hold static text and load no data, so they have no loading, empty or error state.
- R-28 PASS: no FAQ.
- R-32 NOT VERIFIED: native links with the shared focus ring; the keyboard test is written, not run.
- R-33, R-34 PASS: no external patch; one theme.
- R-35 FAIL until the owner's run: the production build was run and every page fetched, but no control was clicked in a browser.
- R-37 PASS: signed `DESIGN.md`, Design Read and dials ENERGY 1 / RHYTHM 1 / MOTION 1.
- R-39 PASS in source: native links, `lang`, `<title>`, and now the `contentinfo` landmark; axe not run.
- R-40 PASS: no media, no number reported.

Block 2, Purpose-Gate: R-01, R-04, R-06 to R-10, R-12 to R-14, R-19, R-22 PASS: no gradient, icon, mono, pattern, arrow, badge, glass, shadow, card, animation or illustration.

Block 3, Liveliness: dials declared and matched (one uniform text layout, no motion); the focal point is the `h1` and the text; whitespace from the 24 px section gap; the one accent is the amber of the inline link and the current-link marker; the identity motif (the current-item bar) marks the current footer link; Design Read declared.

Block 4: C-1, C-3, C-5, R-05, R-11, R-15, R-16, R-20, R-21, R-29 to R-31 PASS: the footer is one row of two links, not a four-column template; no generic call to action or buzzword; dark only by ADR-0015. C-4 NOT VERIFIED: no screenshot at any width.

## Reviews

Reports in `docs/reports/reviews/WP-6.3/`.

- **code-reviewer (1), of c7fcaf7: CHANGES REQUIRED.** BLOCKER: the e2e never ran (not fixable in the sandbox; owner action 3). MAJORs: the bot check vendor was named before the spec chose it (fixed: named by its role); the text points at a profile page that does not exist yet (owner action 2); the auth provider keeps more than the inventory lists (checked against Supabase's documentation, the text fixed, the spec change proposed in deviation 1). MINORs, all fixed in 9872009: the footer test that could not fail, the untested global error footer, the Enter test that proved nothing, the FR-PRF-03 title, the eight region landmarks, Resend's second email. Its two notes for the owner are owner actions 5 and 6.
- **design-reviewer (1), of c7fcaf7: CHANGES REQUIRED.** BLOCKER 1, no screenshots or axe: owner action 3. MAJOR 2, "nothing that is not on this page": the promise is removed, and the sign-in records, the Google profile, the rate-limit count and the analytics fields are listed. MAJOR 3, Google's profile: listed. MAJOR 4, features not yet built: owner action 2. MAJOR 5, age 13: it is charter assumption A-10, which the review missed; kept, and owner action 4 asks the owner to confirm it. MAJOR 6, who "we" are: both texts now define "we" as Heap Academy and never say "the owner"; the operator's name and a contact address are owner action 5. MINORs 7, 9, 10, 11, 13 and 14 fixed in 9872009; 8 (the date) is owner action 1; 12 is owner action 6; 15 (the footer in the workspace) is left for WP-5.2, which builds the workspace layout.
- **code-reviewer (2), of 9872009: CHANGES REQUIRED.** BLOCKER: the same browser run (owner action 3). MAJORs, both fixed in 660ffdc: the policy contradicted itself on location (the host records the city with each page view), and it left out the sign-in provider's log of account events, which can outlive the account. MINORs fixed in 660ffdc: deletion now erases everything under "When you have an account" except that log; the Google account ID; the deletion email is in our own inbox; the request count names its holders; the no-op test line is gone. Left as the review allows: `global-error.tsx` itself has no test, only its body. The fixes were not reviewed again.
- The design review was not run again; it cannot approve without screenshots.
- security-reviewer: not required. The change touches no sign-in, database, server action, header or configuration.

Open MAJOR findings for the owner to waive: none of the code; the owner decisions below.

## Try it on the preview

1. Open `/privacy`, then `/terms`. Each shows its title, "Last updated", and its sections.
2. Check the footer on both, and on any unknown address such as `/abc`: Privacy and Terms, with the open page's link marked.
3. In the terms, under "Your code", follow "privacy policy".
4. Press Tab from the top of `/privacy`: skip link, wordmark, Privacy, Terms.

## Owner actions now due

1. **Read and approve the privacy and terms text** (the plan's "Owner" line for WP-6.3). It is your statement, not mine. When you approve, I set `updated` in `src/messages/legal.ts` to that day; it now says 23 November 2026, the day it was drafted.
2. **Decide when the pages go live.** Today `main` has no lessons, sign-in, profile, backups or analytics, so the text describes the site as it will be at launch. Default: this pull request stays a draft until WP-2.2 and WP-6.3 part 2 are merged. The other choice: approve publishing early.
3. **Run the browser suite and commit the screenshots** (outside the sandbox): `pnpm test:e2e --project=chromium e2e/legal.spec.ts e2e/shell.spec.ts`, then `pnpm test:e2e --project=gallery --project=phone --project=phone-375 --project=phone-360`, then commit `docs/reports/screens/WP-6.3/`. Then ask `design-reviewer` for its review with the screens.
4. **Confirm the age rule.** The terms say an account needs age 13, from charter A-10, which is a placeholder until a legal review.
5. **Who "we" are, and a contact address.** Neither text names the operator or gives a way to write to us; nothing in the spec says who or where, and I did not invent one. The Saudi law of section 8 question 1 will likely ask for both. Tell me the name and the address to add, or approve the text without them.
6. **Two terms lines to confirm:** "We may close an account that breaks these terms" (no tool for it exists or is planned), and "The lessons ... belong to Heap Academy".
7. **Name the bot check vendor** when WP-2.2 settles it (its branch uses Cloudflare Turnstile). The processor line then names it.
8. **Two settings that decide what the policy says**, for WP-2.2 and WP-7.1: whether the sign-in provider writes its event log to the database (`auth.audit_log_entries`, a dashboard switch no spec line sets) and how long the free plan keeps that log; and how long the per-address request counts are kept. Today the text says only "for as long as the provider keeps its logs" and names no period for the counts.

## Deviations from the plan or the spec

1. **The privacy policy lists more than the data inventory of `06-security-privacy.md` section 7.1**: the sign-in provider's last sign-in time and per-session network address, Google's profile (name and picture), the per-address request count of WP-7.1, the sign-in provider's log of account events, and what the host's analytics records with each view, including a city-level place. The inventory said "Nothing else is collected" and "no location beyond what a time zone implies", and the vendors' documentation says otherwise. I have not edited the spec (rule 11). **Proposed `spec-change`:** add these rows to section 7.1, correct its location sentence, and either limit the Google scopes in WP-2.2 or keep the profile row.
2. **The bot check service is not named**, because the spec has not chosen it (principle 7.2 lists processors in the policy). See owner action 7.
3. **The canonical address is relative** (`/privacy`), because `main` has no `metadataBase`. WP-5.1 adds it (`SITE_ORIGIN`), and the canonical becomes absolute when both are merged. I did not add a second origin constant here.
4. **The legal pages live in `features/shell`**, beside the not-found and error pages, because the experience spec lists them with the system pages (section 5.6).
5. **The footer is a client component**, to mark the current link with `usePathname`. It holds two links and no state.

## What is left for part 2

The profile page with its states (FR-PRF-01), display name editing (FR-PRF-02), account deletion with a typed confirmation and a recent sign-in through the privileged client (FR-PRF-03), J-10 with database assertions on every table, and the lint proof that only the deletion use case imports the privileged client (the rule exists in `scripts/eslint/module-boundaries.mjs`; part 2 adds the module and its test). The deletion test must also look at `auth.audit_log_entries`: if the provider writes its event log there, rows keyed by the deleted user's ID stay and go into the nightly backups (T-17, code review 2).

## Risks and rollback

Two new pages and a footer; no data, no configuration. Rollback: revert the merge commit. The risk is the text: published before approval, or before the features it describes exist (owner actions 1 and 2).

## Definition of Done

- [ ] Every "Done when" line is met. **Not met:** J-10 and the privileged-client lint proof are part 2; the owner has not approved the text yet.
- [x] FR-SYS-03 has passing unit tests that name it. Its e2e tests are written, not run.
- [x] `pnpm verify` passes. CI not run yet (no pull request open).
- [x] The legal pages have no data, so they have no loading, empty or error state.
- [x] No stub, dead control, placeholder, commented-out code, or invented number.
- [x] No new tables. No new server actions.
- [ ] Interface work carries screenshots, an axe result, and the Delivery Gate report. **Not met:** screenshots and axe (owner action 3).
- [ ] The reviewers' blockers are fixed. **Not met:** both blockers need the browser run.
- [x] This description says what changed, why, how it was verified, and how to roll it back.
- [x] No AI attribution in any commit or in this description.

## Opening this pull request

`gh` cannot reach GitHub from the sandbox. From your terminal in the repository root:

```sh
gh pr create --draft --base main --head wp/6.3-legal-pages-footer \
  --title "feat(shell): WP-6.3 part 1 privacy and terms pages, and the footer" \
  --body-file docs/reports/pull-requests/WP-6.3-part-1.md
```
