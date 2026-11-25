# WP-3.4 code review 2 (condensed)

Reviewer: code-reviewer, of a884853. Verdict: APPROVE. Every round 1 finding fixed or answered.

- MINOR: `deploy.yml`'s `find .vercel/output -path '*/dev/*'` also matches Next.js's own traced `dev` folders if they are ever copied into a function. Fixed: only `.vercel/output/functions/dev` and `.vercel/output/static/dev` are checked.
- MINOR: nothing tested that `dispatchEvent` stores the state before the effects run (the mutant survived). Fixed: a check that asks for a new worker, with the committed states recorded; the mutant now fails.
- MINOR: ADR-0034's Context left out a second way to compute during an honest wait (a callback queued with `js.setTimeout`). Fixed.
- Mutants: 6 of 7 killed at a884853; the seventh is killed by the new test.

Ran: `pnpm verify` (1065 tests), 7 mutants. Not run: e2e, `vercel build`, the phone check.
