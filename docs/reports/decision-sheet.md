# Decision sheet (WP-1.1)

Every decision in force for the first release, on one page. Answer "accept all", or name the rows you want changed. A changed row gets a new ADR that supersedes the old one.

Date prepared: 2026-11-15.

## Owner's answer (2026-11-15)

Every row is accepted as written, except:

- **ADR-0002 and A-04**: superseded by ADR-0029, zero-cost hosting. The repository is public on GitHub Free, the app runs on Vercel Hobby, and Supabase Free hosts staging and production. Resend free sends email. Rate limits use the one Hobby firewall rule plus the Postgres counters. The owner accepted the Vercel Hobby terms risk, the 30-day lockout past a limit, Supabase pausing, and the 100-emails-a-day cap, together with the triggers in ADR-0029.
- **Backups**: ADR-0030. A nightly dump is encrypted with `age` to the owner's public key and kept as a 7-day workflow artifact.
- **A-06**: superseded by ADR-0031. There is no brand kit. The wordmark is text in IBM Plex Sans, there is no illustration, and the heap-mark progress glyph is dropped.
- **ADR-0015**: accepted, with its context corrected. The CRT reason is removed, and the reason of verification cost stays.

The table below is the sheet as it was presented.

## 1. Architectural decisions in force

Records that are already Superseded (0001, 0008, 0009, 0010, 0021) or Deferred (0006, 0018) are not on this sheet. They need no answer.

| ADR | Default | What changes if you choose otherwise |
|---|---|---|
| 0002 | Next.js App Router on Vercel Pro. Production deploys from CI, not from the host's automatic deploy. | Another framework or host rewrites the plan from WP-1.2. Cloudflare hosting is free for commercial use but needs more adaptation work. The Vercel free plan is not allowed for commercial use (E-13). |
| 0003 | Learner code runs only in the browser. No server runs learner code. | A server sandbox adds cost per run, an abuse surface, and operations work. It does not fit eight days. |
| 0004 | Pyodide in a module worker, served from our own origin, standard library only. | A public CDN adds a third party to the critical path. MicroPython is smaller but has different errors and a partial standard library. |
| 0005 | `input()` pauses for the learner where the browser supports stack switching. Elsewhere the learner types input before Run. | Shared memory needs cross-origin isolation headers on the lesson route. A service worker adds its own failure modes. |
| 0007 | The browser reports completions. The database checks identity, the published state, and one completion per lesson. A learner can forge their own XP. | Verified completions need server-side execution and a new ADR. |
| 0011 | Guest-first progress in the browser, merged to the account on sign-in. | Anonymous server accounts create a row for every visitor and bot. Sign-up before the first lesson fails goal G-1. |
| 0012 | XP and streak are always computed from completions. No stored totals. | Stored counters can drift. Leaderboards would need aggregates later. |
| 0013 | CodeMirror 6 as the editor. | Monaco is larger and not built for phones. A plain text area has no highlighting. |
| 0014 | Tokens as CSS custom properties, Tailwind CSS, React Aria Components. No pre-styled kit. | A pre-styled kit gives a look shared with thousands of sites. Hand-written behavior is an accessibility risk. |
| 0015 | Dark theme only, behind a token contract. | A light theme now doubles the states to check before launch. |
| 0016 | English only. Strings in `src/messages`, logical CSS properties, one direction setting, enforced by lint. | Arabic now adds translation and right-to-left checks to every screen. Dropping the readiness makes Arabic a rewrite later. |
| 0017 | Sign-in with Google and a six-digit email code. No passwords. | Email links finish in the wrong browser inside TikTok and Instagram. Apple sign-in needs a paid developer membership. |
| 0019 | Errors and events go through ports, with console and host adapters. No custom product events yet. | Calling vendor libraries directly brings lock-in and the risk of leaking personal data. |
| 0020 | The workspace lifecycle is an explicit statechart in `src/runtime`. Library or typed reducer decided in WP-3.4. | State spread across components brings races between run, stop, restart, and input. |
| 0022 | The eight-day scope: charter section 5. The HTML and CSS course and the paid tier wait. | Adding scope moves the launch or cuts from the list in plan section 1.4. |
| 0023 | One Next.js package at the root. Module boundaries are enforced by lint import rules. | The monorepo of ADR-0001 isolates more strongly and costs setup time that eight days cannot spare. |
| 0024 | Lessons live in the database and are written in the `/admin` dashboard. Publishing needs no deploy. | Lessons as files in the repository need a pull request and a deploy for each lesson. |
| 0025 | Admin means a row in `admins` plus an authenticator code (`aal2`), both checked by the database. `/admin` answers "not found" to anyone else. | A role field in user metadata is one writable field away from privilege escalation. |
| 0026 | One test case model: input, expected output, comparison mode, optional hint, optional follow-up code. Every test case is visible. The dashboard validates in your browser before publishing. | Syntax tree checks ("must use a loop") are more expressive and harder to write in a form. Server validation needs server Python. |
| 0027 | Supabase. Every mutation is a server action behind one wrapper. Row level security decides every read and write. | The versioned API of ADR-0010 gives better contracts and needs more building. |
| 0028 | One nonce-based script policy on every page. Every page renders per request. | Static pages need a weaker script policy, or an experimental build option that may be removed. |

## 2. Assumptions

| ID | Default | What changes if it is wrong |
|---|---|---|
| A-01 | Python only. Interface and lessons in English. | Another language needs a new runtime and a course. |
| A-02 | Every published lesson is free and works without an account. | A paid tier is a later project (ADR-0018). |
| A-03 | Sign-in with Google and a six-digit email code. No passwords. | Change ADR-0017. |
| A-04 | Vercel Pro and Supabase. Production Supabase moves to Pro before launch. | Change ADR-0002 or ADR-0027. |
| A-05 | You have a domain, or buy one on Day 1. | Email sending and Google sign-in both wait for it. Launch slips by the verification time. |
| A-06 | The brand kit is in `/brand` before WP-1.1. | **Wrong today.** `/brand` holds only its README. No interface work (WP-1.4) can start until the files arrive. See `docs/reports/brand-check.md`. |
| A-07 | You write every lesson in the dashboard. The implementer writes none. | Add time for drafting and review. |
| A-08 | Every published lesson is open. Nothing is locked behind another lesson. | Add an order rule later. |
| A-09 | You are the only admin. | Roles and an audit log come first. |
| A-10 | Minimum age 13, as a placeholder until legal review. | The legal reviewer sets the rule. |
| A-11 | Lessons are text and code. No images. | Add image upload later. |
| A-12 | Pages render per request so the strict script policy works (ADR-0028). | Revisit when traffic makes it slow or costly. |
