<!-- No AI attribution in this description or in any commit: no co-author trailer, no "Generated with" line, no session link (CLAUDE.md rule 15). -->

## What and why

WP-8.1 Production readiness, the parts that need no owner action. The owner's instruction for this session limited it to those parts. Everything else is listed under "Owner actions now due" and in `docs/reports/local-build-progress.md`.

- `docs/reports/launch-readiness.md`: launch checklist sections 4.1 to 4.3, one row per item, each with its state and its evidence or what it waits for.
- The whole-application review by `design-reviewer`, on every screen recaptured on this commit (`reviews/WP-8.1/design-review-1.md`). These of its findings are fixed here:
  - **The dashboard setup page's QR code was a broken image (B1).** auth-js already returns a `data:` address and the page added a second one. The unit test's mock had a shape the library never returns, and the journey only checked that the image was visible.
  - **Screens.** 71 workspace screens were never saved by the runtime project, and 13 stale phone screens were written by no test (B2).
  - **The current-item marker from DESIGN.md (M3).** It was missing everywhere. It now marks the next lesson on the course page.
  - **An invalid field's red border under the pointer (minor 1), and one physical CSS property (minor 13).**
- **A stale test, `e2e/workspace-a11y-runtime.spec.ts`.** Its keyboard walk predates the footer (WP-6.3), and the two reached `main` together. That project is not in CI, so nothing had caught it. The expected order now ends with the footer, as the spec orders it.

## Work package

- Work package: WP-8.1 (`docs/spec/08-delivery-plan.md`), owner-free parts only.
- Requirements and threats:
  - Covered: NFR-SEC-02 (history scans), FR-ADM-01 and T-19 (the setup QR code).
  - Evidence recorded: FR-SEO-01, NFR-COST-02 and NFR-OBS-04 wait for the real domain and vendor accounts (owner).
- Time box: 2 hours. Time taken: not measured. It is past the box, mostly in e2e runs (15 to 20 minutes each with one worker). Nothing was cut to fit. The items not done are listed under "Owner actions now due".

## How it was verified

- `pnpm verify`: see the final run below.
- Tests added or changed, with IDs in their titles:
  - `second-step.test.ts`: the fixture is what the local auth service sends, with GoTrue's SVGo declaration and comment, inside auth-js's `data:` prefix. Tests cover the refused shapes and the markup read with and without its declaration and comment.
  - `admin-gate-journey.spec.ts`: the QR image decodes (`naturalWidth > 0`).
  - `catalog.test.tsx`: the next lesson carries `aria-current="step"` and the marker.
  - `primitives.test.tsx`: the invalid hover class.
  - `workspace-a11y-runtime.spec.ts`: the footer in the keyboard order.
- History:
  - `gitleaks git --config .gitleaks.toml --redact`: 1298 commits, "no leaks found", exit 0.
  - `check-attribution.mjs --range 5136e76..HEAD`, the root commit's message, and `--files`: all exit 0.
- `pnpm infra:verify --url http://127.0.0.1:3160` against a local production build: "All 23 checks passed or do not apply", exit 0. The full output is in `launch-readiness.md`.
- e2e: see `launch-readiness.md`, "e2e on `main`", and the final run below.

Final runs:

- `pnpm verify`, final: `VERIFY_EXIT=0`, `Test Files  155 passed (155)`, `Tests  2777 passed (2777)`.
- e2e, every screen project with one worker after `supabase db reset`: `326 passed (19.7m)`, `1 failed` (the canary, reported), `1 skipped`, `2 did not run` (the canary file's next tests).
- `admin-gate-journey.spec.ts` in `stack` after the QR fix: `2 passed (2.2m)`.

## Screens

Every screen in `docs/reports/screens/` was recaptured on this branch, with one worker after `supabase db reset`. The runs were CI's projects plus `runtime-chromium` and `phone-workspace`. Screens whose pixels changed are committed in place, in the folder of the package that last changed them.

antislop Delivery Gate report: the reviewer's whole-application gate is in `reviews/WP-8.1/design-review-1.md`. Of its FAILs, these are fixed here:

- R-35: the screens are now from this commit, and the QR image is checked to decode.
- C-2: the QR code.
- Block 3, identity motif: the current-item marker.

These FAILs stay open, so the gate does not pass for the application yet:

- R-27: profile and sign-in states without screens, and dashboard states that cannot be read.
- Block 3 focal point and C-4: the workspace frame at 720 px tall.

This package's own changes are small. For those changes:

- R-02 PASS: no copy changed.
- R-25 PASS: the marker uses `--color-action`, the signed accent.
- R-32 PASS: `aria-current` added and focus unchanged.
- R-39 PASS: the invalid state is no longer lost on hover.
- R-40 PASS: the QR image keeps its width and height.

## Reviews

- design-reviewer: whole application, CHANGES REQUIRED. B1, B2, M3, minor 1 and minor 13 are fixed. The rest are open, below.
- code-reviewer: CHANGES REQUIRED, 1 blocker, 1 major, 4 minors. All fixed (`reviews/WP-8.1/code-review-1.md`).
- security-reviewer: CHANGES REQUIRED, 1 blocker, 1 major, 1 minor, all on the QR parse. All fixed (`security-review-1.md`). It found the SVG display path safe.

Open BLOCKER and MAJOR findings for the owner:

1. **B3:** the profile has no screens.
2. **B4:** from 768 px up the workspace is framed by four bars, and at 1280×720 the editor gets about 65 to 100 px. This is structural: a compact bar on `/learn` instead of the site header, the footer out of the locked frame, and a floor for the editor.
3. **M1:** dashboard gallery screens are whole-page captures about 17,000 px tall.
4. **M2:** sign-in states without screens.
5. **M4:** Python's traceback shows before the plain-words card. `console-panel.tsx` changes on `wp/7.5-polish`, so decide after that merge.

## Try it on the preview

1. As the admin with no authenticator yet, open `/admin/setup` and press the start button. The QR code shows as a code, not a broken image.
2. Signed in, with one lesson completed, open the course page. The next lesson has the amber bar at its start and bold text.
3. In the dashboard, create a course with an empty title, then rest the pointer on the field. The border stays red.

## Owner actions now due

These come from WP-8.1 and need the owner:

- The final domain and DNS check.
- Google sign-in in production mode.
- The verified email sender.
- An audit of the production environment variables in Vercel, against the list in `launch-readiness.md`. Names only.
- `pnpm infra:verify --url <domain> --repo <owner/repo> --auth <project ref>` against the real domain. It was not run from this machine.
- The phone checks on a real iPhone and Android, including the in-app browsers.
- `admins` holds only the owner's row, and the authenticator works.
- The auth redirect allow-list.
- After WP-7.3 merges: the backup run on `main` and one restore.
- One rollback and one restore from the runbooks.
- The uptime check, tested once.
- Usage notifications, and the free-tier figures against ADR-0029.
- The firewall rate limit.
- The open design findings above.
- **A flaky test:** `e2e/canary-journey.spec.ts` timed out after a long serial run (180 s waiting for the cached course list) and passed alone (4 passed, 56.5 s). Not fixed here.
- **CI coverage:** CI runs Chromium only. J-1 to J-13 on three engines needs `stack-firefox` and `stack-webkit` in CI. Firefox's stack journeys crashed locally in WP-7.4.

## Deviations from the plan or the spec

1. Only the owner-free parts are built, by the owner's instruction. Launch checklist 4.1 to 4.3 is not ticked.
2. The design review's fixes are partial; see "Open BLOCKER and MAJOR findings".
3. A test expectation changed: the keyboard walk now includes the footer. It is not a weaker check, because it now expects one more region and two more stops, in the order section 6.1 gives.

## Risks and rollback

- The QR change refuses a provider answer that is not SVG with the "unavailable" message, where it used to show a broken image. If auth-js changes its format, the setup page says setup is unavailable and the unit test names the case.
- Rollback: revert the merge commit. No migration.

## Definition of Done

- [ ] Every "Done when" line is met: no. Sections 4.1 to 4.3 need the owner.
- [x] Every cited requirement touched has a passing test that names its ID.
- [x] `pnpm verify` passes. The e2e results are recorded as they are, including the flaky canary.
- [ ] Every state of every changed view exists: the profile, sign-in and dashboard gaps are open (B3, M1, M2).
- [x] No stub, dead control, placeholder, commented-out code, or invented number.
- [x] No new table. No new server action.
- [ ] Every reviewer blocker is fixed: B3 and B4 are open.
- [x] No AI attribution in any commit or in this description.
