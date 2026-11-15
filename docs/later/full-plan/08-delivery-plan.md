> Archived. Not in force. This file belongs to the original ten-phase plan and is kept for work after the first release. Do not build from it unless the owner says so. The plan in force is in `docs/spec/`.

# 08 Delivery Plan

Ten phases. Each phase ends at a gate the owner approves. Each work package (WP) is one issue, one branch, and normally one pull request, run with `/work-package <id>` under the lifecycle in `05-engineering-handbook.md` section 3. A gate is run with `/phase-gate <n>`.

The order is risk-first: the pipeline before the product, the unproven parts before the parts built on them, and a usable product as early as possible.

## 1. Shape of the plan

| Phase | Outcome | Product state at the gate |
|---|---|---|
| 0 Inception | Decisions agreed, design direction signed, guardrails on | No code |
| 1 Foundation | A real page reaches production through every gate | Skeleton live, access-protected |
| 2 Risk burn-down | The risky decisions are proven or changed | Spike reports, baselines |
| 3 Design system | Tokens, primitives, shell | Styled shell on preview |
| 4 Content and graders | Lessons can be written and trusted | Pilot lessons pass checks |
| 5 Learning experience | A guest can learn end to end | **Usable without accounts** |
| 6 Identity and persistence | Accounts, sync, profile | **Feature-complete for an open launch** |
| 7 Access tiers | Paid tier can be switched on | Tiered mode proven on staging |
| 8 Hardening | Observable, secure, fast, accessible, recoverable | Launch candidate |
| 9 Launch | Content complete, beta done, live | 1.0.0 |

Phase 7 may be scheduled after launch without rework, because launch is in open mode and the seams it needs are built in Phases 4 to 6. Until Phase 7 ships, `content:check` rejects any lesson marked `access: paid`.

Production is access-protected (hosting provider deployment protection) from Phase 1 until the launch decision in WP-9.4.

Lesson production (the content track, `04-content-system.md` section 10) runs alongside from Phase 4.

## 2. Work packages

Notation: **Builds** is the deliverable. **Done when** is the acceptance beyond the handbook's Definition of Done. **Owner** is what only the owner can do.

### Phase 0: Inception

Goal: agree, direct, and constrain before building. No product code.

**WP-0.1 Repository and tracker**
- Builds: private repository with the kit committed unchanged; labels; one milestone per phase; one issue per WP generated from this file; `docs/TECH_DEBT.md` and `docs/DEPENDENCIES.md` with headers and no entries.
- Done when: every WP below has an issue that links to its section; a checksum list of the kit files is recorded so later spec changes are visible; the commits and the pull request of this WP carry no AI attribution (the pull request shows `git log --format=fuller` for its range).
- Owner: create the private repository; sign in to the GitHub CLI.

**WP-0.2 Guardrails**
- Builds: the kit's `.claude/settings.json`, which already turns attribution off, extended with a deny list and blocking hooks (handbook section 2) and an allow list for routine project commands so sessions are not interrupted by prompts; `scripts/check-attribution.mjs` with its own tests, called by the attribution hook (handbook section 4.1); confirmation that the rules, subagents, and skills in `.claude/` load; confirmation that antislop is installed with its pointer block and resolves to `during` mode.
- Done when: `docs/reports/guardrails.md` shows each of these attempted and blocked: reading a `.env` file, force push, push to `main`, skipping Git hooks, a commit whose message has a Claude co-author trailer, a pull request whose description says it was generated with Claude Code. It also shows one subagent invoked and one skill invoked.
- Owner: run the antislop installer before this WP (see `START-HERE.md`).

**WP-0.3 Decisions review**
- Builds: a walkthrough with the owner of assumptions A-01 to A-12 and ADR-0001 to ADR-0021, one decision at a time, each with the recommendation and what changes if the owner chooses otherwise.
- Done when: every ADR is Accepted or amended; changed assumptions are reflected in the spec through a `spec-change` pull request; no open question remains unassigned. From here on, every gate checks that each architectural decision has an ADR (NFR-MAINT-07).

**WP-0.4 Design direction**
- Builds: brand intake from `/brand`; the antislop direction interview, using `03-experience.md` section 9 as the starting proposal; `DESIGN.md` written from the owner's answers (identity, personality, palette, typography, mood, dials, icon decision, signature element decision); a token draft with a contrast table computed by the contrast checker.
- Done when: the owner has signed `DESIGN.md`; every text and surface pair in the token draft meets AA; anything in the brand kit that collides with an antislop rule was named and decided by the owner (antislop R-37).
- Owner: place the brand kit in `/brand`; answer the interview.

**Gate 0.** ADRs accepted. `DESIGN.md` signed. Guardrails demonstrated. Issues exist.

### Phase 1: Foundation

Goal: a walking skeleton. One real page travels the whole path to production with every gate active.

**WP-1.1 Workspace and toolchain**
- Builds: pnpm workspace and task runner; the package skeletons of `02-architecture.md` section 4 with `exports` maps; strict TypeScript; lint rules including dependency boundaries, accessibility, no inline user-facing strings, logical properties only, no raw design values; formatter; test presets; dead-code check; Git hooks, including a commit-message hook that runs the attribution check; commit lint; `pnpm verify`; the Claude Code post-edit hook that formats and lints the edited file, and the stop hook that runs `pnpm verify`.
- Done when: each rule has a fixture that violates it and a test showing the check fails on that fixture. Refs: NFR-MAINT-01, NFR-MAINT-04, NFR-MAINT-05; NFR-I18N-01, NFR-I18N-02.

**WP-1.2 Pipeline and repository policy**
- Builds: the pull request workflow (`static`, `unit`, `build` to start) with path filter, caches, pinned actions, least-privilege permissions, timeouts, and the attribution check in `static`, re-run when a pull request's title or description is edited; scheduled workflow skeleton; update bot; pull request and issue templates; branch protection; release tooling.
- Done when: a pull request with a failing required check cannot be merged; a pull request with AI attribution in a commit or in its description fails `static`; the attribution check run once over the whole history of `main` finds nothing; pipeline duration is recorded as the baseline for NFR-MAINT-06.
- Owner: apply branch protection (needs a paid plan, E-14).

**WP-1.3 Application skeleton**
- Builds: the Next.js app with locale-ready routing for one locale; environment schema; message catalog; root layout with landmarks; error and not-found pages; `/api/health` and `/api/ready`; the API handler wrapper (schemas, problem responses, request ID, same-origin check); OpenAPI generation and drift check; structured logging; telemetry ports with console and no-op adapters; security headers with the content security policy in report-only mode.
- Done when: FR-SYS-01, FR-SYS-04, NFR-OBS-01, NFR-I18N-03, NFR-I18N-04 have passing tests; a missing environment variable stops the build with its name.

**WP-1.4 Environments and delivery**
- Builds: Supabase local stack, staging project, production project; a baseline migration; the hosting project with preview deployments; the ordered deploy workflow of `07-operations.md` section 3 with smoke suite and automatic rollback; deployment protection on production; `pnpm infra:verify`; runbooks for infrastructure setup and for deploy and roll back.
- Done when: a merge deploys to staging then production in order; a deliberately failing smoke test triggers rollback.
- Owner: create the hosting and database projects; add secrets to the CI production environment only.

**WP-1.5 Test platform**
- Builds: Playwright projects for Chromium, Firefox, WebKit, and two phone profiles; axe fixture; console-error guard; visual comparison in a pinned container; coverage gates; `pnpm trace`; Lighthouse CI and bundle budget checks wired as required checks.
- Done when: the smoke suite runs on a preview deployment; coverage thresholds fail the pipeline when missed (NFR-MAINT-02); the traceability report generates; a rollback drill is performed from the runbook and timed (NFR-REL-04).

**Gate 1.** Skeleton live and protected. Every gate demonstrably blocks. Rollback drilled within target.

### Phase 2: Risk burn-down

Goal: prove or change the risky decisions inside the real codebase. Spike code lives in `spikes/` and is deleted or promoted at the gate. Each spike ends with a report in `docs/reports/spikes/` (question, method, measurements, decision) and an updated ADR. The prototypes in `09-evidence.md` are the starting point; they covered Chromium only.

**WP-2.1 Python runtime**
- Proves: module worker through the app's bundler; self-hosted assets with immutable caching; interactive input by stack switching on Chromium, Firefox, and WebKit; the batch fallback with the capability removed; terminate and respawn; warm spare; network lock-down including prototype-chain recovery attempts; worker response policy; real download progress.
- Measures: cold and warm time to ready on throttled profiles and on real phones; memory on a low-end profile.
- Decides: ADR-0004, ADR-0005. Updates RISK-01, RISK-02, RISK-12.
- Owner: run the spike page on a real iPhone and a real Android phone.

**WP-2.2 Web sandbox**
- Proves: the sandbox document under real hosting headers in three engines; the containment matrix; whether resource policy headers block the sandbox's own script; a rendering technique that preserves document structure; feasibility of live preview.
- Decides: ADR-0006.

**WP-2.3 Grader parity**
- Proves: one harness skeleton giving identical verdicts for a fixture set of at least twenty programs on CPython, Pyodide under Node, and three browsers; determinism with seeded randomness; timing.
- Decides: feasibility of FR-GRD-04; the fixture set becomes the seed of the parity suite.

**WP-2.4 Editor on real devices**
- Proves: CodeMirror 6 in the app on iOS Safari, Android Chrome, and the TikTok and Instagram in-app browsers; on-screen keyboard behavior with the fixed action bar and symbol row; keyboard escape; a screen reader smoke test.
- Decides: ADR-0013. Updates RISK-03, RISK-13.
- Owner: device testing.

**WP-2.5 Rendering, caching, and script policy**
- Proves: a static free lesson and a gated paid lesson in the current framework version; the canary leak test; the script policy options of `06-security-privacy.md` section 5.2; cache headers as served by the hosting provider.
- Decides: ADR-0021, and confirms ADR-0018.

**WP-2.6 Sign-in**
- Proves: Google and email code against staging, including from preview URLs; the custom email sender; the bot challenge; behavior inside in-app browsers on real devices.
- Decides: ADR-0017.
- Owner: create the Google client, the email provider account, and the bot challenge keys; device testing.

**Gate 2.** Every ADR touched is Accepted or amended with evidence. Baselines for NFR-PERF-04, NFR-PERF-05, NFR-PERF-06 recorded. Risk register updated. Go or no-go on the architecture.

### Phase 3: Design system and shell

Goal: the visual language as code, proven accessible, before any feature screen.

**WP-3.1 Tokens and theme contract**
- Builds: three-tier tokens from `DESIGN.md`; self-hosted, subset fonts; the syntax highlighting palette; an automated contrast test over every declared text and surface pair; the lint rule against raw values.
- Done when: NFR-A11Y-07 has a passing automated test.

**WP-3.2 Primitives, general**
- Builds: button, link, text field, one-time-code field, tabs, dialog, drawer, tooltip, menu, toast, progress bar, skeleton, callout, status label, keyboard key, skip link. Each with every state, stories, component tests, and axe.
- Done when: every primitive is operable by keyboard alone, has a visible focus state, meets the touch target size, and is still under reduced motion. Refs: NFR-A11Y-02, NFR-A11Y-03, NFR-A11Y-06, NFR-A11Y-08.

**WP-3.3 Primitives, workspace**
- Builds: split pane, code block with copy, console, test list, error panel, empty state, outline list, view switcher, symbol row, and the progress glyph if the owner approved the signature element.
- Done when: the split pane meets the window splitter pattern by keyboard; the console and test list announce through live regions. Refs: FR-WSP-01; NFR-A11Y-04.

**WP-3.4 Shell and system pages**
- Builds: header, navigation, footer, site notice region, not-found, error, unsupported browser. All copy in catalogs.
- Done when: FR-SYS-01, FR-SYS-02 pass; responsive from 320 to 2560 px.

**WP-3.5 Stories as gates**
- Builds: all stories running in CI with axe and visual comparison; the Delivery Gate report for the shell.
- Done when: the Delivery Gate is all PASS with evidence.

**Gate 3.** The owner approves the look on a phone and a laptop from the preview. Delivery Gate passes.

### Phase 4: Content system and graders

Goal: lessons can be written quickly and a pass can be trusted.

**WP-4.1 Schemas, registry, loader**
- Builds: schemas for every content file; the append-only registry and its CI check; the manifest; error messages that name file and field. Refs: FR-CNT-01, FR-CNT-02, FR-CNT-03.

**WP-4.2 Markdown pipeline**
- Builds: the allowed syntax, directives, sanitizer, and build-time highlighting; one component that renders lesson HTML.
- Done when: the malicious fixture lessons for T-06 are neutralized in build output. Refs: FR-WSP-02.

**WP-4.3 Python harness**
- Builds, test-first on CPython: every test kind, comparison mode, near-miss classification, run isolation, structured errors; the Node runner; the parity suite in CI.
- Done when: FR-GRD-01, FR-GRD-03, FR-GRD-04, FR-GRD-06 and FR-RUN-04 pass; branch coverage 95 percent; mutation score meets NFR-MAINT-03 for comparison code.

**WP-4.4 Web harness**
- Builds: `dom`, `style`, `source`, and `custom` kinds; integration with the sandbox; tests in three engines.
- Done when: FR-GRD-02 passes.

**WP-4.5 Content commands**
- Builds: `content:new`, `content:check`, `content:lint`, `content:sync`, `content:stats`; their CI jobs; the runbook for a published lesson whose tests are wrong.
- Done when: FR-CNT-04 to FR-CNT-07 and FR-GRD-05 pass; a deliberately broken solution fails CI.

**WP-4.6 Curriculum and pilot content**
- Builds: the curriculum, edited from the proposal by the owner; the pilot lessons of `04-content-system.md` section 9.3 as drafts; `content-editor` reviews.
- Done when: the owner has approved each pilot lesson on a preview.
- Owner: curriculum decisions; lesson review.

**WP-4.7 Authoring guide**
- Builds: `docs/AUTHORING.md`; the `/author-lesson` procedure verified.
- Done when: a new lesson is authored from the guide alone and timed against G-5.

**Gate 4.** Pilot content passes every check including wrong answers. Harness thresholds met. Authoring time measured.

### Phase 5: Learning experience

Goal: a guest can learn end to end on a phone and a laptop. No accounts yet.

**WP-5.1 Catalog and course pages**
- Builds: `/courses` and `/courses/[course]` from the manifest; unlock rules in `domain` with property tests; all row states. Refs: FR-CAT-01, FR-CAT-02, FR-CAT-04; FR-CRS-01 to FR-CRS-05.

**WP-5.2 Workspace frame**
- Builds: the workspace layout at every width; instructions rendering; editor with file tabs; outline drawer; previous and next; the three phone views. Run and Check controls are not rendered until WP-5.4 makes them work.
- Refs: FR-WSP-01, FR-WSP-02, FR-WSP-03, FR-WSP-11, FR-WSP-13.

**WP-5.3 Runner package**
- Builds: protocol schemas; Python client; watchdog; input strategies; error mapping; the statechart with a test for every transition; the worker entry in the app.
- Refs: FR-RUN-01, FR-RUN-02, FR-RUN-03, FR-RUN-06, FR-RUN-07; ADR-0020.

**WP-5.4 Python lessons end to end**
- Builds: Run, Console, input, Stop, Check, Tests panel, error panel, completion moment, runtime status.
- Done when: J-2, J-3, J-4 pass; once the runtime is cached, Run and Check make no network request (NFR-COST-01). Refs: FR-WSP-04 to FR-WSP-09, FR-WSP-17.

**WP-5.5 Web lessons end to end**
- Builds: sandbox client; Preview; Tests; containment notes; live preview if WP-2.2 found it feasible.
- Done when: J-7 passes; T-03, T-04, T-05 tests pass. Refs: FR-RUN-05; FR-WSP-19, FR-WSP-20.

**WP-5.6 Guest progress**
- Builds: the `ProgressStore` port; the browser adapter with memory fallback; drafts with autosave, restore, reset, and undo; completions; active days; XP and streak from `domain`; progress on catalog and course pages; the resume row.
- Refs: FR-PRG-01, FR-PRG-04, FR-PRG-05; FR-WSP-10; FR-CAT-03. If time allows, editor preferences per device (FR-WSP-18).

**WP-5.7 Help, keyboard, and focus**
- Builds: progressive hints; solution reveal on the static path; shortcut sheet; validated key bindings; focus management; live region announcements; the manual screen reader script, version 1.
- Refs: FR-WSP-12, FR-WSP-14, FR-WSP-16; NFR-A11Y-03, NFR-A11Y-04.

**WP-5.8 Landing page**
- Builds: the landing page of `03-experience.md` section 5.1 with the live editor.
- Done when: FR-LND-01 to FR-LND-03 pass; Delivery Gate passes.

**WP-5.9 Journeys, budgets, resilience**
- Builds: J-1 and J-11; runtime loading under throttling; unsupported browser handling; performance budgets enforced; the runbook for unreachable runtime assets.
- Refs: NFR-PERF-01 to NFR-PERF-06; NFR-REL-02, NFR-REL-03; NFR-COMPAT-01, NFR-COMPAT-03, NFR-COMPAT-04.

**Gate 5.** The owner completes the pilot lessons on a phone and a laptop. First pass of the device matrix (`01-requirements.md` section 4.3). The owner decides the launch content scope using `content:stats`.

### Phase 6: Identity, persistence, API

Goal: accounts and progress that follows the learner.

**WP-6.1 Schema, policies, tests**
- Builds: migrations for every table in `02-architecture.md` section 10; row level security; pgTAP tests for every table and operation; seed data; generated types; a schema snapshot test. Refs: NFR-SEC-03; T-08.

**WP-6.2 API in use**
- Builds: `me` and progress read endpoints; the typed client and query cache; rate limit classes; contract tests; request IDs visible end to end.
- Done when: the OpenAPI drift check and contract tests pass; a request ID shown in the browser can be found in the server log; a request over its limit is refused. Refs: NFR-OBS-01; T-14; ADR-0010.

**WP-6.3 Sign-in**
- Builds: Google and email code flows and views; return path validation; in-app browser handling; bot challenge; session refresh; sign out; runbooks for provider outage and secret rotation.
- Done when: FR-AUTH-01 to FR-AUTH-07 and FR-LND-04 pass; every T-11 test passes.

**WP-6.4 Account progress and sync**
- Builds: the account adapter; the outbox; optimistic updates; the sync region; drafts on the server.
- Done when: J-6 passes; failure-injection tests prove NFR-REL-01. Refs: FR-PRG-02, FR-PRG-06.

**WP-6.5 Guest merge**
- Builds: the merge use case and endpoint; clearing the guest store only after success.
- Done when: J-5 passes; property tests prove idempotence. Refs: FR-PRG-03.

**WP-6.6 Profile, XP, streak**
- Builds: `/profile`; display name; time zone; derived XP and streak on the server.
- Done when: FR-PRF-01, FR-PRF-02 pass; streak property tests cover day boundaries, zone changes, and daylight saving.

**WP-6.7 Deletion and export**
- Done when: J-10 passes with database assertions; FR-PRF-03, FR-PRF-04; T-17.

**WP-6.8 Catalog in the pipeline**
- Builds: `content:sync` in the deploy workflow; retirement; redirects for previous slugs; runbooks for a failed migration and for a paused or unavailable database.
- Refs: FR-CNT-07, FR-CNT-08; FR-PRG-07.

**WP-6.9 Lesson feedback**
- Builds: the report form and endpoint; storage; a documented query for the operator. Refs: FR-FBK-01; FR-WSP-15.

**Gate 6.** All journeys except J-9 pass on the full browser matrix. The product is feature-complete for an open launch.

### Phase 7: Access tiers

May run after launch (see section 1).

**WP-7.1 Policy and entitlements**
- Builds: tier resolution; the entitlements repository; the operator grant and revoke script. Refs: FR-ACC-01, FR-ACC-02, FR-ACC-05.

**WP-7.2 Gated delivery**
- Builds: payload and solution endpoints; exclusion of paid material from static output; the canary leak test as a required check; cache headers.
- Done when: T-09 passes. Refs: FR-ACC-03.

**WP-7.3 Locked experience**
- Done when: J-9 passes. Refs: FR-ACC-04; FR-CRS-04.

**WP-7.4 Entitlement webhook**
- Builds: a signed, replay-protected endpoint, disabled by default, with its contract documented for a future membership integration. Refs: FR-ACC-06.

**Gate 7.** With tiered mode on staging, no guest or free session can obtain paid material by any route. Production stays open.

### Phase 8: Hardening

Goal: a launch candidate that can be watched, defended, and recovered.

**WP-8.1 Observability.** Vendor adapters behind the ports, proxied first-party; the full event taxonomy; real-user performance; dashboards for the success measures and service levels; alerts, including spend alerts at every paid vendor. Refs: NFR-OBS-02 to NFR-OBS-04; NFR-PERF-07; NFR-COST-02.

**WP-8.2 Security.** Enforced content security policy per ADR-0021; all headers; edge rate limits; clean scanners; a check that every threat T-01 to T-18 has a passing test or a named manual control; a baseline dynamic scan of staging; a bill of materials. Refs: NFR-SEC-01 to NFR-SEC-05.

**WP-8.3 Performance.** Budgets confirmed on real devices; preload on intent; font and image audit; bundle review; the API load test of `07-operations.md` section 10; scale triggers confirmed against measured usage (NFR-COST-03).

**WP-8.4 Accessibility.** axe across every state; the manual script with VoiceOver and NVDA; zoom and reflow; fixes. Refs: NFR-A11Y-01 to NFR-A11Y-08.

**WP-8.5 Discovery.** Titles, descriptions, canonical URLs, sitemap, robots rules, structured data, share images from the brand template. Refs: FR-SEO-01, FR-SEO-02.

**WP-8.6 Privacy and legal.** The data inventory checked against the code; drafts of the privacy policy and terms; the pages; the questions of `06-security-privacy.md` section 8 answered by the legal reviewer. Refs: FR-SYS-03; NFR-PRIV-01 to NFR-PRIV-03. Owner: arrange the legal review.

**WP-8.7 Recovery.** The backup job; a restore drill; the site notice mechanism (chosen here and recorded in an ADR: it must work without a code deploy and while the database is down); the remaining runbooks; a tabletop incident exercise. Refs: NFR-REL-05; FR-SYS-05.

**WP-8.8 antislop audit.** antislop in `after` mode across the whole product; the numbered findings file; the owner chooses what to fix; fixes and the follow-up report.

**Gate 8.** Every quality gate in the handbook is green, including the nightly and manual ones. Restore, rollback, and site notice each done once by the owner from the runbook.

### Phase 9: Launch

**WP-9.1 Launch content.** Every lesson in the launch scope is published.

**WP-9.2 Closed beta.** A small invited group from the community uses the protected production site for at least a week. Feedback is triaged; every S1 and S2 is fixed. Owner: invitations.

**WP-9.3 Device and browser sign-off.** The device matrix of `01-requirements.md` section 4.3 completed on real devices, including the TikTok and Instagram in-app browsers (NFR-COMPAT-02). Owner: testing.

**WP-9.4 Go or no-go.** The checklist in section 4, reviewed line by line with evidence.

**WP-9.5 Launch and first week.** Remove deployment protection; tag `1.0.0`; watch dashboards daily; use the hotfix path for anything urgent.

**WP-9.6 Review.** A retrospective; proposed targets in the charter and operations documents replaced with measured ones in an ADR; the backlog for 1.1.

## 3. Risk register

Reviewed at every gate. Probability and impact are low, medium, or high.

| ID | Risk | P | I | Response | Addressed in |
|---|---|---|---|---|---|
| RISK-01 | Interactive input behaves differently or is missing outside Chromium, or on older iOS. | M | M | Batch fallback is a first-class path with its own tests. | WP-2.1 |
| RISK-02 | The 5.5 MB runtime feels slow on mobile data and learners leave. | M | H | Lesson and editor usable first; real progress; preload on intent; caching; measure and set a target. | WP-2.1, WP-5.9, WP-8.3 |
| RISK-03 | In-app browsers: Google sign-in blocked, storage cleared, quirks. | H | H | Email code; guest mode; real-device tests; early save prompt. | WP-2.4, WP-2.6, WP-9.3 |
| RISK-04 | Content takes longer than code. | H | H | Content track from Phase 4; pilot first; launch scope decided with real numbers at Gate 5. | WP-4.6, WP-9.1 |
| RISK-05 | Graders pass wrong code or fail right code. | M | H | Wrong-answer fixtures; parity suite; mutation testing; near-miss messages; feedback channel. | WP-4.3, WP-4.4, WP-4.5, WP-6.9 |
| RISK-06 | The implementer produces plausible but wrong work, or drifts from the spec. | H | H | Three layers of enforcement; test-first; independent reviewers; evidence rule; small WPs; gates. | All |
| RISK-07 | The plan is too large for one owner's review time. | M | H | Usable product at Gate 5; Phase 7 deferrable; fifteen-minute pull requests. | Section 1 |
| RISK-08 | Vendor terms and limits bite at the wrong moment. | M | M | Verified limits; spend alerts; scale triggers; paid plans where terms require them. | WP-1.4, WP-8.1 |
| RISK-09 | Paid material leaks when tiers are switched on. | L | H | Never-static invariant; canary test as a required check. | WP-2.5, WP-7.2 |
| RISK-10 | Privacy or legal exposure, including minors. | M | H | Data minimization; legal review before launch. | WP-8.6 |
| RISK-11 | A major framework or runtime release breaks the build mid-project. | M | M | Pinned versions; weekly grouped updates; adapters at the boundaries. | WP-1.2 |
| RISK-12 | Mobile browsers end the tab under memory pressure. | M | M | No warm spare on low-memory devices; measure; recover and say what happened. | WP-2.1, WP-5.9 |
| RISK-13 | Writing code on a phone is unpleasant. | H | M | Symbol row; large targets; honest hint that a laptop is easier; account sync so a learner can switch devices. | WP-2.4, WP-5.2 |
| RISK-14 | Guests lose progress when browser storage is cleared. | M | M | Save prompt after the first completion; clear wording that progress is on this device. | WP-5.6, WP-6.5 |

## 4. Launch checklist

Each line needs evidence, not a tick.

**Product**
- [ ] Journeys J-1 to J-8, J-10, J-11 pass on the full matrix. J-9 if tiers are launching.
- [ ] Every Must requirement has a passing test in the traceability report.
- [ ] The antislop audit follow-up report shows the owner's chosen fixes done.

**Quality**
- [ ] All required, nightly, and manual gates green for three consecutive days.
- [ ] No open S1 or S2 defect. No quarantined test without the owner's sign-off.

**Security and privacy**
- [ ] Every threat T-01 to T-18 has a passing test or a named manual control.
- [ ] Content security policy enforced. Scanners clean.
- [ ] Privacy policy and terms reviewed by the legal reviewer and published.
- [ ] Residual risks signed by the owner.

**Operations**
- [ ] Dashboards and alerts live; a test alert reached the owner's phone.
- [ ] Rollback, restore, and site notice each performed once from the runbook.
- [ ] Custom email sender configured; sign-in limits and bot challenge on.
- [ ] Spend alerts set at every paid vendor. Production database on a plan that does not pause.
- [ ] Load test passed with headroom.

**Content**
- [ ] Every launch lesson published, with `content:check` and the owner's approval.
- [ ] Lesson feedback reaches the owner.

**Devices**
- [ ] Sign-off on real iPhone and Android, in Safari, Chrome, and the TikTok and Instagram in-app browsers.

## 5. After 1.0

Candidates, none committed: quick-check quizzes after each chapter; Arabic interface; light theme; JavaScript course; Skool entitlement sync; verified grading for competitions and certificates; chapter badges; a free-form playground.
