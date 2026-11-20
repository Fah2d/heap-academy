# Code review 1, WP-1.4

Reviewer: `code-reviewer`, fresh context. Started on `ef7276c..7bf3939`; four fix commits landed while it worked, so the findings are against de50547. 2026-11-16.

Verdict: **CHANGES REQUIRED**.

The fix commits 8f85981, 201b41b, d5e002d and de50547 had already fixed six problems the reviewer found: the nav link narrower than 44 px ("Links" measured 37.3 px from the font metrics), the hover border on a read-only field, the made-up "9.8 MB" figure, no check that `/dev/error` is absent, no 320 px width, and the reference sentence showing with no reference.

## BLOCKER

- **The "Done when" evidence is missing.** `docs/reports/screens/WP-1.4/` holds only `contrast.md`. No test or script takes the 375, 768 and 1280 px screenshots. The axe and 44 px checks, the reduced-motion check, the Delivery Gate report and `design-reviewer` approval are open. Fix: add screenshot capture to the e2e specs, have the owner run `pnpm test:e2e`, and put the results in the pull request. Until then the package is not done.

## MAJOR

1. **The reference is unreliable, and the new hint can be false.** `error-view.tsx:14-18`, `layout.tsx:26`, `system.ts:16`. With no digest the page shows the root layout's request ID, and the root layout does not re-render on client-side navigation, so after one navigation that ID belongs to an earlier, successful document request. A browser-side error is logged nowhere today (`/api/client-error` does not exist), so "Our logs file the failure under it" is untrue for that branch. The code shows the digest first, which differs from the wording of NFR-OBS-01 and `07-operations.md` line 83. The header name `x-request-id` and the format `^[A-Za-z0-9_-]{8,64}$` are not written down where WP-1.3 will see them. Fix: decide with the owner and record it with a `spec-change`: the digest for server errors, logged next to the request ID (WP-1.3); no request-ID fallback for browser errors until a client error report exists, or reword the hint.
2. **"Go to the home page" and the wordmark lead to a 404.** `not-found-view.tsx:9`, `error-view.tsx:28`, `site-shell.tsx:22`. `/` has no page until WP-5.1. Fix: owner decision.
3. **The raw-value lint rule has gaps.** `scripts/eslint/no-raw-values.mjs:17` and `:138`. Named colors pass in CSS (`color: red`), and `style={{ color: "red", "--gap": "13px" }}` with `gap-(--gap)` passes in a component. Fix: flag named colors except `transparent`, `currentColor` and `inherit`; check custom properties set in `style`; a test for each.
4. **The footer and nav are left out without a recorded decision.** `site-shell.tsx:7`. WP-1.4 "Builds" lists the footer; `03-experience.md` section 4 requires header, nav, main and footer landmarks. WP-6.3 builds only "the footer links", and WP-5.1 never mentions the Courses link. Fix: the owner's decision, and the footer element and the nav added to WP-6.3 and WP-5.1.

## MINOR

- `text-field.tsx:41`: invalid with no `errorMessage` shows an icon and an empty span, replacing the browser's message with nothing. Fall back to `validation.validationErrors`.
- `notice.tsx:30`: `role="status"` mounted together with its text is often not announced.
- `primitives.test.tsx:70`: `toContain("underline")` also matches `no-underline`. The TextField error test never checks `aria-describedby`.
- `shell.test.tsx:85`: the skip-link test cites NFR-A11Y-06; it should cite NFR-A11Y-03.
- `next.config.ts:16`: `NEXT_WATCH_POLL_INTERVAL_MS` is read outside the environment schema and is missing from `.env.example`; a bad value throws a ZodError that does not name the variable; polling then fails with EMFILE anyway.
- `.claude/settings.json:54`: the `pnpm test:e2e` and `npx playwright *` exclusions have no effect by the implementer's own report, but they widen the sandbox configuration.
- `error.tsx:10`, `global-error.tsx:17`: the title is built from a literal `" | "`, duplicating `shell.titleTemplate`.
- `semantic.css:54` says the 14 px code size is set in base.css; it is set in `components.css:44`. `semantic.css:5` says `p-7` produces no style, but `--spacing-7` is defined.
- `fonts.ts:33`: the mono fallback is not metric-matched, which departs from the signed `DESIGN.md` section 5.
- `package.json:40-41`: nothing imports `@fontsource/*`; the committed WOFF2 files are byte-identical to theirs. Note them as the source or remove them.
- The gallery does not show the Button `icon` or `block` variants.
- `src/features/shell` is not in the module table; the planned `spec-change` covers it.

## What the reviewer ran

`pnpm verify` (exit 0, 507 tests), then the same checks on clean `git archive` exports at 7bf3939 (507 tests) and d5e002d (508 tests). `git log --format=fuller ef7276c..de50547`: every author and committer is Fahad, with no trailer or credit. The production `.next` build contains no gallery copy in its client or server JavaScript. The compiled CSS for state-variant order. ESLint probes on stdin.

Not checked: Playwright, axe, screenshots, Firefox and WebKit, right-to-left rendering, the WP-1.3 script policy, the Delivery Gate, owner approval of the settings changes.

## Outcome

| Finding | Outcome |
|---|---|
| BLOCKER | Screenshot capture added in b985ccb: every axe check saves its state to `docs/reports/screens/WP-1.4/`. The run itself is the owner's, because the browser cannot start in this sandbox. |
| MAJOR 1 | Hint reworded in b985ccb to claim nothing about logs. The digest-versus-request-ID question is for the owner, with WP-1.3. |
| MAJOR 2, 4 | For the owner. |
| MAJOR 3 | Fixed in b1ca483, with tests. |
| Underline test, skip-link citation | Fixed in b985ccb. |
| Other MINOR | Listed in the pull request. |
