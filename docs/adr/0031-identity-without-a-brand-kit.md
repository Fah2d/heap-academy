# ADR-0031: Identity without a brand kit

- Status: Accepted (owner, WP-1.1, 2026-11-15)
- Decision due: Day 1 (WP-1.1).
- Date proposed: 2026-11-15
- Decider: the owner
- Relates to: A-06, G-4, FR-SYS-01; ADR-0014, ADR-0015

## Context

The plan assumed a brand kit in `/brand`: a logo, a seven-block mark, a mascot, the Handjet font, and a brand book (A-06). There is none, and none is coming. The implementer may not create brand assets (`CLAUDE.md` rule 6). The owner wants a formal, clean, professional look that does not have to follow the style of Heap's videos.

## Decision

- The wordmark is the live text "Heap Academy" in IBM Plex Sans. There is no logo, mark, or mascot.
- There is no illustration anywhere in the product. Empty states, the completion moment, and the not-found page are text and actions.
- The seven-block progress glyph of `03-experience.md` section 10.6 is dropped.
- Fonts: IBM Plex Sans and IBM Plex Mono, self-hosted, under the SIL Open Font License. Handjet is not used.
- Icons: IBM Carbon icons, under the Apache License 2.0, imported one by one.
- Accent: amber `#D4A017`, kept from Heap's videos. CRT effects and burgundy are not used.
- `DESIGN.md` holds every value. Nothing in the product waits on `/brand`.

## Consequences

- Gain: Interface work can start on Day 1 with no missing files.
- Gain: Every font and icon is openly licensed for commercial self-hosting.
- Cost: The site has no graphic identity mark. Recognition rests on the wordmark, the type, and the amber accent.
- Cost: There is no favicon until the owner supplies one.

## Alternatives considered

- **Wait for a brand kit.** None is coming.
- **Have the implementer draw a mark.** Not allowed by `CLAUDE.md` rule 6.

## Evidence

None needed. This is a design decision by the owner.

## Revisit when

The owner supplies a logo, mark, or favicon.
