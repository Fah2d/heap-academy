**Part 5 of WP-7.3.** The missing free-tier trigger for the firewall's rate-limit rule, which NFR-COST-02 asks for. Documents only. Same branch as parts 1 to 4 (`wp/7.3-operations`), up to date with `main` at 7875ee2.

## What and why

NFR-COST-02 says every free-tier limit has a trigger in ADR-0029. Part 4 listed one limit without a row: the 1,000,000 allowed requests of the one rate-limit rule of a Hobby project (E-23). This part adds it at half the free amount, like decision D's other rows.

Checking the current Vercel pages for the row (CLAUDE.md rule 13) found that `07-operations.md` section 7 says "a month", which Vercel does not state. The text now says so.

## Work package

- Work package: WP-7.3 Operations, part 5.
- Requirements covered: NFR-COST-02.
- Spec and ADR changes on this branch (label `spec-change`): ADR-0029, E-23, `07-operations.md` section 7.
- Time box 2.5 hours for the whole package. Part 5 from about 15:20 to about 15:25 on 2026-11-24.

## What changed

| Item | Where |
|---|---|
| The Vercel trigger row adds "1,000,000 allowed requests of the firewall's rate-limit rule", and an amendment note says the period and the effect of using it up are not stated by Vercel. | `docs/adr/0029-zero-cost-hosting-on-free-tiers.md` |
| E-23 gains a bullet from the pages read again on 2026-11-24, with quotes and the pages' `last_updated` dates. | `docs/spec/09-evidence.md` |
| Section 7 no longer says the amount is monthly; it says the period is not stated and that ADR-0029 reads it as a month. | `docs/spec/07-operations.md` |
| The usage runbook's table gains the rate-limit row, and the morning check names the figure, with where to read it marked not verified. | `docs/runbooks/usage-spike-or-free-tier-limit.md` |

## How it was verified

- `npm_config_verify_deps_before_run=false pnpm verify`: exit 0, `Test Files  34 passed (34)`, `Tests  746 passed (746)`. pnpm printed `ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK` for its pre-run install; nothing was installed.
- The Vercel pages were read on 2026-11-24: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting and https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing.
- **Not verified**: where Vercel shows the rule's allowed requests, and what stops when they are used up. No rule exists until WP-7.1.

## Reviews

No reviewer asked: no code, screen, style or product text changed, and the change follows decision D's pattern. The owner reads the amendment as part of the `spec-change` review.

## Owner actions now due

1. Approve or change decision N below. Until then the ADR-0029 note says it awaits approval.
2. The owner actions of parts 1 to 4 are still due. When opening or updating the pull request, add this file to the body:

```sh
cat docs/reports/pull-requests/WP-7.3-part-{1,2,3,4,5}.md > "$TMPDIR/wp-7.3.md"
gh pr create --draft --base main --head wp/7.3-operations --label spec-change \
  --title "feat(system): WP-7.3 client error report, backup role and operations runbooks" \
  --body-file "$TMPDIR/wp-7.3.md"
```

If it is already open: `gh pr edit wp/7.3-operations --add-label spec-change --body-file "$TMPDIR/wp-7.3.md"`.

## Decisions taken by default

- **N. The rate-limit trigger is 500,000 allowed requests, read as a month, and its action is the Vercel row's (move to Vercel Pro).** Half of the free amount, like every other row of decision D. Vercel does not state the period, so a month is assumed, like the other Hobby figures; if the period is shorter the trigger fires later than it should. The runbook plans for the rule to stop limiting when the amount is used up, which leaves only the per-action Postgres limits; that is the safe reading of an unstated effect. Alternative: no trigger until WP-7.1 measures real counts, which leaves NFR-COST-02 unmet at launch.

## Deviations from the plan or the spec

- None in this part. Analytics (decision C) and the Deploy patch (decision E) still wait for the owner, as in part 4.

## Risks and rollback

Documents only. Rollback: revert the part 5 commit.
