# ADR-0024: Lessons live in the database and are written in an admin dashboard

- Status: Proposed
- Decision due: Day 1 (WP-1.1).
- Date proposed: 2026-11-15
- Decider: the owner
- Relates to: G-5, FR-ADM-03 to FR-ADM-11, FR-ADM-14, FR-PRG-07; supersedes ADR-0008

## Context

ADR-0008 kept lessons as files reviewed in pull requests. Its own "revisit when" was "a non-technical author needs to publish". The owner now wants to write and publish lessons himself, on the day, without a deploy.

## Decision

Courses, chapters, lessons, and test cases are rows in Postgres. The owner creates and edits them in a dashboard under `/admin`. Solutions and wrong answers live in a separate table that only the admin can read. Publishing is a status change in the database, and learners see it within a minute through cache invalidation. Lesson IDs are UUIDs that never change, so progress survives every edit.

## Consequences

- Gain: A lesson goes from idea to live in minutes.
- Gain: No deploy, no pull request, no repository knowledge needed to author.
- Cost: A second product to build and secure: the dashboard.
- Cost: Lessons are not in Git. History and rollback of lesson text come from database backups and, when built, from export files.
- Cost: Lessons cannot be executed in CI before publishing. Validation runs in the owner's browser instead (ADR-0026).

## Alternatives considered

- **Files in the repository (ADR-0008).** Stronger review and history; every lesson needs a pull request and a deploy.
- **A hosted content management system.** Another vendor, and it cannot run a solution against test cases.

## Evidence

None needed.

## Revisit when

Lesson history or review by a second person becomes important.
