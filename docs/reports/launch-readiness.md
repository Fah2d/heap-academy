# Launch readiness (WP-8.1)

Sections 4.1 to 4.3 of the launch checklist (`docs/spec/08-delivery-plan.md` section 4). Each line shows its state, then its evidence or what it waits for.

The checks were run in this repository on `wp/8.1-readiness`, which is `main` at 5dcc577, on 2026-11-27. Nothing was run against staging or production from this machine (CLAUDE.md rule 10).

States:

- **Done**: verified here, with the output quoted.
- **Owner**: only the owner can do or confirm it.
- **Waiting**: it depends on a branch or a CI job that is not on `main` yet.

## 4.1 Product

| Item | State | Evidence or what it waits for |
|---|---|---|
| Every journey J-1 to J-13 is green on three engines on `main`. | Waiting | CI's e2e job runs Chromium only (`--project=chromium --project=stack --project=gallery`). `stack-firefox` and `stack-webkit` exist (WP-7.4 part 3) but are not in CI, and Firefox's stack journeys crashed locally (`Page crashed`, reported in WP-7.4). Chromium, locally, on `main`: see "e2e on `main`" below. |
| The owner has completed a lesson on a real iPhone and a real Android phone, in the browser and inside the TikTok and Instagram in-app browsers. | Owner | Recorded in `docs/reports/spikes/runtime-devices.md` when done. |
| Every screen has passed the antislop Delivery Gate and the `design-reviewer`. | Not yet | See "Whole-application design review" below. |
| No placeholder text, dead control, or invented number is on the site. | Done for the source | See "Placeholder scan" below. Dead controls and numbers are part of the design review. |

## 4.2 Security

| Item | State | Evidence or what it waits for |
|---|---|---|
| Every row of the threat table has a passing test or a recorded check. | Done except T-24 | `docs/reports/day-7-security.md`, "Threats", maps each row to its tests. Every row except T-24 has tests on `main` whose titles cite it. T-24's tests (`scripts/restore.test.ts`, `scripts/workflows.test.ts`, `06_backup_reader.test.sql`) are on `wp/7.3-operations`, which is not merged. |
| `pnpm infra:verify` passes against the real domain. | Owner | Not run against any deployment from this machine. Run against a local production build: see "infra:verify on a local build" below. |
| The owner is the only row in `admins`, and his authenticator works. | Owner | Production database. |
| The auth provider's redirect allow-list has the real domain and no leftover addresses. | Owner | `pnpm infra:verify --url <domain> --auth <project ref>` checks it. That needs `SUPABASE_ACCESS_TOKEN`, which only the owner holds. |
| No secret is in the repository history. | Done | See "History scans". |
| The repository history has no AI attribution. | Done | See "History scans". |

## 4.3 Operations

| Item | State | Evidence or what it waits for |
|---|---|---|
| The nightly encrypted backup ran green on `main`, and one of its backups was restored. | Waiting, then Owner | The backup workflow is on `wp/7.3-operations` (decision P approved, pushed at 820c1c6). It runs on `main` only, after the merge, with the owner's secrets. |
| One rollback and one restore have been done from the runbooks. | Owner | Both act on the production deployment and database. |
| The uptime check emails the owner when the health endpoint fails. It was tested once. | Owner | The vendor account is the owner's. |
| Usage notifications are on wherever a vendor offers them, and every free-tier figure is below its ADR-0029 trigger. | Owner | Vendor dashboards. |
| The firewall rate limit is on. | Owner | Vercel dashboard. |

## Evidence

### History scans

`gitleaks git --config .gitleaks.toml --redact`, exit 0:

```
1298 commits scanned.
scanned ~8448053 bytes (8.45 MB) in 883ms
no leaks found
```

`node scripts/check-attribution.mjs --range 5136e76..HEAD`: exit 0. That covers 1161 of the 1162 commits on this branch.

The root commit 5136e76, by `--message-file` on its message: exit 0. Its author and committer are Fahad.

`node scripts/check-attribution.mjs --files`: exit 0.

### Placeholder scan

`grep -rniE "coming soon|lorem|ipsum|\bTBD\b|FIXME|\bTODO\b" src -l`: no file.

`placeholder` appears only in two places:

- The text field primitive's optional `placeholder` prop, documented as never the only label.
- The development gallery (`src/messages/gallery.ts`, `primitive-gallery.tsx`). It is built only for the development server, because `pageExtensions` leaves `.dev.tsx` pages out of every other build.

### Environment variables against `.env.example` (repository side)

- `.env.example` lists exactly the variables the schema declares, each with a description. The test `[NFR-SEC-04] .env.example documents exactly the declared variables, each with a description` (`src/infrastructure/env/schema.test.ts`) passes in `pnpm verify`.
- Outside the schema, the application reads these variables:
  - `NODE_ENV`, set by Next.js.
  - `VERCEL_ENV`, set by Vercel (`next.config.ts`).
  - `HEAP_RELEASE`, which is in `.env.example`.
  - `NEXT_WATCH_POLL_INTERVAL_MS`, a local development setting in `next.config.ts`.
- `scripts/infra-verify.mjs` reads `SUPABASE_ACCESS_TOKEN`, the owner's token, which the app never reads.
- The production values in Vercel are the owner's to audit against this list: names only, no value copied anywhere.

### infra:verify on a local build

`pnpm infra:verify --url http://127.0.0.1:3160` ran against a local production build of this commit, served by `pnpm start` with the local stack's public keys. It checks what any visitor sees: headers, the script policy and its nonce, the worker's policy, request IDs, health and the report endpoint.

It shows the build is right. It does not show the domain's configuration, which is the owner's run. Exit 0:

```
PASS  page / is HTML: 200 text/html; charset=utf-8
PASS  Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-09w9UNtKdkYPhxmrQe7Uwg==' 'strict-dynamic'; style-src 'self' 'nonce-09w9UNtKdkYPhxmrQe7Uwg=='; style-src-attr 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; report-uri /api/csp-report; report-to csp
PASS  every script carries the nonce: 22 of 22 scripts
PASS  a new nonce per request: 09w9UNtKdkYPhxmrQe7Uwg== then eRcL64r+HbZw6ZBxfclVoA==
PASS  X-Content-Type-Options: nosniff
PASS  Referrer-Policy: strict-origin-when-cross-origin
PASS  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=(), browsing-topics=()
SKIP  Strict-Transport-Security: not applicable over plain HTTP (sent: max-age=63072000; includeSubDomains)
PASS  a static file carries the security headers: 200 /_next/static/chunks/40ic3v6sf-o2x.js
PASS  the Python worker carries its own policy: 200 default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; frame-ancestors 'none'; report-uri /api/csp-report
PASS  the Python worker is revalidated: no-cache
PASS  the runtime files are immutable: 200 public, max-age=31536000, immutable
PASS  a miss under the runtime's path carries a policy: 404 default-src 'none'; frame-ancestors 'none'; sandbox
PASS  a request ID per request: 92ac4314-afeb-416c-83c0-ebd96d8a557c then ee75da82-3f77-4777-b766-ce89828fd752
PASS  a client-sent request ID is replaced: 92ac4314-afeb-416c-83c0-ebd96d8a557c
PASS  /api/health answers ok: 200 {"status":"ok","release":"local"}
SKIP  the address serves the expected release: no --release given (serves local)
PASS  /api/health is not cached: no-store
PASS  /api/health carries nosniff: nosniff
PASS  /api/csp-report accepts a report: 204
PASS  /api/csp-report refuses a malformed report: 400
PASS  /api/csp-report caps the size: 413
PASS  /api/csp-report refuses GET: 405

All 23 checks passed or do not apply.
```

### e2e on `main`

All runs used one worker, after `supabase db reset` with `ACTION_COUNTER_KEY` set.

1. **Before the fixes**, for the design review: CI's projects (`--project=chromium --project=stack --project=gallery --workers=1`) gave `233 passed (15.2m)`, `1 failed`, `1 skipped`, `2 did not run`. The runtime and phone projects gave `92 passed`, `1 failed`.
   - The runtime failure was the keyboard walk in `e2e/workspace-a11y-runtime.spec.ts`. It predates the footer (WP-6.3), and the two reached `main` together; that project is not in CI. The expected order now ends with the footer, as `docs/spec/03-experience.md` section 6.1 orders it.
2. **After the fixes**, every screen recaptured:
   - Command: `--project=chromium --project=stack --project=gallery --project=runtime-chromium --project=phone-workspace --workers=1`.
   - Result: `326 passed (19.7m)`, `1 failed`, `1 skipped`, `2 did not run`, `E2E_EXIT=1`.
   - The fix passed on its own first: `admin-gate-journey.spec.ts` in `stack` gave `2 passed (2.2m)`.
3. **The one failure, in both serial runs:**
   - The test: `[T-21] [NFR-SEC-03] a guest receives no solution...` (`e2e/canary-journey.spec.ts`).
   - What happens: its `beforeAll` waits for the new canary course to leave the cached course list. At the 180 s test timeout it still answered `404, 404`. The two "did not run" are the same file's next tests.
   - The pattern: it failed at the same place in both runs, test 88, after the same tests. It passes alone (`4 passed (56.5s)`) and with five workers on the WP-7.5 branch (`273 passed`, `1 skipped`). CI uses Playwright's default number of workers, not one.
   - This is a test-order dependency on the data cache (ADR-0028). It is reported to the owner, not fixed here.
4. **T-02 on `main`:** the loop, print flood and memory bomb fixtures in `e2e/runtime.spec.ts` and the time limit in `e2e/statechart-runtime.spec.ts` passed in the `runtime-chromium` runs.

### Whole-application design review

The full findings and answers are in `reviews/WP-8.1/design-review-1.md`. The verdict was CHANGES REQUIRED, with 4 blockers, 4 majors and 13 minors.

**Fixed in this package:**

- The broken QR image on the dashboard's setup page (B1).
- The screen set: the runtime project now saves screens, and the stale phone files are deleted (B2).
- The current-item marker on the course page (M3).
- The invalid field's border under the pointer (minor 1).
- One physical CSS property (minor 13).

**Open, so item 4.1.3 stays unticked:**

- B3: the profile has no screens.
- B4: the workspace frame from 768 px up. This one is structural.
- M1: dashboard screens that cannot be read.
- M2: sign-in states without screens.
- M4: the traceback shows before the error card. Decide after WP-7.5 merges.
- The other minors.

Once B3, M1 and M2 have their screens, the review runs again.
