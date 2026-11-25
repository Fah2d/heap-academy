<!-- No AI attribution in this description or in any commit (CLAUDE.md rule 15). -->

**Base: `wp/5.4-progress-preview` at a15f858.** That branch holds the 2.2 to 5.4 line and the runtime branches, which WP-7.2 checks. This pull request merges after them. Until then it also shows their commits, so review the commits after a15f858. Part 1 of WP-7.2: the admin gallery's axe checks, and the bugs they found.

## What

- 1e95ee3: one admin state per gallery page. `/dev/admin` drew about 20 editors at once, so axe found the same landmarks many times (`landmark-unique`), and none of `e2e/admin-gallery.spec.ts`'s checks had ever passed (they first ran here). Each state is now its own page at `/dev/admin?state=<state>`, listed on `/dev/admin`, the same pattern as the catalog gallery. The list is `src/features/admin/components/admin-states.ts`. The spec runs axe on all 34 states and on the list, and keeps every earlier assertion, each on its state's page. axe now waits until no CSS colour transition is running: it had read a pending button halfway between two colours (3.51:1).
- a28300c: **saving an existing course's details did nothing.** The course editor hands the whole course to the details form. The strict details schema refused the extra keys (`id`, `chapters`, …), and the check reported that as a sixth outcome line, which no field shows. No request went out and nothing said why. The form now keeps the four fields only, and the check parses only those. This bug is in WP-4.1's code and is not yet on `main`.
- 8c41dae (code review 1): axe also runs on each state as the spec leaves it, and on the state a test ends on. That found two more buttons, course and lesson status, that are announced while pending and then leave the page. **The `Button` primitive now removes React Aria's spent announcement that names it when it unmounts.** React Aria would drop it after 7 s anyway; until then axe reports `role-img-alt`.
- 51c9b24: Validate's Stop is no longer a pending button. React Aria announced it by its ID, then it left the page, so the announcement named nothing (`role-img-alt`) and focus fell to the start of the page. The status line already says "Stopping". If focus was lost, it goes back to Validate. While a chapter is renamed it keeps its heading, so the lesson rows' headings stay in order (`heading-order`).

## How it was verified

- `pnpm verify` on 8c41dae: exit 0, `Test Files  130 passed (130)`, `Tests  2326 passed (2326)`.
- `pnpm build` on 8c41dae with CI's fake public values: exit 0. `check-bundle`: `No server variable (RESEND_API_KEY, HEAP_RELEASE) in 23 files under .next/static.` `check-static`: exit 0. `/dev/admin` is not in the production build.
- New unit tests, each failing without its fix: the check given a whole course; the form saving a whole course; Stop never pending, with focus back on Validate; focus the owner moved stays put; the renamed chapter's heading; a button's announcement leaving with it.
- Browser, Chromium, one test per Playwright process, against `next dev --webpack` on `localhost`, on 8c41dae: `admin-gallery.spec.ts` 46 of 46 (it was 0 of 8 before this part), and `workspace-runtime.spec.ts` 17 of 17, because the `Button` change is shared.
- Not run: the stack journeys and `pnpm test:db` (no Docker; no database change), Firefox and WebKit (speed mode), Lighthouse on the preview (no preview deployment of this branch yet).

## Reviews

Code review 1 (one round, speed mode): CHANGES REQUIRED, 1 BLOCKER, 6 MINOR. The blocker (states driven by clicks lost their axe check) and four minors are fixed in 8c41dae. Two minors are answered without change. See `docs/reports/reviews/WP-7.2/code-review-1.md`. No security review: no sign-in, database, runtime or header change.

## antislop Delivery Gate report

antislop active: during (session override, CLAUDE.md rule 5). Dials from `DESIGN.md`: ENERGY 1 / RHYTHM 1 / MOTION 1.

- Block 1: PASS. R-25/R-39: zero axe violations on all 34 admin states and the list (before: `landmark-unique`, `role-img-alt`, `heading-order` and `color-contrast` mid-transition). R-27: each state has its own page and test. Focus is never left on the page's start after Stop.
- Block 2: PASS. No new technique. The gallery list uses the `Link` primitive, as the catalog gallery does.
- Block 3: PASS. No visible change to a learner's page. In the admin area, a renamed chapter shows its number and title above its form.
- Block 4: PASS. No motion change.

## Decisions (safe defaults)

1. The admin gallery takes the catalog gallery's one-state-per-page pattern rather than scoping axe to part of a page. Each state is still checked as a whole page, so no check is narrowed.
2. The course-details fix stays on this branch, which is stacked on WP-4.1. When WP-4.1 merges first, the owner can pick a28300c into it.
3. axe waits only for CSS transitions, not for every animation, so a looping loading indicator cannot hold the check.
4. The gallery screens in `docs/reports/screens/WP-2.3/`, `WP-4.1/`, `WP-4.2/` and `WP-4.3/` are from this first passing run. They now show one state each.
5. The `Button` primitive removes React Aria's announcement of its own pending state when it unmounts. It finds the announcement by the structure React Aria uses: `role="log"`, then `role="img"` with `aria-labelledby`. If a later React Aria version changes that structure, the removal does nothing and axe reports the problem again. It cannot remove anything else.

## Next

WP-7.2 part 2: axe on every workspace state still missing from the journeys, the keyboard walkthrough, the reduced-motion check, and the throttled load profile. The numbers go into `docs/reports/day-7-quality.md`.
