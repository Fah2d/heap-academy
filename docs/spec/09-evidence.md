# 09 Evidence

What this plan rests on: facts checked against primary sources, and prototypes that were actually run. Dated 2026-11-11 to 2026-11-15. Versions and prices move; Day 3 repeats the runtime checks inside the real codebase, and the implementer rechecks documentation before relying on an API.

Some entries describe the sandbox for an HTML and CSS course. That course waits (`00-charter.md` section 4); the entries stay because the work was done and will be needed.

Prototype environment: Linux container, Node 22.23.4, Pyodide 314.0.7 from npm, Playwright 1.63 driving headless Chromium 153.0.8010.12, local static server.

## 1. What was not verified

Read this first.

- **Firefox and WebKit.** Only Chromium was available. Every browser claim below is Chromium unless a source is cited.
- **Real phones and in-app browsers.** Nothing was run on a device.
- **The real bundler and host.** Prototypes used hand-written pages and a plain Node server, not Next.js on Vercel.
- **Resource policy headers on sandbox assets.** For the later HTML and CSS course. The warning in `docs/later/full-plan/02-architecture.md` section 6.3 is reasoning, not a test.
- **Preserving full document structure in the sandbox.** For the later HTML and CSS course. The prototype injected markup into a container. The alternative technique was not tried.
- **Network lock-down against a determined attacker.** Own-property removal was tested. Recovery through the prototype chain was not.
- **Load and field performance.** All timings are from one machine, local files, no network.
- **Claude Code attribution settings in a live session.** The keys in E-18 come from current documentation. The first real test is the first pull request, in WP-1.2.
- **A nonce policy on a real build.** E-21 is documentation. Whether the editor and the interface libraries run cleanly under it is first tested in WP-1.3 and WP-4.2.
- **The second sign-in step.** E-20 is documentation. The `aal2` check inside a policy is first tested in WP-2.1 and WP-2.3.
- **The bot challenge on an email code request, and the cost of the host's rate limiting.** E-22 is documentation, and one part of it is an inference. First checks in WP-2.2 and WP-7.1.
- **The time boxes in the delivery plan.** They are estimates. Nothing was timed.

## 2. Evidence index

| ID | Claim | Kind |
|---|---|---|
| E-01 | Framework and runtime versions; Next.js script policy constraints | Source |
| E-02 | Size of the Python runtime | Measured |
| E-03 | Pyodide 314 needs module workers | Source and measured |
| E-04 | Start, check, terminate, respawn, and memory behavior | Measured |
| E-05 | Interactive input by stack switching; `null` versus `undefined` | Measured |
| E-06 | Harness behavior and isolation; first sandbox test | Measured |
| E-07 | Content security policy behavior; sandbox document design; network removal | Measured |
| E-08 | Browser support for WebAssembly stack switching | Source |
| E-09 | Supabase server-side auth with current Next.js | Source |
| E-10 | Google sign-in inside embedded browsers | Source |
| E-11 | Supabase limits | Source |
| E-12 | Walkthrough of the reference product | Observed |
| E-13 | Vercel plan terms | Source |
| E-14 | GitHub branch protection on private repositories | Source |
| E-15 | Browser versions Pyodide is tested against | Source |
| E-16 | Pyodide standard stream handling | Source |
| E-17 | antislop facts | Source (repository read in full) |
| E-18 | Claude Code facts | Source |
| E-19 | Contrast of the known brand colors | Computed |
| E-20 | Supabase second sign-in step and assurance levels | Source |
| E-21 | Next.js nonces, dynamic rendering, and the data cache | Source |
| E-22 | Host rate limiting and the auth bot challenge | Source |
| E-23 | Vercel Hobby terms, limits, and rate limiting | Source |
| E-24 | Supabase Free plan, backups, multi-factor authentication, connections | Source |
| E-25 | GitHub Actions on a public repository | Source |
| E-26 | Free email sender tiers | Source |

## 3. Details

### E-01 Versions and Next.js script policy

- Next.js: 16.4.3 was the latest stable in October 2026. The request proxy file is `proxy.ts`.
- Pyodide: 314.0.7, released 2026-09-14, Python 3.14. The version scheme now follows the Python version.
- Next.js content security policy guide for 16.4: nonces are generated in `proxy.ts`; pages that use a nonce must be dynamically rendered, which disables static optimization and incremental regeneration; partial prerendering is incompatible with nonce-based policies; the documented no-nonce option allows inline scripts; an experimental build-time integrity option (`experimental.sri`) allows static generation and may change or be removed; WebAssembly needs `'wasm-unsafe-eval'`.

Sources: [Next.js content security policy guide](https://nextjs.org/docs/app/guides/content-security-policy), [frontend frameworks release digest](https://releases.sh/collections/frontend-frameworks/digest/2026-10-19), [Pyodide changelog](https://pyodide.org/en/stable/project/changelog.html).

### E-02 Runtime size

Files shipped in the `pyodide` npm package, version 314.0.7:

| File | Raw | gzip | Brotli |
|---|---|---|---|
| `pyodide.asm.wasm` | 9.60 MB | 3.59 MB | 2.74 MB |
| `python_stdlib.zip` | 2.55 MB | 2.50 MB | 2.49 MB |
| `pyodide.asm.mjs` | 1.25 MB | 0.26 MB | 0.21 MB |
| `pyodide-lock.json` | 0.12 MB | 0.03 MB | 0.02 MB |
| `pyodide.mjs` | 0.02 MB | 0.01 MB | 0.01 MB |
| **Total** | **13.53 MB** | **6.39 MB** | **5.46 MB** |

The npm package contains everything the core runtime needs, so it can be served from our own origin with the lockfile as the integrity record.

### E-03 Module workers

The Pyodide changelog states that 314.0.0 dropped support for classic workers and that the loader files are ES modules. The prototype loaded it with `new Worker(url, { type: "module" })` and `import { loadPyodide } from ".../pyodide.mjs"`.

### E-04 Runtime behavior

| Measurement | Node worker thread | Chromium module worker |
|---|---|---|
| Start to ready, first time | 1.8 s | 2.3 to 2.4 s |
| Start to ready after a terminate | 1.9 s | 1.7 s |
| Check with 3 tests | 1 to 2 ms | Passed |
| `while True: pass` with a 2 s limit (Node) or 1.5 s (browser) | Terminated at 2.0 s | Terminated at 1.5 s; page stayed responsive |
| Run after respawn | Passed | Passed |
| Appending 10 MB strings forever | `MemoryError` reported as a runtime error; runtime still usable | Not run |

### E-05 Interactive input

In a Chromium module worker, with no `SharedArrayBuffer` and no cross-origin isolation headers, a Python program calling `input()` twice paused each time, received the answer from the page by `postMessage`, and continued. `can_run_sync()` returned true. Transcript: prompt, answer, prompt, answer, final line.

Mechanism: Python calls `run_sync()` on a promise returned by a JavaScript function; the entry call from JavaScript uses `callPromising()` so stack switching is enabled.

Finding: a JavaScript `null` arrives in Python as `JsNull` (`is None` is false, `str()` gives `"jsnull"`). `undefined` arrives as `None`. Signalling end of input with `null` produced a wrong error kind; with `undefined` it produced the right one.

### E-06 Harness

One pure-Python harness file ran unchanged on CPython 3.13 and inside Pyodide.

- For the lesson in `docs/later/full-plan/04-content-system.md` section 3: solution passed 3 of 3; an answer that printed a fixed name passed the first test and failed the other two; the empty starter failed all three.
- Syntax error, runtime error with line number, input ending early, and a print flood stopped at 64,000 characters were each reported as structured results.
- **Bug found**: restoring builtins with `vars(builtins).clear()` followed by `vars(builtins).update(...)` fails, because after the clear the name `vars` no longer exists. The fix holds references before learner code runs and uses none by name afterwards. Verified with learner code that sets `builtins.print = None` and deletes `builtins.len`.
- Tracebacks carried the right line number but empty line text, because the source was not registered with `linecache`.
- First sandbox test (`srcdoc`, no policy on the parent): message origin was `null`; reading `document.cookie`, `localStorage`, and the parent document each threw `SecurityError`; DOM and computed-style assertions worked; a link click did not navigate and opened no window, and the browser logged a console error about the blocked popup.

### E-07 Content security policy and the sandbox

All in Chromium, with this policy on every app response: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; worker-src 'self'; connect-src 'self'; frame-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'`.

| Test | Result |
|---|---|
| Pyodide starts and runs with `'wasm-unsafe-eval'` and without `'unsafe-eval'` | Yes, ready in 2.4 s |
| Interactive input under that policy | Works |
| `pyodide.code.run_js` (evaluating JavaScript from Python) | Refused |
| Sandbox as `srcdoc` under that policy | Learner `<style>` and `style` attributes blocked (`style-src-elem`, `style-src-attr`); CSS tests failed |
| Sandbox as a document loaded from a URL with its own policy | Learner CSS rule and inline style both applied; all tests passed; origin `null`; cookie and parent access threw |
| Same document with `sandbox allow-scripts` added to its policy, embedded | Works |
| Same document opened directly as a top-level page | Origin `null`; cookie and storage access threw |
| After start-up, deleting `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `Worker` and related from the worker global | From Python, `js.fetch`, `js.XMLHttpRequest`, `js.Worker` were `None`; twenty common standard library modules still imported |

Sandbox policy used in the passing tests is the one printed in `docs/later/full-plan/02-architecture.md` section 6.3.

### E-08 Stack switching support

WebAssembly JavaScript Promise Integration: Chrome and Edge 137 (May 2025), Firefox 153 (July 2026), Safari 27 on macOS and iOS (2026-09-14). Listed as newly available across browsers from 2026-09-14. Devices on earlier iOS versions do not have it, which is why the batch input path is a first-class requirement.

Source: [web features explorer](https://web-platform-dx.github.io/web-features-explorer/features/wasm-jspi).

### E-09 Supabase with Next.js

The current server-side guide uses `@supabase/supabase-js` and `@supabase/ssr`; environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; a root `proxy.ts` that refreshes the session; and `getClaims()` to protect server code, with a warning not to trust `getSession()` on the server.

Source: [Supabase server-side auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs?router=app).

### E-10 Google sign-in in embedded browsers

Google refuses OAuth inside embedded webviews with a 403 `disallowed_useragent` error. Reports name the Instagram and TikTok in-app browsers.

Source: [Auth0 community report](https://community.auth0.com/t/google-social-error-for-web-login-from-embedded-browsers/110494).

### E-11 Supabase limits

- Built-in email sender: 2 emails per hour; raising it requires a custom SMTP provider.
- One-time codes: 360 per hour by default; resend once per 60 seconds.
- The production checklist recommends a bot challenge on sign-up and sign-in endpoints.
- Free plan: 50,000 monthly active users, 500 MB database, 5 GB egress, two active projects, projects paused after a week of low activity, backups not downloadable.
- Pro plan: from 25 US dollars per month; no pausing; daily backups kept 7 days.

Sources: [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod), [project pausing](https://supabase.com/kb/faqs/platform/free-project-pausing), [pricing](https://supabase.com/pricing).

### E-12 Reference product walkthrough

Codedex, walked through in a real browser on 2026-11-11 without an account: catalog, the Python and HTML course pages, exercises 01 to 03 of Python, exercise 01 of HTML, the outline drawer, and the phone layout. Findings are in `03-experience.md` section 2.

The Python course page listed eight chapters with 43 exercises. Two chapters were open; six were marked as needing the paid plan.

One observation matters for this plan: exercise 02 asks the learner to print "Hello World!". Submitting `print('Hello')` was accepted, awarded XP, and advanced progress. This was one exercise on one day; it is recorded as the reason FR-GRD-05 exists, not as a general claim about that product.

Source: [codedex.io](https://www.codedex.io).

### E-13 Vercel

The free plan is restricted to non-commercial personal use; commercial use, which includes advertising the sale of a product or service, requires Pro or Enterprise. The free plan includes 100 GB of fast data transfer. Pro is 20 US dollars per month per developer seat and includes 20 US dollars of usage credit.

Sources: [fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines), [pricing](https://vercel.com/pricing).

### E-14 GitHub

Protected branches are available on public repositories with the free plan, and on public and private repositories with Pro, Team, and Enterprise.

Source: [about protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

### E-15 Pyodide browser versions

Pyodide's documentation lists the versions it is tested against: Chrome 112, Firefox 112, Safari 16.4, and Node.js 18 or newer.

Source: [Using Pyodide](https://pyodide.org/en/latest/usage/index.html).

### E-16 Pyodide streams

`setStdin`, `setStdout`, and `setStderr` accept handler objects. A stdin handler returns a string, bytes, a byte, or `undefined` or `null` for end of input. In a browser the default stdin is `prompt()`, which does not exist in a worker, so a handler must be set. Interrupting running Python needs a `SharedArrayBuffer`, which this design avoids by terminating the worker instead.

Sources: [streams](https://pyodide.org/en/latest/usage/streams.html), [interrupting execution](https://pyodide.org/en/latest/usage/keyboard-interrupts.html).

### E-17 antislop

Version 3.2.28. Read in full: the core rules, the guide, and all five skills.

- The installer (`npx antislop-ai`, Node 20.12 or newer) asks four questions, copies skill folders into `.claude/skills/`, and appends a pointer block to the end of `CLAUDE.md`.
- It is a filter, not a source of direction. Direction comes from `DESIGN.md`, which the owner authors (rule R-37).
- Two modes: `during` and `after`. `npx antislop-ai --mode during` saves the default.
- The Delivery Gate has four blocks and must be reported line by line with evidence.
- It includes a contrast checker script.

Source: [anti-slop repository](https://github.com/miqdadbadjuber/anti-slop).

### E-18 Claude Code

- `CLAUDE.md` should stay under 200 lines; it is context, not enforcement.
- `.claude/rules/*.md` files with a `paths` list load only when matching files are in play.
- Hooks are configured in `.claude/settings.json`, which can be committed. A command hook that exits with code 2 blocks the action. Events include `PreToolUse`, `PostToolUse`, and `Stop`.
- Permission rules use `allow`, `ask`, and `deny`; deny wins. Pattern rules on shell commands can be evaded by rewording, which is why server-side enforcement exists.
- Subagents are Markdown files in `.claude/agents/` with `name`, `description`, and optional `tools`; each starts with a fresh context.
- Skills are folders in `.claude/skills/<name>/SKILL.md`, invoked as `/name` with arguments.
- Attribution (checked 2026-11-14). By default Claude Code adds a `Co-Authored-By: <model> <noreply@anthropic.com>` trailer to commits and "Generated with Claude Code" to pull request descriptions, and in cloud and Remote Control sessions a `Claude-Session` link. The `attribution` key controls this: `commit: ""` and `pr: ""` hide the trailer and the line, and `sessionUrl: false` drops the link. `attribution: false` also hides everything, but needs v2.1.281 or later; older versions reject it and skip the whole settings file, so the kit uses the empty-string form. `includeCoAuthoredBy` is deprecated.
- Claude Code tells the model that attribution rules in `CLAUDE.md` take precedence over its default lines.
- Shared project settings (`.claude/settings.json`) override user settings. A personal `.claude/settings.local.json` overrides both.
- Cloud sessions read only some settings. In a claude.ai project thread, a repository's permission rules, hooks, and `env` do not apply, which is one more reason the pipeline enforces attribution.

Sources: [hooks](https://code.claude.com/docs/en/hooks), [subagents](https://code.claude.com/docs/en/sub-agents.md), [permissions](https://code.claude.com/docs/en/permissions.md), [memory](https://code.claude.com/docs/en/memory.md), [skills](https://code.claude.com/docs/en/skills.md), [settings reference: Git and attribution](https://code.claude.com/docs/en/settings-reference.md), [settings files and precedence](https://code.claude.com/docs/en/settings.md).

### E-19 Brand color contrast

Computed with the WCAG 2 formula. Near-black here is `#0B0B0C`, a stand-in until the brand book's black is known.

| Text on background | Ratio | AA normal text |
|---|---|---|
| `#FFEBD1` on `#0B0B0C` | 16.92 | Pass |
| `#D4A017` on `#0B0B0C` | 8.28 | Pass |
| `#0B0B0C` on `#D4A017` | 8.28 | Pass |
| `#FFFFFF` on `#D4A017` | 2.38 | Fail |
| `#FFEBD1` on `#520423` | 12.89 | Pass |
| `#D4A017` on `#520423` | 6.31 | Pass |

### E-20 Supabase second sign-in step

Checked 2026-11-15.

- Supabase Auth supports a second factor with an authenticator app (TOTP). The documentation states that the TOTP API is free to use and is enabled on all projects by default.
- Calls in the JavaScript client: `supabase.auth.mfa.enroll({ factorType: 'totp' })` returns the factor ID and a QR code; `supabase.auth.mfa.challenge({ factorId })` returns a challenge ID; `supabase.auth.mfa.verify({ factorId, challengeId, code })` completes it; `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` returns `currentLevel` and `nextLevel`; `supabase.auth.mfa.listFactors()` lists enrolled factors.
- The assurance level is the `aal` claim in the session token: `aal1` after a normal sign-in, `aal2` after a second factor. A token without the claim counts as `aal1`.
- The documented way to enforce it in the database is a policy condition `(select auth.jwt()->>'aal') = 'aal2'`. The documentation shows it as a restrictive policy for all users of a table; this plan puts the same condition inside `private.is_admin()` so that it applies to the admin only.
- After unenrolling a factor, the documentation says to call `refreshSession()` for the level to change at once.

Sources: [multi-factor authentication](https://supabase.com/docs/guides/auth/auth-mfa), [authenticator app flow](https://supabase.com/docs/guides/auth/auth-mfa/totp).

### E-21 Next.js nonces, rendering, and the data cache

Checked 2026-11-15 against the current documentation.

- The content security policy guide generates the nonce in `proxy.ts` and states that pages must be dynamically rendered to use it, that static optimization and incremental regeneration are then disabled, and that partial prerendering is incompatible with a nonce-based policy.
- The framework applies the nonce to its own scripts by reading the policy header of the request. `await connection()` opts a page into dynamic rendering.
- In development `'unsafe-eval'` is required for debugging; the guide states it is not required in production.
- The alternatives the guide offers for static pages are a policy that allows inline scripts, or an experimental build-time integrity option that may change or be removed.
- Without the Cache Components mode, a database query is cached with `unstable_cache(fn, keyParts, { tags, revalidate })` from `next/cache`, and invalidated with `revalidateTag(tag, 'max')` from a server action or a route handler. With that mode, the equivalents are the `use cache` directive with `cacheTag`, and `updateTag`, which works only in server actions.

Consequence for this plan: every page is rendered per request, content is cached as data, and Cache Components stays off (ADR-0028).

Sources: [content security policy guide](https://nextjs.org/docs/app/guides/content-security-policy), [caching without Cache Components](https://nextjs.org/docs/app/guides/caching-without-cache-components), [revalidating](https://nextjs.org/docs/app/getting-started/revalidating).

### E-22 Rate limiting and the bot challenge

Checked 2026-11-15.

- Vercel's firewall: custom rules, address blocking, and attack mitigation are free on all plans. Rate limiting is a priced feature, billed by usage on the Pro plan. Traffic the firewall denies does not count as requests or data transfer.
- Supabase Auth supports hCaptcha and Cloudflare Turnstile. The documentation says the challenge can protect sign-in, sign-up, and password reset forms, and shows the token passed as `options: { captchaToken }` on a sign-up call. That the same option protects an email code request is an inference from the client library's interface, not a statement on that page. WP-2.2 confirms it.

Sources: [firewall usage and pricing](https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing), [bot challenge for auth](https://supabase.com/docs/guides/auth/auth-captcha).

### E-23 Vercel Hobby

Checked 2026-11-15. Terms last updated 2026-10-19; Hobby plan page last updated 2026-11-12; rate limiting page last updated 2026-08-28.

- Terms, section 4: "You shall only use the Services under a Hobby plan for your personal or non-commercial use." No definition of commercial use was found in the terms. Vercel may "disable or remove any Project or website deployment on the Hobby plan with or without notice."
- Included per month: 100 GB fast data transfer, 10 GB fast origin transfer, 1,000,000 function invocations, 4 active CPU-hours, 360 GB-hours of provisioned memory.
- "In most cases, if you exceed your usage limits on the Hobby plan, you will have to wait until 30 days have passed before you can use the feature again." There are no billing cycles on Hobby.
- "WAF Rate Limiting is available on all plans." A Hobby project has one rate-limit rule within three custom firewall rules, keyed by address or JA4 digest, fixed window from 10 seconds to 10 minutes, with 1,000,000 allowed requests included. This corrects the first bullet of E-22, which said rate limiting was a Pro feature.
- Deploy from GitHub Actions: `vercel build`, then `vercel deploy --prebuilt`, with `--prod` for production. CLI uploads are limited to 100 MB of source on Hobby. A Hobby project cannot connect to a repository owned by a GitHub organization.

Sources: [terms](https://vercel.com/legal/terms), [Hobby plan](https://vercel.com/docs/plans/hobby), [limits](https://vercel.com/docs/limits), [rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting), [Vercel for GitHub](https://vercel.com/docs/deployments/git/vercel-for-github).

### E-24 Supabase Free

Checked 2026-11-15. No page showed a date.

- Free plan: 500 MB database, 5 GB egress, 50,000 monthly active users, two active projects. "Free projects are paused after 1 week of inactivity." The pages do not define activity or a restore window.
- Backups: "Automatic backups: Not included" on Free. The backups guide recommends that free projects "regularly export their data using the Supabase CLI `db dump` command and maintain off-site backups."
- Multi-factor authentication: "Basic Multi-Factor Auth: Included" on Free; the phone factor is a paid add-on. That the basic factor is the authenticator app (TOTP) is an inference from the MFA guide, which lists the app authenticator and defines `aal2`. WP-2.3 confirms it.
- Custom SMTP is included on Free. With a custom sender, "a low rate-limit of 30 messages per hour is imposed", which can be changed on the rate limits page.
- Connections: pg_dump needs a direct or session-mode connection. On Free the direct connection is IPv6 only; "The shared pooler is IPv4-only on every plan." Whether GitHub-hosted runners reach either reliably, and whether dumps count toward egress, is not documented.

Sources: [pricing](https://supabase.com/pricing), [backups](https://supabase.com/docs/guides/platform/backups), [MFA](https://supabase.com/docs/guides/auth/auth-mfa), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [connecting](https://supabase.com/docs/guides/database/connecting-to-postgres), [pooling and limits](https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits).

### E-25 GitHub Actions on a public repository

Checked 2026-11-15. No page showed a date.

- "GitHub Actions usage is free for standard GitHub-hosted runners in public repositories."
- Artifact storage on GitHub Free: 500 MB. "GitHub Support cannot increase storage limits for GitHub Actions."
- "With the exception of `GITHUB_TOKEN`, secrets are not passed to the runner when a workflow is triggered from a forked repository." Workflows on `pull_request_target` run in the context of the base branch.
- Who may download artifacts from a public repository is not stated. The download endpoint says only that tokens "need the repo scope". ADR-0030 assumes anyone can.
- The maximum artifact retention for public repositories was not found on the pages read.

Sources: [billing](https://docs.github.com/en/actions/administering-github-actions/usage-limits-billing-and-administration), [limits](https://docs.github.com/en/actions/reference/limits), [secrets](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions), [artifacts API](https://docs.github.com/en/rest/actions/artifacts), [repository Actions settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository).

### E-26 Free email sender tiers

Checked 2026-11-15. No page showed a date.

- Resend free: 3,000 emails a month; "The Free plan is limited to 100 emails per day." SMTP relay and 3 custom domains are included. The page states no commercial-use restriction and no branding.
- MailerSend free: 500 emails a month, SMTP relay, 1 sending domain. Its logo probably appears on free emails, which is an inference from the plan table.
- Brevo's pricing page did not render its content when fetched. Not compared.

Sources: [Resend pricing](https://resend.com/pricing), [MailerSend pricing](https://www.mailersend.com/pricing).

## 4. Reference snippets

Excerpts from the prototypes that ran. They show the calls that matter. They are evidence and a starting point for Day 3, not production code: no schemas, no tests, no error handling.

### 4.1 Interactive input without shared memory (worker)

```js
import { loadPyodide } from "/_runtime/pyodide/314.0.7/pyodide.mjs";

const pyodide = await loadPyodide({ indexURL: "/_runtime/pyodide/314.0.7/" });

let pendingInput = null;
pyodide.registerJsModule("heap_bridge", {
  // Python waits on this promise. The page answers with an "input" message.
  request_input: () =>
    new Promise((resolve) => {
      pendingInput = resolve;
      self.postMessage({ type: "input_request" });
    }),
  emit: (text) => self.postMessage({ type: "output", text }),
});

pyodide.runPython(`
import sys, heap_bridge
from pyodide.ffi import run_sync

def interactive_input(prompt=""):
    if prompt:
        sys.stdout.write(str(prompt))
    line = run_sync(heap_bridge.request_input())
    if line is None:          # the page sends undefined, never null
        raise EOFError("EOF when reading a line")
    return str(line)
`);

self.onmessage = async (event) => {
  const message = event.data;
  if (message.type === "input") pendingInput?.(message.line);
  if (message.type === "run") {
    // callPromising enables stack switching for this call into Python.
    const json = await runInteractive.callPromising(message.source);
    self.postMessage({ type: "run_done", result: JSON.parse(json) });
  }
};
```

### 4.2 Restoring builtins safely (Python harness)

```python
_BUILTINS = builtins.__dict__

def _restore(target, snapshot, _dict_update=dict.update, _list=list):
    # No builtin may be looked up by name here: learner code may have removed it.
    for key in _list(target):
        if key not in snapshot:
            del target[key]
    _dict_update(target, snapshot)
```

### 4.3 Removing network access after start-up (worker)

```js
for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource",
                    "Worker", "SharedWorker", "importScripts", "BroadcastChannel"]) {
  try { delete self[name]; } catch {}
  try { Object.defineProperty(self, name, { value: undefined, writable: false, configurable: false }); } catch {}
}
// Still to do in WP-3.1: the same on every object in the global's prototype chain.
```

### 4.4 Sandbox document (for the later HTML and CSS course)

Served with the policy in `docs/later/full-plan/02-architecture.md` section 6.3.

```js
// /_sandbox/frame.js, running in an opaque origin
window.addEventListener("message", (event) => {
  if (event.source !== parent || event.data.type !== "render") return;
  render(event.data.files);
  const results = runAssertions(event.data.tests);
  parent.postMessage({ type: "check_done", results }, "*");
});
parent.postMessage({ type: "sandbox_ready" }, "*");
```

```js
// App page
const frame = document.createElement("iframe");
frame.setAttribute("sandbox", "allow-scripts");
frame.title = "Preview";
frame.src = "/_sandbox/frame.html";
window.addEventListener("message", (event) => {
  if (event.source !== frame.contentWindow) return; // the only sender we accept
  // parse event.data with a schema before use
});
```
