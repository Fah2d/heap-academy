# Start here

This is for you, Fahad. Everything else in the kit is written for Claude Code.

## What this is

A specification kit for the first release of the Heap Academy practice platform, built in eight days. You put it in an empty repository, and Claude Code builds the product from it one work package at a time: 30 work packages over 8 days. Each one ends in a pull request you review and merge. Each day ends with a day check.

The "master prompt" is one line (section 3). The substance is in the files, so every session starts from the same written truth and nothing depends on a long chat.

## 1. What you have on Day 8

- An admin dashboard at `/admin`, locked to you with an authenticator app. You create courses, chapters, lessons, and test cases there, and publish with no deploy.
- A lesson cannot go live unless its solution passes every test case and its starter code fails at least one. Any wrong answer you record must fail too.
- For learners: a course list, course pages, and a lesson workspace with the instructions on the left, the editor on the right, a console that answers `input()`, and the test cases with expected and actual output.
- Python runs in the learner's browser. No server runs learner code, so there is no cost per run.
- Anyone can learn without an account. Signing in with Google or an email code keeps progress, XP, and streak across devices.
- Tests, security controls, monitoring, backups, and runbooks, enforced by the pipeline and not by good intentions.

No lessons come with the kit. You write them in the dashboard, starting on Day 4.

## 2. Before Day 1

About an hour. Start the first item now: it can take hours to be approved.

1. **The slow part**: buy or pick the domain. Start the email sender's domain verification. Create the Google sign-in client and its consent screen.
2. **Tools on your computer**: Node.js (current LTS), pnpm, Git, the GitHub CLI signed in, Docker (for the local database), and Claude Code. An authenticator app on your phone.
3. **Accounts**: a paid GitHub plan, Vercel Pro, Supabase, an email provider, and a bot challenge (Cloudflare Turnstile or hCaptcha). Claude Code tells you on Day 1 which projects to create.
4. **Repository**: create an empty **private** GitHub repository and clone it. Unzip this kit into it from a terminal, because copying by hand in Finder or Explorer can miss the hidden `.claude` folder:

   ```
   unzip heap-academy-spec-kit.zip -d path/to/your/repo
   ```

   On Windows PowerShell: `Expand-Archive heap-academy-spec-kit.zip -DestinationPath path\to\your\repo`. Afterwards `CLAUDE.md` sits at the top level, and `.claude/settings.json` and `.claude/skills/work-package/SKILL.md` exist.
5. **Brand kit**: copy your logo, mark, mascot files, fonts, colors, and brand book into `brand/`. See `brand/README.md`.
6. **antislop**: in the repository folder run

   ```
   npx antislop-ai
   ```

   Answer its four questions: select all the extra skills; install location `This project`; agent `Claude Code`; then confirm. It copies its skills into `.claude/skills/` and adds a block to the end of `CLAUDE.md`. Then run

   ```
   npx antislop-ai --mode during
   ```

   so it never stops to ask which mode to use.
7. **First commit**: commit everything and push to `main`. This is the only time anything goes straight to `main`; from here on every change arrives as a pull request.
8. **Open a new Claude Code session** in the folder. antislop and the kit's rules load when a session starts.

## 3. Run it

First message, exactly this:

```
/work-package WP-1.1
```

That one line is the whole prompt. After that, one line per work package, each in a fresh session, in the order of `docs/spec/08-delivery-plan.md`:

```
/work-package WP-1.2
```

Every evening:

```
/day-check 1
```

Where the plan says two packages can run side by side, open a second Claude Code session for the second one. That is what makes each day fit. Claude Code stops after each pull request and waits for you.

## 4. The eight days

| Day | What exists at the end |
|---|---|
| 1 | Decisions made, design direction signed, a first page live through every check |
| 2 | The database with its policies, sign-in, and the admin area locked to you |
| 3 | Python runs, takes input, is stopped, and is graded, in three browsers and on your phones |
| 4 | The admin dashboard: courses, lessons, test cases, validation, publishing |
| 5 | A guest can learn a lesson end to end on a phone |
| 6 | Accounts keep progress across devices, with XP and streak |
| 7 | Security, accessibility, performance, and operations checked and recorded |
| 8 | Launch lessons checked, the site live on your domain |

The time boxes in the plan are estimates. They were not measured.

## 5. What only you can do

| When | You |
|---|---|
| Every work package | Open the preview link, try it, read the pull request, merge. Aim for fifteen minutes each. |
| Day 1 | Answer the decision sheet ("accept all" or name the changes). Answer the design interview and sign `DESIGN.md`. Create the Vercel project and two Supabase projects. Turn on branch protection. Put secrets where the runbook says, never in the repository. Point the domain. |
| Day 2 | Enter the Google client and the email sender in Supabase. Create the bot challenge keys. Try the email code inside TikTok and Instagram. Make yourself the admin and enroll your authenticator app. |
| Day 3 | Run the test page on a real iPhone and a real Android phone, in the browser and inside TikTok and Instagram. |
| Day 4 onward | Write lessons. Publish your first one on Day 4. |
| Day 5 | Complete a lesson on a real phone. Time yourself writing one. |
| Day 6 | Read and approve the privacy policy and terms. |
| Day 7 | Move production to Supabase Pro. Create the uptime check and spend alerts. Do one rollback and one restore from the runbooks. Test on your phones. |
| Day 8 | Pass every launch lesson yourself on a phone. Walk the launch checklist. Say go. |

## 6. What it costs

Checked on 2026-11-13 and 2026-11-15. Confirm before paying; prices change.

| What | Why you cannot skip it | Cost |
|---|---|---|
| Vercel Pro | The free plan is for non-commercial use only. Rate limiting is billed by usage. | 20 US dollars a month, plus usage |
| Supabase | Free works for staging. Free projects pause after a week of low activity and have no downloadable backups, so production moves to Pro before launch. | Free, then 25 US dollars a month |
| GitHub paid personal plan | Branch protection on a private repository is not in the free plan. | See GitHub's pricing |
| Email provider | Supabase's built-in sender is limited to 2 emails an hour, so sign-in codes need a real sender. | Pick a plan whose daily cap covers your launch-day sign-ups |
| Bot challenge, uptime check | | Free tiers |
| Domain | | Yearly |

Two costs grow with success: the Python runtime is about 5.5 MB per new learner, downloaded once and then cached (ten thousand new learners is roughly 55 GB of transfer), and every page view runs a small function. Both show on Vercel's usage page. `docs/spec/07-operations.md` section 9 says what to do when they get large.

## 7. Decisions made for you

WP-1.1 shows all of these on one sheet, each with what changes if you choose differently. The main ones:

- Python only, in English. Every lesson is free and open, and nothing is locked behind another lesson (your answers).
- You type test cases into the dashboard: an input, the expected output, and optional follow-up code for checking a variable or a function (your answer).
- Anyone can learn; signing in saves progress (your answer).
- No AI credit anywhere in the repository (your instruction). The kit turns Claude Code's attribution off in `.claude/settings.json`, and from Day 1 the pipeline blocks any commit or pull request that carries it.
- Lessons live in the database, not in files, so you publish without a deploy.
- The dashboard asks for your authenticator code at the start of each session. You are the only admin, set once by a runbook.
- Every page is rendered per request, so the strictest script security policy works. It costs a little compute per page view; the point at which to change it is written down.
- Grading runs in the browser, so a learner could fake their own XP. Nothing depends on XP yet.
- Dark theme only. English only, but built so Arabic can be added later.
- The seven blocks of the heap mark as the progress indicator. This one is a proposal that needs your yes.

## 8. What waits

The HTML and CSS course, the paid tier, locked lessons, showing the solution, lesson reports, hidden test cases, images in lessons, and more admins. The full list, with the reason for each and when to revisit it, is in `docs/spec/00-charter.md` section 4. Their designs are kept in `docs/later/full-plan/` for after launch.

## 9. If a day slips

The plan has a cut order: seven small features that leave, one at a time, before anything else does (`docs/spec/08-delivery-plan.md` section 1.4). It also has a list of what is never cut: the security controls, the tests, and the rule that a broken lesson cannot be published. If cutting is not enough, you choose between moving the launch and dropping a feature. Claude Code never makes that choice for you.

## 10. What was proven, and what was not

Before this plan was written, the risky parts were prototyped and run: Python in a browser worker, `input()` that pauses for the learner, stopping an infinite loop without freezing the page, and grading with a test harness, under a strict security policy. The prototypes exposed several real traps, and each is written into the plan with its fix.

All of that ran in one browser engine (Chromium). Firefox, Safari, and real phones were not available. Day 3 repeats every check there, inside the real app, before anything is built on top. The dashboard's second sign-in step, the security policy on a real build, and the bot challenge on email codes come from current documentation and are first tested on Days 1 and 2. `docs/spec/09-evidence.md` lists exactly what was and was not verified.

## 11. What is in the kit

| Path | What |
|---|---|
| `CLAUDE.md` | The rules Claude Code loads every session |
| `docs/spec/00` to `09` | Charter, requirements, architecture, experience, lessons and grading, engineering handbook, security, operations, the eight-day plan, evidence |
| `docs/adr/` | The decision records. Those in force wait for your yes on Day 1 |
| `docs/templates/` | Pull request, day report, spike report |
| `docs/later/` | The original ten-phase plan, archived for after launch |
| `.claude/settings.json` | Claude Code settings. Attribution is off from the first session; WP-1.2 adds the guardrails |
| `.claude/rules/` | Standards that load when matching files are edited |
| `.claude/agents/` | Three independent reviewers: code, security, design |
| `.claude/skills/` | The procedures behind `/work-package`, `/day-check`, and `/adr` |
| `brand/` | Where your brand kit goes |
