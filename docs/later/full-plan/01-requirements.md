> Archived. Not in force. This file belongs to the original ten-phase plan and is kept for work after the first release. Do not build from it unless the owner says so. The plan in force is in `docs/spec/`.

# 01 Requirements

Every requirement has a stable ID. Tests cite the IDs they verify (see `05-engineering-handbook.md` section 8.6). Priority uses MoSCoW: **M** must, **S** should, **C** could. Nothing ships as a stub: a requirement is either fully met or absent.

## 1. People

| ID | Persona | Situation | Needs |
|---|---|---|---|
| P-1 | First-timer | Saw a Heap video. On a phone, inside the TikTok or Instagram in-app browser. Has never written code. Reads English as a second language. | To run something real in under a minute without signing up. Plain words. Big touch targets. |
| P-2 | Returning learner | On a laptop in the evening. Has an account. | To land on the exact lesson they left, with their code intact. |
| P-3 | Jumper | Knows the basics from school. | To skip ahead to a later chapter and to challenges. |
| P-4 | Author | The owner today, a hired teacher later. Works in the repository. | To add or fix a lesson quickly and know it is solvable before it ships. |
| P-5 | Operator | The owner. | To see whether the product is healthy, what it costs, and what learners struggle with. |

## 2. Journeys

Each journey is an end-to-end test suite in `e2e/journeys/`.

| ID | Journey | Steps |
|---|---|---|
| J-1 | Video to first Run | Open `/` on a phone as a guest. Tap Run on the live snippet. See output. Tap through to lesson 1. Lesson text is readable at once; the editor accepts input before the runtime is ready. |
| J-2 | Complete a guided lesson | Read. Type. Run. Read output. Check. See a failing test with expected and actual. Fix. Check. Pass. See the completion moment. Go to the next lesson. |
| J-3 | Program that asks for input | Run code that calls `input()` twice. Answer each prompt in the console. See the final output. |
| J-4 | Runaway code | Run `while True: pass`. Press Stop, or wait for the time limit. The page never freezes. The runtime restarts. The next Run works. |
| J-5 | Save my progress | As a guest with completions, sign in with an email code. Local progress appears in the account. Nothing is duplicated or lost. |
| J-6 | Another device | Sign in on a second browser. See the same completions, XP, streak, and drafts. |
| J-7 | Web lesson | Edit HTML and CSS in two tabs. See the preview. Check. A style test fails with the computed value shown. Fix. Pass. |
| J-8 | Author adds a lesson | Run `content:new`. Write the lesson, solution, tests, and a wrong answer. `content:check` passes locally and in CI. The lesson appears in a preview deployment as a draft. |
| J-9 | Locked lesson (tiered mode) | As a free learner open a paid lesson by URL. See what unlocks it. The lesson payload is not present in the response. |
| J-10 | Delete my account | Confirm by typing. Sign in again to confirm identity. All personal data is gone; the session ends. |
| J-11 | Backend outage | With the API unreachable, open a lesson, run, and pass it as a guest. A banner says progress is saved on this device. When the API returns, signed-in progress syncs. |

## 3. Functional requirements

### 3.1 Landing (LND)

| ID | P | Requirement | Acceptance |
|---|---|---|---|
| FR-LND-01 | M | The signed-out home page states what the product is in one sentence and shows a real editor with a short Python program that runs with the production runner. | Run produces output from the real runtime. No screenshot, video, or fake terminal stands in for it. |
| FR-LND-02 | M | The home page lists the published courses with real lesson counts and links into lesson 1 of each. | Counts equal the content manifest. |
| FR-LND-03 | M | The home page contains no statistic, testimonial, logo wall, or claim without a real source. | antislop Hard Gate items R-17, R-18, R-36, R-38 pass. |
| FR-LND-04 | M | A signed-in visitor to `/` is taken to `/courses`. | Redirect is server-side. |

### 3.2 Catalog (CAT)

| ID | P | Requirement | Acceptance |
|---|---|---|---|
| FR-CAT-01 | M | `/courses` lists published courses: title, one-line description, level, lesson count, estimated time. | Data comes from content files only. |
| FR-CAT-02 | M | Each course shows the viewer's progress and one primary action whose label matches state: begin, continue (deep link to the next incomplete lesson), or review. | Label and target are correct for 0 percent, partial, and 100 percent. |
| FR-CAT-03 | S | Viewers with progress see a resume row above the list for the most recently opened lesson. | Hidden when there is no progress. |
| FR-CAT-04 | M | A course with no published lesson is not listed. | No placeholder cards. |

### 3.3 Course page (CRS)

| ID | P | Requirement | Acceptance |
|---|---|---|---|
| FR-CRS-01 | M | `/courses/[course]` shows the course intro, what the learner will be able to do, and every chapter in order with its lessons. | Order equals the manifest. |
| FR-CRS-02 | M | Each lesson row shows its kind, XP, and one state: completed, current, available, locked by order, or locked by tier. State is conveyed by text and icon, not color alone. | All five states render and are announced to assistive technology. |
| FR-CRS-03 | M | Unlock policy per course: `chapter-open` (default; the first lesson of each chapter is available, later lessons unlock in order, challenges and the build unlock after the chapter's guided lessons) or `linear`. | Rules are a pure function with full unit coverage. |
| FR-CRS-04 | M | A locked row says what unlocks it. Opening a locked lesson by URL shows the same explanation and a link to the lesson that unlocks it. | No dead end. |
| FR-CRS-05 | S | A progress summary shows lessons completed, XP earned of total, and chapters completed. | Values equal derived progress. |

### 3.4 Workspace (WSP)

| ID | P | Requirement | Acceptance |
|---|---|---|---|
| FR-WSP-01 | M | At 768 px and wider the workspace has an instructions pane and a work pane (editor above output). Dividers resize by pointer and keyboard; sizes persist per device. | Splitters meet the WAI-ARIA window splitter pattern. |
| FR-WSP-02 | M | The instructions pane renders the sections defined for the lesson's kind, in order (`04-content-system.md` section 2.4). For a guided lesson: Concept, Watch out (optional), Your task, Hints (optional). Code samples have a copy control; images have alt text. | Rendered from sanitized HTML produced at build time. |
| FR-WSP-03 | M | The editor provides syntax highlighting, line numbers, bracket matching, auto-indent, undo and redo, and Tab indentation with a documented way to leave the editor by keyboard. Multi-file lessons show one tab per file. | Keyboard-only user can enter and leave the editor. |
| FR-WSP-04 | M | Run executes the current code. Python output streams to the Console as it is produced. Web code renders in the Preview. Run never grades. | Output appears incrementally for a program that prints in a loop with pauses. |
| FR-WSP-05 | M | Check runs the lesson's tests and lists each test as passed or failed with its name, expected value, actual value, and the author's hint for that failure. Hidden tests show only name and verdict. | Works for every test kind in `04-content-system.md`. |
| FR-WSP-06 | M | When all tests pass, the lesson is completed once, a completion moment shows the XP earned, and the primary action becomes the next lesson. When a test fails, the first failure is expanded and focused. | Passing twice does not award XP twice. |
| FR-WSP-07 | M | While code runs, a Stop control is available. Code that exceeds the time limit is stopped with an explanation. In both cases the runtime is ready again without a page reload. | J-4 passes. |
| FR-WSP-08 | M | When a Python program asks for input, the Console shows the prompt and an input line; the answer is echoed. Where the browser cannot pause a program, an Input field accepts answers before Run, one per line. | Both strategies pass J-3. |
| FR-WSP-09 | M | Errors are shown in learner language: what kind of error, the message, and the line, which links to that line in the editor. The filtered traceback is available on expand. Runtime internals never appear. | Syntax, runtime, input-ended, time limit, memory, and output limit errors each have a tested message. |
| FR-WSP-10 | M | The learner's code is saved as they type and restored when they return. Reset to starter asks for confirmation and offers Undo. | Reload restores code; Undo restores the pre-reset code. |
| FR-WSP-11 | M | The workspace links back to the course, offers an outline of all chapters and lessons with their states, and has previous and next controls. | Outline is a modal dialog with focus trap and Escape to close. |
| FR-WSP-12 | M | Keyboard shortcuts exist for Run, Check, Stop, and moving focus between instructions, editor, and output. A shortcut sheet lists them. | Shortcuts do not conflict with browser or screen reader keys on Windows, macOS, or Linux. |
| FR-WSP-13 | M | Below 768 px the workspace shows three views (Lesson, Code, Output) with the action bar fixed above the on-screen keyboard and a row of symbols that are slow to reach on phone keyboards. | Tested at 320, 375, and 430 px, portrait and landscape. |
| FR-WSP-14 | S | A learner can reveal the reference solution after confirming. The completion is then recorded as assisted. | The solution is not in the page until requested. |
| FR-WSP-15 | S | A learner can report a problem with a lesson from the workspace. | See FR-FBK-01. |
| FR-WSP-16 | S | The Help area links to the community when a community URL is configured. | Absent when not configured. |
| FR-WSP-17 | M | Runtime state is visible whenever it is not ready: loading with real progress, failed with retry, restarting. The lesson text and editor remain usable in every state. | Simulated slow and failed loads are covered by tests. |
| FR-WSP-18 | C | Editor preferences (font size, wrap) persist per device. | |
| FR-WSP-19 | M | Web lessons render the preview on Run. Links and forms inside the preview do not navigate the preview or the app. | Containment matrix in `06-security-privacy.md` passes. |
| FR-WSP-20 | S | Web lessons update the preview while typing, debounced, without stealing focus. | No layout shift in the work pane. |

### 3.5 Runtimes (RUN)

| ID | P | Requirement | Acceptance |
|---|---|---|---|
| FR-RUN-01 | M | Python executes in the learner's browser in a dedicated worker. The page stays interactive during execution. | Main-thread long tasks during a busy loop stay under 50 ms. |
| FR-RUN-02 | M | Each run has a time limit of 5 seconds of execution, not counting time spent waiting for the learner's input. A lesson may raise it to at most 20 seconds. | Limit enforced from outside the worker. |
| FR-RUN-03 | M | Output per run is capped at 64,000 characters. The cap is reported, not silent. | A print loop cannot grow memory without bound. |
| FR-RUN-04 | M | Runs are isolated from each other: fresh namespace, restored builtins, restored working directory, restored module set, fixed random seed for tests. | A run that deletes or rebinds builtins does not affect the next run. |
| FR-RUN-05 | M | Web code runs only inside a sandboxed document with an opaque origin. It cannot read app cookies, storage, or DOM, and cannot navigate the app. | Verified by tests in three browser engines. |
| FR-RUN-06 | M | A runtime crash or out-of-memory condition is detected and reported, and the runtime recovers without a reload. | Memory bomb fixture recovers. |
| FR-RUN-07 | M | Runtime assets are versioned, served from an origin we control with immutable caching, and loaded only when a lesson needs them. | Second visit loads the runtime from cache. |

### 3.6 Grading (GRD)

| ID | P | Requirement | Acceptance |
|---|---|---|---|
| FR-GRD-01 | M | Python test kinds: `io`, `variable`, `call`, `source`, `custom`. | Each has unit tests for pass, fail, and learner-error cases. |
| FR-GRD-02 | M | Web test kinds: `dom`, `style`, `source`, `custom`. | Same. |
| FR-GRD-03 | M | Output comparison modes: `normalized` (default), `exact`, `contains`, `regex`, with optional numeric tolerance. | Normalization rules are specified and property-tested. |
| FR-GRD-04 | M | The same lesson and the same code produce the same verdicts in CI (Node) and in each supported browser. | Parity suite runs in CI. |
| FR-GRD-05 | M | Every lesson ships a solution that passes, a starter that fails, and at least one named wrong answer that fails. | Enforced by `content:check`. |
| FR-GRD-06 | M | A failing test never reveals a hidden test's expected value. | Hidden results carry no expected or actual fields. |

### 3.7 Progress (PRG)

| ID | P | Requirement | Acceptance |
|---|---|---|---|
| FR-PRG-01 | M | Guest completions, drafts, and active days are stored in the browser and survive reloads. The guest is told progress is saved on this device only. | Works when storage is unavailable by falling back to memory with a visible notice. |
| FR-PRG-02 | M | Account progress is stored on the server and appears on every signed-in device. | J-6 passes. |
| FR-PRG-03 | M | On sign-in, guest progress merges into the account: completions are unioned, the newer draft wins per lesson, active days are unioned. Merging twice changes nothing. | Merge is a pure function with property tests; J-5 passes. |
| FR-PRG-04 | M | XP is the sum of catalog XP values for completed lessons. No XP value is accepted from the client. | Forged requests cannot change XP beyond the catalog. |
| FR-PRG-05 | M | Streak is the number of consecutive local calendar days with a completion, ending today or yesterday. Current and longest are shown. Days use the learner's time zone at the moment of activity. | Property tests cover day boundaries, zone changes, and daylight saving shifts. |
| FR-PRG-06 | M | A completion that cannot reach the server is queued, shown as pending, and retried until stored. | Network failure during Check does not lose the completion. |
| FR-PRG-07 | M | Completions survive lesson edits, renames, and retirement. A renamed lesson's old URL redirects. | Lesson IDs are immutable (FR-CNT-02). |

### 3.8 Authentication (AUTH)

| ID | P | Requirement | Acceptance |
|---|---|---|---|
| FR-AUTH-01 | M | Sign in with Google. | Works in Chrome, Safari, Firefox, Edge. |
| FR-AUTH-02 | M | Sign in with a six-digit code sent by email. No passwords, no links that must be opened in another browser. | The whole flow completes inside one browser tab. |
| FR-AUTH-03 | M | Inside an embedded in-app browser, the Google option is replaced by a short explanation and the email code is offered first. | Detected by user agent with a manual override link. |
| FR-AUTH-04 | M | After signing in the learner returns to the page they were on. Only same-site relative paths are accepted as return targets. | Open redirect tests pass. |
| FR-AUTH-05 | M | Sign out ends the session on this device. Sessions refresh without interrupting the learner. | |
| FR-AUTH-06 | M | Requests for email codes are protected against automated abuse. | Challenge on the request form; provider limits configured (see `07-operations.md`). |
| FR-AUTH-07 | M | No account is needed for free lessons. The invitation to save progress appears after the first completion, never blocks the next action, and can be dismissed. | Not a modal over the completion moment. |

### 3.9 Profile and account (PRF)

| ID | P | Requirement | Acceptance |
|---|---|---|---|
| FR-PRF-01 | M | `/profile` shows display name, XP, current and longest streak, progress per course, and completed lessons. | Empty states for a new account. |
| FR-PRF-02 | M | The learner can change their display name. Time zone is detected and can be overridden. | Name is validated and length-limited. |
| FR-PRF-03 | M | The learner can delete their account. All personal data is erased. | J-10 passes; verified at database level. |
| FR-PRF-04 | M | The learner can download their data as a JSON file. | Contains profile, completions, drafts, active days. |

### 3.10 Access (ACC)

| ID | P | Requirement | Acceptance |
|---|---|---|---|
| FR-ACC-01 | M | Every lesson has an access level (`free` or `paid`). Every viewer has a tier (`guest`, `free`, `paid`). One policy function decides access everywhere. | No access decision exists outside that function. |
| FR-ACC-02 | M | Access mode `open` grants every lesson to everyone. Mode `tiered` enforces levels. Production launches in `open`. | Mode is a validated configuration value. |
| FR-ACC-03 | M | In `tiered` mode the content, starter code, tests, and solution of a paid lesson are delivered only after a server-side entitlement check. They are absent from static output, caches shared between users, and client bundles. | Canary leak test (see `06-security-privacy.md` T-09) passes. |
| FR-ACC-04 | S | A lesson locked by tier names what unlocks it and links to the membership URL when one is configured. | |
| FR-ACC-05 | S | An operator script grants and revokes the paid tier for an email address, with an expiry date. | Audited in the entitlements table. |
| FR-ACC-06 | C | A signed webhook endpoint accepts entitlement changes from an external membership system. Disabled by default. | Signature and replay tests pass. |

### 3.11 Content system (CNT)

| ID | P | Requirement | Acceptance |
|---|---|---|---|
| FR-CNT-01 | M | Courses, chapters, lessons, and tests are files validated against schemas. Invalid content fails the build with the file path and field. | |
| FR-CNT-02 | M | Every lesson has an immutable ID recorded in an append-only registry. IDs never change or get reused. | CI rejects a changed or removed ID. |
| FR-CNT-03 | M | Lesson status is `draft`, `published`, or `retired`. Only published lessons appear in production. Drafts appear in local and preview environments, visibly marked. | |
| FR-CNT-04 | M | CLI commands: `content:new`, `content:check`, `content:lint`, `content:sync`, `content:stats`. | Documented in the authoring guide. |
| FR-CNT-05 | M | `content:check` proves FR-GRD-05 for every lesson and runs in CI. | A deliberately broken solution fails CI. |
| FR-CNT-06 | M | `content:lint` checks spelling, heading structure, image alt text, link targets, reading length, and banned phrasing. | |
| FR-CNT-07 | M | `content:sync` writes the lesson catalog (IDs, order, XP, access, status) to the database, idempotently. | Running it twice changes nothing. |
| FR-CNT-08 | M | A lesson's previous slugs redirect to its current URL. | |

### 3.12 Feedback (FBK)

| ID | P | Requirement | Acceptance |
|---|---|---|---|
| FR-FBK-01 | S | A learner can send a lesson report: a category (unclear text, my correct answer failed, a wrong answer passed, something broke, other) and an optional message. Guests can send it. | Stored with lesson ID and content version. Rate limited. No code is attached unless the learner ticks a box. |

### 3.13 System and discovery (SYS, SEO)

| ID | P | Requirement | Acceptance |
|---|---|---|---|
| FR-SYS-01 | M | Not-found and error pages explain what happened, offer a way forward, and (for errors) show a reference ID the learner can quote. | |
| FR-SYS-02 | M | A browser below the support floor sees a clear message instead of a broken workspace. | |
| FR-SYS-03 | M | Privacy policy and terms pages exist, are linked from every page, and are marked as reviewed by the legal reviewer before launch. | |
| FR-SYS-04 | M | Liveness and readiness endpoints exist for monitoring. | |
| FR-SYS-05 | S | An operator can show a site-wide notice (for maintenance or incidents) by configuration, without a deploy of new code. | |
| FR-SEO-01 | M | Every public page has a unique title, description, canonical URL, and is in the sitemap. Draft and gated content is excluded. | |
| FR-SEO-02 | S | Course pages carry structured data and a share image built from the brand template. | Validated with a structured data test in CI. |

## 4. Non-functional requirements

Numbers marked (measured) come from the prototypes in `09-evidence.md`. Numbers marked (proposed) are confirmed or revised with a baseline taken in Phase 2 and recorded in an ADR. A number that was not measured is never reported as a result (antislop R-40).

### 4.1 Performance (PERF)

| ID | Requirement | Verified by |
|---|---|---|
| NFR-PERF-01 | Landing, catalog, and course pages: Lighthouse mobile performance 90 or higher, LCP 2.5 s or less, CLS 0.1 or less, TBT 200 ms or less on the CI profile. | Lighthouse CI, required check |
| NFR-PERF-02 | First-load JavaScript, compressed: 170 kB or less on content pages; 350 kB or less on the workspace, excluding the Python runtime. (proposed) | Bundle budget, required check |
| NFR-PERF-03 | In the workspace, lesson text is readable and the editor accepts typing before the runtime finishes loading. The runtime never blocks rendering. | E2E with throttled runtime |
| NFR-PERF-04 | Python runtime download is 6.5 MB or less compressed. Version 314.0.7 is 5.5 MB with Brotli and 6.4 MB with gzip (measured). | Asset size check in CI |
| NFR-PERF-05 | Warm start (assets cached) to runtime ready: 2.5 s or less on the reference laptop. Prototype: 1.7 to 2.4 s in headless Chromium (measured). | Performance test |
| NFR-PERF-06 | After ready: Run of a one-line program returns in 150 ms or less; Check of ten tests in 500 ms or less. Prototype: three tests in about 2 ms (measured). | Performance test |
| NFR-PERF-07 | Field Core Web Vitals at the 75th percentile are in the good range on content pages. | Real-user monitoring after launch |

### 4.2 Accessibility (A11Y)

| ID | Requirement | Verified by |
|---|---|---|
| NFR-A11Y-01 | Conforms to WCAG 2.2 level AA. | Automated plus manual audit |
| NFR-A11Y-02 | Zero serious or critical axe violations on every page and every workspace state. | axe in E2E, required check |
| NFR-A11Y-03 | Everything works with a keyboard alone. Focus is always visible and never trapped except in open dialogs. | E2E keyboard journeys |
| NFR-A11Y-04 | Run and Check outcomes are announced to screen readers through live regions. | Manual script with VoiceOver and NVDA |
| NFR-A11Y-05 | Usable at 200 percent zoom and at 320 CSS px width without horizontal scrolling of the page. | E2E at 320 px; manual zoom |
| NFR-A11Y-06 | Touch targets are at least 44 by 44 CSS px. | Automated check on interactive elements |
| NFR-A11Y-07 | All text meets AA contrast in every state, including disabled-looking but readable text and syntax colors. | Contrast checker on tokens |
| NFR-A11Y-08 | Motion that is not essential stops under reduced-motion preference. | E2E with the preference emulated |

### 4.3 Compatibility (COMPAT)

| ID | Requirement | Verified by |
|---|---|---|
| NFR-COMPAT-01 | Supported: the two latest major versions of Chrome, Edge, Firefox, and Safari on desktop; Safari on iOS; Chrome on Android. Floor: Chrome 112, Firefox 112, Safari 16.4 (the versions the Python runtime is tested against). | E2E on three engines; device matrix |
| NFR-COMPAT-02 | The in-app browsers of TikTok and Instagram on iOS and Android are supported for J-1 and for email code sign-in. | Real-device sign-off by the owner |
| NFR-COMPAT-03 | Layouts work from 320 px to 2560 px wide. | E2E viewport matrix |
| NFR-COMPAT-04 | Features that depend on a browser capability are detected, never assumed from the user agent, and each fallback path has tests. The one exception is recognizing in-app browsers for FR-AUTH-03, which has no capability signal. | Tests that remove the capability |

**Device matrix.** Automated tests cover engines. These are checked by hand on real hardware at Gates 5 and 9.

| Device | Browsers and contexts |
|---|---|
| iPhone on the current iOS | Safari; the TikTok in-app browser; the Instagram in-app browser |
| iPhone or iPad one major iOS version behind | Safari. This exercises the batch input path where stack switching is absent (E-08). |
| Android phone, mid-range | Chrome; the TikTok in-app browser; the Instagram in-app browser |
| Windows laptop | Chrome, Edge, Firefox; NVDA with Firefox or Chrome |
| Mac | Safari, Chrome; VoiceOver with Safari |

A device the owner does not have is covered by borrowing one or by a real-device cloud service. An emulator does not count for in-app browsers.

### 4.4 Security and privacy (SEC, PRIV)

Controls and their tests are specified in `06-security-privacy.md`. Summary:

| ID | Requirement |
|---|---|
| NFR-SEC-01 | Learner code never executes in the app's origin with access to credentials. |
| NFR-SEC-02 | A content security policy is enforced on every app response, with no `unsafe-eval`. Per-user routes use per-request nonces. The script policy for static public routes is decided by evidence in ADR-0021. |
| NFR-SEC-03 | Every data access is authorized on the server; the database denies by default. |
| NFR-SEC-04 | No secret is in the repository, the client bundle, logs, or telemetry. |
| NFR-SEC-05 | Dependencies are pinned, scanned, and updated on a schedule. |
| NFR-PRIV-01 | Only the data listed in the data inventory is collected. |
| NFR-PRIV-02 | No advertising or cross-site tracking. Analytics uses no third-party cookies. |
| NFR-PRIV-03 | Learner code and email addresses never enter analytics or error reports. |

### 4.5 Reliability (REL)

| ID | Requirement | Verified by |
|---|---|---|
| NFR-REL-01 | No completion is lost once the learner has seen the pass. | Offline and failure-injection tests |
| NFR-REL-02 | If the API or database is unavailable, published free lessons still load, run, and can be passed in guest mode, with a notice. | J-11 |
| NFR-REL-03 | A runtime crash recovers within 5 seconds without a reload. | Fault tests |
| NFR-REL-04 | Deploys cause no downtime. A bad deploy is rolled back within 5 minutes. | Rollback drill each phase from Phase 1 |
| NFR-REL-05 | The database is backed up daily. A restore drill has passed. Recovery point 24 hours; recovery time 4 hours. | Drill record in `docs/runbooks/` |

### 4.6 Observability (OBS)

| ID | Requirement |
|---|---|
| NFR-OBS-01 | Every server request has a request ID that appears in logs, error responses, and error reports. |
| NFR-OBS-02 | Client and server errors are reported with release version and environment. |
| NFR-OBS-03 | Product events follow the taxonomy in `07-operations.md` and are emitted through one typed function. |
| NFR-OBS-04 | Service level objectives have dashboards and alerts before launch. |

### 4.7 Maintainability (MAINT)

| ID | Requirement | Verified by |
|---|---|---|
| NFR-MAINT-01 | TypeScript strict mode with the additional flags in `05-engineering-handbook.md`. No `any`, no suppression without a linked reason. | Lint, required check |
| NFR-MAINT-02 | Line and branch coverage 90 percent or higher in `domain` and `grader`; 80 percent lines elsewhere. | Coverage gate |
| NFR-MAINT-03 | Mutation score 75 percent or higher in `domain` and in grader comparison code. | Nightly mutation run |
| NFR-MAINT-04 | No unused files, exports, or dependencies. | Dead-code check, required |
| NFR-MAINT-05 | Package and layer dependency rules hold. | Dependency rule check, required |
| NFR-MAINT-06 | Pull request pipeline finishes within 12 minutes at the 95th percentile. | CI timing report |
| NFR-MAINT-07 | Every architectural decision has an ADR. | Review checklist |

### 4.8 Internationalization readiness (I18N)

| ID | Requirement | Verified by |
|---|---|---|
| NFR-I18N-01 | No user-facing string is written inline in a component. All copy comes from message catalogs. | Lint rule |
| NFR-I18N-02 | Layout uses logical properties only (inline start and end, not left and right). | Lint rule |
| NFR-I18N-03 | Document language and direction come from locale configuration. Code is always left to right. | Unit test |
| NFR-I18N-04 | Dates, numbers, and plurals are formatted through the platform's internationalization APIs. | Review checklist |

### 4.9 Cost (COST)

| ID | Requirement |
|---|---|
| NFR-COST-01 | No server-side cost per code execution. |
| NFR-COST-02 | Spend alerts are configured at every paid vendor before launch. |
| NFR-COST-03 | Scale triggers (when to move a tier or a vendor) are written in `07-operations.md` before launch. |

## 5. Explicitly out of scope

See `00-charter.md` section 4. Requests that fall there are answered with the trigger for revisiting, not with a partial build.
