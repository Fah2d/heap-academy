# WP-6.3: legal pages and footer joined into the stack

Base: `main` (PR #22), carrying WP-6.1 to WP-6.3.

**Do not merge to `main` (it deploys) until decision 1 is settled.**

## What changes

- Merges `wp/6.3-legal-pages-footer` (`/privacy`, `/terms`, the footer) into the stack.
- Both pages are in the indexing table and the sitemap (FR-SEO-01).
- Privacy text now matches the stack: guest completions are added to the account at sign-in; sign-out and account deletion remove them from the browser; editor code stays; sign-in cookies; Cloudflare is named. Date: 25 November 2026.
- The legal keyboard test counts the header's Courses and Sign in links.

## Up to date with main at 89362a5 (2026-11-26)

- Merge 7ff6d80: `main` with WP-3.1 to WP-5.4 and the Python basics course. Two conflicts: `docs/reports/local-build-progress.md` (both sides' sections kept) and a comment in `course-status.test.tsx` (`main`'s wording; the code was the same).
- 7ff2c2f, J-10 found a row left after deletion: the auth service keeps an `auth.flow_state` row per email code request, naming the user with no foreign key. A new migration, `20261126010000_flow_state_on_user_delete.sql`, adds an after delete trigger on `auth.users` that deletes them. The new pgTAP assertion failed before the migration and passes after it. The previous app version still works: the change only adds a trigger. Security review: APPROVE, one minor (the pgTAP delete runs as `postgres`, not as the auth service's role; the reviewer checked that role by hand).
- 2df6b9f: J-5/J-6 and J-10 wait until their course is on the site. Their course is written by SQL, and the cached course list answers 404 for it for up to a minute.
- 91100f7, c2c5449: the stack journeys run axe after colour transitions finish (`noAxeViolations`). Before, axe measured buttons mid-transition: 3.52:1 in sign-in, 2.66:1 in admin-gate.
- `pnpm verify`: exit 0, 150 files, 2673 tests. `pnpm test:db`: 13 files, 378 tests, PASS.
- e2e as CI runs it (`CI=1`, CI's public values, the local stack's keys and the deletion variables, `--project=chromium --project=stack --project=gallery`, after `supabase db reset`): 156 passed, 1 skipped (the existing `[T-19]` `test.fixme`), exit 0. A second run: 155 passed, 1 failed. `[T-11]` could not load Turnstile (`net::ERR_NETWORK_CHANGED` on this machine), and the page showed its "did not load" error. Not rerun.
- Local CLI is v3.2.0 (auth v2.197.0); CI pins v2.122.1. Not verified on CI's auth version.

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
