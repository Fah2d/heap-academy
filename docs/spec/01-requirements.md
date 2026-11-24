# 01 Requirements

Requirements for the first release. Every requirement has a stable ID. Tests cite the IDs they verify (`05-engineering-handbook.md` section 8.6). Priority: **M** must be in the release, **S** should be, and is cut first when a day runs late. Nothing ships as a stub: a requirement is fully met or absent.

IDs match the archived plan where the requirement is the same. Gaps in the numbering are requirements that wait (`00-charter.md` section 4).

## 1. People

| ID | Persona | Situation | Needs |
|---|---|---|---|
| P-1 | First-timer | Saw a Heap video. On a phone, inside the TikTok or Instagram in-app browser. Has never written code. Reads English as a second language. | To run something real in under a minute without signing up. Plain words. Big touch targets. |
| P-2 | Returning learner | On a laptop in the evening. Has an account. | To continue where they stopped, with their progress intact. |
| P-4 | Author | The owner. Works in the admin dashboard. | To write a lesson and its test cases quickly and know it is solvable before learners see it. |
| P-5 | Operator | The owner. | To know the product is up, what it costs, and that nobody else can reach the dashboard. |

## 2. Journeys

Each journey is an end-to-end test suite in `e2e/`.

| ID | Journey | Steps |
|---|---|---|
| J-1 | Video to first Run | Open a lesson on a phone as a guest. The lesson text is readable at once and the editor accepts typing before Python is ready. Tap Run. See output. |
| J-2 | Complete a lesson | Read. Type. Run. Check. See a failing test case with expected and actual output. Fix. Check. Pass. See the completion moment. Go to the next lesson. |
| J-3 | Program that asks for input | Run code that calls `input()` twice. Answer each prompt in the console. See the final output. |
| J-4 | Runaway code | Run `while True: pass`. Press Stop, or wait for the time limit. The page never freezes. Python restarts. The next Run works. |
| J-5 | Save my progress | As a guest with completions, sign in with an email code. Local progress appears in the account. Nothing is duplicated or lost. |
| J-6 | Another device | Sign in on a second browser. See the same completions, XP, and streak. |
| J-8 | Owner adds a lesson | In the dashboard, create a lesson, write instructions, starter, solution, and test cases. Fill expected output from the solution. Validate. Preview. Publish. A guest sees it without a deploy. |
| J-10 | Delete my account | Confirm by typing. Sign in again if the session is old. All personal data is gone; the session ends. |
| J-12 | Stranger at the admin door | A guest and a signed-in learner open `/admin`: both see the not-found page. A direct write to a lesson through the database interface is refused. An admin without the second step cannot write. |
| J-13 | A broken lesson cannot go live | In the dashboard, try to publish a lesson whose solution fails a test case, then one whose starter already passes. Both are refused with the reason. |

## 3. Functional requirements

### 3.1 Home (LND)

| ID | P | Requirement | Acceptance |
|---|---|---|---|
| FR-LND-01 | S | The home page shows a real editor with a short Python program that runs with the production runtime. | Run produces output from the real runtime. No screenshot, video, or fake terminal stands in for it. |
| FR-LND-02 | M | The home page says what the product is in one sentence and lists the published courses with real lesson counts, each linking into the course. | Counts equal the published lessons in the database. |
| FR-LND-03 | M | The home page contains no statistic, testimonial, logo wall, or claim without a real source. | antislop Hard Gate passes. |

### 3.2 Course list (CAT)

| ID | P | Requirement | Acceptance |
|---|---|---|---|
| FR-CAT-01 | M | `/courses` lists published courses: title, one-line summary, lesson count. | Data comes from the database only. |
| FR-CAT-02 | M | Each course shows the viewer's progress and one primary action whose label matches state: begin, continue (to the next incomplete lesson), or review. | Label and target are correct for 0 percent, partial, and 100 percent. |
| FR-CAT-04 | M | A course with no published lesson is not listed. With no published course at all, the page says so honestly. | No placeholder cards. |

### 3.3 Course page (CRS)

| ID | P | Requirement | Acceptance |
|---|---|---|---|
| FR-CRS-01 | M | `/courses/[course]` shows the course summary, its outcomes when the owner has written them, and every chapter in order with its lessons. | Order equals the order set in the dashboard. |
| FR-CRS-02 | M | Each lesson row shows its XP and one state: completed, next up, or open. State is conveyed by text and icon, not color alone. | All three states render and are announced to assistive technology. |
| FR-CRS-05 | S | A progress summary shows lessons completed and XP earned of total. | Values equal derived progress. |

### 3.4 Workspace (WSP)

| ID | P | Requirement | Acceptance |
|---|---|---|---|
| FR-WSP-01 | M | At 768 px and wider the workspace has an instructions pane and a work pane, with the editor above the output. | The page itself does not scroll; each pane does. |
| FR-WSP-02 | M | The instructions pane renders the lesson's Markdown, sanitized. Code samples have a copy control. | Rendered by the single lesson-content component. |
| FR-WSP-03 | M | The editor provides Python syntax highlighting, line numbers, bracket matching, auto-indent, undo and redo, and Tab indentation with a documented way to leave the editor by keyboard. | A keyboard-only user can enter and leave the editor. |
| FR-WSP-04 | M | Run executes the current code. Output streams to the console as it is produced. Run never grades. | Output appears incrementally for a program that prints in a loop with pauses. |
| FR-WSP-05 | M | Check runs the lesson's test cases and lists each as passed or failed with its name, input, expected output, actual output, and the owner's hint for that failure. | Works with and without follow-up code. |
| FR-WSP-06 | M | When all test cases pass, the lesson is completed once, a completion moment shows the XP earned, and the primary action becomes the next lesson. When one fails, the first failure is expanded and focused. | Passing twice does not award XP twice. |
| FR-WSP-07 | M | While code runs, a Stop control is available. Code that exceeds the time limit is stopped with an explanation. In both cases Python is ready again without a page reload. | J-4 passes. |
| FR-WSP-08 | M | When a program asks for input, the console shows the prompt and an input line; the answer is echoed. Where the browser cannot pause a program, an Input field accepts answers before Run, one per line. | Both strategies pass J-3. |
| FR-WSP-09 | M | Errors are shown in learner language: what kind of error, the message, and the line, which links to that line in the editor. Runtime internals never appear. | Syntax, runtime, input-ended, time limit, memory, and output limit errors each have a tested message. |
| FR-WSP-10 | M | The learner's code is saved on the device as they type and restored when they return. Reset to starter asks for confirmation and offers Undo. | Reload restores code; Undo restores the pre-reset code. |
| FR-WSP-11 | M | The workspace links back to the course and has previous and next controls. | Controls are disabled, not hidden, at the ends of a course. |
| FR-WSP-12 | M | Keyboard shortcuts exist for Run and Check and are shown on the buttons. | They do not conflict with browser keys on Windows, macOS, or Linux. |
| FR-WSP-13 | M | Below 768 px the workspace shows three views (Lesson, Code, Output) with the action bar fixed above the on-screen keyboard. | Tested at 320, 375, and 430 px. |
| FR-WSP-17 | M | Python's state is visible whenever it is not ready: loading with real progress, failed with retry, restarting. The lesson text and editor remain usable in every state. | Simulated slow and failed loads are covered by tests. |
| FR-WSP-21 | S | In the Code view on phones, a row above the keyboard offers the symbols that are slow to reach. | Each key inserts at the cursor. |
| FR-WSP-22 | M | Hints are revealed one at a time, on request. | A lesson without hints shows no hint control. |
| FR-WSP-23 | S | Common Python error types come with one sentence that explains them. | Reviewed like lesson text. |

### 3.5 Runtime (RUN)

| ID | P | Requirement | Acceptance |
|---|---|---|---|
| FR-RUN-01 | M | Python executes in the learner's browser in a dedicated worker. The page stays interactive during execution. | Main-thread long tasks during a busy loop stay under 50 ms. |
| FR-RUN-02 | M | Each run has a time limit of 5 seconds of execution, not counting time spent waiting for the learner's input. | Enforced from outside the worker. |
| FR-RUN-03 | M | Output per run is capped at 64,000 characters. The cap is reported, not silent. | A print loop cannot grow memory without bound. |
| FR-RUN-04 | M | Runs are isolated from each other: fresh namespace, restored builtins, restored module set. | A run that deletes or rebinds builtins does not affect the next run. |
| FR-RUN-06 | M | A runtime crash or out-of-memory condition is detected and reported, and the runtime recovers without a reload. | A memory bomb fixture recovers. |
| FR-RUN-07 | M | Runtime files are versioned, served from our own origin with immutable caching, and loaded only when a page needs them. | A second visit loads the runtime from cache. |

### 3.6 Grading (GRD)

| ID | P | Requirement | Acceptance |
|---|---|---|---|
| FR-GRD-01 | M | One test case model: a name, an input, optional follow-up code, an expected output, a comparison mode, and an optional hint (`04-content-system.md` section 2). | Unit tests cover pass, fail, and learner-error cases, with and without follow-up code. |
| FR-GRD-03 | M | Comparison modes: `normalized` (default), `exact`, `contains`. | Normalization rules are specified and property-tested. |
| FR-GRD-04 | M | The same lesson and the same code produce the same verdicts in the test suite (Pyodide under Node) and in each supported browser. | A parity suite runs in CI. |
| FR-GRD-05 | M | A lesson cannot be published unless, since its last change, its solution passed every test case, its starter failed at least one, and each recorded wrong answer failed at least one. | Enforced in the dashboard and by a database rule. J-13 passes. |
| FR-GRD-07 | S | When output almost matches, the result names the difference: letter case, spaces, punctuation, or a missing last line. | Each near miss has a tested message. |

### 3.7 Progress (PRG)

| ID | P | Requirement | Acceptance |
|---|---|---|---|
| FR-PRG-01 | M | Guest completions and saved code are stored in the browser and survive reloads. The guest is told progress is saved on this device only. | Falls back to memory with a visible notice when storage is unavailable. |
| FR-PRG-02 | M | Account progress is stored on the server and appears on every signed-in device. | J-6 passes. |
| FR-PRG-03 | M | On sign-in, guest completions merge into the account. Merging twice changes nothing. | Merge is a pure function with property tests; J-5 passes. |
| FR-PRG-04 | M | XP is the sum of the XP values of completed lessons. The value is set by the database from the lesson, never accepted from a client. | A forged request cannot raise XP beyond what the lessons carry. |
| FR-PRG-05 | M | Streak is the number of consecutive local calendar days with a completion, ending today or yesterday. Current and longest are shown. | Property tests cover day boundaries and daylight saving shifts. |
| FR-PRG-06 | M | A completion that cannot reach the server stays on the device and is retried until stored. | A network failure during Check does not lose the completion. |
| FR-PRG-07 | M | Completions and their XP survive lesson edits, renames, and archiving. | An archived lesson's completions still count. |

### 3.8 Sign-in (AUTH)

| ID | P | Requirement | Acceptance |
|---|---|---|---|
| FR-AUTH-01 | M | Sign in with Google. | Works in Chrome, Safari, Firefox, Edge. |
| FR-AUTH-02 | M | Sign in with a six-digit code sent by email. No passwords, no links that must be opened in another browser. | The whole flow completes inside one browser tab. |
| FR-AUTH-03 | M | Inside an embedded in-app browser, the email code is offered first and a sentence explains why Google is not. | Detected by user agent, with a manual link to the Google option. |
| FR-AUTH-04 | M | After signing in the learner returns to the page they were on. Only same-site relative paths are accepted as return targets. | Open redirect tests pass. |
| FR-AUTH-05 | M | Sign out ends the session on this device. Sessions refresh without interrupting the learner. | |
| FR-AUTH-06 | M | Requests for email codes are protected against automated abuse. | A bot challenge on the request form; provider limits configured. |
| FR-AUTH-07 | M | No account is needed to learn. The invitation to save progress appears after the first completion, never blocks the next action, and can be dismissed. | Not a modal over the completion moment. |

### 3.9 Profile and account (PRF)

| ID | P | Requirement | Acceptance |
|---|---|---|---|
| FR-PRF-01 | M | `/profile` shows display name, XP, current and longest streak, and progress per course. | Empty states for a new account. |
| FR-PRF-02 | M | The learner can change their display name. Time zone is detected from the browser. | Name is validated and length-limited. |
| FR-PRF-03 | M | The learner can delete their account. All personal data is erased. | J-10 passes; verified at database level. |

### 3.10 Admin dashboard (ADM)

| ID | P | Requirement | Acceptance |
|---|---|---|---|
| FR-ADM-01 | M | The dashboard lives under `/admin` and is reachable only by a user on the admin list who has passed the second sign-in step. Everyone else gets the same not-found page as any missing address. | J-12 passes. |
| FR-ADM-02 | M | An admin enrolls an authenticator app once and is asked for its code in every new admin session. | An admin session without the second step can read nothing and write nothing in the dashboard. |
| FR-ADM-03 | M | Create, edit, reorder, publish, unpublish, and archive courses and chapters. | A course cannot be published with no published lesson. |
| FR-ADM-04 | M | Create and edit a lesson: title, address, XP, instructions in Markdown with a preview rendered exactly as learners will see it, hints, starter, solution, and optional wrong answers. | The preview uses the same renderer as the workspace. |
| FR-ADM-05 | M | Add, edit, duplicate, reorder, and delete test cases. | Limits in `04-content-system.md` section 2 are enforced with clear messages. |
| FR-ADM-06 | M | Run the solution against every test case in the dashboard and see each verdict with expected and actual output. Expected output can be filled from the solution's actual output and then edited. | Uses the same runtime and harness as the workspace. |
| FR-ADM-07 | M | Publishing a lesson, and saving a change to the starter, solution, or test cases of a published lesson, requires a passing validation of exactly what is being saved. | The reason for a refusal is shown per rule. |
| FR-ADM-08 | M | A draft lesson can be previewed in the real workspace before publishing. A preview never records progress. | Preview is under `/admin`, never on a public address. |
| FR-ADM-09 | M | Lessons and courses are draft, published, or archived. Archiving removes one from the site and keeps learners' completions. A lesson with completions cannot be deleted. | |
| FR-ADM-10 | M | Unsaved changes are never lost silently: leaving the editor warns, and a save that would overwrite a newer version is refused with a prompt to reload. | |
| FR-ADM-11 | M | A change to published content appears on the site within one minute, without a deploy. | Measured in J-8. |
| FR-ADM-12 | S | Export a course as one JSON file. Import a lesson from JSON as a draft. | An imported lesson still has to pass validation to be published. |
| FR-ADM-13 | S | The dashboard shows, per lesson, how many learners completed it. | Counts come from the database. |
| FR-ADM-14 | M | Solutions, wrong answers, and anything not published are never sent to a browser that is not an admin's. | Database policy tests and a response scan prove it (`06-security-privacy.md` T-21). |

### 3.11 System and discovery (SYS, SEO)

| ID | P | Requirement | Acceptance |
|---|---|---|---|
| FR-SYS-01 | M | Not-found and error pages explain what happened, offer a way forward, and (for errors) show a reference the learner can quote. For a server error the reference is the error's digest. For a browser error it is the request ID of its report to `/api/client-error`, shown once the report is stored; if the report fails, no reference is shown (approved by the owner on 2026-11-24, WP-7.3 decision B). | |
| FR-SYS-02 | M | A browser below the support floor sees a clear message instead of a broken workspace. | |
| FR-SYS-03 | M | Privacy policy and terms pages exist, are linked from every page, and carry text the owner approved. | |
| FR-SYS-04 | M | A health endpoint exists for monitoring. | |
| FR-SEO-01 | M | Every public page has a unique title, description, and canonical address, and is in the sitemap. Sign-in, profile, and admin pages are excluded from indexing. | |

## 4. Non-functional requirements

Numbers marked (measured) come from the prototypes in `09-evidence.md`. A number that was not measured is never reported as a result.

### 4.1 Performance (PERF)

| ID | Requirement | Verified by |
|---|---|---|
| NFR-PERF-01 | Home, course list, and course pages: Lighthouse mobile performance 90 or higher, LCP 2.5 s or less, CLS 0.1 or less, measured on the preview deployment. | Lighthouse run in WP-7.2 |
| NFR-PERF-03 | In the workspace, lesson text is readable and the editor accepts typing before the runtime finishes loading. The runtime never blocks rendering. | E2E with a throttled runtime |
| NFR-PERF-04 | The Python runtime download is 6.5 MB or less compressed. Version 314.0.7 is 5.5 MB with Brotli (measured). | Asset size check in CI |
| NFR-PERF-06 | After the runtime is ready, Run of a one-line program returns in 150 ms or less and Check of ten test cases in 500 ms or less on a laptop. Prototype: three tests in about 2 ms (measured). | Performance test |

### 4.2 Accessibility (A11Y)

| ID | Requirement | Verified by |
|---|---|---|
| NFR-A11Y-01 | The target is WCAG 2.2 level AA. This release verifies it with automated checks and a keyboard walkthrough; a formal audit comes later. | WP-7.2 report |
| NFR-A11Y-02 | Zero serious or critical axe violations on every page and every workspace state. | axe in E2E, required check |
| NFR-A11Y-03 | Everything works with a keyboard alone. Focus is always visible and never trapped except in open dialogs. | E2E keyboard journeys |
| NFR-A11Y-04 | Run and Check outcomes are announced to screen readers through live regions. | Component tests |
| NFR-A11Y-05 | Learner pages are usable at 320 CSS px width without horizontal scrolling of the page. | E2E at 320 px |
| NFR-A11Y-06 | Touch targets are at least 44 by 44 CSS px. | Automated check on interactive elements |
| NFR-A11Y-07 | All text meets AA contrast in every state, including syntax colors. | Contrast checker on tokens |
| NFR-A11Y-08 | Motion that is not essential stops under the reduced-motion preference. | E2E with the preference emulated |

### 4.3 Compatibility (COMPAT)

| ID | Requirement | Verified by |
|---|---|---|
| NFR-COMPAT-01 | Supported: the two latest major versions of Chrome, Edge, Firefox, and Safari on desktop; Safari on iOS; Chrome on Android. Floor: Chrome 112, Firefox 112, Safari 16.4 (the versions the Python runtime is tested against). | E2E on three engines |
| NFR-COMPAT-02 | The in-app browsers of TikTok and Instagram on iOS and Android are supported for J-1 and for email code sign-in. | Real-device sign-off by the owner on Day 3 and Day 7 |
| NFR-COMPAT-03 | Learner pages work from 320 px to 2560 px wide. The dashboard is built for 1024 px and wider and says so on smaller screens. | E2E viewport matrix |
| NFR-COMPAT-04 | Features that depend on a browser capability are detected, never assumed from the user agent, and each fallback path has tests. The one exception is recognizing in-app browsers for FR-AUTH-03. | Tests that remove the capability |

### 4.4 Security and privacy (SEC, PRIV)

Controls and their tests are specified in `06-security-privacy.md`.

| ID | Requirement | Verified by |
|---|---|---|
| NFR-SEC-01 | Learner code never executes in the page. It runs only in the Python worker. | Runtime tests |
| NFR-SEC-02 | A content security policy with a per-request nonce and no `unsafe-eval` is enforced on every page. | External header check |
| NFR-SEC-03 | Every read and write is authorized by row level security. The database denies by default. | Policy tests for every table and operation |
| NFR-SEC-04 | No secret is in the repository, the client bundle, logs, or analytics. | Secret scan and bundle check, required |
| NFR-SEC-05 | Dependencies are pinned by the lockfile and audited on every pull request. | Required check |
| NFR-SEC-06 | Admin rights come from an allow-list plus the second sign-in step, and are enforced by the database, not only by the interface. | Policy tests; J-12 |
| NFR-SEC-07 | The codebase has no raw HTML injection sink. Lesson Markdown becomes elements through a sanitizing renderer. | Lint rule; fixture tests |
| NFR-PRIV-01 | Only the data listed in the data inventory is collected. | Review in WP-7.1 |
| NFR-PRIV-02 | No advertising or cross-site tracking. Analytics uses no cookies. | Review in WP-7.3 |
| NFR-PRIV-03 | Learner code and email addresses never enter analytics or logs. | Unit tests on the logger; review |

### 4.5 Reliability (REL)

| ID | Requirement | Verified by |
|---|---|---|
| NFR-REL-01 | No completion is lost once the learner has seen the pass. | Failure-injection tests |
| NFR-REL-02 | A lesson that is already open keeps working if the server becomes unreachable: Run and Check still work, and the completion is kept for later. | E2E with the network cut |
| NFR-REL-03 | A runtime crash recovers within 5 seconds without a reload. | Fault tests |
| NFR-REL-04 | Deploys cause no downtime. A bad deploy can be rolled back within 5 minutes. | One rollback drill before launch |
| NFR-REL-05 | The database is backed up daily, and one restore has been practiced before launch. | Drill record in `docs/runbooks/` |

### 4.6 Observability (OBS)

| ID | Requirement | Verified by |
|---|---|---|
| NFR-OBS-01 | Every server request has a request ID that appears in its log lines. A server error is logged with its digest and the request ID. For a server error the reference is the error's digest. For a browser error it is the request ID of its report to `/api/client-error`, shown once the report is stored; if the report fails, no reference is shown (approved by the owner on 2026-11-24, WP-7.3 decision B). | Integration test |
| NFR-OBS-02 | Client and server errors are recorded with the release version and no personal data. | Integration test |
| NFR-OBS-04 | An external uptime check watches the health endpoint and tells the owner when it fails. | Launch checklist |

### 4.7 Maintainability (MAINT)

| ID | Requirement | Verified by |
|---|---|---|
| NFR-MAINT-01 | TypeScript strict mode with the additional flags in `05-engineering-handbook.md` section 5. No `any`, no suppression without a linked reason. | Lint, required check |
| NFR-MAINT-02 | Line and branch coverage 90 percent or higher in `src/domain` and `src/grader`. | Coverage gate, required check |
| NFR-MAINT-05 | Module dependency rules hold (`02-architecture.md` section 4.1). | Lint, required check |
| NFR-MAINT-06 | The pull request pipeline finishes within 10 minutes in the usual case. | CI timing, reported in the day check |
| NFR-MAINT-07 | Every architectural decision has an ADR. | Review checklist |
| NFR-MAINT-08 | No commit, pull request, or file credits an AI tool. | Attribution check, required |

### 4.8 Readiness for Arabic (I18N)

| ID | Requirement | Verified by |
|---|---|---|
| NFR-I18N-01 | No user-facing string is written inline in a component. All copy comes from message modules. | Lint rule |
| NFR-I18N-02 | Layout uses logical properties only (inline start and end, not left and right). | Lint rule |
| NFR-I18N-03 | Document language and direction come from one configuration value. Code is always left to right. | Unit test |

### 4.9 Cost (COST)

| ID | Requirement | Verified by |
|---|---|---|
| NFR-COST-01 | No server-side cost per code execution. | Architecture; no route executes learner code |
| NFR-COST-02 | Every vendor runs on its free tier except the domain (ADR-0029). Usage notifications are on wherever a vendor offers them, and every free-tier limit has a trigger in ADR-0029, all before launch. | Launch checklist |

## 5. Explicitly out of scope

See `00-charter.md` section 4. A request that falls there is answered with the trigger for revisiting it, not with a partial build.
