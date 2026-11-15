> Archived. Not in force. This file belongs to the original ten-phase plan and is kept for work after the first release. Do not build from it unless the owner says so. The plan in force is in `docs/spec/`.

# 00 Project Charter

Status: Proposed. Becomes Accepted at Gate 0 (see `08-delivery-plan.md`).
Owner: Fahad (product owner and sole approver).
Last verified against external facts: 2026-11-13 (see `09-evidence.md`).

## 1. Purpose

Heap Academy is the coding practice platform of Heap, a tech education brand. A learner opens a course, reads a short lesson on the left, writes real code on the right, runs it, and checks it against visible test cases. Everything executes in the learner's browser.

This charter fixes what version 1.0 is, what it is not, who decides, and what we assume. Every other document in `docs/spec/` derives from it.

## 2. Problem

Short videos create interest in programming but give the viewer nothing to do next. The reference product the owner studied has a game theme that is not Heap's, marks six of the eight chapters of its Python course as paid, and on the day it was examined accepted a wrong answer on one exercise (see `09-evidence.md` E-12). Heap needs its own place where a viewer can go from a video to writing working code within a minute, and where a pass means the code is right.

## 3. Goals for 1.0

| ID | Goal | How we will know |
|---|---|---|
| G-1 | A first-time visitor on a phone can run real Python without an account. | Journey J-1 passes on the device matrix; time from landing to first successful Run is tracked. |
| G-2 | A pass is trustworthy. | Every published lesson rejects at least one known-wrong answer in CI; grader parity between CI and browsers. |
| G-3 | Progress is never lost. | Guest progress survives reloads; account progress survives devices; no completion is dropped (NFR-REL-01). |
| G-4 | The product reads as designed, not generated. | antislop Delivery Gate passes on every screen; owner signs `DESIGN.md`. |
| G-5 | The owner can add a lesson in under 30 minutes without touching application code. | Authoring guide plus `content:new` and `content:check`; timed during Phase 4. |
| G-6 | Running cost stays near zero per learner. | No server-side code execution; cost guardrails in `07-operations.md`. |
| G-7 | Paid content can be switched on later without a rewrite. | Access policy seam and leak test pass in tiered mode on staging (Phase 7). |

## 4. Non-goals for 1.0

These are deliberate. Each has a reason and a trigger for revisiting.

| Not doing | Why | Revisit when |
|---|---|---|
| Server-side code execution, competitions, certificates | Needs a judging service and a trust model that client-side grading cannot give (ADR-0007). | Monthly competitions are scheduled. |
| Payments inside the platform | Membership is sold through the Skool community. | Skool stops being the paywall. |
| Admin or authoring UI | Content lives in files reviewed through pull requests (ADR-0008). | A non-technical teacher needs to publish. |
| AI tutor or chat | Cost per learner and safety review are out of scope. | Budget and a moderation plan exist. |
| Languages beyond Python and HTML and CSS | Each language is a runner plus a course. | JavaScript course is commissioned. |
| Arabic interface | Owner decision. Seams are enforced so it is an addition, not a rewrite (ADR-0016). | Owner asks for it. |
| Light theme | One theme done well beats two half-tested (ADR-0015). | Learner feedback or accessibility need. |
| Leaderboards, badges, levels | XP and streak are enough to start; rankings invite cheating under client-side grading. | Verified grading exists. |
| Native mobile apps, offline mode | The web app must first prove retention. | Field data shows repeat mobile use. |
| Infrastructure as code tooling beyond native config files | One operator, three vendors. Config lives in versioned files and a verified checklist. | A second operator joins. |

## 5. Scope summary

In scope for 1.0, by MoSCoW priority. Detailed requirements are in `01-requirements.md`.

- **Must**: landing page with a live editor, course catalog, course page, lesson workspace (instructions, editor, console or preview, tests), Python and HTML and CSS runners, guest progress, accounts (Google and email code), synced progress, XP, streak, profile, account deletion and export, content pipeline and CLI, access policy seam (open at launch), observability, security baseline, accessibility to WCAG 2.2 AA, legal pages.
- **Should**: solution reveal, lesson feedback, resume row, live preview for web lessons, structured data and share images, entitlement script for the future paid tier.
- **Could**: editor preference sync, quick-check quizzes, entitlement webhook.
- **Won't (this release)**: everything in section 4.

## 6. Roles

| Role | Who | Responsibilities |
|---|---|---|
| Product owner and approver | Fahad | Approves gates, `DESIGN.md`, lesson content, pull requests, and launch. Owns accounts, secrets, domains, legal sign-off, real-device testing. |
| Implementer | Claude Code (main session) | Plans and builds one work package at a time under `05-engineering-handbook.md`. Never merges its own work. |
| Independent reviewers | Claude Code subagents in `.claude/agents/` | Review with a fresh context. Read-only. Report findings; do not fix. |
| Legal reviewer | A qualified person the owner chooses | Reviews privacy policy and terms before launch. |

Decision rights: the owner decides product, design, content, budget, and risk acceptance. The implementer decides implementation details inside accepted ADRs. A change to an accepted ADR needs the owner.

## 7. Constraints

- **People**: one owner with limited review time. Work is sliced so that each pull request can be reviewed in about fifteen minutes.
- **Budget**: prefer free or low tiers. Known unavoidable costs are listed in `07-operations.md` section 9.
- **Repository**: private, because it holds solutions and (later) paid lessons.
- **Brand**: Heap identity from the owner's brand kit in `/brand`. No brand asset is generated by the implementer (antislop R-23).
- **Audience**: Arabic-speaking learners in the Gulf, arriving mostly on phones from TikTok and Instagram. Examples and imagery must suit that audience (see `04-content-system.md` section 8).
- **Honesty**: no invented numbers, testimonials, or claims anywhere in the product (antislop R-17, R-18, R-36, R-38).

## 8. Assumptions

Each assumption is a decision made on the owner's behalf. The owner confirms or changes them in WP-0.3. Changing one may change the plan.

| ID | Assumption | If wrong |
|---|---|---|
| A-01 | Launch courses are Python and HTML and CSS; interface and lessons are in English. | Languages: add a runner and course. Arabic: activate ADR-0016 seams. |
| A-02 | Access is open at launch: every lesson is free and usable without an account. | Switch `ACCESS_MODE` to `tiered` after Phase 7. |
| A-03 | Sign-in methods are Google and a six-digit email code. No passwords. | Change ADR-0017. |
| A-04 | Hosting is Vercel (paid Pro plan, since the free plan excludes commercial use) and Supabase. | Change ADR-0002 or ADR-0009. |
| A-05 | The owner has, or will buy, a domain. | The Vercel default domain is used until then; auth redirect URLs must be updated later. |
| A-06 | The brand kit (logo, mark, mascot, colors, fonts, brand book) will be placed in `/brand` before WP-0.4. | Phase 3 cannot start. |
| A-07 | Lesson text is drafted by the implementer and approved by the owner. | The owner writes it; the content track slows the launch. |
| A-08 | The first chapter lesson of every chapter is open so experienced learners can jump ahead; lessons inside a chapter unlock in order. | Set the course `unlock` policy to `linear`. |
| A-09 | Revealing a solution still allows completion and XP, and is recorded as assisted. | Change FR-WSP-14. |
| A-10 | The community link in the Help area points to the Skool community. | Set `NEXT_PUBLIC_COMMUNITY_URL` or remove the link. |
| A-11 | Minimum age is 13; under 18 with guardian consent. This is a placeholder until legal review. | Legal reviewer sets the rule. |
| A-12 | A course keeps one URL per lesson for its lifetime; renames redirect. | Nothing; this is enforced. |

## 9. Success measures

These are measured, not promised. Targets marked proposed are set from field data two weeks after launch and recorded in an ADR.

| Measure | Definition | Target |
|---|---|---|
| Activation | Sessions that reach a first successful Run, divided by sessions that open a lesson | Proposed |
| First lesson completion | Sessions that pass lesson 1, divided by sessions that open it | Proposed |
| Time to first Run | Median seconds from lesson open to first Run result, cold cache, mobile | Proposed |
| Return rate | Learners active on day 7 after first completion | Proposed |
| Runtime reliability | Successful runtime loads divided by attempts | 99 percent or better |
| Grader trust | Lesson feedback reports of type "my correct answer failed" or "wrong answer passed" per 1,000 completions | Tracked from launch |

## 10. Glossary

Use these words in code, copy, and documents. Do not introduce synonyms.

| Term | Meaning |
|---|---|
| Course | An ordered set of chapters about one subject. |
| Chapter | An ordered set of lessons inside a course. |
| Lesson | One screen of work: instructions plus an editor plus tests. Kinds: `guided`, `challenge`, `build`. |
| Guided lesson | Teaches one idea, then asks for a small task. |
| Challenge | A problem statement with tests and no teaching. Unlocks after the chapter's guided lessons. |
| Build | The chapter's closing lesson: the learner assembles a small program alone. |
| Run | Execute the code and show its output. Never grades. |
| Check | Run the lesson's tests against the code. One Check is one attempt. |
| Test case | One assertion with a learner-facing name, shown in the Tests panel. |
| Completion | The record that a learner passed a lesson. Recorded once per learner and lesson. |
| Assisted | A completion made after the solution was revealed. |
| Draft | The learner's saved code for a lesson. |
| Guest | A visitor without an account. Progress lives in the browser. |
| Tier | `guest`, `free`, or `paid`. A lesson's access level is `free` or `paid`. |
| XP | Sum of the XP values of a learner's completed lessons. Always derived. |
| Streak | Count of consecutive local calendar days with at least one completion. |
| Runtime | The in-browser engine that executes code: the Python worker or the web sandbox. |
| Harness | The trusted code that runs tests inside a runtime. |
| Work package (WP) | The unit of delivery: one issue, one branch, one pull request. |
| Gate | A phase exit review the owner must approve. |

## 11. Document map

| Document | Answers |
|---|---|
| `01-requirements.md` | What must the product do, and how well |
| `02-architecture.md` | How it is built and why |
| `03-experience.md` | How it looks, reads, and behaves; input for `DESIGN.md` |
| `04-content-system.md` | How lessons and tests are written, checked, and published |
| `05-engineering-handbook.md` | How we work: process, standards, testing, gates |
| `06-security-privacy.md` | What can go wrong and what stops it |
| `07-operations.md` | Environments, pipelines, monitoring, recovery, cost |
| `08-delivery-plan.md` | Phases, work packages, exit criteria, risks, launch |
| `09-evidence.md` | Facts and prototype results this plan rests on |
| `docs/adr/` | One file per architectural decision |

## 12. Change control

The spec is versioned with the code. A change to any file in `docs/spec/` or an accepted ADR goes through a pull request labeled `spec-change`, states which requirement IDs it touches, and is approved by the owner. The implementer proposes changes; it never edits the spec to make a failing check pass.
