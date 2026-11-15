# Architecture decision records

One file per decision. Numbered in order. Never renumbered.

- **Proposed**: written, waiting for the owner. The owner decides every proposed record on Day 1 (WP-1.1).
- **Accepted**: the owner agreed. The text is frozen. Code must follow it.
- **Superseded**: replaced by a later record, which it names. Kept for history.
- **Deferred**: belongs to something that waits. Not in force for the first release.

Records 0001 to 0021 come from the original ten-phase plan. Records 0022 to 0028 reshape it for the eight-day first release.

To change an accepted decision, write a new ADR that supersedes it. Do not edit the old one beyond its status line. Use `/adr "Title"` to start from the template.

The index with one-line summaries and the state of each record is in `docs/spec/02-architecture.md` section 15.
