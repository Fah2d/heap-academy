# WP-6.3: legal pages and footer joined into the stack

Base: `wp/6.3-account-deletion`. Draft.

**Do not merge to `main` (it deploys) until decision 1 is settled.**

## What changes

- Merges `wp/6.3-legal-pages-footer` (`/privacy`, `/terms`, the footer) into the stack.
- Both pages are in the indexing table and the sitemap (FR-SEO-01).
- Privacy text now matches the stack: guest completions are added to the account at sign-in; sign-out and account deletion remove them from the browser; editor code stays; sign-in cookies; Cloudflare is named. Date: 25 November 2026.
- The legal keyboard test counts the header's Courses and Sign in links.

## Decisions for the owner

1. The privacy policy describes things this tree does not have yet: nightly encrypted backups on GitHub (WP-7.3), the hosting provider's page view count (WP-7.3), and per-address request counting in the database (WP-7.1). The reason given for keeping the deletion email depends on the backups. Default taken: the text is unchanged, and release waits for those packages. The alternative is to cut those sentences until then.
2. The words are the owner's statement: approve the changed sentences in `src/messages/legal.ts`.
3. "You can delete your account yourself" is true only once the three deletion variables are set (see `docs/runbooks/infrastructure-setup.md`).

## Evidence

- `pnpm verify`: exit 0, 148 files, 2539 tests.
- `pnpm build`, `check-bundle`, `check-static`: exit 0.
- Not run: browser tests (`e2e/legal.spec.ts` did not start: another `next dev` server holds this checkout, port 3302), `pnpm test:db`.
- Delivery Gate and design review: not run (speed mode).

## Review

One code review: CHANGES REQUIRED. Fixed: the device storage claim, the guest sync claim, Cloudflare, cookies, the keyboard test. Open: decision 1. The fixes were not reviewed again.
