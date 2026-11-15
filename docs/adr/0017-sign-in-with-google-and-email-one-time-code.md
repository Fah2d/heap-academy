# ADR-0017: Sign-in with Google and email one-time code

- Status: Proposed
- Decision due: Day 1 (WP-1.1). Confirmed by evidence in WP-2.2.
- Date proposed: 2026-11-13
- Decider: the owner
- Relates to: FR-AUTH-01 to FR-AUTH-07, T-11

## Context

Most first visits happen inside the TikTok and Instagram in-app browsers, where Google refuses to sign users in. Links sent by email open in a different browser than the one the learner is using there.

## Decision

Google by redirect, and a six-digit code sent by email that is typed into the same tab. No passwords. A custom email sender, a bot challenge on code requests, and provider rate limits are required before launch.

## Consequences

- Gain: Works inside in-app browsers.
- Gain: No password storage or reset flow.
- Cost: Needs an email provider with enough daily volume.
- Cost: Two flows to maintain.

## Alternatives considered

- **Email links.** Complete in the wrong browser when opened from an in-app browser.
- **Passwords.** Support and security burden.
- **Apple sign-in.** Needs a paid developer membership; worth revisiting for an iPhone-heavy audience.
- **Codes by text message.** Cost per message and more personal data.

## Evidence

E-09, E-10, E-11. See `docs/spec/09-evidence.md`.

## Revisit when

Sign-in completion rates by method after launch.
