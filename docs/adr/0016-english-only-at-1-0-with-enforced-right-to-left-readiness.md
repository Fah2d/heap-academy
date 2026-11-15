# ADR-0016: English only at 1.0 with enforced right-to-left readiness

- Status: Accepted (owner, WP-1.1, 2026-11-15). Reduced for the first release by ADR-0022.
- Decision due: Day 1 (WP-1.1).
- Date proposed: 2026-11-13
- Decider: the owner
- Relates to: NFR-I18N-01 to NFR-I18N-03

## Context

The owner chose an English interface. The audience speaks Arabic, so an Arabic interface is a likely later request. Retrofitting direction and strings into a finished app touches every component.

## Decision

One locale. All copy in message modules under `src/messages`. Logical CSS properties only. Document language and direction from one configuration value. Code is always left to right. All of this is lint-enforced. An internationalization library and locale routing are added when a second language is commissioned (ADR-0022).

## Consequences

- Gain: Arabic later is translation and verification, not a refactor.
- Gain: English URLs will not change when a second locale arrives.
- Cost: A small cost now for something that may not be needed.

## Alternatives considered

- **Ignore it.** A rewrite of layout and strings later.
- **Build Arabic now.** The owner chose not to.

## Evidence

None needed.

## Revisit when

The owner asks for Arabic, or rules it out for good, in which case the routing can be simplified.
