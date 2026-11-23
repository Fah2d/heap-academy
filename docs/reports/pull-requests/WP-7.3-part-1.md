**Part 1 of WP-7.3.** The client error report: `POST /api/client-error`, the browser's reporter, and a reference on the error page for an error thrown in the browser. Branched from `main` (0efe863); it depends on nothing that is not merged.

## What and why

Until now an error thrown in the browser was logged nowhere, so the error page showed no reference for it (FR-SYS-01, owner's decision on pull request #3). This part adds the report endpoint of architecture section 9.2 and the reporter port of ADR-0019, and the error page now reports a browser error and shows the reference the server logged it under.

## Work package

- Work package: WP-7.3 Operations, part 1.
- Requirements and threats covered: NFR-OBS-01 and NFR-OBS-02 for browser errors, NFR-PRIV-03 and T-16 for the report, T-14 for the body cap, FR-SYS-01 for the reference.
- Time box 2.5 hours for the whole package. Part 1 took from 00:06 to about 00:25 on 2026-11-24, with the reviews.

## What changed

| Item | Where |
|---|---|
| The three codes of 07-operations section 4.2 (`runtime-load-failed`, `worker-crashed`, `unexpected-exception`), the report type `{ code, route }`, the `ErrorReporter` port type, and `reportedRoute`, which keeps a path without its query or fragment, at most 2048 characters. Pure, so the runtime can use them later. | `src/domain/client-error.ts` |
| The request ID's header name, type and `parseRequestId`, moved from `src/infrastructure/http/request-id.ts` (which re-exports them and keeps `createRequestId`) so the browser checks the reference with the same rule. | `src/domain/request-id.ts` |
| `POST /api/client-error`: `application/json` only (415), at most 8000 bytes, declared or counted while reading (413), a strict schema that refuses any field but `code` and `route` (400), then one `error` line: the request ID from proxy.ts, the reported page's route as its pattern through `logRoute`, `client-error:<code>`, and the server's release. Answers 204; proxy.ts puts the request ID on the answer. | `src/features/system/server/client-error.ts`, `src/app/api/client-error/route.ts` |
| The body cap reader, moved out of the CSP report handler so both endpoints share it. | `src/features/system/server/read-capped.ts` |
| `client-error` added to the logged route segments. | `src/infrastructure/logging/route.ts` |
| The reporter adapter: a POST with no cookie (`credentials: "omit"`) and `keepalive`, which resolves to the answer's `x-request-id` when it is a well-formed request ID, and to nothing on any failure. Exported from `@/features/shell` for the workspace. | `src/features/shell/client/report-client-error.ts` |
| The error page: a server error still shows its digest and is not reported (the server logged it). A browser error is reported once as `unexpected-exception`, also under React's double effect in development, and the reference block appears when the report is stored, with the request ID; while the report is on its way, or if it fails, no block shows, as before. A new error is reported again and never shows the reference of the one before. The reference wraps only after its hyphens (`<wbr>`), with `wrap-anywhere` for a value without hyphens. | `src/features/shell/components/error-view.tsx` |
| A development-only page that throws in the browser after hydration, so the browser error state can be photographed and checked with axe. Not in the production build. | `src/app/dev/client-error/page.dev.tsx`, `src/features/shell/components/browser-error-trigger.tsx` |
| `saveScreen` takes the folder of the work package that changed the screen. | `e2e/screens.ts` |

## How it was verified

`pnpm verify` on the tree of 67a2dab, exit 0 (pnpm's install check failed on the sandbox's store lock, so it ran with `--config.verify-deps-before-run=false` on the installed `node_modules`):

```
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
$ eslint --max-warnings=0 .
$ tsc --noEmit
$ node scripts/check-attribution.mjs --branch && node scripts/check-attribution.mjs --files
$ vitest run --coverage
 Test Files  31 passed (31)
      Tests  722 passed (722)
 src/domain        |     100 |       95 |     100 |     100 |
```

`next build` with CI's values and `HEAP_RELEASE=0123456789abcdef0123456789abcdef01234567`, exit 0:

```
Route (app)
┌ ƒ /_not-found
├ ƒ /api/client-error
├ ƒ /api/csp-report
└ ƒ /api/health
```

```
No server variable (RESEND_API_KEY, HEAP_RELEASE) in 20 files under .next/static.
check-bundle exit 0
No prerendered page in .next, apart from /_global-error, which Next.js always prerenders.
check-static exit 0
```

The development trigger's message is in no file under `.next/static` (`grep -rl` counted 0).

Against `next start -p 3733` on the build of 7845ed8, with curl:

```
--- valid
HTTP/1.1 204 No Content
x-request-id: 7567467d-ac71-4aca-930b-977134a767cb
--- extra field
400
--- text/plain
415
--- 9 kB
413
--- GET
405
--- log lines
{"time":"2026-11-23T21:10:59.196Z","release":"0123456789abcdef0123456789abcdef01234567","level":"info","requestId":"7567467d-ac71-4aca-930b-977134a767cb","route":"POST /api/client-error","outcome":"request"}
{"time":"2026-11-23T21:10:59.199Z","release":"0123456789abcdef0123456789abcdef01234567","level":"error","requestId":"7567467d-ac71-4aca-930b-977134a767cb","route":"GET /:param/:param","outcome":"client-error:worker-crashed"}
```

The valid report's route was `/courses/ada@example.com?token=secret`; the line holds neither the address nor the query. The security reviewer also sent `x-request-id: attacker_chosen_id` and got back a server UUID, which the `client-error:worker-crashed` line carries.

**Tests added**, with the requirement IDs in their titles:

- `src/features/system/server/client-error.test.ts`: the line's fields; each of the three codes and no other; a report with a `message` refused; an email in the path and a query never reach the line, through the real logger; `none` when there is no request ID; a route that is not a path, or too long, refused; the longest route accepted; exactly 8000 bytes accepted and 8001 refused, the cap pinned at 8000; a declared `content-length: 9000` refused without the body being read; a streamed body over the cap refused; another content type 415; a body that is not a JSON object 400.
- `src/features/shell/client/report-client-error.test.ts`: posts only `code` and `route`, with no cookie and `keepalive`; resolves to the answer's request ID; resolves to nothing on a 400, a missing or malformed header, or a network failure.
- `src/features/shell/shell.test.tsx`: a server error is not reported; a browser error is reported once under `StrictMode` with the path alone, then shows the request ID; no reference while the report is pending or after it fails; a new error is reported again and the old reference disappears; the reference wraps only after hyphens and its text is unchanged.
- `src/domain/client-error.test.ts`, `src/domain/request-id.test.ts`: the reported route and the request ID shape.
- Mutants, each now failing a test: removing the declared length check (1 failure), `size > limit` to `size >= limit - 1` (2), the cap raised to 8000000 (2), the route limit lowered by one (1).

**End to end and axe: not run.** The sandbox stops Chromium at launch, as in earlier sessions. Written and waiting for a run:

- `e2e/client-error.spec.ts` (chromium, firefox, webkit projects): 204 with a request ID, 400 with a message, 413 over 8 kB, and a page that sends a report under its content security policy.
- `e2e/gallery.spec.ts` at 320, 375, 768 and 1280 px, and `e2e/phone.spec.ts` at 412, 375 and 360 px: the browser error page shows the reference the response carried, does not scroll sideways, and has no axe violation; with the report answered 503, no reference and no hint show.
- `e2e/shell.spec.ts`: `/dev/client-error` is 404 in the production build.

## Screens

**None.** `docs/reports/screens/WP-7.3/` does not exist yet; see owner action 1. The only visible change is the reference block, which already exists for a server error, now also shown for a browser error.

antislop Delivery Gate report, antislop active: during (session override, from `CLAUDE.md` rule 5). The gate is **not passed**: R-03, R-25, R-32, R-35 and C-4 need the screenshots and the axe run.

Block 1, Hard Gate:

- R-02 PASS: no new text. The strings are the existing `errorPage.referenceHint` and `errorPage.referenceLabel`.
- R-03 NOT VERIFIED: the sideways-scroll checks at 320 to 1280 px and on the phone are written, not run. The reference wraps after its hyphens.
- R-17, R-18, R-36, R-38 PASS: no number, statistic or testimonial; the reference is the value the server logged.
- R-23 PASS: no asset created.
- R-24, R-26, C-2 PASS: no new link or control.
- R-25 NOT VERIFIED by axe. Tokens unchanged: text on background 16.94, muted on background 7.86.
- R-27 PASS: the block's three states (pending, stored, failed) are each defined and tested; pending and failed show nothing, as the page did before.
- R-28 PASS: no FAQ.
- R-32 NOT VERIFIED: no new focusable element; the keyboard order is unchanged.
- R-33, R-34 PASS: no external patch; one theme.
- R-35 FAIL until the owner's run: no control was clicked in a browser.
- R-37 PASS: signed `DESIGN.md`; dials ENERGY 1 / RHYTHM 1 / MOTION 1, as on the existing error page.
- R-39 PASS in source: the block is plain text in reading order, not announced (the design review's advice); axe not run.
- R-40 PASS: no media.

Block 2, Purpose-Gate: PASS. No gradient, icon, pattern, badge, shadow, card, animation or illustration added. The mono face is the existing `code` element for a value to copy.

Block 3, Liveliness: unchanged from the WP-1.4 error page.

Block 4: C-1, C-3, C-5 PASS. C-4 NOT VERIFIED: no screenshot at any width.

## Reviews

- `docs/reports/reviews/WP-7.3/code-review-1.md`, of 7845ed8: CHANGES REQUIRED. 1 blocker (the release, owner decision A), 3 majors (the port out of reach, the cap untested, the reference not in the spec), 5 minors. Fixed in 67a2dab: both code majors and four minors. Open: the blocker (decision A), the spec major (decision B), the rate limit minor (WP-7.1).
- `docs/reports/reviews/WP-7.3/security-review-1.md`, of 7845ed8: APPROVE with 5 minors. MINOR 4 fixed; MINOR 3 is decisions A and B; MINOR 1 and 2 go to WP-7.1; MINOR 5 is the manual evidence above.
- `docs/reports/reviews/WP-7.3/design-review-1.md`, of 7845ed8: CHANGES REQUIRED. The blocker (no screens, no page for the state) is half fixed: the development page and the e2e exist, the run does not. The wrap minor is fixed and not seen; the spec minor is decision B.
- The fixes in 67a2dab were not reviewed again.

Open MAJOR findings for the owner to waive: the code review's spec major, until decision B is made.

## Try it on the preview

1. `curl -i -X POST -H 'content-type: application/json' -d '{"code":"worker-crashed","route":"/courses"}' <preview>/api/client-error`: expect `204` and an `x-request-id`.
2. In the host's logs, find the line with that request ID and `"outcome":"client-error:worker-crashed"`.
3. The same with `"message":"x"` added: expect `400` and no `client-error` line.
4. The browser error page exists only on the development server: `pnpm dev`, open `/dev/client-error`, and the reference appears below the buttons.

## Owner actions now due

1. Outside the sandbox: `pnpm test:e2e --project=chromium e2e/client-error.spec.ts e2e/shell.spec.ts`, then `--project=gallery` and `--project=phone --project=phone-375 --project=phone-360`. Commit `docs/reports/screens/WP-7.3/` and ask `design-reviewer` again with the screens.
2. Decide A and B below.
3. Stop the servers the sandbox could not stop: `lsof -ti tcp:3217,3733 | xargs kill`.
4. Open the draft pull request with the command at the end.

## Decisions for the owner

**A. Where the release on a client error line comes from.** 07-operations section 4.2 says the browser sends it. `.env.example` lists `HEAP_RELEASE` as a server variable, and `scripts/check-bundle.mjs` fails a build that has its name or value in a browser file, so sending it from the browser means changing that classification, which is a check. Options:
- (a) Make the release public: `NEXT_PUBLIC_HEAP_RELEASE`, set from the same parsed value in `next.config.ts` and the deploy build, taken out of the server list in `.env.example`; the report gets a `release` field (40 hex characters or `local`), and the line carries both. The release is not secret: `/api/health` already returns it and the repository is public. The code reviewer recommends this.
- (b) Keep the server's release and change the spec's wording. A tab still on the old bundle after a deploy is then logged under the new release.
- **Default, built here: (b)'s behaviour, without the spec edit.** Recommendation: (a), as a small follow-up commit on this branch once you say so, because the first hours after a deploy are when the release matters.

**B. A `spec-change` for the browser error's reference.** FR-SYS-01, NFR-OBS-01, `03-experience.md` section 5.6 and `07-operations.md` section 4.1 say a browser error shows no reference "until `/api/client-error` exists", and NFR-OBS-01 says "the error page shows the digest only". Proposed text for FR-SYS-01 and NFR-OBS-01: "For a server error the reference is the error's digest. For a browser error it is the request ID of its report to `/api/client-error`, shown once the report is stored; if the report fails, no reference is shown." And for 07-operations section 4.2, depending on A: "with the release version" (a) or "the server adds its release" (b). Default: no spec file is edited on this branch (rule 11); the text goes into a `spec-change` pull request when you approve it.

## Deviations from the plan or the spec

- **The release is the server's** (decision A).
- **A report with any field but `code` and `route` is refused**, not trimmed, so a reporter that starts sending a message fails loudly instead of being cut silently. The code reviewer accepted this.
- **The line's `route` is the reported page as `GET <pattern>`**, while proxy.ts logs the POST under the same request ID.
- **No read deadline on a slow body.** A client can hold the handler open by sending a few bytes at a time (security MINOR 1; the CSP endpoint already had this). Left for WP-7.1, with the per-address counters, which should name both report endpoints (security MINOR 2).

## What is left for later parts of WP-7.3

- Part 2, on `main` alone: analytics turned on (the host's cookie-free analytics, which needs either its package, not installed here, or its script under the nonce policy, to be decided), and the runbooks for rotating a secret and for a usage spike or a free-tier limit reached.
- After WP-2.1 merges: the nightly encrypted backup workflow with the `backup_reader` role, the recipient key check, provenance attestation, the heartbeat ping, the deletion email and their tests; the restore script and its verification script; the restore and deletion request runbooks.
- The owner's drills, monitors and notifications.
- The workspace and runtime send `runtime-load-failed` and `worker-crashed` when WP-3.x merges.

## Risks and rollback

The endpoint writes one log line per report and touches no data. A flood of reports inflates the error count until WP-7.1's limits exist. Rollback: revert the two commits; the error page goes back to no reference for a browser error.

## Definition of Done

- [ ] Every "Done when" line is met. **Not met for the package**: the drills, the backup run and the monitors are later parts and owner actions. This part's own lines (endpoint, reporter, logger allowlist tests) have tests.
- [x] Every cited Must requirement in this part has a passing test that names its ID.
- [x] `pnpm verify` passes; `next build`, `check-bundle` and `check-static` pass.
- [ ] Every state of every changed view exists, and is photographed. **Not met**: the states exist and are tested in jsdom; no screenshot.
- [x] No stub, dead control, placeholder, commented-out code or invented number.
- [x] No new tables. No new server actions.
- [ ] Every reviewer blocker is fixed. **Not met**: decision A, and the screenshots.
- [x] No AI attribution in any commit or in this description.

## Opening this pull request

`gh` cannot reach GitHub from the sandbox. From your terminal in the repository root:

```sh
gh pr create --draft --base main --head wp/7.3-operations \
  --title "feat(system): WP-7.3 part 1 client error report" \
  --body-file docs/reports/pull-requests/WP-7.3-part-1.md
```
