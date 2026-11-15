# ADR-0008: Content as files with stable IDs and a synced catalog

- Status: Superseded by ADR-0024
- Decision due: not applicable.
- Date proposed: 2026-11-13
- Decider: the owner
- Relates to: FR-PRG-07. The content requirements it served are in `docs/later/full-plan/`.

## Context

Lessons include code, tests, and wrong answers that must be executed to be trusted. They need review, history, and rollback. Progress must survive every edit.

## Decision

Lessons are files in the repository, validated by schemas, reviewed in pull requests, and checked in CI. Every course, chapter, and lesson has an immutable ID in an append-only registry. A build manifest is the single source for routes, order, XP, and access; the database catalog is a projection written by an idempotent sync.

## Consequences

- Gain: Every lesson is proven solvable before it ships.
- Gain: Review, history, and rollback come from Git.
- Gain: Renames and edits never orphan progress.
- Cost: Authors need to work in a repository.
- Cost: Publishing means a deploy.

## Alternatives considered

- **A hosted content management system.** Another vendor, weaker review, and lessons could not be executed in CI.
- **Lessons in the database with an admin interface.** A second product to build.

## Evidence

E-06. See `docs/spec/09-evidence.md`.

## Revisit when

A non-technical author needs to publish.
