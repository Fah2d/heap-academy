# 08 Delivery Plan

Eight days from an empty repository to a live site. Thirty work packages, each ending in a pull request the owner reviews and merges. This plan replaces the ten-phase plan, which is archived in `docs/later/`.

## 1. Shape of the plan

### 1.1 The eight days

| Day | Outcome | The owner's part |
|---|---|---|
| 1 | Decisions made, design direction signed, a first page live through every check | Answer the decision sheet, do the design interview, create the accounts, point the domain |
| 2 | Database with policies, sign-in, the admin area locked | Set up Google sign-in and the email sender, become the admin |
| 3 | Python runs, takes input, is stopped, and is graded in three browser engines | Test on real phones, inside TikTok and Instagram |
| 4 | The admin dashboard: courses, lessons, test cases, validation, publishing | Publish a first lesson; start writing |
| 5 | A guest can learn a lesson end to end on a phone | Time yourself writing a lesson; keep writing |
| 6 | Accounts keep progress across devices, with XP and streak | Approve the privacy and terms text; keep writing |
| 7 | Security, accessibility, performance, and operations checked and recorded | Do one rollback and one restore; test on phones; make the backup key |
| 8 | Launch lessons checked, the site live on the domain | Read every launch lesson on a phone; say go |

Time boxes are estimates of Claude Code's working time. They were not measured. Each review by the owner adds about fifteen minutes.

### 1.2 How a day runs

1. In the morning, start the day's first work package in a fresh session: `/work-package WP-x.y`.
2. When a pull request opens: open the preview, try it, read the description, merge. The next package starts in a new session.
3. In the evening: `/day-check <day>`. It reports what merged, what the day's exit line shows, and what moved.

### 1.3 Two at once

Where a package says "Can run beside", it may run in a second session at the same time (`05-engineering-handbook.md` section 12.2). The pairs: WP-1.3 and WP-1.4; WP-2.1 and WP-2.2; WP-3.2 and WP-3.3; WP-4.1 and WP-4.2; WP-5.1 and WP-5.2; WP-5.3 and WP-5.4; WP-6.2 and WP-6.3; WP-7.1 and WP-7.2; WP-7.3 and WP-7.4. Running them one after the other also works; it only takes longer.

### 1.4 Cut order

When a day ends behind, these leave the plan in this order. Each is a Should requirement and is complete or absent, never half-built.

1. Completion counts in the dashboard (FR-ADM-13)
2. Near-miss messages (FR-GRD-07)
3. Symbol row on phones (FR-WSP-21)
4. Error explanations (FR-WSP-23)
5. Export and import (FR-ADM-12, WP-6.4)
6. The live editor on the home page (FR-LND-01)
7. The course progress summary (FR-CRS-05)

If that is not enough, the owner chooses between moving the launch and cutting a Must requirement. The implementer never makes that choice.

### 1.5 Never cut

Policy tests for every table. The second sign-in step for the admin. The script policy. Learner code only in the worker. The publish rule. Account deletion. The states of every screen. The antislop Delivery Gate. The no-attribution rule. The rollback and restore drills.

## 2. Work packages

Each package lists: its time box, what it depends on, the requirements and threats it covers, what it builds, and the evidence that it is done. "Owner" lines are things only the owner can do.

### Day 1: Decide and lay the foundation

**WP-1.1 Decisions and design direction**
- Time box: 2 hours, mostly the owner's. No code.
- Covers: NFR-MAINT-07; goals G-4 and G-8; assumptions A-01 to A-12.
- Builds: a decision sheet, one table with every ADR in force and every assumption, each with its default and what changes otherwise; the ADR status lines updated from the owner's answers; the direction interview from `03-experience.md` section 10; `DESIGN.md`, written from the owner's answers and signed by him; a check of `/brand` against `brand/README.md`.
- Done when: every ADR that is not superseded or deferred is Accepted or replaced; `DESIGN.md` exists with the owner's signature line; missing brand files are listed for the owner.
- Owner: answer "accept all" or name the changes; answer the design interview; sign.

**WP-1.2 Repository skeleton and guardrails**
- Time box: 2.5 hours. Depends on: the decision sheet of WP-1.1.
- Covers: NFR-MAINT-01, NFR-MAINT-05, NFR-MAINT-08, NFR-SEC-04, NFR-SEC-05, NFR-I18N-01, NFR-I18N-02; T-18.
- Builds: the Next.js application at its current stable version with the TypeScript flags of the handbook; pnpm; the folder structure of `02-architecture.md` section 4; lint with the import rules, the no-raw-HTML rule, the no-inline-strings rule, and the logical-properties rule; formatter; Vitest; Playwright; the environment schema and `.env.example`; `pnpm verify`; the kit's `.claude/settings.json` extended with a deny list and blocking hooks; `scripts/check-attribution.mjs` with its own tests; Git hooks for pre-commit and commit messages; the secret scan configuration.
- Done when: `pnpm verify` passes; a deliberate import-rule violation fails lint; `docs/reports/guardrails.md` shows each of these attempted and blocked: reading a `.env` file, force push, push to `main`, skipping Git hooks, a commit whose message has a Claude co-author trailer, a pull request whose description says it was generated with Claude Code; the commits and the pull request of this package carry no AI attribution (the pull request shows `git log --format=fuller` for its range).

**WP-1.3 Pipeline, first deploy, and the script policy**
- Time box: 3 hours. Depends on: WP-1.2. Can run beside: WP-1.4.
- Covers: NFR-SEC-02, NFR-SEC-04, NFR-SEC-05, NFR-MAINT-06, NFR-MAINT-08, NFR-OBS-01, NFR-REL-04, FR-SYS-04; T-12, T-13, T-15.
- Builds: the `static`, `unit`, and `build` jobs with pinned actions, least-privilege permissions, and timeouts; the deploy workflow of `07-operations.md` section 3; `proxy.ts` with the nonce policy of `06-security-privacy.md` section 5.2, enforced; the other response headers; `/api/health`; `/api/csp-report`; request IDs; `pnpm infra:verify`; the runbooks for infrastructure setup and for deploy and roll back.
- Done when: one real page is live at the production address through a pull request with every check green; a pull request with a failing check cannot merge; a pull request with AI attribution in a commit or in its description fails `static`; the attribution check run once over the whole history of `main` finds nothing; `pnpm infra:verify` shows every header and a policy with a nonce and no `unsafe-inline` or `unsafe-eval` for scripts; the page runs its scripts with no policy violation in Chromium, Firefox, and WebKit; the result of trying the policy without the inline style attribute line is recorded; pipeline duration is recorded; whether a Hobby project can share one protected preview by link is recorded; before the repository is made public, `gitleaks git --log-opts="--all"` over every branch and every `refs/pull/*` ref finds nothing, and GitHub secret scanning, push protection, and private vulnerability reporting are on, checked with `gh api repos/OWNER/REPO --jq .security_and_analysis`; `SECURITY.md` exists; the `staging`, `production`, and `production-backup` environments allow `main` only.
- Owner: make the repository public (ADR-0029), only after the history scan above passes; turn off Issues, Discussions, and the wiki, limit interactions to collaborators, and require approval for workflows from outside contributors; give the implementer a fine-grained token without admin rights; turn on Vercel Git Fork Protection and preview deployment protection; create the Vercel Hobby project and the two Supabase Free projects; turn on branch protection with the required checks; put secrets where the runbook says; point the domain; start the email sender's domain verification and create the Google sign-in client, because both can take hours.

**WP-1.4 Design tokens, primitives, and the shell**
- Time box: 3 hours. Depends on: WP-1.1 signed, WP-1.2. Can run beside: WP-1.3.
- Covers: FR-SYS-01, NFR-A11Y-06, NFR-A11Y-07, NFR-A11Y-08, NFR-I18N-01, NFR-I18N-02, NFR-I18N-03; goal G-4.
- Builds: tokens in three tiers from `DESIGN.md`; self-hosted fonts; primitives for button, link, text field, tabs, dialog, disclosure, notice, progress, and status; the shell with header, footer, skip link, and landmarks; the not-found and error pages with a reference ID; the lint rule against raw values.
- Done when: a development-only page, absent from the production build, shows every primitive in every state; the contrast checker passes on every token pair in use; screenshots at 375, 768, and 1280 px; axe is clean; the antislop Delivery Gate report is in the pull request; `design-reviewer` approves.

Day 1 is done when: the production address serves the shell through the pipeline with the script policy enforced; the guardrails are proven; `DESIGN.md` is signed; the decisions are accepted.

### Day 2: Data, sign-in, and the admin lock

**WP-2.1 Schema and policies**
- Time box: 3 hours. Depends on: WP-1.3. Can run beside: WP-2.2.
- Covers: NFR-SEC-03, NFR-SEC-06, FR-GRD-05, FR-PRG-04, FR-PRG-07, FR-ADM-09, FR-ADM-14; T-08, T-10, T-20, T-21, T-22.
- Builds: migrations for every table of `02-architecture.md` section 8; the policies of section 8.2; the functions and triggers of section 8.3; seed data with a sample course for local and staging; generated types; policy and trigger tests; the `db` job.
- Done when: policy tests cover every table and operation as anonymous, as a learner, as an admin at `aal1`, and as an admin at `aal2`; trigger tests show that a published lesson cannot be saved without validation, that a course cannot be published empty, that a completion's XP comes from the lesson whatever the caller sends, and that a lesson with completions cannot be deleted; every migration applies to an empty database in CI and to staging through the workflow.

**WP-2.2 Sign-in**
- Time box: 3.5 hours. Depends on: WP-1.4. Needs the `profiles` trigger of WP-2.1 before its pull request opens.
- Covers: FR-AUTH-01 to FR-AUTH-06, NFR-COMPAT-02; T-11.
- Builds: the server and browser database clients; session refresh in `proxy.ts` that fails open; the verified-claims helper; the server action wrapper with its tests; Google sign-in with the callback and return path validation; email code request and verification with the bot challenge; sign-out; in-app browser detection; the sign-in screen with every state; the account control in the header; the `e2e` job with the email code journey against the local mail catcher; the runbook for a sign-in or email outage.
- Done when: both methods work on the preview against staging; open redirect tests pass; the response is identical for a known and an unknown email; the learner returns to the page they came from; a request without a session cookie causes no call to the auth service (test).
- Owner: enter the Google client and the email sender in the auth provider's settings; set the email template to show a code; create the bot challenge keys; try the email code inside the TikTok and Instagram in-app browsers on production after the merge, because previews require a Vercel sign-in (ADR-0029).

**WP-2.3 The admin gate**
- Time box: 2.5 hours. Depends on: WP-2.1, WP-2.2.
- Covers: FR-ADM-01, FR-ADM-02, NFR-SEC-06; T-19, T-20.
- Builds: `/admin/setup` and `/admin/verify`; the server guard for every `/admin` layout; the not-found response for everyone else; the dashboard's first page, which lists courses and says so honestly when there are none; the runbooks for making the owner an admin and for a lost authenticator.
- Done when: J-12 passes: a guest and a learner get the not-found page at every `/admin` address, an admin at `aal1` is sent to verify and is refused by every content policy, and repeated wrong codes are limited; after verification the session is at `aal2` and the dashboard opens.
- Owner: sign in on production, add your admin row by the runbook, enroll your authenticator app.

Day 2 is done when: the owner signs in on production with Google and with an email code, is the only admin, and passes the second step; a stranger gets the not-found page; every table has passing policy tests.

### Day 3: Python in the browser

**WP-3.1 The Python worker**
- Time box: 3.5 hours. Depends on: WP-1.3.
- Covers: FR-RUN-01, 02, 03, 06, 07, NFR-SEC-01, NFR-PERF-04, NFR-REL-03, NFR-COMPAT-04, NFR-COST-01; T-01, T-02.
- Builds: a build script that copies the pinned Pyodide files to `/_runtime/pyodide/<version>/` with a size manifest; immutable caching for them; the module worker; schemas for every protocol message; the controller with the watchdog; output batching and the output cap; the network lock-down, including the prototype chain; the worker's own response policy; a development-only page that drives it.
- Done when: in Chromium, Firefox, and WebKit, output streams, `while True: pass` is stopped at the limit and the next run works, a print flood is capped, and a memory bomb recovers; from Python, `js.fetch` is unavailable and evaluating JavaScript is refused; the worker's policy is proven from inside the worker; the page policy works without `'wasm-unsafe-eval'`, or the engine that needs it is recorded; main-thread long tasks stay under 50 ms during a busy loop; the runtime size check is in `build`.

**WP-3.2 Live input**
- Time box: 2 hours. Depends on: WP-3.1. Can run beside: WP-3.3.
- Covers: FR-WSP-08, NFR-COMPAT-04.
- Builds: interactive input through stack switching; the batch fallback; capability detection at `ready`; waiting time left out of the time limit; end of input mapped to `input_ended`.
- Done when: a program that calls `input()` twice passes in three engines; with the capability removed, the batch path passes the same program; a ten second wait for input does not reach the time limit.

**WP-3.3 The grader**
- Time box: 3 hours. Depends on: WP-3.1.
- Covers: FR-GRD-01, FR-GRD-03, FR-GRD-04, FR-RUN-04, NFR-MAINT-02, NFR-PERF-06.
- Builds: the test case schema and limits; the comparison modes with property tests; the Python harness with follow-up code, isolation, builtins restore, and structured results; the Node runner for tests; `check` in the worker protocol; the parity suite.
- Done when: unit tests cover pass, fail, learner error, follow-up code error, and time limit; a run that deletes builtins does not affect the next; the example lesson in `04-content-system.md` section 7 gives the stated verdicts for its solution, starter, and wrong answer under Node and in three browser engines; coverage in `src/grader` meets the threshold.

**WP-3.4 The statechart and the phone check**
- Time box: 2 hours. Depends on: WP-3.2, WP-3.3.
- Covers: FR-WSP-07, FR-WSP-17, NFR-COMPAT-01, NFR-COMPAT-02.
- Builds: the workspace statechart in `src/runtime` with a test for every transition; the pending intent; a development-only page on the preview that runs a program with input, a check, and a runaway loop; a spike report from `docs/templates/spike-report.md`.
- Done when: every transition is tested; the owner has run the page on a real iPhone and a real Android phone, in the browser and inside the TikTok and Instagram in-app browsers, through a Vercel shareable link to the protected preview (whether Hobby offers one is checked in WP-1.3; if it does not, the owner decides how to reach the page before this package starts); `docs/reports/spikes/runtime-devices.md` records each device, engine version, input strategy, and result. A failure there is the first work of Day 4.
- Owner: the phone check.

Day 3 is done when: Python runs, takes input, is stopped, and is graded in three engines in CI and on the owner's phones.

### Day 4: The admin dashboard

**WP-4.1 Courses and chapters**
- Time box: 2.5 hours. Depends on: WP-2.3, WP-1.4. Can run beside: WP-4.2.
- Covers: FR-ADM-03, FR-ADM-09, FR-ADM-10, FR-ADM-11; T-20.
- Builds: the dashboard shell; the course list; the course editor with details, chapters, and Move up and Move down; statuses; the server actions for course structure; the cached queries for published content in `src/content` with their tag and its invalidation; every state.
- Done when: create, edit, reorder, and archive work; publishing a course with no published lesson is refused with the reason; each action called with a learner's session is refused; a stale save is refused; screenshots at 1280 px; `design-reviewer` approves.

**WP-4.2 The lesson editor**
- Time box: 3.5 hours. Depends on: WP-2.3, WP-1.4. Uses the seeded sample course.
- Covers: FR-ADM-04, FR-ADM-10, NFR-SEC-07; T-06.
- Builds: the Markdown renderer in `src/content` with its allowlist, code highlighting, and copy control; the single lesson-content component; the code editor component with the nonce; the lesson editor's Details, Instructions with live preview, hints, starter, solution, and wrong answers; saving a draft through `save_lesson`; the unsaved-changes warning; the refusal of a stale save.
- Done when: malicious Markdown fixtures are neutralized in the preview; the preview and the learner view are the same component; leaving with unsaved changes warns; a save over a newer version is refused; the editor's styles load with no policy violation.

**WP-4.3 Test cases, validation, publishing**
- Time box: 3.5 hours. Depends on: WP-4.1, WP-4.2, WP-3.4.
- Covers: FR-ADM-05, FR-ADM-06, FR-ADM-07, FR-ADM-09, FR-GRD-05; T-22.
- Builds: the test case list with add, edit, duplicate, reorder, delete; running the solution with a verdict per test case; "Fill from solution"; the checklist of `03-experience.md` section 7.6; publish, unpublish, archive; cache invalidation on change; the runbook for a published lesson that is wrong.
- Done when: J-13 passes; the publish path passes end to end; changing the test cases of a published lesson without a passing validation is refused by the database in a test that bypasses the interface; the limits of `04-content-system.md` section 2 give clear messages.
- Owner: create one real lesson on the preview and publish it.

Day 4 is done when: the owner can create a course, a chapter, and a validated, published lesson; a broken lesson cannot be published.

### Day 5: The learner experience

**WP-5.1 Home, course list, course page**
- Time box: 3 hours. Depends on: WP-4.1. Can run beside: WP-5.2.
- Covers: FR-LND-02, FR-LND-03, FR-CAT-01, FR-CAT-04, FR-CRS-01, FR-SEO-01, NFR-A11Y-05.
- Builds: the three pages from cached published content; honest empty states; titles, descriptions, canonical addresses, the sitemap, and indexing rules.
- Done when: only published content appears; counts equal the database; a page view with a warm cache makes no database query (test); sign-in, profile, and admin pages are excluded from indexing; screenshots; axe; the Delivery Gate report; `design-reviewer` approves.

**WP-5.2 The workspace on a laptop**
- Time box: 4 hours. Depends on: WP-3.4, WP-4.2.
- Covers: FR-WSP-01, 02, 03, 04, 05, 07, 08, 09, 10, 11, 12, 17, 22, FR-SYS-02, NFR-PERF-03, NFR-A11Y-03, NFR-A11Y-04; T-07.
- Builds: the lesson page; the panes; instructions; the editor; Run, Check, and Stop; the console with its input line and the batch field; the tests panel; the error component for every kind; hints; Python status; reset with undo; previous and next; shortcuts; the unsupported-browser message; saved code on the device.
- Done when: J-2, J-3, and J-4 pass on Chromium; a keyboard-only user can enter and leave the editor; live regions announce outcomes; with the runtime throttled the text is readable and the editor takes typing; injection payloads in output render as text; screenshots of every state; axe; the Delivery Gate report; `design-reviewer` approves.

**WP-5.3 The workspace on a phone**
- Time box: 2.5 hours. Depends on: WP-5.2. Can run beside: WP-5.4.
- Covers: FR-WSP-13, NFR-A11Y-05, NFR-A11Y-06, NFR-COMPAT-03; goal G-1.
- Builds: the three views; the action bar fixed above the on-screen keyboard; switching to Output on Run and Check; the full-width action from Lesson to Code.
- Done when: J-1 passes at 320, 375, and 430 px; screenshots; axe.
- Owner: complete a lesson on a real phone on the preview.

**WP-5.4 Progress on the device, and preview**
- Time box: 3 hours. Depends on: WP-5.2, WP-4.3.
- Covers: FR-PRG-01, FR-PRG-06, FR-WSP-06, FR-CAT-02, FR-CRS-02, FR-AUTH-07, FR-ADM-08, FR-ADM-11, NFR-REL-01, NFR-REL-02.
- Builds: the progress store with IndexedDB and a memory fallback; the completion moment; completion marks and action labels on the course list and course page; the invitation to save progress; the admin preview route, which uses the workspace and records nothing.
- Done when: completions and saved code survive a reload; with storage unavailable the notice appears; passing twice awards once; the preview records nothing and answers not-found to a learner; with the network cut after load, Run and Check still work and the completion is kept; J-8 passes from creating a lesson to a guest seeing it within a minute.
- Owner: time yourself writing and publishing one lesson (G-5).

Day 5 is done when: a guest on a phone opens a published lesson, runs, checks, passes, and still sees the progress after a reload.

### Day 6: Accounts, XP, and streak

**WP-6.1 Synced progress**
- Time box: 3 hours. Depends on: WP-5.4, WP-2.2.
- Covers: FR-PRG-02, FR-PRG-03, FR-PRG-06, FR-PRG-07, NFR-REL-01; T-08, T-10.
- Builds: `recordCompletion` and `mergeProgress`; the merge function in `src/domain` with property tests; sync on sign-in, on load, and when the tab becomes visible; progress rendered on the server for a signed-in learner; the unsynced state in the interface.
- Done when: J-5 and J-6 pass; merging twice changes nothing; a failed write is retried until stored; a completion for another user, or for a lesson that is not published, is refused.

**WP-6.2 XP and streak**
- Time box: 2 hours. Depends on: WP-6.1. Can run beside: WP-6.3.
- Covers: FR-PRG-04, FR-PRG-05, FR-CRS-05, NFR-MAINT-02.
- Builds: the streak function with property tests for day boundaries and daylight saving; XP totals; their display in the header, on the course page, and in the completion moment.
- Done when: the property tests pass; XP equals the sum of the learner's completion rows; a guest and an account with the same history show the same numbers; coverage in `src/domain` meets the threshold.

**WP-6.3 Profile, account deletion, legal pages**
- Time box: 3 hours. Depends on: WP-6.1.
- Covers: FR-PRF-01, FR-PRF-02, FR-PRF-03, FR-SYS-03, NFR-PRIV-01; T-17.
- Builds: the profile page with its states; display name editing; account deletion with a typed confirmation and a recent sign-in, using the privileged client in its one module; the privacy and terms pages, drafted from the data inventory of `06-security-privacy.md` section 7.1; the footer links.
- Done when: J-10 passes with database assertions on every table; lint proves the privileged client is imported in one place; the owner has approved the legal text in the pull request.
- Owner: read and approve the privacy and terms text.

**WP-6.4 Export and import**
- Time box: 2 hours. Depends on: WP-4.3. A Should package: fifth in the cut order.
- Covers: FR-ADM-12; T-23.
- Builds: course export to one JSON file; lesson import as a draft, in the format of `04-content-system.md` section 8.
- Done when: an exported lesson imports as an identical draft; import starts no run; a malformed file is refused and the field is named.

Day 6 is done when: a learner signs in, keeps progress across two devices, sees XP and streak, and can delete the account; the legal pages carry text the owner approved.

### Day 7: Hardening

**WP-7.1 Security pass**
- Time box: 3.5 hours. Can run beside: WP-7.2.
- Covers: NFR-SEC-01 to NFR-SEC-07, NFR-PRIV-01, FR-ADM-14, FR-AUTH-06; every threat in `06-security-privacy.md` section 4, with T-14 and T-21 built here.
- Builds: the canary test of T-21; the firewall rate limit rule and the Postgres counters of `07-operations.md` section 7; the auth provider settings check (redirect allow-list, code lifetime, limits, bot challenge on); the dependency audit and a secret scan over the whole history; the database provider's security advisor run against production; a whole-application review by `security-reviewer`; the fixes.
- Done when: every row of the threat table names a passing test or a recorded check; `pnpm infra:verify` passes against production; no blocker from the review is open.

**WP-7.2 Accessibility and performance pass**
- Time box: 3 hours.
- Covers: NFR-A11Y-01 to NFR-A11Y-08, NFR-PERF-01, NFR-PERF-03, NFR-PERF-06.
- Builds: axe on every screen and every workspace state in the end-to-end suite; the keyboard walkthrough; the reduced-motion check; Lighthouse mobile runs on the preview for the home, course list, and course pages; a load profile of the workspace on a throttled phone profile; the fixes.
- Done when: zero serious or critical axe findings; every number is in `docs/reports/day-7-quality.md` with the command that produced it; each miss has a fix or the owner's written waiver.

**WP-7.3 Operations**
- Time box: 2.5 hours. Can run beside: WP-7.4.
- Covers: NFR-OBS-01, NFR-OBS-02, NFR-OBS-04, NFR-REL-04, NFR-REL-05, NFR-PRIV-02, NFR-PRIV-03, NFR-COST-02; T-16.
- Builds: `/api/client-error` and the client reporter; tests on the logger's allowlist; analytics turned on; the nightly encrypted backup workflow of ADR-0030 with the `backup_reader` role, the committed recipient key check, provenance attestation, the heartbeat ping, and the one-line deletion email; tests that only `age` files are uploaded, that a failed connection prints no credential, and that the restore script refuses an artifact from any other run; the runbooks for restore (including where the backup key lives and how to rotate it), rotating a secret, a usage spike or a free-tier limit reached, and a deletion request by email; the verification script for the restore drill.
- Done when: the owner has done one rollback and one restore from the runbooks, the restore from a decrypted nightly backup on a separate machine without Claude Code, with `auth.users` counted and the plaintext destroyed afterwards, and the time each took is recorded; the backup workflow has run green on `main` at least once; the uptime check exists; usage notifications are on wherever a vendor offers them.
- Owner: create an `age` key pair, keep the private key offline, and give the public key; create the free heartbeat monitor; create the uptime check; turn on usage notifications; do the two drills.

**WP-7.4 Every journey on three engines**
- Time box: 2.5 hours.
- Covers: NFR-COMPAT-01, NFR-COMPAT-03, NFR-COMPAT-04; goals G-1 and G-3.
- Builds: the journey suite completed for J-1 to J-13 on Chromium, Firefox, and WebKit at phone and laptop sizes; the fixes.
- Done when: every journey is green on three engines on `main`; the owner's pass on real phones, including the in-app browsers, is recorded in `docs/reports/spikes/app-devices.md`.
- Owner: the phone pass on the production site.

**WP-7.5 Polish**
- Time box: 3 hours. Starts only when the four packages above are merged. Every item is a Should requirement.
- Covers: FR-LND-01, FR-WSP-23, FR-GRD-07, FR-WSP-21, FR-ADM-13.
- Builds, in this order, each complete or absent: the live editor on the home page; error explanations; near-miss messages; the symbol row; completion counts in the dashboard.
- Done when: each item built has its tests, states, screenshots, and Delivery Gate report; each item not built is named in the day report.

Day 7 is done when: the security, accessibility, performance, and operations results are recorded with evidence; rollback and restore have each been done once.

### Day 8: Lessons and launch

**WP-8.1 Production readiness**
- Time box: 2 hours.
- Covers: FR-SEO-01, NFR-SEC-02, NFR-COST-02, NFR-OBS-04; goal G-7.
- Builds: the final domain and DNS check; Google sign-in in production mode; the verified email sender; an audit of production environment variables against `.env.example`; `pnpm infra:verify` against the real domain; a whole-application review by `design-reviewer` with fresh screenshots and the antislop Delivery Gate on every screen; the fixes.
- Done when: sections 4.1 to 4.3 of the launch checklist are ticked, each with its evidence.

**WP-8.2 Launch lessons check**
- Time box: 1.5 hours, mostly the owner's.
- Covers: FR-GRD-05; goals G-2 and G-5.
- Builds: a report from the database listing every published lesson with its validation time, its number of test cases, and whether it has hints and a recorded wrong answer.
- Done when: the report shows every published lesson validated after its last change; the owner has passed each launch lesson himself on a phone on the production site.
- Owner: the read-through.

**WP-8.3 Launch**
- Time box: 1 hour.
- Covers: goal G-8.
- Builds: the go or no-go walk through section 4 with the owner; the `v1.0.0` tag; a watch of the first hours (uptime, client error reports, the sign-in log); `docs/reports/launch.md`; one issue for each item of `00-charter.md` section 4 the owner wants next.
- Done when: the owner says go; the site is live on the domain; nothing at S1 or S2 shows in the first-hours watch.

The rest of Day 8 is left empty on purpose. It is the slack for anything that slipped.

## 3. Risk register

Reviewed in every day check.

| ID | Risk | Response |
|---|---|---|
| RISK-01 | Python misbehaves in an in-app browser on a phone: no stack switching, tight memory. | The phone check on Day 3, before anything is built on the runtime. The batch input path. The unsupported-browser message. |
| RISK-02 | The email sender or Google sign-in is not ready, because domain verification takes time. | The owner starts both on Day 1. The email code is the path that matters most, since Google is blocked in in-app browsers. |
| RISK-03 | The script policy breaks a library: editor styles, overlays, the bot challenge. | The policy is enforced from Day 1, so a break shows the day it is introduced. The editor gets the nonce. |
| RISK-04 | Rendering every page per request is slow or costly when a video spreads. | Content comes from the data cache. A test proves a warm page view makes no database query. ADR-0028 names the trigger and the route to static pages. |
| RISK-05 | The owner's reviews become the bottleneck. | Pull requests sized for fifteen minutes. At most two sessions at once. The day check shows the queue. |
| RISK-06 | The lessons are not written by Day 8. | The dashboard exists from Day 4. A course can launch with one chapter. `04-content-system.md` section 9 has a starting outline. |
| RISK-07 | A day slips. | The cut order. The slack on Day 8. The owner decides anything beyond that. |
| RISK-08 | The owner is locked out of the dashboard, or someone else gets in. | The lost-authenticator runbook. Admin rights only by SQL. The second step enforced by the database. |
| RISK-09 | Validation is trusted from the owner's browser. | The database rule. Accepted in ADR-0026. Revisit before a second author. |
| RISK-10 | A framework or vendor behaves differently from this plan, because versions moved. | Every fact is dated in `09-evidence.md`. The implementer checks current documentation before first use and reports any difference. |
| RISK-11 | AI attribution reaches the repository anyway, for example from a session that ignores project settings. | Three layers: settings, hooks, and the pipeline check on every commit and pull request text. |
| RISK-12 | The privacy and terms text is wrong for the audience's law. | Plain text from the real data inventory, approved by the owner. A qualified review before any paid feature. |
| RISK-13 | A free-tier limit is reached after a video spreads, and the site or sign-in stops: Vercel Hobby waits up to 30 days, Supabase Free pauses, Resend stops at 100 emails a day. Vercel may also disable a Hobby project under its terms. | The triggers of ADR-0029, read in the morning review and in every day check. The owner accepted this risk on 2026-11-15. |

## 4. Launch checklist

The owner ticks each line. A line with no evidence is not ticked.

### 4.1 Product

- [ ] Every journey from J-1 to J-13 is green on three engines on `main`.
- [ ] The owner has completed a lesson on a real iPhone and a real Android phone, in the browser and inside the TikTok and Instagram in-app browsers.
- [ ] Every screen has passed the antislop Delivery Gate and the `design-reviewer`.
- [ ] No placeholder text, dead control, or invented number is on the site.

### 4.2 Security

- [ ] Every row of the threat table has a passing test or a recorded check.
- [ ] `pnpm infra:verify` passes against the real domain.
- [ ] The owner is the only row in `admins`, and his authenticator works.
- [ ] The auth provider's redirect allow-list has the real domain and no leftover addresses.
- [ ] No secret is in the repository history.
- [ ] The repository history has no AI attribution.

### 4.3 Operations

- [ ] The nightly encrypted backup ran green on `main`, and one of its backups was restored.
- [ ] One rollback and one restore have been done from the runbooks.
- [ ] The uptime check emails the owner when the health endpoint fails. It was tested once.
- [ ] Usage notifications are on wherever a vendor offers them, and every free-tier figure is below its ADR-0029 trigger.
- [ ] The firewall rate limit is on.

### 4.4 Lessons

- [ ] Every published lesson was validated after its last change.
- [ ] The owner has passed every launch lesson himself.
- [ ] The first chapter has at least three lessons.

### 4.5 The owner

- [ ] The privacy and terms pages carry text the owner approved.
- [ ] Google sign-in is in production mode and the email sender's domain is verified.
- [ ] The owner knows where the runbooks are and has opened each one.

## 5. After the first release

The designs for what waits are in `docs/later/full-plan/`. A suggested order, to be decided by what learners do in the first two weeks:

1. What learners ask for first: showing the solution, lesson reports, the lesson outline.
2. Formal service objectives and alerts, set from two weeks of real numbers.
3. The HTML and CSS course with its sandbox (archived architecture section 6, ADR-0006).
4. A legal review, then the paid tier (ADR-0018).
5. Static public pages with a hash-based script policy, when the trigger in ADR-0028 is met.

Each starts with an ADR that says what changes in this spec.
