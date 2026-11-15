# 00 Project Charter

Status: Accepted by the owner on 2026-11-15 through the decision sheet (WP-1.1, `docs/reports/decision-sheet.md`).
Owner: Fahad (product owner and sole approver).
Release: the first release, built in eight days. The original ten-phase plan is archived in `docs/later/` and is not in force.
Last verified against external facts: 2026-11-15 (see `09-evidence.md`).

## 1. Purpose

Heap Academy is the coding practice platform of Heap, a tech education brand. A learner opens a course, reads a short lesson on the left, writes real Python on the right, runs it, and checks it against visible test cases. The code runs in the learner's browser. The owner creates every course, lesson, and test case in an admin dashboard, and publishing needs no deploy.

This charter fixes what the first release is, what it is not, who decides, and what we assume. Every other document in `docs/spec/` derives from it.

## 2. Problem

Short videos create interest in programming but give the viewer nothing to do next. The reference product the owner studied has a game theme that is not Heap's, marks most of its Python course as paid, and on the day it was examined accepted a wrong answer on one exercise (`09-evidence.md` E-12). Heap needs its own place where a viewer can go from a video to writing working code within a minute, where a pass means the code is right, and where the owner can add a lesson on the day he thinks of it.

## 3. Goals

| ID | Goal | How we will know |
|---|---|---|
| G-1 | A first-time visitor on a phone can run real Python without an account. | Journey J-1 passes in three browser engines and on the owner's phones. |
| G-2 | A pass is trustworthy. | No lesson can be published unless its solution passes every test and its starter fails at least one (FR-GRD-05). |
| G-3 | Progress is never lost. | Guest progress survives reloads; account progress survives devices; no completion is dropped (NFR-REL-01). |
| G-4 | The product reads as designed, not generated. | The antislop Delivery Gate passes on every screen; the owner signs `DESIGN.md`. |
| G-5 | The owner can write and publish a lesson in the dashboard in under 15 minutes, with no deploy. | Journey J-8, timed by the owner on Day 5. |
| G-6 | Running cost stays near zero per learner. | No server executes learner code (NFR-COST-01). |
| G-7 | It is safe to point a viral video at it. | Every control in `06-security-privacy.md` has a passing test; the admin area needs a second sign-in step. |
| G-8 | Live in eight days. | The launch checklist in `08-delivery-plan.md` section 4. |

## 4. What waits

These are deliberate. Each has a reason, and most have a finished design in `docs/later/full-plan/`.

| Not in this release | Why | Revisit when |
|---|---|---|
| HTML and CSS course and its sandbox | A second runtime with its own security design (ADR-0006). | The Python course is live and the owner wants a second course. |
| Paid tier | Nothing is sold through the platform yet (ADR-0018). | The owner sells a membership. |
| Lessons locked behind earlier lessons | More states and guards; open lessons suit visitors from a video. | Learners skip ahead and fail. |
| Showing the solution, lesson reports, data download, site notice, lesson outline drawer, resizable panes | Each is small, none is needed to learn. | After launch, by demand. |
| Hidden test cases, images in lessons, per-lesson time limits | Text, code, and visible tests cover a beginner course. | A lesson needs one. |
| Lessons as files in the repository | Replaced by the dashboard (ADR-0024). | Never, unless authors want pull requests. |
| Server-side code execution, competitions, certificates | Needs a judging service; client-side grading can be forged (ADR-0007). | A competition is scheduled. |
| More than one admin, roles, an audit log | One owner writes the lessons. | A second author joins. |
| Arabic interface, light theme | Owner decisions; the seams stay cheap (ADR-0015, ADR-0016). | The owner asks. |
| Leaderboards, badges, AI tutor, native apps | Not needed to learn Python. | Field data asks for them. |
| Component gallery, visual comparison tests, mutation tests, requirement tracing tool | Process weight that eight days cannot carry. | The codebase has more than one implementer. |

## 5. Scope summary

Detailed requirements are in `01-requirements.md`.

- **Must**: home page, course list, course page, lesson workspace (instructions, editor, console with live input, visible tests), Python runtime in the browser, guest progress, sign-in with Google or an email code, synced progress, XP, streak, profile, account deletion, admin dashboard (courses, chapters, lessons, test cases, validation, publishing, preview), security baseline, accessibility basics, privacy and terms pages, monitoring, backups.
- **Should**: live editor on the home page, export and import of lessons as JSON, completion counts in the dashboard, symbol row above the phone keyboard, plain-language explanations for common Python errors, near-miss messages for almost-right output.
- **Not now**: everything in section 4.

## 6. Roles

| Role | Who | Responsibilities |
|---|---|---|
| Product owner and approver | Fahad | Answers the decision sheet, signs `DESIGN.md`, reviews and merges every pull request, writes every lesson, owns accounts, secrets, domain, device testing, and the launch decision. |
| Implementer | Claude Code (main session) | Plans and builds one work package at a time under `05-engineering-handbook.md`. Never merges its own work. |
| Independent reviewers | Claude Code subagents in `.claude/agents/` | Review with a fresh context. Read-only. Report findings; do not fix. |
| Legal reviewer | A qualified person the owner chooses | Reviews the privacy policy and terms. For this release the owner approves the text; the review happens before any paid feature. |

Decision rights: the owner decides product, design, content, budget, and risk acceptance. The implementer decides implementation details inside the decisions in `docs/adr/`. Changing a decision needs the owner.

## 7. Constraints

- **Time**: eight days, with the owner available all day. Scope is cut before quality is (`08-delivery-plan.md` section 1.4).
- **People**: one owner. Each pull request is sliced to be reviewed in about fifteen minutes.
- **Budget**: zero running cost except the domain (ADR-0029). Free-tier limits and the triggers to leave them are in `07-operations.md` section 9.
- **Repository**: public (ADR-0029).
- **Brand**: no brand kit. A text wordmark, IBM Plex type, and an amber accent, as set in `DESIGN.md` (ADR-0031). No brand asset is generated by the implementer.
- **Audience**: Arabic-speaking learners in the Gulf, arriving mostly on phones from TikTok and Instagram.
- **Honesty**: no invented numbers, testimonials, or claims anywhere in the product.
- **Authorship**: the repository carries no AI attribution (`05-engineering-handbook.md` section 4.1).

## 8. Assumptions

Each assumption is a decision made on the owner's behalf. The owner confirms or changes them in WP-1.1. Changing one may change the plan.

| ID | Assumption | If wrong |
|---|---|---|
| A-01 | The first release teaches Python only. Interface and lessons are in English. | Another language is a new runtime plus a course; see `docs/later/`. |
| A-02 | Every published lesson is free and usable without an account. | A paid tier is a later project (ADR-0018). |
| A-03 | Sign-in methods are Google and a six-digit email code. No passwords. | Change ADR-0017. |
| A-04 | Hosting is free: a public GitHub repository, Vercel Hobby, Supabase Free for staging and production with nightly encrypted backups, and Resend free for email (ADR-0029, ADR-0030). | A trigger in ADR-0029 fires: move that vendor to its paid plan. |
| A-05 | The owner has a domain, or buys one on Day 1. Email sending and Google sign-in both need it. | Launch slips by the time verification takes. |
| A-06 | There is no brand kit. The wordmark is text, there is no illustration, and `DESIGN.md` holds every visual value (ADR-0031). | The owner supplies brand files later; a new ADR decides where they appear. |
| A-07 | The owner writes the lessons in the dashboard. The implementer writes no lesson content. | Add time for drafting and review. |
| A-08 | Every published lesson is open. Nothing is locked behind another lesson. | Add an order rule later. |
| A-09 | The owner is the only admin. | Add roles and an audit log first. |
| A-10 | Minimum age is 13. This is a placeholder until legal review. | The legal reviewer sets the rule. |
| A-11 | Lessons are text and code. No images. | Add image upload later. |
| A-12 | Pages are rendered per request so a strict script policy can be used (ADR-0028). | Revisit when traffic makes this slow or costly. |

## 9. Success measures

Measured, not promised. No target is claimed before there is data.

| Measure | Definition |
|---|---|
| Activation | Sessions that reach a first successful Run, divided by sessions that open a lesson |
| First lesson completion | Sessions that pass the first lesson, divided by sessions that open it |
| Return rate | Learners active on day 7 after their first completion |
| Runtime reliability | Successful runtime loads divided by attempts |
| Authoring time | Minutes from opening a new lesson in the dashboard to publishing it |

## 10. Glossary

Use these words in code, copy, and documents. Do not introduce synonyms.

| Term | Meaning |
|---|---|
| Course | An ordered set of chapters about one subject. |
| Chapter | An ordered set of lessons inside a course. |
| Lesson | One screen of work: instructions, an editor, and test cases. |
| Starter | The code a learner sees when a lesson opens. |
| Solution | The owner's correct answer. Never sent to a learner. |
| Wrong answer | A typical mistake the owner records so that validation proves the tests catch it. |
| Test case | One check with a name the learner reads: an input, an expected output, and optional follow-up code. |
| Run | Execute the code and show its output. Never grades. |
| Check | Run the lesson's test cases against the code. |
| Completion | The record that a learner passed a lesson. Recorded once per learner and lesson. |
| Saved code | A learner's code for a lesson, kept on their device as they type. |
| Guest | A visitor without an account. Progress lives in the browser. |
| Admin | The owner, signed in and past the second sign-in step. |
| Draft, Published, Archived | The three states of a course or lesson. Only published ones are visible to learners. |
| Validate | Run the solution, the starter, and the wrong answers against the test cases in the dashboard. |
| Publish | Make a validated lesson visible to learners. |
| XP | Sum of the XP values of a learner's completed lessons. Always derived. |
| Streak | Count of consecutive local calendar days with at least one completion. |
| Runtime | The in-browser engine that executes Python: Pyodide in a worker. |
| Harness | The trusted Python code that runs test cases inside the runtime. |
| Work package (WP) | The unit of delivery: one branch, one pull request. |
| Day check | The end-of-day review of what merged against the day's exit line. |

## 11. Document map

| Document | Answers |
|---|---|
| `01-requirements.md` | What must the product do, and how well |
| `02-architecture.md` | How it is built and why |
| `03-experience.md` | How it looks, reads, and behaves; input for `DESIGN.md` |
| `04-content-system.md` | How lessons and test cases are modeled, validated, and published |
| `05-engineering-handbook.md` | How we work: process, standards, testing, checks |
| `06-security-privacy.md` | What can go wrong and what stops it |
| `07-operations.md` | Environments, pipeline, monitoring, recovery, cost |
| `08-delivery-plan.md` | The eight days, work packages, risks, launch |
| `09-evidence.md` | Facts and prototype results this plan rests on |
| `docs/adr/` | One file per architectural decision |
| `docs/later/` | The archived ten-phase plan. Not in force. |

## 12. Change control

The spec is versioned with the code. A change to any file in `docs/spec/` or to a decision in `docs/adr/` goes through a pull request labeled `spec-change`, states which requirement IDs it touches, and is approved by the owner. The implementer proposes changes; it never edits the spec to make a failing check pass.
