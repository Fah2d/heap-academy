**Part 1 of WP-6.1.** The pure merge only. Branched from `main`; it does not depend on WP-3.x.

## What and why

The progress merge of FR-PRG-03 and ADR-0011, as pure functions in `src/domain`, with property tests. Architecture section 10 asks for a merge that is property-tested for idempotence and commutativity; FR-PRG-03's acceptance line is "Merging twice changes nothing".

## Work package

- Work package: WP-6.1 Synced progress, part 1.
- Requirements covered: FR-PRG-03 (merge, idempotent), and the pure parts of FR-PRG-02 and FR-PRG-06.
- Time box 3 hours for the whole package. Part 1 took from 07:29 to 07:31 on 2026-11-20, plus the description and review.

## What changed

| Item | Where |
|---|---|
| `LessonId`, a branded lower-case UUID, and `parseLessonId`. | `src/domain/ids.ts` |
| `applyAccount(device, account)`, the merge of device and account: once the server has answered a sync with the account's full list, the account's completion stands for each lesson it has, marked synced; the device's unsynced completions for other lessons stay, unsynced. A synced entry the account lacks was stored by another account on this device, so it is dropped and never sent. Applying the same list again changes nothing. | `src/domain/progress.ts` |
| `mergeCompletions(...lists)`: one completion per lesson from lists of one source, the first of each (the earlier time, then the smaller code), in lesson order. Idempotent, commutative and associative. A time that is not a finite number is left out. | `src/domain/progress.ts` |
| `unsynced(device)`: what the next sync sends. | `src/domain/progress.ts` |
| The seeded property testing helper, the same file as on `wp/3.3-grader`. | `scripts/testing/property.ts` |

## How it was verified

`pnpm verify` at the docs commit:

```
 Test Files  10 passed (10)
      Tests  397 passed (397)
```

with the domain rows:

```
 src/domain        |     100 |    94.44 |     100 |     100 |
  progress.ts      |     100 |    92.85 |     100 |     100 | 44
```

Line 44 is the comparator's "equal" branch; the lesson IDs it compares are always distinct. pnpm's own install check failed on the sandbox's store lock (`ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK`) and the run went on with the installed `node_modules`, which are WP-3.1's (one dependency more than `main`).

**Tests added**, each title carrying its requirement, property tests over 500 seeded cases each:

- `src/domain/progress.test.ts`: merging twice changes nothing; the order of the lists does not matter; merging in steps equals merging at once; nothing duplicated or lost; each lesson keeps its first completion, one of the inputs; the tie rule; a time that is not a finite number is left out; lesson order and no extra fields. Applying the account list twice changes nothing; the account's completions stand, synced, and the device's unsynced others wait, in lesson order; another account's stored completion is neither kept nor sent; a completion the server has not stored is sent again; an account completion replaces the device's, even an earlier one; `unsynced`.
- `src/domain/ids.test.ts`: a lower-case UUID and nothing else.

## Screens

None.

## Reviews

- Code review 1 (`docs/reports/reviews/WP-6.1-part-1/code-review-1.md`, which covers all three part-1 branches), of 75b0bb5: CHANGES REQUIRED, with 2 majors and 3 minors. All fixed except MAJOR 2, which is an owner decision. The response is at the end of the file.
- Three mutants (the sort, the sync flag, the finite check) each fail a test.
- The fixes were not reviewed again.

## Owner actions now due

1. Decide the rule in the first deviation below. Recommended: a `spec-change` that makes architecture section 10 say what commutativity covers (the set of lessons), with the stored row winning a conflict.
2. Decide what the device store does at sign-out (cleared, or kept per account). FR-AUTH-05 says only that the session ends. Until this is decided, an unsynced completion made while one account was signed in looks like a guest's to the next account.

## Deviations from the plan or the spec

- **Two rules.** Section 10 has the server insert "do nothing on conflict", so the account keeps its first stored row, which may be later than a guest's offline completion. No rule that keeps the stored row can be commutative in the completions, as section 10 asks. `applyAccount` is the merge of device and account and follows the database, so two devices show the same thing (J-6). `mergeCompletions`, the commutative one, is limited to lists from one source.

## What is left for part 2

`recordCompletion` and `mergeProgress` server actions; the device store (IndexedDB with the memory fallback); sync on sign-in, on load and when the tab becomes visible; progress rendered on the server; the unsynced state in the interface; policy tests for `completions`; J-5 and J-6.

## Risks and rollback

Nothing calls these functions yet.

## Definition of Done

- [ ] Every "Done when" line is met. **Not met:** J-5, J-6, retry until stored, refusal of another user's or an unpublished lesson's completion are part 2.
- [x] FR-PRG-03 has a passing test that names its ID.
- [x] `pnpm verify` passes.
- [x] No stub, dead control, placeholder, or invented number.
- [x] No new tables. No new server actions.
- [ ] Every reviewer blocker is fixed. See Reviews.
- [x] No AI attribution in any commit or in this description.

## Opening this pull request

`gh` cannot reach GitHub from the sandbox. From your terminal in the repository root:

```sh
gh pr create --draft --base main --head wp/6.1-merge-part-1 \
  --title "feat(domain): WP-6.1 part 1 the progress merge" \
  --body-file docs/reports/pull-requests/WP-6.1-part-1.md
```
