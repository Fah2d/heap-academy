---
name: adr
description: Record an architectural decision as a new ADR, or supersede an existing one. Use when a change makes or alters a decision about structure, technology, security, data, or a quality threshold.
argument-hint: "\"Title of the decision\""
---

Write a new ADR titled **$ARGUMENTS**.

1. Take the next number: the highest in `docs/adr/` plus one. Never reuse or renumber.
2. Copy `docs/adr/0000-template.md` to `docs/adr/NNNN-<slug>.md`, with the slug made from the title in lowercase with hyphens.
3. Fill every section:
   - Status: Proposed. Decision due: the day or work package where the owner decides. Relates to: requirement IDs, threats, and other ADRs.
   - Context: the forces, with evidence from `docs/spec/09-evidence.md` or new sources cited with the date checked.
   - Decision: what we will do, stated so that code can be checked against it.
   - Consequences: the gains and the costs, honestly.
   - Alternatives considered: at least two real ones, each with the reason it lost.
   - Revisit when: a concrete trigger, not "if needed".
4. If it replaces an earlier ADR, set that ADR's status line to "Superseded by ADR-NNNN" and change nothing else in it.
5. Add the record to the index in `docs/spec/02-architecture.md` section 15, and update any spec text the decision changes, in the same pull request.
6. Open a pull request labeled `spec-change`. The owner decides. Do not build on a Proposed ADR unless the owner says so.
